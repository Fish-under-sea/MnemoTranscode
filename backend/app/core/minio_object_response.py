"""MinIO 对象按 key 流式输出为 StreamingResponse（用户头像、成员头像等同域拉流）。"""

from __future__ import annotations

import time

from fastapi import HTTPException, status
from fastapi.responses import StreamingResponse
from minio import Minio
from minio.error import S3Error

from app.core.config import get_settings


def streaming_response_for_object_key(key: str, *, bucket: str | None = None) -> StreamingResponse:
    """读取 bucket 内 object，返回可直接用于 get 路由的响应。"""
    if not key or not key.strip():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文件不存在")

    settings = get_settings()
    client = Minio(
        settings.minio_endpoint,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=settings.minio_secure,
        region="us-east-1",
    )
    bucket_name = (bucket or "").strip() or settings.minio_bucket

    try:
        stat = client.stat_object(bucket_name, key)
    except S3Error as e:
        code = getattr(e, "code", "") or ""
        if "NoSuchKey" in str(e) or "NotFound" in str(e) or code in ("NoSuchKey", "NoSuchObject"):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文件不存在") from e
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="存储读取失败",
        ) from e

    try:
        response = client.get_object(bucket_name, key)
    except S3Error as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="存储读取失败",
        ) from e

    def guess_ct() -> str:
        c = (stat.content_type or "").strip()
        if c and c != "application/octet-stream":
            return c
        low = key.lower()
        if low.endswith(".png"):
            return "image/png"
        if low.endswith((".jpg", ".jpeg")):
            return "image/jpeg"
        if low.endswith(".webp"):
            return "image/webp"
        if low.endswith(".gif"):
            return "image/gif"
        if low.endswith((".mp4", ".m4v")):
            return "video/mp4"
        if low.endswith(".webm"):
            return "video/webm"
        if low.endswith((".mov", ".qt")):
            return "video/quicktime"
        return "application/octet-stream"

    content_type = guess_ct()

    def gen():
        try:
            while True:
                chunk = response.read(32 * 1024)
                if not chunk:
                    break
                yield chunk
        finally:
            response.close()
            response.release_conn()

    return StreamingResponse(
        gen(),
        media_type=content_type,
        headers={"Cache-Control": "private, max-age=300"},
    )


def raise_if_expired(exp: int) -> None:
    if int(time.time()) > exp:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="链接已过期，请刷新页面")
