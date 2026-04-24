"""订阅档位：用量上限与权益文案（与产品页一致）。"""

from __future__ import annotations

from app.models.user import User
from app.schemas.user_center import SubscriptionResponse

TIER_TOKEN_LIMITS: dict[str, int] = {
    "free": 100_000,
    "pro": 2_000_000,
    "enterprise": 1_000_000_000_000,
}

TIER_FEATURES: dict[str, list[str]] = {
    "free": ["基础 AI 对话", "档案管理", "记忆录入", "语义搜索"],
    "pro": [
        "基础 AI 对话",
        "档案管理",
        "记忆录入",
        "语义搜索",
        "故事书生成",
        "记忆胶囊",
        "优先队列",
        "5x 用量限额",
        "邮件支持",
    ],
    "enterprise": [
        "全部 Pro 功能",
        "无限用量",
        "自定义模型",
        "API 访问",
        "专属支持",
        "多用户协作",
    ],
}

VALID_TIERS = frozenset(TIER_TOKEN_LIMITS.keys())


def normalize_tier(tier: str | None) -> str:
    t = (tier or "free").strip().lower()
    return t if t in TIER_TOKEN_LIMITS else "free"


def apply_tier_to_user(user: User, tier: str) -> None:
    t = normalize_tier(tier)
    if t not in VALID_TIERS:
        t = "free"
    user.subscription_tier = t
    user.monthly_token_limit = TIER_TOKEN_LIMITS[t]
    user.subscription_expires_at = None


def build_subscription_response(user: User) -> SubscriptionResponse:
    tier = normalize_tier(user.subscription_tier)
    limit = int(user.monthly_token_limit or TIER_TOKEN_LIMITS[tier])
    used = int(user.monthly_token_used or 0)
    if limit <= 0:
        limit = TIER_TOKEN_LIMITS["free"]
    pct = round(used / limit * 100, 2) if limit > 0 else 0.0
    return SubscriptionResponse(
        tier=tier,
        monthly_limit=limit,
        monthly_used=used,
        remaining=max(0, limit - used),
        usage_percent=pct,
        expires_at=user.subscription_expires_at,
        features=TIER_FEATURES.get(tier, TIER_FEATURES["free"]),
    )
