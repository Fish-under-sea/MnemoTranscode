"""
记忆 CRUD API 路由
"""

from datetime import datetime

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.exceptions import DomainAuthError, DomainInternalError, DomainResourceError
from app.models.user import User
from app.models.memory import Memory, Member, Archive
from app.schemas.memory import (
    MemoryCreate, MemoryUpdate, MemoryResponse,
    MemorySearchRequest, MemorySearchResponse,
)
from app.api.v1.auth import get_current_user
from app.services.vector_service import VectorService
from app.core.config import get_settings

router = APIRouter(prefix="/memories", tags=["记忆"])
settings = get_settings()


def memory_to_response(m: Memory) -> MemoryResponse:
    """Memory ORM 无 archive_id 列，需从已加载的 member 填充。"""
    if m.member is None:
        raise ValueError("Memory.member must be loaded (use selectinload)")
    return MemoryResponse(
        id=m.id,
        title=m.title,
        content_text=m.content_text,
        timestamp=m.timestamp,
        location=m.location,
        member_id=m.member_id,
        archive_id=m.member.archive_id,
        emotion_label=m.emotion_label,
        vector_embedding_id=m.vector_embedding_id,
        is_capsule=m.is_capsule,
        unlock_date=m.unlock_date,
        media_refs=list(m.media_refs) if m.media_refs is not None else [],
        created_at=m.created_at,
        updated_at=m.updated_at,
    )


