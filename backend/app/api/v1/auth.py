"""
用户相关 API 路由
"""

import io
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token, decode_access_token
from app.core.config import get_settings
from app.core.avatar_public_url import (
    build_avatar_display_url,
    parse_object_key_from_stored_url,
    verify_avatar_file_signature,
)
from app.models.user import User
from app.models.preferences import UserPreferences
from app.schemas.memory import (
    UserCreate, UserUpdate, UserResponse,
    TokenResponse
)
from app.schemas.user_center import SubscriptionResponse, SubscriptionTierUpdate
from app.services.subscription import apply_tier_to_user, build_subscription_response

settings = get_settings()
router = APIRouter(prefix="/auth", tags=["认证"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """获取当前登录用户"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="无法验证凭据",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
    try:
        user_id: int = int(payload.get("sub"))
    except (TypeError, ValueError):
        raise credentials_exception
    if user_id is None:
        raise credentials_exception
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception
    # 更新最后活跃时间（仅 flush，与同请求内其它写操作由 get_db 或路由内 commit 一并提交）
    user.last_active_at = datetime.now(timezone.utc)
    await db.flush()
    return user


def build_user_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        username=user.username,
        is_active=user.is_active,
        created_at=user.created_at,
        avatar_url=build_avatar_display_url(user.id, user.avatar_url),
        subscription_tier=user.subscription_tier or "free",
        monthly_token_limit=user.monthly_token_limit or 100000,
        monthly_token_used=user.monthly_token_used or 0,
    )


@router.get("/avatar-file")
async def get_avatar_file(
    uid: int = Query(..., description="用户 ID"),
    exp: int = Query(..., description="过期时间 Unix 秒"),
    sig: str = Query(..., min_length=32, max_length=128, description="HMAC-SHA256 十六进制"),
    db: AsyncSession = Depends(get_db),
):
    """拉取用户头像原图。供 <img src> 同域/反代使用，无需 MinIO 预签名、不经过浏览器直连对象存储。"""

    if int(time.time()) > exp:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="链接已过期，请刷新页面")

    result = await db.execute(select(User).where(User.id == uid))
    user = result.scalar_one_or_none()
    if not user or not user.avatar_url:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="头像不存在")

    if not verify_avatar_file_signature(uid, user.avatar_url, exp, sig):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="签名无效")

    key = parse_object_key_from_stored_url(user.avatar_url)
    if not key:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="头像数据异常")

    from minio import Minio
    from minio.error import S3Error

    client = Minio(
        settings.minio_endpoint,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=settings.minio_secure,
        region="us-east-1",
    )
    bucket = settings.minio_bucket
    try:
        stat = client.stat_object(bucket, key)
    except S3Error as e:
        code = getattr(e, "code", "") or ""
        if "NoSuchKey" in str(e) or "NotFound" in str(e) or code in ("NoSuchKey", "NoSuchObject"):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文件不存在")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="存储读取失败"
        ) from e

    try:
        response = client.get_object(bucket, key)
    except S3Error as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="存储读取失败"
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


@router.post("/register", response_model=TokenResponse)
async def register(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    """用户注册"""
    result = await db.execute(select(User).where(User.email == user_data.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="该邮箱已被注册")

    user = User(
        email=user_data.email,
        username=user_data.username,
        hashed_password=hash_password(user_data.password),
        monthly_token_limit=100000,
        monthly_token_used=0,
        subscription_tier="free",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # 为新用户创建默认偏好
    prefs = UserPreferences(user_id=user.id)
    db.add(prefs)
    await db.commit()

    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(
        access_token=token,
        user=build_user_response(user),
    )


@router.post("/login", response_model=TokenResponse)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    """用户登录（OAuth2 密码模式）"""
    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalar_one_or_none()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="邮箱或密码错误")

    user.last_active_at = datetime.now(timezone.utc)
    await db.commit()

    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(
        access_token=token,
        user=build_user_response(user),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """获取当前用户信息"""
    return build_user_response(current_user)


@router.patch("/me", response_model=UserResponse)
async def update_me(
    update_data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新当前用户信息（可含 subscription_tier，与 POST /auth/subscription 等效）。"""
    if update_data.username:
        current_user.username = update_data.username
    if update_data.subscription_tier is not None:
        apply_tier_to_user(current_user, update_data.subscription_tier)
    await db.commit()
    await db.refresh(current_user)
    return build_user_response(current_user)


@router.post("/billing/apply-tier", response_model=SubscriptionResponse)
async def apply_tier_billing(
    body: SubscriptionTierUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    与 POST /auth/subscription 等效。路径中不含 *subscription*，避免反代/规则仅对 /auth/subscription 返回 405。
    """
    result = await db.execute(select(User).where(User.id == current_user.id))
    user = result.scalar_one()
    apply_tier_to_user(user, body.tier)
    await db.commit()
    await db.refresh(user)
    return build_subscription_response(user)


@router.post("/subscription", response_model=SubscriptionResponse)
@router.patch("/subscription", response_model=SubscriptionResponse)
@router.put("/subscription", response_model=SubscriptionResponse)
async def update_subscription_tier(
    body: SubscriptionTierUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """切换订阅档位（当前版本免支付，直接生效）。支持 POST / PATCH / PUT（任一反代封禁某方法时客户端可回退）。"""
    result = await db.execute(select(User).where(User.id == current_user.id))
    user = result.scalar_one()
    apply_tier_to_user(user, body.tier)
    await db.commit()
    await db.refresh(user)
    return build_subscription_response(user)


@router.get("/subscription", response_model=SubscriptionResponse)
async def get_subscription(
    current_user: User = Depends(get_current_user),
):
    """获取订阅信息"""
    return build_subscription_response(current_user)


@router.post("/refresh-token", response_model=TokenResponse)
async def refresh_token(
    remember: bool = Query(False),
    current_user: User = Depends(get_current_user),
):
    """刷新 Token"""
    expires_delta = timedelta(days=7) if remember else timedelta(minutes=settings.access_token_expire_minutes)
    token = create_access_token({"sub": str(current_user.id)}, expires_delta=expires_delta)
    return TokenResponse(
        access_token=token,
        user=build_user_response(current_user),
    )


ALLOWED_AVATAR_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
MAX_AVATAR_SIZE = 5 * 1024 * 1024  # 5MB


@router.post("/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """上传用户头像"""
    content = await file.read()

    if len(content) > MAX_AVATAR_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"头像文件过大（最大 5MB）",
        )

    content_type = file.content_type or "image/png"
    if content_type not in ALLOWED_AVATAR_TYPES:
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
    object_name = f"avatars/{current_user.id}/{uuid.uuid4()}.{file_ext}"

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

        # 构建公开访问 URL
        file_url = f"http://{settings.minio_endpoint}/{bucket_name}/{object_name}"

        # 更新用户头像 URL
        current_user.avatar_url = file_url
        await db.commit()
        await db.refresh(current_user)

        return {
            "url": build_avatar_display_url(current_user.id, current_user.avatar_url),
            "user": build_user_response(current_user),
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"头像上传失败: {str(e)}",
        )


@router.delete("/avatar", response_model=UserResponse)
async def delete_avatar(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除用户头像（恢复默认）"""
    current_user.avatar_url = None
    await db.commit()
    await db.refresh(current_user)
    return build_user_response(current_user)
