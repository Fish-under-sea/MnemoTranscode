"""
用量统计 API
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.v1.auth import get_current_user
from app.models.user import User
from app.models.usage import UsageRecord
from app.models.media import MediaAsset
from app.services.subscription import (
    apply_tier_to_user,
    build_subscription_response_from_usage_records,
    normalize_tier,
    storage_quota_bytes_for_tier,
    tier_monthly_token_limit,
)
from app.schemas.user_center import (
    UsageStatsResponse,
    UsageHistoryResponse,
    QuotaResponse,
    UsageRecordResponse,
    SubscriptionResponse,
    SubscriptionTierUpdate,
)
from app.services.usage_metering import sum_monthly_tokens_by_channel

router = APIRouter(prefix="/usage", tags=["用量统计"])


@router.post("/subscription-tier", response_model=SubscriptionResponse)
async def set_subscription_tier_alias(
    body: SubscriptionTierUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    切换订阅档位（与 POST /api/v1/auth/subscription 等价）。

    当 /auth/subscription 在代理或 ASGI 层对 POST/PATCH/PUT 出现 405 时，可改用本路径（独立 URL 段，避免与 GET 同一路由冲突）。
    """
    result = await db.execute(select(User).where(User.id == current_user.id))
    user = result.scalar_one()
    apply_tier_to_user(user, body.tier)
    await db.commit()
    await db.refresh(user)
    return await build_subscription_response_from_usage_records(db, user)


@router.get("/stats", response_model=UsageStatsResponse)
async def get_usage_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取本月用量统计数据"""
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    sub_used, uk_used = await sum_monthly_tokens_by_channel(db, current_user.id)

    result = await db.execute(
        select(UsageRecord)
        .where(UsageRecord.user_id == current_user.id)
        .where(UsageRecord.created_at >= month_start)
    )
    records = result.scalars().all()

    usage_by_type: dict[str, int] = {}
    usage_by_day: dict[str, int] = {}

    for r in records:
        action = r.action_type or "other"
        tokens = r.token_count or 0
        usage_by_type[action] = usage_by_type.get(action, 0) + tokens
        day_key = r.created_at.strftime("%Y-%m-%d")
        usage_by_day[day_key] = usage_by_day.get(day_key, 0) + tokens

    usage_by_day_list = [
        {"date": k, "tokens": v} for k, v in sorted(usage_by_day.items())
    ]

    sum_storage = await db.execute(
        select(func.coalesce(func.sum(MediaAsset.size), 0)).where(
            MediaAsset.owner_id == current_user.id
        )
    )
    storage_used = int(sum_storage.scalar() or 0)
    tier = normalize_tier(current_user.subscription_tier)
    storage_quota = storage_quota_bytes_for_tier(tier)
    storage_pct = (
        round(storage_used / storage_quota * 100, 2) if storage_quota > 0 else 0.0
    )

    # tokens 月度上限与 storage 一致：均以当前订阅档位为准（与 /auth/subscription、产品描述对齐）
    limit = tier_monthly_token_limit(current_user)

    return UsageStatsResponse(
        monthly_used=sub_used,
        monthly_used_user_key=uk_used,
        monthly_limit=limit,
        usage_by_type=usage_by_type,
        usage_by_day=usage_by_day_list,
        remaining=max(0, limit - sub_used),
        usage_percent=round(sub_used / limit * 100, 2) if limit > 0 else 0,
        storage_used=storage_used,
        storage_quota=storage_quota,
        storage_usage_percent=storage_pct,
    )


@router.get("/history", response_model=UsageHistoryResponse)
async def get_usage_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    action_type: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取用量历史记录（分页）"""
    query = select(UsageRecord).where(UsageRecord.user_id == current_user.id)
    if action_type:
        query = query.where(UsageRecord.action_type == action_type)

    # 总数
    count_result = await db.execute(
        select(func.count(UsageRecord.id)).where(UsageRecord.user_id == current_user.id)
    )
    total = count_result.scalar() or 0

    # 分页
    offset = (page - 1) * page_size
    query = query.order_by(UsageRecord.created_at.desc()).offset(offset).limit(page_size)
    result = await db.execute(query)
    records = result.scalars().all()

    return UsageHistoryResponse(
        records=[UsageRecordResponse.model_validate(r) for r in records],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/quota", response_model=QuotaResponse)
async def get_quota(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取当前配额信息"""
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    sub_used, _ = await sum_monthly_tokens_by_channel(db, current_user.id)
    monthly_used = sub_used

    next_month = month_start + timedelta(days=32)
    next_month = next_month.replace(day=1)

    tier_limit = tier_monthly_token_limit(current_user)
    return QuotaResponse(
        subscription_tier=normalize_tier(current_user.subscription_tier),
        monthly_limit=tier_limit,
        monthly_used=monthly_used,
        remaining=max(0, tier_limit - monthly_used),
        usage_percent=round(monthly_used / tier_limit * 100, 2) if tier_limit > 0 else 0,
        reset_at=next_month,
    )
