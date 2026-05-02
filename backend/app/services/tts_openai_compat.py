"""OpenAI Chat 兼容网关上的语音合成：`POST .../audio/speech` —— 多厂商可走同路径，字段以控制台为准。"""

from __future__ import annotations

from typing import Any

import httpx


async def synthesize_openai_compat_speech(
    *,
    base_url: str,
    api_key: str | None,
    model: str,
    input_text: str,
    payload_extra: dict[str, Any] | None = None,
    timeout_sec: float = 120.0,
) -> bytes:
    """返回 MP3 binary（假定 response_format=mp3/openai 默认）"""
    root = base_url.strip().rstrip("/")
    url = f"{root}/audio/speech"
    headers: dict[str, str] = {"Content-Type": "application/json"}
    key = (api_key or "").strip()
    if key:
        headers["Authorization"] = f"Bearer {key}"
    body: dict[str, Any] = {
        "model": model.strip(),
        "input": input_text.strip()[:2000],
        "response_format": "mp3",
    }
    if payload_extra:
        body.update(payload_extra)
    async with httpx.AsyncClient(timeout=timeout_sec) as client:
        resp = await client.post(url, headers=headers, json=body)
        if resp.status_code >= 400:
            detail = (resp.text or "")[:1500]
            raise RuntimeError(f"TTS HTTP {resp.status_code}: {detail}")
        data = resp.content
        if not data:
            raise RuntimeError("TTS 返回空 body")
        return data
