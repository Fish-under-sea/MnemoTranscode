"""将存库的 MinIO 直链转为浏览器可用的预签名 GET URL（私有桶可读）。"""

from datetime import timedelta

from minio import Minio

from app.core.config import get_settings

settings = get_settings()


def resolve_client_avatar_url(avatar_url: str | None) -> str | None:
    if not avatar_url:
        return None
    bucket = settings.minio_bucket
    prefixes = (
        f"http://{settings.minio_endpoint}/{bucket}/",
        f"https://{settings.minio_endpoint}/{bucket}/",
    )
    object_key: str | None = None
    for p in prefixes:
        if avatar_url.startswith(p):
            object_key = avatar_url[len(p) :]
            break
    if not object_key:
        return avatar_url
    try:
        client = Minio(
            settings.minio_endpoint,
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=settings.minio_secure,
        )
        return client.presigned_get_object(bucket, object_key, expires=timedelta(hours=24))
    except Exception:
        return avatar_url
