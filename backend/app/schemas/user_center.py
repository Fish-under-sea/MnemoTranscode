"""
用量和偏好相关 Pydantic Schema
"""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field
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
    cost: int = 0
    model_name: str | None = None
    session_id: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class UsageStatsResponse(BaseModel):
    monthly_used: int
    monthly_limit: int
    usage_by_type: dict[str, int]
    usage_by_day: list[dict]
    remaining: int
    usage_percent: float


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
    ai_memory_sync: str | None = None


# ==== 订阅 ====

class SubscriptionResponse(BaseModel):
    tier: str
    monthly_limit: int
    monthly_used: int
    remaining: int
    usage_percent: float
    expires_at: datetime | None = None
    features: list[str] = []


class SubscriptionTierUpdate(BaseModel):
    """切换订阅档位（演示环境免支付）。"""

    tier: Literal["free", "pro", "enterprise"]


# ==== AI 记忆 ====

class AIMemoryContext(BaseModel):
    summaries: list[dict] = []
    last_updated: datetime | None = None


class AIMemoryUpdate(BaseModel):
    context: AIMemoryContext
