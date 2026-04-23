"""
故事书生成 API 路由

基于记忆自动生成生命故事
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.user import User
from app.models.memory import Memory, Member, Archive
from app.api.v1.auth import get_current_user
from app.services.memory_organizer_service import MemoryOrganizerService

router = APIRouter(prefix="/storybook", tags=["故事书"])


@router.post("/generate")
async def generate_story(
    archive_id: int,
    member_id: int | None = None,
    style: str = "nostalgic",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    基于档案中的记忆生成故事书

    - **archive_id**: 档案 ID
    - **member_id**: 可选，指定成员
    - **style**: 故事风格（nostalgic / literary / simple / dialogue）
    """
    # 验证权限
    result = await db.execute(
        select(Archive).where(
            Archive.id == archive_id,
            Archive.owner_id == current_user.id
        )
    )
    archive = result.scalar_one_or_none()
    if not archive:
        raise HTTPException(status_code=403, detail="无权限访问此档案")

    # 获取成员
    member_name = "TA"
    query = select(Member).where(Member.archive_id == archive_id)
    if member_id:
        query = query.where(Member.id == member_id)
    result = await db.execute(query)
    member = result.scalar_one_or_none()
    if member:
        member_name = member.name

    # 获取记忆
    mem_query = select(Memory).where(Memory.member_id == Member.id, Member.archive_id == archive_id)
    if member_id:
        mem_query = select(Memory).where(Memory.member_id == member_id)
    result = await db.execute(mem_query.order_by(Memory.timestamp.asc()))
    memories = result.scalars().all()

    if not memories:
        raise HTTPException(status_code=400, detail="该档案下暂无记忆，无法生成故事")

    memories_data = [
        {
            "id": m.id,
            "title": m.title,
            "content_text": m.content_text,
            "timestamp": m.timestamp.isoformat() if m.timestamp else None,
            "location": m.location,
            "emotion_label": m.emotion_label,
        }
        for m in memories
    ]

    try:
        organizer = MemoryOrganizerService()
        story = await organizer.generate_story(
            memories=memories_data,
            member_name=member_name,
            style=style,
        )
        return {
            "story": story,
            "archive_id": archive_id,
            "member_id": member_id,
            "style": style,
            "memory_count": len(memories),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"故事生成失败: {str(e)}")
