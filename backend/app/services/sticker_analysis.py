"""表情包：拉取对象后调用多模态 LLM 写入 media_assets.extras。"""

from __future__ import annotations

import base64
import json
import logging
import re
from datetime import datetime, timezone
from typing import Any

from minio import Minio

from app.core.config import get_settings
from app.services.llm_service import LLMService

logger = logging.getLogger(__name__)
settings = get_settings()


def _minio_internal() -> Minio:
    return Minio(
        settings.minio_endpoint,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=settings.minio_secure,
    )


def _parse_payload_from_llm(text: str) -> dict[str, Any]:
    raw = text.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```\w*\s*", "", raw)
        raw = re.sub(r"\s*```\s*$", "", raw)
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        m = re.search(r"\{[\s\S]*\}", text)
        if not m:
            raise
        data = json.loads(m.group(0))
    if not isinstance(data, dict):
        raise ValueError("期望 JSON 对象")
    return data


async def analyze_sticker_object(*, bucket: str, object_key: str, content_type: str, llm: LLMService | None = None) -> dict[str, Any]:
    """读取 MinIO 对象，调用模型，返回要合并进 extras 的字典。"""
    client = _minio_internal()
    try:
        obj = client.get_object(bucket, object_key)
        try:
            image_bytes = obj.read()
        finally:
            obj.close()
            obj.release_conn()
    except Exception as exc:
        logger.warning("读取表情包对象失败 %s/%s: %s", bucket, object_key, exc)
        return {"sticker_analyze_error": str(exc)[:400]}

    mime = (content_type or "image/png").split(";")[0].strip().lower()
    if not mime.startswith("image/"):
        return {"sticker_analyze_error": "非图片类型，跳过视觉模型"}

    b64 = base64.standard_b64encode(image_bytes).decode("ascii")
    svc = llm or LLMService()
    usage_out: dict = {}
    try:
        text = await svc.classify_sticker_multimodal(b64, mime, usage_out=usage_out)
    except Exception as exc:
        logger.warning("表情包 LLM 失败: %s", exc)
        return {"sticker_analyze_error": str(exc)[:400]}

    text = svc._filter_thinking_content(text.strip())  # noqa: SLF001
    try:
        payload = _parse_payload_from_llm(text)
    except (json.JSONDecodeError, ValueError) as exc:
        return {"sticker_analyze_error": f"解析模型输出失败: {exc}"}

    tags = payload.get("tags")
    if not isinstance(tags, list):
        tags = []
    tags = [str(t).strip() for t in tags if str(t).strip()][:16]
    tone = payload.get("tone")
    tone_s = str(tone).strip()[:200] if tone is not None else ""
    nsfw = bool(payload.get("nsfw_hint"))
    out: dict[str, Any] = {
        "sticker_tags": tags,
        "sticker_tone": tone_s,
        "sticker_nsfw_hint": nsfw,
        "sticker_analyzed_at": datetime.now(timezone.utc).isoformat(),
    }
    if usage_out:
        out["sticker_llm_usage"] = {
            k: usage_out[k] for k in ("model", "prompt_tokens", "completion_tokens", "total_tokens") if k in usage_out
        }
    return out
