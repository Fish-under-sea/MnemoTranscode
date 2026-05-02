"""
用量和偏好相关 Pydantic Schema
"""
from datetime import datetime

from pydantic import BaseModel, Field, field_validator
from enum import Enum


# ==== 用量统计 ====

class ActionType(str, Enum):
    dialogue = "dialogue"
    caption = "caption"
    search = "search"
    storybook = "storybook"


class UsageRecordResponse(BaseModel):
    id: int
    user_id: int
    action_type: str
    token_count: int
    metering_channel: str | None = None
    cost: int = 0
    model_name: str | None = None
    session_id: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class UsageStatsResponse(BaseModel):
    """monthly_used：订阅口径（计入本月限额）；monthly_used_user_key：自备 Key 消耗（不计限额）。"""
    monthly_used: int
    monthly_used_user_key: int = 0
    monthly_limit: int
    usage_by_type: dict[str, int]
    usage_by_day: list[dict]
    remaining: int
    usage_percent: float
    # 媒体对象（media_assets）按 owner 聚合的实际占用；配额随 subscription_tier
    storage_used: int = 0
    storage_quota: int = 0
    storage_usage_percent: float = 0.0


class UsageHistoryResponse(BaseModel):
    records: list[UsageRecordResponse]
    total: int
    page: int
    page_size: int


class QuotaResponse(BaseModel):
    subscription_tier: str
    monthly_limit: int
    monthly_used: int
    remaining: int
    usage_percent: float
    reset_at: datetime | None = None


# ==== 用户偏好 ====

class ThemeMode(str, Enum):
    light = "light"
    dark = "dark"
    auto = "auto"


class PrimaryColor(str, Enum):
    jade = "jade"
    amber = "amber"
    rose = "rose"
    sky = "sky"
    violet = "violet"
    forest = "forest"


class CardStyle(str, Enum):
    glass = "glass"
    minimal = "minimal"
    elevated = "elevated"


class FontSize(str, Enum):
    small = "small"
    medium = "medium"
    large = "large"


class UserPreferencesBase(BaseModel):
    theme: ThemeMode = ThemeMode.light
    primary_color: PrimaryColor = PrimaryColor.jade
    card_style: CardStyle = CardStyle.glass
    font_size: FontSize = FontSize.medium
    dashboard_layout: str = "grid"
    custom_css: str | None = None
    app_background_url: str | None = None
    app_background_kind: str | None = Field(
        None, description="image=CSS背景; video=<video> 铺满（gif 仍视为 image）"
    )
    ai_memory_sync: str = "on"


class UserPreferencesResponse(UserPreferencesBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserPreferencesUpdate(BaseModel):
    theme: ThemeMode | None = None
    primary_color: PrimaryColor | None = None
    card_style: CardStyle | None = None
    font_size: FontSize | None = None
    dashboard_layout: str | None = None
    custom_css: str | None = None
    app_background_url: str | None = None
    app_background_kind: str | None = None
    ai_memory_sync: str | None = None


# ==== 订阅 ====

class SubscriptionResponse(BaseModel):
    tier: str
    monthly_limit: int
    monthly_used: int
    monthly_used_user_key: int = 0
    remaining: int
    usage_percent: float
    expires_at: datetime | None = None
    features: list[str] = []


class SubscriptionTierUpdate(BaseModel):
    """切换订阅档位（演示环境免支付）。兼容请求体带 `enterprise`，视为 max。"""

    tier: str

    @field_validator("tier")
    @classmethod
    def normalize_tier_slug(cls, v: str) -> str:
        t = str(v).strip().lower()
        if t == "enterprise":
            t = "max"
        allowed = frozenset({"free", "lite", "pro", "max"})
        if t not in allowed:
            raise ValueError("tier 须为 free、lite、pro、max（legacy: enterprise 会自动映射为 max）")
        return t


# ==== AI 记忆 ====

class AIMemoryContext(BaseModel):
    summaries: list[dict] = []
    last_updated: datetime | None = None


class AIMemoryUpdate(BaseModel):
    context: AIMemoryContext
