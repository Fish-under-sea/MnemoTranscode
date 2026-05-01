"""聊天记录导入：在规则分段基础上分批经 LLM 提炼为记忆条目（对齐对话提炼的 JSON 协议)。"""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.mnemo.chain_enricher import enrich_after_memories_created
from app.models.memory import Memory
from app.mnemo.sync_memories import ensure_memory_engram
from app.schemas.client_llm import ClientLlmOverride
from app.services.chat_import_parser import ChatMemoryDraft, parse_chat_import
from app.services.llm_service import LLMService
from app.core.config import get_settings

logger = logging.getLogger(__name__)


class ChatImportLLMError(RuntimeError):
    """开启 AI 精炼时，LLM 不可用或输出无效，禁止静默降级。"""


def _short_exc(exc: BaseException, max_len: int = 400) -> str:
    s = str(exc).strip()
    if len(s) <= max_len:
        return s
    return s[: max_len - 1] + "…"

# 单批送入 LLM 的原文上限（字符），避免爆上下文
_BATCH_CHAR_TARGET = 12_000
# 单批原始片段条数上限（与字符上限同时生效），避免百余条挤在一次调用里导致 JSON 失败
_MAX_SEGMENTS_PER_REFINE_BATCH = 18
# 与 memory.import_chat_log 对齐
_MAX_DRAFTS = 500
_VECTOR_DEFER_THRESHOLD = 72


def _batch_drafts(drafts: list[ChatMemoryDraft]) -> list[list[ChatMemoryDraft]]:
    batches: list[list[ChatMemoryDraft]] = []
    cur: list[ChatMemoryDraft] = []
    size = 0
    for d in drafts:
        piece = len(d.content_text) + 8
        over_chars = cur and size + piece > _BATCH_CHAR_TARGET
        over_count = cur and len(cur) >= _MAX_SEGMENTS_PER_REFINE_BATCH
        if over_chars or over_count:
            batches.append(cur)
            cur = []
            size = 0
        cur.append(d)
        size += piece
    if cur:
        batches.append(cur)
    return batches


def _ensure_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _batch_default_ts(batch: list[ChatMemoryDraft]) -> datetime:
    for d in batch:
        if d.occurred_at:
            return d.occurred_at
    return datetime.now(timezone.utc)


