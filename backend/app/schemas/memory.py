"""
用户相关 Pydantic Schema
"""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, EmailStr, Field, field_validator, model_serializer, model_validator
from enum import Enum

from app.schemas.client_llm import ClientLlmOverride


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
    # 与独立订阅接口等效；enterprise 视为 max
    subscription_tier: str | None = None

    @field_validator("subscription_tier")
    @classmethod
    def normalize_subscription_tier(cls, v: str | None) -> str | None:
        if v is None:
            return None
        t = str(v).strip().lower()
        if t == "enterprise":
            t = "max"
        allowed = frozenset({"free", "lite", "pro", "max"})
        if t not in allowed:
            raise ValueError("subscription_tier 须为 free、lite、pro、max")
        return t


class UserResponse(UserBase):
    """用户响应"""
    id: int
    is_active: bool
    created_at: datetime
    avatar_url: str | None = None
    subscription_tier: str = "free"
    monthly_token_limit: int = 50_000_000
    monthly_token_used: int = 0

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

MemberStatus = Literal["active", "passed", "distant", "pet", "other"]


def _normalize_member_payload(raw: Any, mode: Literal["create", "update"]) -> Any:
    """按规格对成员字段做归一化与冲突校验。"""
    if not isinstance(raw, dict):
        return raw

    data = dict(raw)
    # 前端旧枚举 alive/deceased/unknown → API MemberStatus（body 可不传 archive_id，由路径注入）
    _legacy_status = {"alive": "active", "deceased": "passed", "unknown": "other"}
    if isinstance(data.get("status"), str):
        _s = data["status"].strip().lower()
        if _s in _legacy_status:
            data["status"] = _legacy_status[_s]
    state_fields = ("status", "end_year", "is_alive", "death_year")

    # PATCH 场景：状态相关字段全未提供时直接放行
    if mode == "update" and all(field not in data for field in state_fields):
        return data

    # 空字符串快速失败
    for field in ("status", "end_year", "death_year"):
        value = data.get(field)
        if isinstance(value, str) and value.strip() == "":
            raise ValueError(f"VALIDATION_EMPTY_{field.upper()}")

    has_status_value = "status" in data and data.get("status") is not None
    status = data.get("status")
    is_alive = data.get("is_alive")
    death_year = data.get("death_year")
    end_year = data.get("end_year")

    # status 缺失或显式 null 时，按旧字段降级推导
    if not has_status_value:
        if is_alive is True:
            data["status"] = "active"
        elif is_alive is False:
            data["status"] = "passed"
            if end_year is None and death_year is not None:
                data["end_year"] = death_year

    # Create 场景必须得到 status
    if mode == "create" and ("status" not in data or data.get("status") is None):
        raise ValueError("VALIDATION_REQUIRED_STATUS")

    status = data.get("status")
    death_year = data.get("death_year")
    end_year = data.get("end_year")

    # 冲突检测
    if status == "active" and is_alive is False:
        raise ValueError("FIELD_CONFLICT_STATUS_IS_ALIVE")
    if status is not None and status != "passed" and death_year is not None:
        raise ValueError("FIELD_CONFLICT_STATUS_DEATH_YEAR")
    if end_year is not None and death_year is not None and end_year != death_year:
        raise ValueError("FIELD_CONFLICT_END_YEAR_DEATH_YEAR")

    return data

class MemberBase(BaseModel):
    """成员基础字段"""
    name: str = Field(..., min_length=1, max_length=100)
    relationship_type: str = Field(..., max_length=50)
    birth_year: int | None = None
    status: MemberStatus | None = None
    end_year: int | None = None
    death_year: int | None = None
    is_alive: bool | None = None
    bio: str | None = None


class MemberCreate(MemberBase):
    """创建成员（archive_id 仅来自 URL 路径 /archives/{archive_id}/members，勿需在 body 重复）。"""

    @model_validator(mode="before")
    @classmethod
    def normalize_input(cls, raw: Any) -> Any:
        return _normalize_member_payload(raw, "create")


class MemberUpdate(BaseModel):
    """更新成员"""
    name: str | None = Field(None, min_length=1, max_length=100)
    relationship_type: str | None = Field(None, max_length=50)
    birth_year: int | None = None
    status: MemberStatus | None = None
    end_year: int | None = None
    death_year: int | None = None
    bio: str | None = None
    is_alive: bool | None = None

    @model_validator(mode="before")
    @classmethod
    def normalize_input(cls, raw: Any) -> Any:
        return _normalize_member_payload(raw, "update")


class MemberResponse(MemberBase):
    """成员响应"""
    id: int
    archive_id: int
    voice_profile_id: str | None = None
    is_alive: bool | None = Field(default=None, deprecated=True)
    emotion_tags: list[str] = []
    memory_count: int = 0
    created_at: datetime
    # 展示用签名 URL；无头像时为 None
    avatar_url: str | None = None

    class Config:
        from_attributes = True

    @model_serializer(mode="wrap")
    def derive_legacy_fields(self, handler):
        payload = handler(self)
        status = payload.get("status")
        payload["is_alive"] = status == "active"
        payload["death_year"] = payload.get("end_year") if status == "passed" else None
        return payload


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


class MemoryBatchDeleteRequest(BaseModel):
    """批量删除记忆（须全部为当前用户名下档案中的条目）。"""

    memory_ids: list[int] = Field(..., min_length=1, max_length=500)
    member_id: int | None = Field(
        default=None,
        ge=1,
        description="若提供，仅删除属于该成员的记忆，避免误选其它成员条目",
    )


class MemoryBatchDeleteResponse(BaseModel):
    deleted_count: int


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


# —— 聊天记录导入 / 对话提炼 / 关系网 ——#

class ChatImportRequest(BaseModel):
    """微信或聊天导出的纯文本导入"""
    member_id: int = Field(..., ge=1)
    raw_text: str = Field(..., min_length=1, max_length=500_000)
    source: Literal["auto", "wechat", "plain"] = "auto"
    build_graph: bool = True


class ChatImportStreamRequest(ChatImportRequest):
    """流式导入（SSE）：规则分段后默认经多批 LLM 精炼再入库。"""

    ai_refine: bool = True
    # 与对话页一致：使用浏览器「模型设置」中的网关与密钥，避免仅依赖服务端 .env
    client_llm: ClientLlmOverride | None = None


class ChatImportResponse(BaseModel):
    created_count: int
    memory_ids: list[int]
    graph_temporal_edges: int
    graph_llm_edges: int
    # 大批量导入时为 True：已跳过 Qdrant 向量同步，避免数百次 embedding 导致 OOM；对话预热可补齐。
    vectors_deferred: bool = False


class ConversationExtractRequest(BaseModel):
    """从对话消息列表提炼记忆"""
    member_id: int = Field(..., ge=1)
    messages: list[dict] = Field(..., min_length=1, max_length=60)
    build_graph: bool = True
    client_llm: ClientLlmOverride | None = None


class ConversationExtractResponse(BaseModel):
    created_count: int
    memory_ids: list[int]
    graph_temporal_edges: int
    graph_llm_edges: int


class MnemoGraphNode(BaseModel):
    id: str
    node_type: str
    label: str
    memory_id: int | None = None


class MnemoGraphEdge(BaseModel):
    from_id: str
    to_id: str
    edge_type: str
    weight: float


class MnemoGraphResponse(BaseModel):
    member_id: int
    nodes: list[MnemoGraphNode]
    edges: list[MnemoGraphEdge]
