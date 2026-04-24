"""
用量记录模型 — 记录用户的 AI 模型调用量
"""
from datetime import datetime
from sqlalchemy import Column, Integer, BigInteger, String, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.core.database import Base


class UsageRecord(Base):
    """AI 用量记录"""

    __tablename__ = "usage_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    action_type = Column(String(50), nullable=False)
    token_count = Column(BigInteger, default=0)
    cost = Column(Integer, default=0)
    model_name = Column(String(100), nullable=True)
    session_id = Column(String(100), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, index=True)

    # 索引优化
    __table_args__ = (
        Index("ix_usage_user_month", "user_id", "created_at"),
    )

    def __repr__(self):
        return f"<UsageRecord user={self.user_id} action={self.action_type} tokens={self.token_count}>"
