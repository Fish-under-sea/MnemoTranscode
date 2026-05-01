"""
档案管理 API 路由
"""

import io
import uuid

from fastapi import APIRouter, Depends, status, Query, UploadFile, File, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.exceptions import DomainAuthError, DomainResourceError
from app.core.database import get_db
from app.core.config import get_settings
from app.core.avatar_public_url import (
    build_member_avatar_display_url,
    parse_object_key_from_stored_url,
    verify_member_avatar_file_signature,
)
from app.core.minio_object_response import raise_if_expired, streaming_response_for_object_key
from app.models.user import User
from app.models.memory import Archive, Member, Memory
from app.schemas.memory import (
    ArchiveCreate, ArchiveUpdate, ArchiveResponse,
    MemberCreate, MemberUpdate, MemberResponse,
)
from app.api.v1.auth import get_current_user

router = APIRouter(prefix="/archives", tags=["档案"])

settings = get_settings()

ALLOWED_MEMBER_AVATAR_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
MAX_MEMBER_AVATAR_SIZE = 5 * 1024 * 1024


def _member_avatar_content_type(filename: str, reported: str | None) -> str:
    """与媒体直传一致：空 file.type 时按扩展名推断，避免 Windows/部分浏览器报 415。"""
    r = (reported or "").strip()
    if r in ALLOWED_MEMBER_AVATAR_TYPES:
        return r
    low = (filename or "").lower()
    if low.endswith(".png"):
        return "image/png"
    if low.endswith((".jpg", ".jpeg")):
        return "image/jpeg"
    if low.endswith(".gif"):
        return "image/gif"
    if low.endswith(".webp"):
        return "image/webp"
    return r or "image/png"


def member_to_response(member: Member, owner_id: int) -> MemberResponse:
    """序列化成员：头像 URL 转为同源可显式的签名链。"""
    base = MemberResponse.model_validate(member)
    display = build_member_avatar_display_url(owner_id, member.archive_id, member.id, member.avatar_url)
    return base.model_copy(update={"avatar_url": display})


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
    query = select(Archive).options(selectinload(Archive.members).selectinload(Member.memories)).where(Archive.owner_id == current_user.id)
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
        select(Archive).options(selectinload(Archive.members).selectinload(Member.memories)).where(Archive.id == archive_id, Archive.owner_id == current_user.id)
    )
    archive = result.scalar_one_or_none()
    if not archive:
        raise DomainResourceError(error_code="RESOURCE_NOT_FOUND", message="档案不存在")

    member_count = len(archive.members) if archive.members else 0
    memory_count = sum(len(m.memories) for m in archive.members) if archive.members else 0
    
    for field, value in update_data.model_dump(exclude_unset=True).items():
        setattr(archive, field, value)
    await db.commit()
    await db.refresh(archive)
    
    resp = ArchiveResponse.model_validate(archive)
    resp.member_count = member_count
    resp.memory_count = memory_count
    return resp


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
    return member_to_response(member, current_user.id)


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
    return [member_to_response(m, current_user.id) for m in members]


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
    return member_to_response(member, current_user.id)


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
    return member_to_response(member, current_user.id)


@router.get("/{archive_id}/members/{member_id}/avatar-file")
async def get_member_avatar_file(
    archive_id: int,
    member_id: int,
    exp: int = Query(..., description="过期时间 Unix 秒"),
    sig: str = Query(..., min_length=32, max_length=128, description="HMAC-SHA256 十六进制"),
    db: AsyncSession = Depends(get_db),
):
    """成员头像原图：同源拉流，供 <img src> 使用。"""
    raise_if_expired(exp)
    result = await db.execute(
        select(Member).where(Member.id == member_id, Member.archive_id == archive_id)
    )
    member = result.scalar_one_or_none()
    if not member or not member.avatar_url:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="头像不存在")
    ar = await db.execute(select(Archive).where(Archive.id == archive_id))
    archive = ar.scalar_one_or_none()
    if not archive:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="档案不存在")
    owner_id = archive.owner_id
    if not verify_member_avatar_file_signature(
        owner_id, archive_id, member_id, member.avatar_url, exp, sig
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="签名无效")
    key = parse_object_key_from_stored_url(member.avatar_url)
    if not key:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="头像数据异常")
    return streaming_response_for_object_key(key)


@router.post("/{archive_id}/members/{member_id}/avatar", response_model=MemberResponse)
async def upload_member_avatar(
    archive_id: int,
    member_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """上传并更新成员展示头像（MinIO + 同源签名 URL）。"""
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

    content = await file.read()
    if len(content) > MAX_MEMBER_AVATAR_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="头像文件过大（最大 5MB）",
        )
    content_type = _member_avatar_content_type(file.filename or "", file.content_type)
    if content_type not in ALLOWED_MEMBER_AVATAR_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="仅支持 JPG、PNG、GIF、WebP 格式",
        )
    ext_by_type = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/gif": "gif",
        "image/webp": "webp",
    }
    file_ext = ext_by_type[content_type]
    object_name = f"avatars/members/{member_id}/{uuid.uuid4()}.{file_ext}"

    try:
        from minio import Minio

        client = Minio(
            settings.minio_endpoint,
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=settings.minio_secure,
            region="us-east-1",
        )
        bucket_name = settings.minio_bucket
        if not client.bucket_exists(bucket_name):
            client.make_bucket(bucket_name)
        client.put_object(
            bucket_name,
            object_name,
            io.BytesIO(content),
            len(content),
            content_type=content_type,
        )
        file_url = f"http://{settings.minio_endpoint}/{bucket_name}/{object_name}"
        member.avatar_url = file_url
        await db.commit()
        await db.refresh(member)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"头像上传失败: {str(e)}",
        ) from e

    return member_to_response(member, current_user.id)


@router.delete("/{archive_id}/members/{member_id}/avatar", response_model=MemberResponse)
async def delete_member_avatar(
    archive_id: int,
    member_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """移除成员自定义头像。"""
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

    member.avatar_url = None
    await db.commit()
    await db.refresh(member)
    return member_to_response(member, current_user.id)


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
