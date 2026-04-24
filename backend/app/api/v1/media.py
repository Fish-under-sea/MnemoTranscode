"""多媒体管理 API（兼容旧接口 + 新两阶段上传接口）。"""

from datetime import datetime, timedelta, timezone
from enum import Enum
import uuid

from fastapi import APIRouter, Depends, File, UploadFile
from minio import Minio
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth import get_current_user
from app.core.config import get_settings
from app.core.database import get_db
from app.core.exceptions import DomainInternalError, DomainMediaError, DomainResourceError
from app.models.media import MediaAsset, MediaUploadSession
from app.models.user import User

router = APIRouter(prefix="/media", tags=["多媒体"])
settings = get_settings()


class UploadPurpose(str, Enum):
    AVATAR = "avatar"
    VOICE_SAMPLE = "voice_sample"
    ARCHIVE_PHOTO = "archive_photo"
    ARCHIVE_VIDEO = "archive_video"
    ARCHIVE_AUDIO = "archive_audio"
    OTHER = "other"


PURPOSE_CONTENT_TYPES = {
    UploadPurpose.AVATAR: {"image/jpeg", "image/png", "image/webp"},
    UploadPurpose.ARCHIVE_PHOTO: {"image/jpeg", "image/png", "image/webp", "image/heic"},
    UploadPurpose.ARCHIVE_AUDIO: {"audio/mpeg", "audio/wav", "audio/ogg", "audio/mp3", "audio/mp4", "audio/webm"},
    UploadPurpose.VOICE_SAMPLE: {"audio/mpeg", "audio/wav", "audio/ogg", "audio/mp3", "audio/mp4", "audio/webm"},
    UploadPurpose.ARCHIVE_VIDEO: {"video/mp4", "video/webm", "video/quicktime"},
}

MAX_SIZE_BYTES = {
    UploadPurpose.AVATAR: 5 * 1024 * 1024,
    UploadPurpose.ARCHIVE_PHOTO: 20 * 1024 * 1024,
    UploadPurpose.ARCHIVE_AUDIO: 100 * 1024 * 1024,
    UploadPurpose.VOICE_SAMPLE: 100 * 1024 * 1024,
    UploadPurpose.ARCHIVE_VIDEO: 500 * 1024 * 1024,
    UploadPurpose.OTHER: 100 * 1024 * 1024,
}


class UploadInitRequest(BaseModel):
    filename: str = Field(..., min_length=1)
    content_type: str = Field(..., min_length=1)
    size: int = Field(..., gt=0)
    purpose: UploadPurpose
    archive_id: int | None = None
    member_id: int | None = None


class UploadCompleteRequest(BaseModel):
    upload_id: str = Field(..., min_length=1)
    object_key: str = Field(..., min_length=1)
    etag: str | None = None
    size: int | None = None


def _minio_client() -> Minio:
    return Minio(
        settings.minio_endpoint,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=settings.minio_secure,
    )


def _validate_upload_request(payload: UploadInitRequest) -> None:
    allowed = PURPOSE_CONTENT_TYPES.get(payload.purpose, set())
    if payload.purpose == UploadPurpose.OTHER:
        if not (
            payload.content_type.startswith("image/")
            or payload.content_type.startswith("audio/")
            or payload.content_type.startswith("video/")
        ):
            raise DomainMediaError("MEDIA_UPLOAD_INIT_INVALID_TYPE", "other 仅支持媒体类型")
    elif payload.content_type not in allowed:
        raise DomainMediaError("MEDIA_UPLOAD_INIT_INVALID_TYPE", "不支持的文件类型")

    if payload.size > MAX_SIZE_BYTES[payload.purpose]:
        raise DomainMediaError("MEDIA_UPLOAD_INIT_FILE_TOO_LARGE", "文件大小超过限制")


