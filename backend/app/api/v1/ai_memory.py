"""
AI 记忆同步 API
"""
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.v1.auth import get_current_user
from app.models.user import User
from app.schemas.user_center import AIMemoryContext, AIMemoryUpdate

router = APIRouter(prefix="/ai-memory", tags=["AI 记忆同步"])


@router.get("", response_model=AIMemoryContext)
async def get_ai_memory(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取 AI 记忆上下文"""
    if not current_user.ai_memory_context:
        return AIMemoryContext(summaries=[], last_updated=None)

    try:
        data = json.loads(current_user.ai_memory_context)
        return AIMemoryContext(
            summaries=data.get("summaries", []),
            last_updated=data.get("last_updated"),
        )
    except (json.JSONDecodeError, TypeError):
        return AIMemoryContext(summaries=[], last_updated=None)


@router.put("", response_model=AIMemoryContext)
async def update_ai_memory(
    update_data: AIMemoryUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新 AI 记忆上下文"""
    summaries = update_data.context.summaries or []

    # 最多保留最近 10 条摘要
    if len(summaries) > 10:
        summaries = summaries[-10:]

    data = {
        "summaries": summaries,
        "last_updated": datetime.now(timezone.utc).isoformat(),
    }

    current_user.ai_memory_context = json.dumps(data, ensure_ascii=False)
    await db.commit()

    return AIMemoryContext(
        summaries=summaries,
        last_updated=data["last_updated"],
    )


@router.delete("", response_model=AIMemoryContext)
async def clear_ai_memory(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """清除 AI 记忆上下文"""
    current_user.ai_memory_context = None
    await db.commit()
    return AIMemoryContext(summaries=[], last_updated=None)
