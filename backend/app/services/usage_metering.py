"""AI 用量打点与按渠道（订阅 / 自备 Key）聚合"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.usage import UsageRecord
from app.schemas.client_llm import ClientLlmOverride

METERING_SUBSCRIPTION = "subscription"
METERING_USER_KEY = "user_key"


def classify_metering_channel(client_llm: ClientLlmOverride | None) -> str:
    """client_llm.api_key 非空则视为用户自备模型，否则计入订阅配额口径。"""
    if client_llm and (client_llm.api_key or "").strip():
        return METERING_USER_KEY
    return METERING_SUBSCRIPTION


def tokens_from_usage_bundle(usage: dict | None) -> int:
    """从 OpenAI 兼容 usage 结构中解析整数 token 数。"""
    if not usage:
        return 0
    t = usage.get("total_tokens")
    try:
        if t is not None and not isinstance(t, bool):
            ti = int(t)
            if ti > 0:
                return ti
    except (TypeError, ValueError):
        pass
    try:
        pt = int(usage.get("prompt_tokens") or 0)
        ct = int(usage.get("completion_tokens") or 0)
        return max(0, pt + ct)
    except (TypeError, ValueError):
        return 0


async def record_token_usage(
    db: AsyncSession,
    *,
    user_id: int,
    action_type: str,
    usage_bundle: dict,
    client_llm: ClientLlmOverride | None = None,
    session_id: str | None = None,
) -> None:
    """写入一条本月可聚合的用量行（prompt+completion 或 total_tokens）。"""
    n = tokens_from_usage_bundle(usage_bundle)
    if n <= 0:
        return
    ch = classify_metering_channel(client_llm)
    model_hint = usage_bundle.get("model")
    rec = UsageRecord(
        user_id=user_id,
        action_type=action_type,
        token_count=int(n),
        metering_channel=ch,
        cost=0,
        model_name=(str(model_hint)[:100]) if model_hint else None,
        session_id=(session_id[:100]) if session_id else None,
        created_at=datetime.now(timezone.utc),
    )
    db.add(rec)
    await db.flush()


async def sum_monthly_tokens_by_channel(db: AsyncSession, user_id: int) -> tuple[int, int]:
    """
    返回 (subscription_or_legacy, user_key)。
    metering_channel IS NULL 的历史行算作订阅口径。
    """
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    base = (
        select(func.coalesce(func.sum(UsageRecord.token_count), 0))
        .where(UsageRecord.user_id == user_id)
        .where(UsageRecord.created_at >= month_start)
    )

    async def _scalar(stmt):
        r = await db.execute(stmt)
        return int(r.scalar() or 0)

    subscription_used = await _scalar(
        base.where(
            or_(
                UsageRecord.metering_channel.is_(None),
                UsageRecord.metering_channel == METERING_SUBSCRIPTION,
            )
        )
    )
    user_key_used = await _scalar(base.where(UsageRecord.metering_channel == METERING_USER_KEY))
    return subscription_used, user_key_used