async def _llm_refine_batch(batch: list[ChatMemoryDraft], llm: LLMService) -> list[dict[str, Any]]:
    """返回 {title, content_text, emotion_label?, occurred_at?} 列表；失败则抛出 ChatImportLLMError。"""
    n = len(batch)
    # 动态条数上限：小批可多合并，大批至少允许覆盖半批左右的独立记忆
    max_out = min(48, max(6, (n + 1) // 2))

    parts: list[str] = []
    for i, d in enumerate(batch, 1):
        head = f"【片段{i}】"
        if d.occurred_at:
            head += f" 时间约 {d.occurred_at.isoformat()}"
        if d.speaker_hint:
            head += f" 说话者提示:{d.speaker_hint}"
        parts.append(f"{head}\n{d.content_text.strip()}")
    transcript = "\n\n---\n\n".join(parts)
    if len(transcript) > 48_000:
        transcript = transcript[:48_000] + "\n…(截断)"

    prompt = f"""你是关系档案助手。用户从微信/QQ 等导出了下列**同一批**聊天记录片段（含时间与说话者标记）。
请提炼为 1～{max_out} 条**可独立保存的记忆**（具体事件、约定、情感时刻、分歧与和解等），输出 **仅 JSON**：
{{
  "memories": [
    {{"title": "短语标题", "content_text": "第三人称客观叙述，可含时间地点", "emotion_label": "温暖|感伤|快乐|平静|自豪|感激|怀念|愧疚|安心|坚韧|空字符串"}}
  ]
}}
要求：
- 不要虚构片段里没有的信息；可合并高度相关的相邻语境为一条。
- 勿捏造真实姓名；可用「对方」「用户」指称。
- emotion_label 无把握时填空字符串。

聊天记录片段：
{transcript}
"""
    try:
        # JSON 输出易被 max_tokens 截断；提炼阶段单独给足 completion 预算
        data = await llm.json_complete(
            prompt,
            temperature=0.25,
            timeout=120.0,
            max_tokens=min(8192, max(2048, llm.max_tokens)),
        )
    except Exception as exc:
        logger.warning("聊天记录批次 LLM 提炼失败: %s", exc)
        raise ChatImportLLMError(
            f"第 {n} 条原始片段所在批次：LLM 调用失败（请检查「模型设置」或 backend/.env 中的密钥、网关与模型名）。"
            f"详情：{_short_exc(exc)}"
        ) from exc

    mem_list = data.get("memories") if isinstance(data, dict) else None
    if not isinstance(mem_list, list):
        raise ChatImportLLMError(
            "LLM 返回的 JSON 中缺少 memories 数组，或类型错误。请确认模型遵守“仅输出 JSON”指令。"
        )

    default_ts = _ensure_utc(_batch_default_ts(batch))
    out: list[dict[str, Any]] = []
    for item in mem_list[:max_out]:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title", "")).strip()
        body = str(item.get("content_text", "")).strip()
        if len(title) < 1 or len(body) < 2:
            continue
        emo_raw = str(item.get("emotion_label", "")).strip()
        emo = emo_raw if emo_raw else None
        out.append(
            {
                "title": title[:200],
                "content_text": body[:20000],
                "emotion_label": emo,
                "occurred_at": default_ts,
            }
        )
    if not out:
        raise ChatImportLLMError(
            "LLM 返回的 memories 经校验后为空（每条需非空 title 与至少 2 字的 content_text）。"
            " 若为国产模型，请尝试提高 max_tokens 或换用 JSON 遵从更好的模型。"
        )
    return out


def _fallback_from_drafts(batch: list[ChatMemoryDraft]) -> list[dict[str, Any]]:
    return [
        {
            "title": d.title[:200],
            "content_text": d.content_text[:20000],
            "emotion_label": None,
            "occurred_at": _ensure_utc(d.occurred_at) if d.occurred_at else datetime.now(timezone.utc),
        }
        for d in batch
    ]


def _sse(data: dict[str, Any]) -> str:
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


async def stream_chat_import(
    db: AsyncSession,
    *,
    user_id: int,
    member_id: int,
    raw_text: str,
    source: str,
    build_graph: bool,
    ai_refine: bool,
    client_llm: ClientLlmOverride | None = None,
) -> AsyncIterator[str]:
    """
    产生 text/event-stream 帧（data: JSON\\n\\n）。
    ai_refine=False 时与旧版「仅解析入库」等价，但仍走同一流水线便于前端统一。
    """
    yield _sse({"type": "stage", "id": "parse", "message": "正在解析导出文本格式…"})

    drafts = parse_chat_import(raw_text, source=source)
    if not drafts:
        yield _sse({"type": "error", "message": "未能从文本中解析出有效片段"})
        return

    drafts = drafts[:_MAX_DRAFTS]
    yield _sse({"type": "parse_done", "segments": len(drafts)})

    if ai_refine and client_llm is None and not (get_settings().llm_api_key or "").strip():
        yield _sse(
            {
                "type": "error",
                "message": (
                    "未检测到 LLM 密钥：请在「模型设置」中保存并勾选厂商/自定义网关，"
                    "或在 backend/.env 中设置 LLM_API_KEY（或 OPENAI_API_KEY）及 LLM_BASE_URL / LLM_MODEL；"
                    "Docker 环境请确认 env_file 挂载后执行 `docker compose restart backend`。"
                ),
            }
        )
        return

    rows: list[dict[str, Any]] = []
    llm = (
        LLMService(
            api_key=client_llm.api_key or "",
            base_url=client_llm.base_url,
            model=client_llm.model,
        )
        if client_llm
        else LLMService()
    )

    if ai_refine:
        batches = _batch_drafts(drafts)
        total_b = len(batches)
        try:
            for bi, batch in enumerate(batches, 1):
                yield _sse(
                    {
                        "type": "llm_batch",
                        "index": bi,
                        "total": total_b,
                        "message": f"AI 提炼第 {bi}/{total_b} 批（约 {len(batch)} 个原始片段）…",
                    }
                )
                refined = await _llm_refine_batch(batch, llm)
                rows.extend(refined)
                yield _sse({"type": "batch_done", "batch_index": bi, "memories_in_batch": len(refined)})
        except ChatImportLLMError as err:
            yield _sse({"type": "error", "message": str(err)})
            return
    else:
        rows = _fallback_from_drafts(drafts)
        yield _sse({"type": "note", "message": "已跳过 AI 精炼，使用解析分段直写入库。"})

    if not rows:
        yield _sse({"type": "error", "message": "没有可写入的记忆条目"})
        return

    defer_vector = len(rows) > _VECTOR_DEFER_THRESHOLD
    if defer_vector:
        yield _sse(
            {
                "type": "note",
                "message": f"共 {len(rows)} 条，超过阈值 {_VECTOR_DEFER_THRESHOLD}，暂缓写入向量索引以保稳定。",
            }
        )

    yield _sse({"type": "stage", "id": "persist", "message": f"正在写入 {len(rows)} 条记忆…"})

    created_ids: list[int] = []
    batch_commit_every = 25
    for idx, spec in enumerate(rows):
        ts = spec.get("occurred_at")
        if isinstance(ts, datetime):
            ts = _ensure_utc(ts)
        else:
            ts = datetime.now(timezone.utc)
        memory = Memory(
            title=str(spec.get("title", ""))[:200],
            content_text=str(spec.get("content_text", ""))[:20000],
            member_id=member_id,
            timestamp=ts,
            emotion_label=spec.get("emotion_label") if spec.get("emotion_label") else None,
        )
        db.add(memory)
        await db.flush()
        await db.refresh(memory)
        created_ids.append(memory.id)
        try:
            await ensure_memory_engram(db, memory, user_id, with_vector=not defer_vector)
        except Exception as exc:
            logger.warning("导入记忆入图失败 id=%s: %s", memory.id, exc)

        if (idx + 1) % batch_commit_every == 0:
            await db.commit()
            yield _sse({"type": "persist_progress", "saved": idx + 1, "total": len(rows)})

    await db.commit()

    mem_rows = await db.execute(select(Memory).where(Memory.id.in_(created_ids)))
    created = list(mem_rows.scalars().all())

    stats = {"temporal_edges": 0, "llm_edges": 0}
    if build_graph and len(created) >= 2:
        yield _sse({"type": "stage", "id": "graph", "message": "正在用 AI 构建记忆关系网…"})
        try:
            # 与 AI 精炼同时开启时，构图阶段 LLM 异常须显式失败，避免静默 0 边
            stats = await enrich_after_memories_created(
                db, user_id, created, llm, strict_llm=bool(ai_refine)
            )
        except Exception as exc:
            logger.warning("导入后构图失败: %s", exc)
            if ai_refine:
                yield _sse(
                    {
                        "type": "error",
                        "message": f"AI 构建关系网失败：{_short_exc(exc)}",
                    }
                )
                return
            yield _sse({"type": "note", "message": f"关系网构建未完成: {exc}"})

    result = {
        "created_count": len(created),
        "memory_ids": [m.id for m in created],
        "graph_temporal_edges": int(stats.get("temporal_edges", 0)),
        "graph_llm_edges": int(stats.get("llm_edges", 0)),
        "vectors_deferred": defer_vector,
    }
    yield _sse({"type": "done", "result": result})
