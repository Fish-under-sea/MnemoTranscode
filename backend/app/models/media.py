"""媒体上传会话与媒体资产模型。"""

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, BigInteger, func
from sqlalchemy.dialects.postgresql import JSONB

from app.core.database import Base


class MediaUploadSession(Base):
    __tablename__ = "media_upload_sessions"

    id = Column(Integer, primary_key=True, index=True)
    upload_id = Column(String(36), unique=True, index=True, nullable=False)
    owner_id = Column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    archive_id = Column(Integer, nullable=True)
    member_id = Column(Integer, nullable=True)
    purpose = Column(String(32), nullable=False)
    object_key = Column(String(512), unique=True, nullable=False)
    content_type = Column(String(128), nullable=False)
    declared_size = Column(BigInteger, nullable=False)
    status = Column(String(16), nullable=False, default="initiated")
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)


class MediaAsset(Base):
    __tablename__ = "media_assets"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    source_upload_session_id = Column(
        ForeignKey("media_upload_sessions.id", ondelete="SET NULL"), nullable=True, index=True
    )
    object_key = Column(String(512), unique=True, nullable=False)
    bucket = Column(String(64), nullable=False)
    content_type = Column(String(128), nullable=False)
    size = Column(BigInteger, nullable=False)
    purpose = Column(String(32), nullable=False)
    # 表情包 AI 标签、候选分类等（JSON 对象，结构由业务约定）
    extras = Column(JSONB, nullable=True)
    visibility = Column(String(16), nullable=False, default="private")
    archive_id = Column(Integer, nullable=True, index=True)
    member_id = Column(Integer, nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