@router.post("", response_model=MemoryResponse, status_code=status.HTTP_201_CREATED)
async def create_memory(
    memory_data: MemoryCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """创建新的记忆条目"""
    result = await db.execute(
        select(Member).where(Member.id == memory_data.member_id)
    )
    member = result.scalar_one_or_none()
    if not member:
        raise DomainResourceError(error_code="RESOURCE_NOT_FOUND", message="成员不存在")

    result = await db.execute(
        select(Archive).where(Archive.id == member.archive_id, Archive.owner_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise DomainAuthError(error_code="AUTH_FORBIDDEN", message="无权限在此档案下创建记忆")

    memory = Memory(
        title=memory_data.title,
        content_text=memory_data.content_text,
        member_id=memory_data.member_id,
        timestamp=memory_data.timestamp or datetime.utcnow(),
        location=memory_data.location,
        emotion_label=memory_data.emotion_label,
    )
    db.add(memory)
    await db.commit()
    await db.refresh(memory)

    return MemoryResponse(
        id=memory.id,
        title=memory.title,
        content_text=memory.content_text,
        timestamp=memory.timestamp,
        location=memory.location,
        member_id=memory.member_id,
        archive_id=member.archive_id,
        emotion_label=memory.emotion_label,
        vector_embedding_id=memory.vector_embedding_id,
        is_capsule=memory.is_capsule,
        unlock_date=memory.unlock_date,
        media_refs=list(memory.media_refs) if memory.media_refs is not None else [],
        created_at=memory.created_at,
        updated_at=memory.updated_at,
    )


@router.get("", response_model=list[MemoryResponse])
async def list_memories(
    archive_id: int | None = None,
    member_id: int | None = None,
    emotion_label: str | None = None,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取记忆列表（支持按档案/成员/情绪筛选）"""
    query = (
        select(Memory)
        .options(selectinload(Memory.member))
        .join(Member, Memory.member_id == Member.id)
        .join(Archive, Member.archive_id == Archive.id)
        .where(Archive.owner_id == current_user.id)
    )
    if archive_id:
        query = query.where(Member.archive_id == archive_id)
    if member_id:
        query = query.where(Memory.member_id == member_id)
    if emotion_label:
        query = query.where(Memory.emotion_label == emotion_label)

    query = query.order_by(Memory.timestamp.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    memories = result.scalars().all()
    return [memory_to_response(m) for m in memories]


@router.get("/{memory_id}", response_model=MemoryResponse)
async def get_memory(
    memory_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取单条记忆详情"""
    result = await db.execute(
        select(Memory)
        .options(selectinload(Memory.member))
        .join(Member, Memory.member_id == Member.id)
        .join(Archive, Member.archive_id == Archive.id)
        .where(Memory.id == memory_id, Archive.owner_id == current_user.id)
    )
    memory = result.scalar_one_or_none()
    if not memory:
        raise DomainResourceError(error_code="RESOURCE_NOT_FOUND", message="记忆不存在")
    return memory_to_response(memory)


@router.patch("/{memory_id}", response_model=MemoryResponse)
async def update_memory(
    memory_id: int,
    update_data: MemoryUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新记忆条目"""
    result = await db.execute(
        select(Memory)
        .options(selectinload(Memory.member))
        .join(Member, Memory.member_id == Member.id)
        .join(Archive, Member.archive_id == Archive.id)
        .where(Memory.id == memory_id, Archive.owner_id == current_user.id)
    )
    memory = result.scalar_one_or_none()
    if not memory:
        raise DomainResourceError(error_code="RESOURCE_NOT_FOUND", message="记忆不存在")

    for field, value in update_data.model_dump(exclude_unset=True).items():
        setattr(memory, field, value)

    memory.updated_at = datetime.utcnow()
    await db.commit()

    res2 = await db.execute(
        select(Memory)
        .options(selectinload(Memory.member))
        .join(Member, Memory.member_id == Member.id)
        .join(Archive, Member.archive_id == Archive.id)
        .where(Memory.id == memory_id, Archive.owner_id == current_user.id)
    )
    memory2 = res2.scalar_one_or_none()
    if not memory2:
        raise DomainResourceError(error_code="RESOURCE_NOT_FOUND", message="记忆不存在")
    return memory_to_response(memory2)


@router.delete("/{memory_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_memory(
    memory_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除记忆条目"""
    result = await db.execute(
        select(Memory)
        .join(Member, Memory.member_id == Member.id)
        .join(Archive, Member.archive_id == Archive.id)
        .where(Memory.id == memory_id, Archive.owner_id == current_user.id)
    )
    memory = result.scalar_one_or_none()
    if not memory:
        raise DomainResourceError(error_code="RESOURCE_NOT_FOUND", message="记忆不存在")

    await db.delete(memory)
    await db.commit()


@router.post("/search", response_model=MemorySearchResponse)
async def search_memories(
    search_request: MemorySearchRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """语义搜索记忆（基于向量检索）"""
    try:
        vector_service = VectorService()
        raw = await vector_service.search_memories(
            query=search_request.query,
            user_id=current_user.id,
            archive_id=search_request.archive_id,
            member_id=search_request.member_id,
            limit=search_request.limit,
        )
        mem_ids: list[int] = []
        for item in raw:
            pl = item.get("payload") if isinstance(item, dict) else None
            if not isinstance(pl, dict):
                continue
            mid = pl.get("memory_id")
            if mid is not None:
                try:
                    mem_ids.append(int(mid))
                except (TypeError, ValueError):
                    pass
        if not mem_ids:
            return MemorySearchResponse(results=[], query=search_request.query, total=0)
        stmt = (
            select(Memory)
            .options(selectinload(Memory.member))
            .join(Member, Memory.member_id == Member.id)
            .join(Archive, Member.archive_id == Archive.id)
            .where(Memory.id.in_(mem_ids), Archive.owner_id == current_user.id)
        )
        rows = (await db.execute(stmt)).scalars().all()
        by_id = {m.id: m for m in rows}
        ordered = [by_id[i] for i in mem_ids if i in by_id]
        return MemorySearchResponse(
            results=[memory_to_response(m) for m in ordered],
            query=search_request.query,
            total=len(ordered),
        )
    except Exception as e:
        raise DomainInternalError(error_code="INTERNAL_SERVER_ERROR", message=f"搜索失败: {str(e)}")
