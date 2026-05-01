"""
故事书生成 API 路由

基于记忆自动生成生命故事
"""

from pydantic import BaseModel, Field

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.user import User
from app.models.memory import Memory, Member, Archive
from app.api.v1.auth import get_current_user
from app.services.memory_organizer_service import MemoryOrganizerService
from app.schemas.client_llm import ClientLlmOverride

router = APIRouter(prefix="/storybook", tags=["故事书"])


class StorybookGenerateRequest(BaseModel):
    """故事书生成（JSON Body，便于附带 client_llm）"""

    archive_id: int = Field(..., gt=0)
    member_id: int | None = Field(default=None, gt=0)
    style: str = Field(default="nostalgic", max_length=32)
    client_llm: ClientLlmOverride | None = None


@router.post("/generate")
async def generate_story(
    body: StorybookGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    基于档案中的记忆生成故事书

    - **archive_id**: 档案 ID
    - **member_id**: 可选，指定成员；省略则使用该档案下全部成员的记忆
    - **style**: 故事风格（nostalgic / literary / simple / dialogue）
    - **client_llm**: 可选，浏览器端模型设置（优于服务端 LLM_*）
    """
    archive_id = body.archive_id
    member_id = body.member_id
    style = body.style

    result = await db.execute(
        select(Archive).where(
            Archive.id == archive_id,
            Archive.owner_id == current_user.id,
        ),
    )
    archive = result.scalar_one_or_none()
    if not archive:
        raise HTTPException(status_code=403, detail="无权限访问此档案")

    member_name = "全体成员"
    if member_id is not None:
        result = await db.execute(
            select(Member).where(Member.archive_id == archive_id, Member.id == member_id),
        )
        member = result.scalar_one_or_none()
        if not member:
            raise HTTPException(status_code=404, detail="成员不存在或不属于该档案")
        member_name = member.name

    # 记忆列表：必须与 Member 正确 JOIN（原实现未 join 时在「全部成员」下不可靠）
    if member_id is not None:
        mem_query = (
            select(Memory)
            .join(Member, Memory.member_id == Member.id)
            .where(Member.archive_id == archive_id, Memory.member_id == member_id)
        )
    else:
        mem_query = (
            select(Memory)
            .join(Member, Memory.member_id == Member.id)
            .where(Member.archive_id == archive_id)
        )
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
            llm_override=body.client_llm,
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