@router.post("/uploads/init")
async def init_upload(
    payload: UploadInitRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _validate_upload_request(payload)

    safe_filename = payload.filename.replace("/", "_").replace("\\", "_").strip()
    if not safe_filename:
        raise DomainMediaError("MEDIA_UPLOAD_INIT_INVALID_FILENAME", "文件名不能为空")

    upload_id = str(uuid.uuid4())
    object_key = f"{current_user.id}/{datetime.now(timezone.utc):%Y/%m}/{upload_id}-{safe_filename}"
    expires_in = 3600
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

    try:
        client = _minio_client()
        bucket = settings.minio_bucket
        if not client.bucket_exists(bucket):
            client.make_bucket(bucket)
        put_url = client.presigned_put_object(bucket, object_key, expires=timedelta(seconds=expires_in))
    except Exception as exc:
        raise DomainInternalError("INTERNAL_SERVER_ERROR", f"生成上传凭证失败: {exc}") from exc

    session = MediaUploadSession(
        upload_id=upload_id,
        owner_id=current_user.id,
        archive_id=payload.archive_id,
        member_id=payload.member_id,
        purpose=payload.purpose.value,
        object_key=object_key,
        content_type=payload.content_type,
        declared_size=payload.size,
        status="initiated",
        expires_at=expires_at,
    )
    db.add(session)
    await db.commit()

    return {
        "upload_id": upload_id,
        "object_key": object_key,
        "put_url": put_url,
        "expires_in": expires_in,
        "required_headers": {"Content-Type": payload.content_type},
    }


@router.post("/uploads/complete")
async def complete_upload(
    payload: UploadCompleteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(MediaUploadSession).where(MediaUploadSession.upload_id == payload.upload_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise DomainResourceError("MEDIA_UPLOAD_COMPLETE_NOT_FOUND", "上传会话不存在")
    if session.owner_id != current_user.id or session.object_key != payload.object_key:
        raise DomainMediaError("MEDIA_UPLOAD_COMPLETE_OWNERSHIP_MISMATCH", "上传会话归属不匹配")
    if session.status == "uploaded":
        result = await db.execute(
            select(MediaAsset).where(MediaAsset.source_upload_session_id == session.id)
        )
        existing = result.scalar_one_or_none()
        return {"media_id": existing.id if existing else None, "object_key": session.object_key, "status": "uploaded"}
    if session.expires_at <= datetime.now(timezone.utc):
        session.status = "expired"
        await db.commit()
        raise DomainMediaError("MEDIA_UPLOAD_COMPLETE_EXPIRED", "上传会话已过期")

    client = _minio_client()
    try:
        stat = client.stat_object(settings.minio_bucket, session.object_key)
    except Exception as exc:
        raise DomainMediaError("MEDIA_UPLOAD_COMPLETE_OBJECT_MISSING", f"对象不存在: {exc}") from exc

    if payload.size is not None and payload.size != stat.size:
        raise DomainMediaError("MEDIA_UPLOAD_COMPLETE_CHECKSUM_MISMATCH", "上传文件大小不匹配")
    if payload.etag and payload.etag.strip('"') != stat.etag.strip('"'):
        raise DomainMediaError("MEDIA_UPLOAD_COMPLETE_CHECKSUM_MISMATCH", "上传文件 ETag 不匹配")

    asset = MediaAsset(
        owner_id=current_user.id,
        source_upload_session_id=session.id,
        object_key=session.object_key,
        bucket=settings.minio_bucket,
        content_type=session.content_type,
        size=stat.size,
        purpose=session.purpose,
        archive_id=session.archive_id,
        member_id=session.member_id,
    )
    db.add(asset)
    session.status = "uploaded"
    session.completed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(asset)

    return {"media_id": asset.id, "object_key": asset.object_key, "status": "uploaded"}


@router.get("/{media_id}/download-url")
async def get_download_url(
    media_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(MediaAsset).where(MediaAsset.id == media_id))
    asset = result.scalar_one_or_none()
    if not asset:
        raise DomainResourceError("MEDIA_PRESIGN_GET_NOT_FOUND", "媒体资源不存在")
    if asset.owner_id != current_user.id:
        raise DomainMediaError("MEDIA_PRESIGN_GET_FORBIDDEN", "无权限访问该媒体资源")

    client = _minio_client()
    expires_in = 3600
    url = client.presigned_get_object(asset.bucket, asset.object_key, expires=timedelta(seconds=expires_in))
    return {"get_url": url, "expires_in": expires_in}


# 旧直传接口保留一个兼容周期，后续由 B/C 前端切换完成后删除
@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    content = await file.read()
    if len(content) <= 0:
        raise DomainMediaError("MEDIA_UPLOAD_INIT_INVALID_SIZE", "文件大小不合法")
    content_type = file.content_type or "application/octet-stream"
    object_name = f"{current_user.id}/{uuid.uuid4()}"
    try:
        client = _minio_client()
        bucket_name = settings.minio_bucket
        if not client.bucket_exists(bucket_name):
            client.make_bucket(bucket_name)
        client.put_object(bucket_name, object_name, file.file, len(content), content_type=content_type)
        file_url = f"http://{settings.minio_endpoint}/{bucket_name}/{object_name}"
        return {"url": file_url, "object_name": object_name, "content_type": content_type, "size": len(content)}
    except Exception as exc:
        raise DomainInternalError("INTERNAL_SERVER_ERROR", f"文件上传失败: {exc}") from exc


@router.get("/{object_name:path}")
async def get_media(
    object_name: str,
    current_user: User = Depends(get_current_user),
):
    file_url = f"http://{settings.minio_endpoint}/{settings.minio_bucket}/{object_name}"
    return {"url": file_url}
