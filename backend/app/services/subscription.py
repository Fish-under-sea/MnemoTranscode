"""订阅档位：用量上限与权益文案（与产品页一致）。"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.schemas.user_center import SubscriptionResponse
from app.services.usage_metering import sum_monthly_tokens_by_channel

# 每月「订阅配额」tokens（与用户自备网关 Key 用量分开统计）
TIER_TOKEN_LIMITS: dict[str, int] = {
    "free": 50_000_000,  # 5 千万
    "lite": 100_000_000,  # 1 亿
    "pro": 300_000_000,  # 3 亿
    "max": 800_000_000,  # 8 亿
}

# 媒体与上传文件在云存储侧的配额（字节）
_GB = 1024 * 1024 * 1024
TIER_STORAGE_QUOTA_BYTES: dict[str, int] = {
    "free": 1 * _GB,
    "lite": 3 * _GB,
    "pro": 10 * _GB,
    "max": 50 * _GB,
}

TIER_FEATURES: dict[str, list[str]] = {
    "free": [
        "基础 AI 对话（订阅 tokens）",
        "档案与成员管理",
        "记忆录入与语义搜索",
        "存储方案 · 云空间 1GB",
    ],
    "lite": [
        "包含 Free 全部能力",
        "更高订阅 tokens 额度",
        "故事书生成",
        "记忆胶囊",
        "存储方案 · 云空间 3GB",
    ],
    "pro": [
        "包含 Lite 全部能力",
        "大图记忆与对话上下文",
        "优先队列体验",
        "存储方案 · 云空间 10GB",
        "邮件支持",
    ],
    "max": [
        "包含 Pro 全部能力",
        "最高档订阅 tokens",
        "自定义模型与网关（自备 Key 另行计量）",
        "API 与协作扩展（规划中）",
        "存储方案 · 云空间 50GB",
        "专属支持",
    ],
}

VALID_TIERS = frozenset(TIER_TOKEN_LIMITS.keys())


def normalize_tier(tier: str | None) -> str:
    t = (tier or "free").strip().lower()
    if t == "enterprise":
        return "max"
    return t if t in TIER_TOKEN_LIMITS else "free"


def storage_quota_bytes_for_tier(tier: str | None) -> int:
    """订阅档位对应的媒体存储上限（字节）。"""
    t = normalize_tier(tier)
    return int(TIER_STORAGE_QUOTA_BYTES.get(t, TIER_STORAGE_QUOTA_BYTES["free"]))


def tier_monthly_token_limit_for_tier(tier: str | None) -> int:
    """按档位取本月「订阅配额」tokens 上限（与产品文案、TIER_TOKEN_LIMITS 一致）。"""
    t = normalize_tier(tier)
    return int(TIER_TOKEN_LIMITS[t])


def tier_monthly_token_limit(user: User) -> int:
    """始终以用户当前 subscription_tier 为准的月度订阅 tokens 上限。"""
    return tier_monthly_token_limit_for_tier(user.subscription_tier)


def apply_tier_to_user(user: User, tier: str) -> None:
    t = normalize_tier(tier)
    if t not in VALID_TIERS:
        t = "free"
    user.subscription_tier = t
    user.monthly_token_limit = TIER_TOKEN_LIMITS[t]
    user.subscription_expires_at = None


def build_subscription_response(
    user: User,
    *,
    monthly_used_subscription: int | None = None,
    monthly_used_user_key: int = 0,
) -> SubscriptionResponse:
    tier = normalize_tier(user.subscription_tier)
    # 限额以档位 canonical 为准，避免库内 monthly_token_limit 滞后于 tier（切换方案后不一致）
    limit = tier_monthly_token_limit(user)
    used = (
        int(monthly_used_subscription)
        if monthly_used_subscription is not None
        else int(user.monthly_token_used or 0)
    )
    uk = int(monthly_used_user_key or 0)
    pct = round(used / limit * 100, 2) if limit > 0 else 0.0
    return SubscriptionResponse(
        tier=tier,
        monthly_limit=limit,
        monthly_used=used,
        monthly_used_user_key=uk,
        remaining=max(0, limit - used),
        usage_percent=pct,
        expires_at=user.subscription_expires_at,
        features=TIER_FEATURES.get(tier, TIER_FEATURES["free"]),
    )


async def build_subscription_response_from_usage_records(
    db: AsyncSession, user: User
) -> SubscriptionResponse:
    """以 usage_records 为准汇总本月订阅/自备口径（推荐用于 API 序列化）。"""
    sub, uk = await sum_monthly_tokens_by_channel(db, user.id)
    return build_subscription_response(
        user,
        monthly_used_subscription=sub,
        monthly_used_user_key=uk,
    )
