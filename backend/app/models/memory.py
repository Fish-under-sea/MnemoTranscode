"""
记忆相关数据模型

包含：档案（Archive）、成员（Member）、记忆（Memory）、记忆胶囊（MemoryCapsule）
"""

from datetime import datetime
from sqlalchemy import (
    String, Text, Boolean, Integer, DateTime, ForeignKey, JSON, func, Index
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

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

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    archive_type: Mapped[str] = mapped_column(
        String(50), default="family", index=True
    )  # family, lover, friend, relative, celebrity, nation
    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    owner: Mapped["User"] = relationship("User", back_populates="archives")
    members: Mapped[list["Member"]] = relationship(
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

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    relationship: Mapped[str] = mapped_column(String(50), nullable=False)
    archive_id: Mapped[int] = mapped_column(
        ForeignKey("archives.id", ondelete="CASCADE"), index=True
    )
    birth_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    death_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_alive: Mapped[bool] = mapped_column(Boolean, default=True)
    voice_profile_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    emotion_tags: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    archive: Mapped["Archive"] = relationship("Archive", back_populates="members")
    memories: Mapped[list["Memory"]] = relationship(
        "Memory", back_populates="member", cascade="all, delete-orphan"
    )
    capsules: Mapped[list["MemoryCapsule"]] = relationship(
        "MemoryCapsule", back_populates="member", cascade="all, delete-orphan"
    )


class Memory(Base):
    """
    记忆条目模型

    存储单条记忆的完整信息
    """

    __tablename__ = "memories"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    content_text: Mapped[str] = mapped_column(Text, nullable=False)
    member_id: Mapped[int] = mapped_column(
        ForeignKey("members.id", ondelete="CASCADE"), index=True
    )
    timestamp: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    emotion_label: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    vector_embedding_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    media_refs: Mapped[list] = mapped_column(JSON, default=list)
    is_capsule: Mapped[bool] = mapped_column(Boolean, default=False)
    unlock_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    member: Mapped["Member"] = relationship("Member", back_populates="memories")

    __table_args__ = (
        Index("ix_memory_member_timestamp", "member_id", "timestamp"),
    )


class MemoryCapsule(Base):
    """
    记忆胶囊模型

    定时解封的记忆条目
    """

    __tablename__ = "memory_capsules"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    member_id: Mapped[int] = mapped_column(
        ForeignKey("members.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    unlock_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    recipients: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(
        String(20), default="locked"
    )  # locked, unlocked, delivered
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    delivered_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    member: Mapped["Member"] = relationship("Member", back_populates="capsules")

    __table_args__ = (
        Index("ix_capsule_unlock_status", "unlock_date", "status"),
    )
