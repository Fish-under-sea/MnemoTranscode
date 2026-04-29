"""
安全模块：密码哈希、JWT 令牌、加密工具
"""

from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext
from app.core.config import get_settings

settings = get_settings()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """对密码进行哈希加密"""
    # 截断字节长度（而不是字符长度），防止超出 bcrypt 72 字节限制
    password_bytes = password.encode('utf-8')[:72]
    return pwd_context.hash(password_bytes.decode('utf-8', errors='ignore'))


def verify_password(plain_password: str, hashed_password: str | None) -> bool:
    """验证密码是否匹配（哈希损坏或无法识别时返回 False，不向外抛异常）"""
    if not hashed_password:
        return False
    password_bytes = plain_password.encode("utf-8")[:72]
    plain = password_bytes.decode("utf-8", errors="ignore")
    try:
        return pwd_context.verify(plain, hashed_password)
    except ValueError:
        # passlib：空串、未知算法或非 bcrypt 格式的哈希
        return False


def create_access_token(data: dict[str, Any], expires_delta: timedelta | None = None) -> str:
    """创建 JWT 访问令牌"""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def decode_access_token(token: str) -> dict[str, Any] | None:
    """解码并验证 JWT 令牌"""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        return payload
    except JWTError:
        return None
