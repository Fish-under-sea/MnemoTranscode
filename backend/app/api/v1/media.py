"""多媒体管理 API（兼容旧接口 + 新两阶段上传接口）。"""

from datetime import datetime, timedelta, timezone
from enum import Enum
import io
import os
import tempfile
import uuid

from fastapi import APIRouter, Depends, File, UploadFile, Form
from minio import Minio
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth import get_current_user
from app.core.config import get_settings
from app.core.minio_presign import minio_presign_endpoint
from app.core.database import get_db
from app.core.exceptions import DomainInternalError, DomainMediaError, DomainResourceError
from app.models.media import MediaAsset, MediaUploadSession
from app.models.user import User
from app.services.avatar_image import AVATAR_MAX_RAW_BYTES

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
    UploadPurpose.AVATAR: AVATAR_MAX_RAW_BYTES,
    UploadPurpose.ARCHIVE_PHOTO: 100 * 1024 * 1024,
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


def _minio_client_internal() -> Minio:
    """服务端连对象存储（容器内可用 minio:9000）。"""
    return Minio(
        settings.minio_endpoint,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=settings.minio_secure,
    )


def _minio_client_presign() -> Minio:
    """仅用于生成浏览器可访问的预签名 URL（主机为 MINIO_PUBLIC_ENDPOINT 或 127.0.0.1:端口）。"""
    return Minio(
        minio_presign_endpoint(),
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


def _sniff_content_type(filename: str, reported: str) -> str:
    """部分浏览器 file.type 为空，按扩展名补全以便通过校验。"""
    r = (reported or "").strip()
    if r and r != "application/octet-stream":
        return r
    low = (filename or "").lower()
    if low.endswith(".png"):
        return "image/png"
    if low.endswith((".jpg", ".jpeg")):
        return "image/jpeg"
    if low.endswith(".webp"):
        return "image/webp"
    if low.endswith(".heic"):
        return "image/heic"
    if low.endswith(".gif"):
        return "image/gif"
    if low.endswith(".mp4"):
        return "video/mp4"
    if low.endswith(".webm"):
        return "video/webm"
    if low.endswith(".mov"):
        return "video/quicktime"
    if low.endswith((".mp3", ".mpeg")):
        return "audio/mpeg"
    if low.endswith(".wav"):
        return "audio/wav"
    if low.endswith(".ogg"):
        return "audio/ogg"
    return r or "application/octet-stream"


@router.post("/uploads/direct")
@router.post("/uploads/commit")
async def upload_direct(
    file: UploadFile = File(...),
    purpose: str = Form(...),
    member_id: int | None = Form(None),
    archive_id: int | None = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """浏览器经 API  multipart 上传，由服务端写入 MinIO（避免预签名直连对象存储失败）。"""
    try:
        p = UploadPurpose(purpose)
    except ValueError as exc:
        raise DomainMediaError("MEDIA_UPLOAD_INIT_INVALID_TYPE", f"无效的 purpose: {purpose}") from exc

    raw_name = (file.filename or "upload").replace("/", "_").replace("\\", "_").strip()
    if not raw_name:
        raise DomainMediaError("MEDIA_UPLOAD_INIT_INVALID_FILENAME", "文件名不能为空")

    max_b = MAX_SIZE_BYTES[p]
    tmp_path: str | None = None
    tmp_file = None
    closed = False
    try:
        tmp_file = tempfile.NamedTemporaryFile(delete=False, prefix="mtc-direct-")
        tmp_path = tmp_file.name
        size = 0
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            size += len(chunk)
            if size > max_b:
                raise DomainMediaError("MEDIA_UPLOAD_INIT_FILE_TOO_LARGE", "文件大小超过限制")
            tmp_file.write(chunk)
        tmp_file.flush()
        tmp_file.close()
        closed = True
        if size <= 0:
            raise DomainMediaError("MEDIA_UPLOAD_INIT_INVALID_SIZE", "文件大小不合法")

        content_type = _sniff_content_type(raw_name, file.content_type or "")
        pseudo = UploadInitRequest(
            filename=raw_name,
            content_type=content_type,
            size=size,
            purpose=p,
            archive_id=archive_id,
            member_id=member_id,
        )
        _validate_upload_request(pseudo)

        upload_id = str(uuid.uuid4())
        object_key = f"{current_user.id}/{datetime.now(timezone.utc):%Y/%m}/{upload_id}-{raw_name}"
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=3600)
        now = datetime.now(timezone.utc)

        internal = _minio_client_internal()
        bucket = settings.minio_bucket
        if not internal.bucket_exists(bucket):
            internal.make_bucket(bucket)
        internal.fput_object(bucket, object_key, tmp_path, content_type=content_type)
    except DomainMediaError:
        raise
    except Exception as exc:
        raise DomainInternalError("INTERNAL_SERVER_ERROR", f"对象存储写入失败: {exc}") from exc
    finally:
        if tmp_file is not None and not closed:
            try:
                tmp_file.close()
            except Exception:
                pass
        if tmp_path and os.path.isfile(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

    session = MediaUploadSession(
        upload_id=upload_id,
        owner_id=current_user.id,
        archive_id=archive_id,
        member_id=member_id,
        purpose=p.value,
        object_key=object_key,
        content_type=content_type,
        declared_size=size,
        status="uploaded",
        expires_at=expires_at,
        completed_at=now,
    )
    db.add(session)
    await db.flush()

    asset = MediaAsset(
        owner_id=current_user.id,
        source_upload_session_id=session.id,
        object_key=object_key,
        bucket=settings.minio_bucket,
        content_type=content_type,
        size=size,
        purpose=p.value,
        archive_id=archive_id,
        member_id=member_id,
    )
    db.add(asset)
    await db.commit()
    await db.refresh(asset)

    return {
        "media_id": asset.id,
        "object_key": object_key,
        "upload_id": upload_id,
        "status": "uploaded",
    }


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
        internal = _minio_client_internal()
        bucket = settings.minio_bucket
        if not internal.bucket_exists(bucket):
            internal.make_bucket(bucket)
        presign = _minio_client_presign()
        put_url = presign.presigned_put_object(bucket, object_key, expires=timedelta(seconds=expires_in))
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

    client = _minio_client_internal()
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


class MediaAssetOut(BaseModel):
    """媒体资产列表项（与前端 mediaApi 对齐）。"""

    id: int
    object_key: str
    bucket: str
    content_type: str
    size: int
    purpose: str
    archive_id: int | None = None
    member_id: int | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


@router.get("", response_model=list[MediaAssetOut])
@router.get("/", response_model=list[MediaAssetOut])
async def list_media_assets(
    member_id: int | None = None,
    archive_id: int | None = None,
    purpose: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """当前用户拥有的媒体列表，可按成员 / 档案 / 用途筛选。"""
    stmt = select(MediaAsset).where(MediaAsset.owner_id == current_user.id)
    if member_id is not None:
        stmt = stmt.where(MediaAsset.member_id == member_id)
    if archive_id is not None:
        stmt = stmt.where(MediaAsset.archive_id == archive_id)
    if purpose is not None:
        stmt = stmt.where(MediaAsset.purpose == purpose)
    stmt = stmt.order_by(MediaAsset.created_at.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


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

    presign = _minio_client_presign()
    expires_in = 3600
    url = presign.presigned_get_object(asset.bucket, asset.object_key, expires=timedelta(seconds=expires_in))
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
        client = _minio_client_internal()
        bucket_name = settings.minio_bucket
        if not client.bucket_exists(bucket_name):
            client.make_bucket(bucket_name)
        client.put_object(bucket_name, object_name, io.BytesIO(content), len(content), content_type=content_type)
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
