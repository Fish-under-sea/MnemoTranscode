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
from app.schemas.user_center import (
    UsageStatsResponse, UsageHistoryResponse, QuotaResponse,
    UsageRecordResponse
)

router = APIRouter(prefix="/usage", tags=["用量统计"])


@router.get("/stats", response_model=UsageStatsResponse)
async def get_usage_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取本月用量统计数据"""
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    result = await db.execute(
        select(UsageRecord)
        .where(UsageRecord.user_id == current_user.id)
        .where(UsageRecord.created_at >= month_start)
    )
    records = result.scalars().all()

    usage_by_type: dict[str, int] = {}
    usage_by_day: dict[str, int] = {}
    total_used = 0

    for r in records:
        action = r.action_type or "other"
        tokens = r.token_count or 0
        total_used += tokens
        usage_by_type[action] = usage_by_type.get(action, 0) + tokens
        day_key = r.created_at.strftime("%Y-%m-%d")
        usage_by_day[day_key] = usage_by_day.get(day_key, 0) + tokens

    usage_by_day_list = [
        {"date": k, "tokens": v} for k, v in sorted(usage_by_day.items())
    ]

    return UsageStatsResponse(
        monthly_used=total_used,
        monthly_limit=current_user.monthly_token_limit,
        usage_by_type=usage_by_type,
        usage_by_day=usage_by_day_list,
        remaining=max(0, current_user.monthly_token_limit - total_used),
        usage_percent=round(total_used / current_user.monthly_token_limit * 100, 2) if current_user.monthly_token_limit > 0 else 0,
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

    result = await db.execute(
        select(func.coalesce(func.sum(UsageRecord.token_count), 0))
        .where(UsageRecord.user_id == current_user.id)
        .where(UsageRecord.created_at >= month_start)
    )
    monthly_used = result.scalar() or 0

    next_month = month_start + timedelta(days=32)
    next_month = next_month.replace(day=1)

    return QuotaResponse(
        subscription_tier=current_user.subscription_tier or "free",
        monthly_limit=current_user.monthly_token_limit,
        monthly_used=monthly_used,
        remaining=max(0, current_user.monthly_token_limit - monthly_used),
        usage_percent=round(monthly_used / current_user.monthly_token_limit * 100, 2) if current_user.monthly_token_limit > 0 else 0,
        reset_at=next_month,
    )
