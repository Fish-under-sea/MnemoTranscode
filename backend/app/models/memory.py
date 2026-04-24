"""
记忆相关数据模型

包含：档案（Archive）、成员（Member）、记忆（Memory）、记忆胶囊（MemoryCapsule）
"""

from datetime import datetime
from sqlalchemy import (
    Column, String, Text, Boolean, Integer, DateTime, ForeignKey, JSON, func, Index
)
from sqlalchemy.orm import relationship

from app.core.database import Base


class Archive(Base):
    """
    档案模型

    支持多种档案类型：
    - family: 家族记忆
    - lover: 恋人记忆
    - friend: 挚友记忆
    - relative: 至亲记忆
    - celebrity: 伟人/名人记忆
    - nation: 国家/历史记忆
    """

    __tablename__ = "archives"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    archive_type = Column(String(50), default="family", index=True)
    owner_id = Column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    owner = relationship("User", back_populates="archives")
    members = relationship(
        "Member", back_populates="archive", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_archive_owner_type", "owner_id", "archive_type"),
    )


class Member(Base):
    """
    成员模型

    代表档案中的一个角色（家族成员、恋人、伟人等）
    """

    __tablename__ = "members"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    relationship_type = Column(String(50), nullable=False)
    archive_id = Column(ForeignKey("archives.id", ondelete="CASCADE"), index=True)
    birth_year = Column(Integer, nullable=True)
    status = Column(String(16), nullable=False, default="active", index=True)
    end_year = Column(Integer, nullable=True)
    death_year = Column(Integer, nullable=True)
    bio = Column(Text, nullable=True)
    is_alive = Column(Boolean, default=True, nullable=True)
    voice_profile_id = Column(String(255), nullable=True)
    emotion_tags = Column(JSON, default=list)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    archive = relationship("Archive", back_populates="members")
    memories = relationship(
        "Memory", back_populates="member", cascade="all, delete-orphan"
    )
    capsules = relationship(
        "MemoryCapsule", back_populates="member", cascade="all, delete-orphan"
    )


class Memory(Base):
    """
    记忆条目模型

    存储单条记忆的完整信息
    """

    __tablename__ = "memories"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    content_text = Column(Text, nullable=False)
    member_id = Column(ForeignKey("members.id", ondelete="CASCADE"), index=True)
    timestamp = Column(DateTime(timezone=True), nullable=True)
    location = Column(String(255), nullable=True)
    emotion_label = Column(String(50), nullable=True, index=True)
    vector_embedding_id = Column(String(255), nullable=True)
    media_refs = Column(JSON, default=list)
    is_capsule = Column(Boolean, default=False)
    unlock_date = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    member = relationship("Member", back_populates="memories")

    __table_args__ = (
        Index("ix_memory_member_timestamp", "member_id", "timestamp"),
    )


class MemoryCapsule(Base):
    """
    记忆胶囊模型

    定时解封的记忆条目
    """

    __tablename__ = "memory_capsules"

    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(ForeignKey("members.id", ondelete="CASCADE"), index=True)
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)
    unlock_date = Column(DateTime(timezone=True), nullable=False)
    recipients = Column(JSON, default=list)
    status = Column(String(20), default="locked")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    delivered_at = Column(DateTime(timezone=True), nullable=True)

    member = relationship("Member", back_populates="capsules")

    __table_args__ = (
        Index("ix_capsule_unlock_status", "unlock_date", "status"),
    )
