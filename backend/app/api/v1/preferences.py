"""
用户偏好 API
"""
from __future__ import annotations

import io
import uuid

from fastapi import APIRouter, Depends, Query, UploadFile, File, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.api.v1.auth import get_current_user
from app.models.user import User
from app.models.preferences import UserPreferences
from app.schemas.user_center import (
    UserPreferencesResponse,
    UserPreferencesUpdate,
)
from app.core.avatar_public_url import (
    browser_app_background_url,
    build_app_background_display_url,
    parse_object_key_from_stored_url,
    verify_app_background_file_signature,
)
from app.core.minio_object_response import raise_if_expired, streaming_response_for_object_key
from app.core.config import get_settings
from app.services.upload_bounded import read_upload_file_max

router = APIRouter(prefix="/preferences", tags=["用户偏好"])


def _infer_background_kind(url: str) -> str:
    """外链 / data URI → image 或 video，供仅改 URL 时自动落库。"""
    u = url.strip().lower()
    base = u.split("?")[0]
    if u.startswith("data:video/"):
        return "video"
    if u.startswith("data:image/"):
        return "image"
    if base.endswith((".mp4", ".webm", ".mov", ".m4v", ".ogv")):
        return "video"
    return "image"


# 壁纸可含短视频；略高于头像上限
_APP_BG_MAX_BYTES = 42 * 1024 * 1024

_IMG_CT = frozenset(
    {
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
    }
)
_VID_CT = frozenset(
    {
        "video/mp4",
        "video/webm",
        "video/quicktime",
    }
)


def _prefs_browser_response(row: UserPreferences) -> UserPreferencesResponse:
    data = UserPreferencesResponse.model_validate(row).model_dump()
    data["app_background_url"] = browser_app_background_url(row.user_id, row.app_background_url)
    return UserPreferencesResponse(**data)


@router.get("", response_model=UserPreferencesResponse)
async def get_preferences(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取用户偏好设置"""
    result = await db.execute(select(UserPreferences).where(UserPreferences.user_id == current_user.id))
    prefs = result.scalar_one_or_none()

    if not prefs:
        prefs = UserPreferences(user_id=current_user.id)
        db.add(prefs)
        await db.commit()
        await db.refresh(prefs)

    return _prefs_browser_response(prefs)


@router.put("", response_model=UserPreferencesResponse)
async def update_preferences(
    update_data: UserPreferencesUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新用户偏好设置"""
    result = await db.execute(select(UserPreferences).where(UserPreferences.user_id == current_user.id))
    prefs = result.scalar_one_or_none()

    if not prefs:
        prefs = UserPreferences(user_id=current_user.id)
        db.add(prefs)

    update_dict = update_data.model_dump(exclude_unset=True)

    clearing_bg = False
    if "app_background_url" in update_dict and update_dict["app_background_url"] in ("", None):
        clearing_bg = True
        update_dict["app_background_url"] = None

    if clearing_bg:
        update_dict["app_background_kind"] = None
    elif (raw_u := update_dict.get("app_background_url")) and isinstance(raw_u, str) and raw_u.strip():
        if update_dict.get("app_background_kind") is None:
            update_dict["app_background_kind"] = _infer_background_kind(raw_u)

    for key, value in update_dict.items():
        setattr(prefs, key, value)

    await db.commit()
    await db.refresh(prefs)
    return _prefs_browser_response(prefs)


def _guess_ext_and_kind(filename: str, content_type: str | None) -> tuple[str, str]:
    ct = (content_type or "").split(";")[0].strip().lower()
    low_name = (filename or "").lower()
    tail = low_name.rsplit(".", 1)[-1] if "." in low_name else ""

    if ct in _IMG_CT:
        ext = {"image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp"}[ct]
        return ext, "image"
    if ct in _VID_CT:
        ext = {"video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov"}[ct]
        return ext, "video"

    img_tail = frozenset({"jpg", "jpeg", "png", "gif", "webp"})
    vid_tail = frozenset({"mp4", "webm", "mov", "m4v", "ogv"})
    if tail in vid_tail:
        return tail, "video"
    if tail in img_tail:
        return "jpg" if tail == "jpeg" else tail, "image"

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"不支持的内容类型「{ct or tail}」，请上传图片（JPEG/PNG/GIF/WebP）或视频（MP4/WebM/MOV）。",
    )


@router.post("/app-background")
async def upload_app_background(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """上传全站背景素材（入库 MinIO），返回同源可展示的 URL。"""
    settings = get_settings()
    raw = await read_upload_file_max(file, _APP_BG_MAX_BYTES, "网页背景素材")
    file_ext, bg_kind = _guess_ext_and_kind(file.filename or "", file.content_type)

    result = await db.execute(select(UserPreferences).where(UserPreferences.user_id == current_user.id))
    prefs = result.scalar_one_or_none()
    if not prefs:
        prefs = UserPreferences(user_id=current_user.id)
        db.add(prefs)

    object_name = f"app-backgrounds/{current_user.id}/{uuid.uuid4()}.{file_ext}"
    content_type = (file.content_type or "").split(";")[0].strip() or (
        "video/mp4" if bg_kind == "video" else "image/jpeg"
    )

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
            io.BytesIO(raw),
            len(raw),
            content_type=content_type,
        )
        file_url = f"http://{settings.minio_endpoint}/{bucket_name}/{object_name}"
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"背景上传失败: {e!s}",
        ) from e

    prefs.app_background_url = file_url
    prefs.app_background_kind = bg_kind
    await db.commit()
    await db.refresh(prefs)

    display = build_app_background_display_url(current_user.id, prefs.app_background_url)
    return {
        "url": display,
        "kind": bg_kind,
        "preferences": _prefs_browser_response(prefs).model_dump(),
    }


@router.get("/app-background-file")
async def get_app_background_file(
    uid: int = Query(..., description="用户 ID"),
    exp: int = Query(..., description="过期时间 Unix 秒"),
    sig: str = Query(..., min_length=32, max_length=128, description="HMAC-SHA256 十六进制"),
    db: AsyncSession = Depends(get_db),
):
    """流式输出用户当前设置的背景文件（与头像同域拉流）。"""
    raise_if_expired(exp)

    result = await db.execute(select(UserPreferences).where(UserPreferences.user_id == uid))
    prefs = result.scalar_one_or_none()
    if not prefs or not prefs.app_background_url:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="背景不存在")

    if not verify_app_background_file_signature(uid, prefs.app_background_url, exp, sig):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="签名无效")

    key = parse_object_key_from_stored_url(prefs.app_background_url)
    if not key:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="存储键解析失败")

    return streaming_response_for_object_key(key)
