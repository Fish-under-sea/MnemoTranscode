"""
用户相关 Pydantic Schema
"""

from datetime import datetime
from pydantic import BaseModel, EmailStr, Field
from enum import Enum


class UserRole(str, Enum):
    """用户角色枚举"""
    owner = "owner"      # 档案所有者
    member = "member"    # 家族/关系成员
    viewer = "viewer"    # 只读访问者


# ==== 用户 Schema ====

class UserBase(BaseModel):
    """用户基础字段"""
    email: EmailStr
    username: str = Field(..., min_length=2, max_length=50)


class UserCreate(UserBase):
    """创建用户"""
    password: str = Field(..., min_length=6)


class UserLogin(BaseModel):
    """用户登录"""
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    """更新用户"""
    username: str | None = Field(None, min_length=2, max_length=50)


class UserResponse(UserBase):
    """用户响应"""
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    """令牌响应"""
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ==== 档案 Schema ====

class ArchiveBase(BaseModel):
    """档案基础字段"""
    name: str = Field(..., min_length=1, max_length=100)
    description: str | None = None
    archive_type: str = "family"  # family, lover, friend, relative, celebrity, nation


class ArchiveCreate(ArchiveBase):
    """创建档案"""
    pass


class ArchiveUpdate(BaseModel):
    """更新档案"""
    name: str | None = Field(None, min_length=1, max_length=100)
    description: str | None = None


class ArchiveResponse(ArchiveBase):
    """档案响应"""
    id: int
    owner_id: int
    created_at: datetime
    updated_at: datetime
    member_count: int = 0
    memory_count: int = 0

    class Config:
        from_attributes = True


# ==== 成员 Schema ====

class MemberBase(BaseModel):
    """成员基础字段"""
    name: str = Field(..., min_length=1, max_length=100)
    relationship: str = Field(..., max_length=50)
    birth_year: int | None = None
    death_year: int | None = None
    bio: str | None = None


class MemberCreate(MemberBase):
    """创建成员"""
    archive_id: int


class MemberUpdate(BaseModel):
    """更新成员"""
    name: str | None = Field(None, min_length=1, max_length=100)
    relationship: str | None = Field(None, max_length=50)
    birth_year: int | None = None
    death_year: int | None = None
    bio: str | None = None
    is_alive: bool | None = None


class MemberResponse(MemberBase):
    """成员响应"""
    id: int
    archive_id: int
    voice_profile_id: str | None = None
    is_alive: bool = True
    emotion_tags: list[str] = []
    memory_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True


# ==== 记忆 Schema ====

class MemoryBase(BaseModel):
    """记忆基础字段"""
    title: str = Field(..., min_length=1, max_length=200)
    content_text: str = Field(..., min_length=1)
    timestamp: datetime | None = None
    location: str | None = None


class MemoryCreate(MemoryBase):
    """创建记忆"""
    member_id: int
    emotion_label: str | None = None


class MemoryUpdate(BaseModel):
    """更新记忆"""
    title: str | None = Field(None, min_length=1, max_length=200)
    content_text: str | None = Field(None, min_length=1)
    emotion_label: str | None = None


class MemoryResponse(MemoryBase):
    """记忆响应"""
    id: int
    member_id: int
    archive_id: int
    emotion_label: str | None = None
    vector_embedding_id: str | None = None
    is_capsule: bool = False
    unlock_date: datetime | None = None
    media_refs: list[str] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MemorySearchRequest(BaseModel):
    """记忆语义搜索请求"""
    query: str = Field(..., min_length=1)
    archive_id: int | None = None
    member_id: int | None = None
    emotion_label: str | None = None
    limit: int = Field(default=10, ge=1, le=100)


class MemorySearchResponse(BaseModel):
    """记忆语义搜索响应"""
    results: list[MemoryResponse]
    query: str
    total: int
