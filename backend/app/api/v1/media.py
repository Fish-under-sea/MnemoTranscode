"""
多媒体管理 API 路由

负责照片、视频、音频等媒体文件的上传和管理
"""

import uuid
import httpx
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.config import get_settings
from app.models.user import User
from app.api.v1.auth import get_current_user

router = APIRouter(prefix="/media", tags=["多媒体"])
settings = get_settings()


ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
ALLOWED_VIDEO_TYPES = {"video/mp4", "video/webm", "video/quicktime"}
ALLOWED_AUDIO_TYPES = {"audio/mpeg", "audio/wav", "audio/ogg", "audio/mp3"}
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """
    上传媒体文件（照片/视频/音频）

    文件自动存储到 MinIO 并返回访问 URL
    """
    content = await file.read()

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"文件大小超过限制（最大 {MAX_FILE_SIZE // 1024 // 1024}MB）",
        )

    content_type = file.content_type or "application/octet-stream"

    if (
        content_type not in ALLOWED_IMAGE_TYPES
        and content_type not in ALLOWED_VIDEO_TYPES
        and content_type not in ALLOWED_AUDIO_TYPES
    ):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="不支持的文件类型",
        )

    file_ext = file.filename.split(".")[-1] if file.filename else "bin"
    object_name = f"{current_user.id}/{uuid.uuid4()}.{file_ext}"

    try:
        from minio import Minio

        client = Minio(
            settings.minio_endpoint,
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=settings.minio_secure,
        )

        bucket_name = settings.minio_bucket
        if not client.bucket_exists(bucket_name):
            client.make_bucket(bucket_name)

        client.put_object(
            bucket_name,
            object_name,
            file,
            len(content),
            content_type=content_type,
        )

        file_url = f"http://{settings.minio_endpoint}/{bucket_name}/{object_name}"

        return {
            "url": file_url,
            "object_name": object_name,
            "content_type": content_type,
            "size": len(content),
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"文件上传失败: {str(e)}",
        )


@router.get("/{object_name:path}")
async def get_media(
    object_name: str,
    current_user: User = Depends(get_current_user),
):
    """获取媒体文件访问 URL"""
    file_url = f"http://{settings.minio_endpoint}/{settings.minio_bucket}/{object_name}"
    return {"url": file_url}
