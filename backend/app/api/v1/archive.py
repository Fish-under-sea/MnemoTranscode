"""
档案管理 API 路由
"""

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.core.exceptions import DomainAuthError, DomainResourceError
from app.core.database import get_db
from app.models.user import User
from app.models.memory import Archive, Member, Memory
from app.schemas.memory import (
    ArchiveCreate, ArchiveUpdate, ArchiveResponse,
    MemberCreate, MemberUpdate, MemberResponse,
)
from app.api.v1.auth import get_current_user

router = APIRouter(prefix="/archives", tags=["档案"])


@router.post("", response_model=ArchiveResponse, status_code=status.HTTP_201_CREATED)
async def create_archive(
    archive_data: ArchiveCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """创建新的档案"""
    archive = Archive(
        name=archive_data.name,
        description=archive_data.description,
        archive_type=archive_data.archive_type,
        owner_id=current_user.id,
    )
    db.add(archive)
    await db.commit()
    await db.refresh(archive)
    return ArchiveResponse.model_validate(archive)


@router.get("", response_model=list[ArchiveResponse])
async def list_archives(
    archive_type: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取用户的档案列表"""
    query = select(Archive).where(Archive.owner_id == current_user.id)
    if archive_type:
        query = query.where(Archive.archive_type == archive_type)
    query = query.order_by(Archive.updated_at.desc())
    result = await db.execute(query)
    archives = result.scalars().all()
    responses = []
    for archive in archives:
        member_count = len(archive.members) if archive.members else 0
        memory_count = sum(len(m.memories) for m in archive.members) if archive.members else 0
        resp = ArchiveResponse.model_validate(archive)
        resp.member_count = member_count
        resp.memory_count = memory_count
        responses.append(resp)
    return responses


@router.get("/{archive_id}", response_model=ArchiveResponse)
async def get_archive(
    archive_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取档案详情"""
    result = await db.execute(
        select(Archive)
        .options(selectinload(Archive.members).selectinload(Member.memories))
        .where(Archive.id == archive_id, Archive.owner_id == current_user.id)
    )
    archive = result.scalar_one_or_none()
    if not archive:
        raise DomainResourceError(error_code="RESOURCE_NOT_FOUND", message="档案不存在")
    resp = ArchiveResponse.model_validate(archive)
    resp.member_count = len(archive.members)
    resp.memory_count = sum(len(m.memories) for m in archive.members)
    return resp


@router.patch("/{archive_id}", response_model=ArchiveResponse)
async def update_archive(
    archive_id: int,
    update_data: ArchiveUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新档案信息"""
    result = await db.execute(
        select(Archive).where(Archive.id == archive_id, Archive.owner_id == current_user.id)
    )
    archive = result.scalar_one_or_none()
    if not archive:
        raise DomainResourceError(error_code="RESOURCE_NOT_FOUND", message="档案不存在")

    for field, value in update_data.model_dump(exclude_unset=True).items():
        setattr(archive, field, value)
    await db.commit()
    await db.refresh(archive)
    return ArchiveResponse.model_validate(archive)


@router.delete("/{archive_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_archive(
    archive_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除档案"""
    result = await db.execute(
        select(Archive).where(Archive.id == archive_id, Archive.owner_id == current_user.id)
    )
    archive = result.scalar_one_or_none()
    if not archive:
        raise DomainResourceError(error_code="RESOURCE_NOT_FOUND", message="档案不存在")
    await db.delete(archive)
    await db.commit()


# ====== 成员管理 ======

@router.post("/{archive_id}/members", response_model=MemberResponse, status_code=status.HTTP_201_CREATED)
async def create_member(
    archive_id: int,
    member_data: MemberCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """在档案下创建成员"""
    result = await db.execute(
        select(Archive).where(Archive.id == archive_id, Archive.owner_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise DomainAuthError(error_code="AUTH_FORBIDDEN", message="无权限")

    member = Member(
        name=member_data.name,
        relationship_type=member_data.relationship_type,
        archive_id=archive_id,
        birth_year=member_data.birth_year,
        status=member_data.status or "active",
        end_year=member_data.end_year,
        bio=member_data.bio,
    )
    db.add(member)
    await db.commit()
    await db.refresh(member)
    return MemberResponse.model_validate(member)


@router.get("/{archive_id}/members", response_model=list[MemberResponse])
async def list_members(
    archive_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取档案下的所有成员"""
    result = await db.execute(
        select(Archive).where(Archive.id == archive_id, Archive.owner_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise DomainAuthError(error_code="AUTH_FORBIDDEN", message="无权限")

    result = await db.execute(
        select(Member).where(Member.archive_id == archive_id).order_by(Member.birth_year)
    )
    members = result.scalars().all()
    return [MemberResponse.model_validate(m) for m in members]


@router.get("/{archive_id}/members/{member_id}", response_model=MemberResponse)
async def get_member(
    archive_id: int,
    member_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取成员详情"""
    result = await db.execute(
        select(Archive).where(Archive.id == archive_id, Archive.owner_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise DomainAuthError(error_code="AUTH_FORBIDDEN", message="无权限")

    result = await db.execute(
        select(Member).where(Member.id == member_id, Member.archive_id == archive_id)
    )
    member = result.scalar_one_or_none()
    if not member:
        raise DomainResourceError(error_code="RESOURCE_NOT_FOUND", message="成员不存在")
    return MemberResponse.model_validate(member)


@router.patch("/{archive_id}/members/{member_id}", response_model=MemberResponse)
async def update_member(
    archive_id: int,
    member_id: int,
    update_data: MemberUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新成员信息"""
    result = await db.execute(
        select(Archive).where(Archive.id == archive_id, Archive.owner_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise DomainAuthError(error_code="AUTH_FORBIDDEN", message="无权限")

    result = await db.execute(
        select(Member).where(Member.id == member_id, Member.archive_id == archive_id)
    )
    member = result.scalar_one_or_none()
    if not member:
        raise DomainResourceError(error_code="RESOURCE_NOT_FOUND", message="成员不存在")

    ignored_legacy_fields = {"is_alive", "death_year"}
    for field, value in update_data.model_dump(exclude_unset=True).items():
        if field in ignored_legacy_fields:
            continue
        setattr(member, field, value)
    await db.commit()
    await db.refresh(member)
    return MemberResponse.model_validate(member)


@router.delete("/{archive_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_member(
    archive_id: int,
    member_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除成员"""
    result = await db.execute(
        select(Archive).where(Archive.id == archive_id, Archive.owner_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise DomainAuthError(error_code="AUTH_FORBIDDEN", message="无权限")

    result = await db.execute(
        select(Member).where(Member.id == member_id, Member.archive_id == archive_id)
    )
    member = result.scalar_one_or_none()
    if not member:
        raise DomainResourceError(error_code="RESOURCE_NOT_FOUND", message="成员不存在")
    await db.delete(member)
    await db.commit()
