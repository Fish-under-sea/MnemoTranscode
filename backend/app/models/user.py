"""
用户模型
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, BigInteger, Text, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class User(Base):
    """用户模型"""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True)
    username = Column(String(100))
    hashed_password = Column(String(255))
    is_active = Column(Boolean, default=True)
    avatar_url = Column(String(500), nullable=True)

    # 订阅信息
    subscription_tier = Column(String(20), default="free")
    subscription_expires_at = Column(DateTime(timezone=True), nullable=True)
    monthly_token_limit = Column(BigInteger, default=100000)
    monthly_token_used = Column(BigInteger, default=0)

    # AI 记忆上下文（JSON 格式，存储跨会话对话摘要）
    ai_memory_context = Column(Text, nullable=True)

    # 头像相关
    avatar_seed = Column(String(100), nullable=True)

    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_active_at = Column(DateTime(timezone=True), nullable=True)

    archives = relationship("Archive", back_populates="owner", lazy="selectin")
