/** 订阅档位：与后端 subscription_tier 对齐（legacy enterprise 视为 max） */

export type SubscriptionTierId = 'free' | 'lite' | 'pro' | 'max'

export const SUBSCRIPTION_TIER_ORDER: SubscriptionTierId[] = ['free', 'lite', 'pro', 'max']

export function normalizeTierId(raw?: string | null): SubscriptionTierId {
  const s = (raw ?? 'free').trim().toLowerCase()
  if (s === 'enterprise') return 'max'
  return SUBSCRIPTION_TIER_ORDER.includes(s as SubscriptionTierId)
    ? (s as SubscriptionTierId)
    : 'free'
}

export function tierRankOrder(t: SubscriptionTierId): number {
  return SUBSCRIPTION_TIER_ORDER.indexOf(t)
}

export function tierDisplayName(t: SubscriptionTierId): string {
  switch (t) {
    case 'free':
      return 'Free'
    case 'lite':
      return 'Lite'
    case 'pro':
      return 'Pro'
    case 'max':
      return 'Max'
  }
}

/** 与后端 TIER_TOKEN_LIMITS 一致；用于前端在 stats 未到时按档位回显上限 */
export const TIER_MONTHLY_TOKEN_LIMITS: Record<SubscriptionTierId, number> = {
  free: 50_000_000,
  lite: 100_000_000,
  pro: 300_000_000,
  max: 800_000_000,
}

export function tierMonthlyTokenLimit(tier: SubscriptionTierId): number {
  return TIER_MONTHLY_TOKEN_LIMITS[tier]
}

/** 顶栏 / 概览小徽章底色 */
export function tierBadgeClass(t: SubscriptionTierId): string {
  switch (t) {
    case 'max':
      return 'bg-amber-100 text-amber-800'
    case 'pro':
      return 'bg-jade-100 text-jade-700'
    case 'lite':
      return 'bg-sky-100 text-sky-800'
    default:
      return 'bg-slate-200 text-slate-600'
  }
}
