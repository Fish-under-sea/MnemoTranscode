/**
 * 个人中心页面 — 整合订阅、账号与安全、DIY UI、云端存储
 */
import { useState, useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/hooks/useAuthStore'
import { authApi, usageApi, preferencesApi, subscriptionApi, archiveApi } from '@/services/api'
import { isApiError, mapErrorToMessage } from '@/services/errors'
import Avatar from '@/components/ui/Avatar'
import { useAIContext } from '@/hooks/useAIContext'
import {
  applyTheme,
  COLOR_OPTIONS,
  inferAppBackgroundKind,
  panelClassFromCardStyle,
  useThemeAppliedSnapshot,
  type PrimaryColor,
  type ThemeMode,
  type CardStyle,
  type FontSize,
} from '@/lib/theme'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'
import { compressImageFileForAvatar } from '@/lib/compressImage'
import { bumpSubscriptionSyncGen, getSubscriptionSyncGen } from '@/lib/subscriptionSyncGen'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  normalizeTierId,
  tierBadgeClass,
  tierDisplayName,
  tierMonthlyTokenLimit,
  tierRankOrder,
  type SubscriptionTierId,
} from '@/lib/subscriptionTier'
import { formatStoragePrimaryLine, storageProgressPercent } from '@/lib/formatBytes'
import {
  User, CreditCard, Palette, Cloud, BarChart3,
  Check, RefreshCw, Download, Upload, Trash2, Moon, Sun, Monitor,
  AlertTriangle, Eye, EyeOff, Image,
  HardDrive,
} from 'lucide-react'
type TabId = 'overview' | 'subscription' | 'account' | 'appearance' | 'cloud'

const VALID_TAB_IDS: TabId[] = ['overview', 'subscription', 'account', 'appearance', 'cloud']

function resolveCurrentTier(
  sub: { tier?: string } | null | undefined,
  user: { subscription_tier?: string } | null | undefined,
): SubscriptionTierId {
  return normalizeTierId(sub?.tier ?? user?.subscription_tier)
}

function subscriptionPlanButtonLabel(
  currentTier: SubscriptionTierId,
  planId: SubscriptionTierId,
  switching: boolean,
): string {
  if (currentTier === planId) return '当前方案'
  if (switching) return '切换中…'
  const d = tierRankOrder(planId) - tierRankOrder(currentTier)
  if (d < 0) return '降级'
  if (d > 0) return '升级'
  return '切换'
}

function parseTabParam(params: URLSearchParams): TabId {
  const t = params.get('tab')
  return t && VALID_TAB_IDS.includes(t as TabId) ? (t as TabId) : 'overview'
}

const tabs = [
  { id: 'overview', label: '概览', icon: BarChart3 },
  { id: 'subscription', label: '订阅管理', icon: CreditCard },
  { id: 'account', label: '账号与安全', icon: User },
  { id: 'appearance', label: 'DIY UI', icon: Palette },
  { id: 'cloud', label: '云端存储', icon: Cloud },
]

/**
 * 个人中心内容与全局 DIY「卡片风格」对齐（等价于 ui/Card variant="plain"），
 * 默认液态玻璃在用户上传背景透出层次。
 */
function usePersonalCenterPanels() {
  const { cardStyle } = useThemeAppliedSnapshot()
  const shell = panelClassFromCardStyle(cardStyle)
  return {
    cardStyle,
    panelBase: shell,
    /** 大块面板：概览用量、订阅方案卡、表单分区等 */
    section: cn(shell, 'rounded-2xl p-6'),
    /** 紧凑型面板 */
    sectionCompact: cn(shell, 'rounded-2xl p-5'),
    /** 网格内快捷入口 */
    tile: cn(
      shell,
      'rounded-xl p-4',
      'transition-[box-shadow,border-color] duration-200 hover:shadow-e2 hover:border-brand/35',
    ),
  }
}

// ========== 子组件 ==========

/** 用量环形图 */
function UsageRing({ used, limit, color }: { used: number; limit: number; color: string }) {
  const safeLimit = Math.max(limit, 1)
  const percent = Math.min(100, (used / safeLimit) * 100)
  const radius = 48
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - percent / 100)

  return (
    <div className="relative w-32 h-32">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="#E5E7EB" strokeWidth="8" />
        <circle
          cx="60" cy="60" r={radius} fill="none"
          stroke={percent > 80 ? '#EF4444' : percent > 50 ? '#F59E0B' : color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-ink-primary">{percent.toFixed(0)}%</span>
        <span className="text-xs text-ink-muted">订阅配额</span>
      </div>
    </div>
  )
}

type OverviewUsageSnapshot = {
  monthly_used?: number
  monthly_used_user_key?: number
  monthly_limit?: number
  usage_by_type?: Record<string, number>
  storage_used?: number
  storage_quota?: number
  storage_usage_percent?: number
}

/** 概览面板 */
function OverviewPanel() {
  const panels = usePersonalCenterPanels()
  const { user } = useAuthStore()
  const { data: stats, isLoading: loading } = useQuery({
    queryKey: ['dashboard', 'usage'],
    queryFn: async () => (await usageApi.getStats()) as OverviewUsageSnapshot,
    staleTime: 30_000,
  })

  const overviewTier = normalizeTierId(user?.subscription_tier)
  // 限额以后端 stats（与档位一致）为准；避免仅更新 tier 但 store 里 monthly_token_limit 滞后
  const limit =
    stats?.monthly_limit != null && stats.monthly_limit > 0
      ? stats.monthly_limit
      : user?.monthly_token_limit != null && user.monthly_token_limit > 0
        ? user.monthly_token_limit
        : tierMonthlyTokenLimit(overviewTier)
  const usedSub =
    stats?.monthly_used !== undefined ? stats.monthly_used : user?.monthly_token_used ?? 0
  const usedOwn = stats?.monthly_used_user_key ?? 0

  const storagePct = storageProgressPercent(stats ?? null, loading)
  const storageBarWidth =
    storagePct != null ? Math.min(100, Math.max(0, storagePct)) : null
  const storageOverCap = storagePct != null && storagePct > 100

  return (
    <div className="space-y-6">
      {/* 用户卡片：玻璃壳 + 轻量翠色覆层 */}
      <div className={cn(panels.section, 'relative overflow-hidden')}>
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand/16 via-transparent to-brand/10"
          aria-hidden
        />
        <div className="relative flex items-center gap-4">
          <div className="shrink-0 self-center flex h-16 w-16 items-center justify-center overflow-hidden rounded-full ring-2 ring-brand/30 shadow-e2">
            <Avatar
              size={64}
              name={user?.username || 'U'}
              src={user?.avatar_url || undefined}
              className="align-middle"
            />
          </div>
          <div className="min-w-0 flex-1 self-center">
            <h2 className="text-xl font-bold text-ink-primary">{user?.username}</h2>
            <p className="text-ink-muted text-sm">{user?.email}</p>
            <span
              className={cn(
                'inline-block mt-1.5 text-xs px-2.5 py-0.5 rounded-full font-medium',
                tierBadgeClass(overviewTier),
              )}
            >
              {tierDisplayName(overviewTier)}
            </span>
          </div>
        </div>
      </div>

      {/* 用量卡片 */}
      <div className={panels.section}>
        <h3 className="font-semibold text-ink-primary mb-4">本月 AI 用量</h3>
        {loading ? (
          <div className="flex items-center gap-6">
            <div className="w-32 h-32 bg-muted rounded-full animate-pulse" />
            <div className="space-y-2 flex-1">
              <div className="h-4 bg-muted rounded w-3/4 animate-pulse" />
              <div className="h-4 bg-muted rounded w-1/2 animate-pulse" />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-6">
            <UsageRing used={usedSub} limit={limit} color="#10B981" />
            <div className="space-y-3 flex-1">
              <div className="flex justify-between text-sm">
                <span className="text-ink-secondary">订阅用量（计入限额）</span>
                <span className="font-semibold text-ink-primary">{usedSub.toLocaleString()} tokens</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-ink-secondary">自备模型网关</span>
                <span className="font-semibold text-ink-primary">{usedOwn.toLocaleString()} tokens</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-ink-secondary">限额</span>
                <span className="font-semibold text-ink-primary">{`${limit.toLocaleString()} tokens`}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-ink-secondary">剩余（订阅）</span>
                <span className="font-semibold text-brand">
                  {`${Math.max(0, limit - usedSub).toLocaleString()} tokens`}
                </span>
              </div>
              {/* 用量类型分布 */}
              {stats?.usage_by_type &&
                Object.keys(stats.usage_by_type).length > 0 && (
                <div className="pt-2 border-t border-default space-y-1.5">
                  {Object.entries(stats.usage_by_type).map(([type, count]) => (
                    <div key={type} className="flex justify-between text-xs text-ink-muted">
                      <span>
                        {type === 'dialogue'
                          ? 'AI 对话'
                          : type === 'storybook'
                            ? '故事书'
                            : type === 'search'
                              ? '语义搜索'
                              : type === 'memory_extract'
                                ? '对话提炼记忆'
                                : type}
                      </span>
                      <span>{Number(count).toLocaleString()} tokens</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 云存储用量：与仪表盘同源 GET /usage/stats */}
      <div className={panels.section}>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 rounded-full bg-brand/15 flex items-center justify-center shrink-0">
            <HardDrive className="w-4 h-4 text-brand" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-ink-primary">存储用量</h3>
            <p className="text-xs text-ink-muted mt-0.5">
              按当前订阅档位云空间配额统计媒体与上传文件占用
            </p>
          </div>
          <Link
            to="/personal-center?tab=cloud"
            className="text-xs text-brand hover:text-brand-hover shrink-0"
          >
            云端详情
          </Link>
        </div>
        {loading ? (
          <div className="space-y-3">
            <div className="h-9 bg-muted rounded animate-pulse w-2/3" />
            <div className="h-2 bg-muted rounded-full animate-pulse" />
            <div className="h-4 bg-muted rounded animate-pulse w-24" />
          </div>
        ) : (
          <>
            <div className="font-serif text-2xl text-ink-primary tabular-nums tracking-tight">
              {formatStoragePrimaryLine(stats ?? null, false)}
            </div>
            <div className="mt-4 space-y-1.5">
              {storageBarWidth != null ? (
                <>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        storageOverCap ? 'bg-amber-500' : 'bg-brand',
                      )}
                      style={{ width: `${storageBarWidth}%` }}
                    />
                  </div>
                  <div className="flex justify-between gap-2 text-xs text-ink-muted tabular-nums">
                    <span>
                      {storagePct != null
                        ? `已用 ${storagePct.toFixed(1)}%`
                        : null}
                    </span>
                    {storageOverCap && (
                      <span className="text-amber-700 shrink-0">已超出档位配额</span>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-ink-muted">暂时无法读取存储配额，请稍后重试。</p>
              )}
            </div>
          </>
        )}
      </div>

      {/* 快速操作 */}
      <div className="grid grid-cols-2 gap-4">
        <Link
          to="/personal-center?tab=subscription"
          className={cn(panels.tile, 'block text-left no-underline text-inherit cursor-pointer')}
        >
          <CreditCard size={20} className="text-brand mb-2" />
          <div className="font-semibold text-ink-primary text-sm">升级方案</div>
          <div className="text-xs text-ink-muted mt-0.5">解锁更多用量</div>
        </Link>
        <Link
          to="/personal-center?tab=cloud"
          className={cn(panels.tile, 'block text-left no-underline text-inherit cursor-pointer')}
        >
          <Download size={20} className="text-brand mb-2" />
          <div className="font-semibold text-ink-primary text-sm">导出数据</div>
          <div className="text-xs text-ink-muted mt-0.5">前往云端存储，执行档案与备份导入/导出</div>
        </Link>
      </div>
    </div>
  )
}

/** 订阅管理面板 */
function SubscriptionPanel() {
  const panels = usePersonalCenterPanels()
  const { user, updateUser } = useAuthStore()
  const queryClient = useQueryClient()
  const [sub, setSub] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState(false)

  const refreshSubscription = () => {
    const at = getSubscriptionSyncGen()
    return subscriptionApi.get().then((res: any) => {
      if (at !== getSubscriptionSyncGen()) return
      setSub(res)
      updateUser({
        subscription_tier: res.tier,
        monthly_token_limit: res.monthly_limit,
        monthly_token_used: res.monthly_used,
      })
    })
  }

  useEffect(() => {
    setLoading(true)
    refreshSubscription()
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSelectPlan = async (planId: SubscriptionTierId) => {
    if (planId === resolveCurrentTier(sub, user) || switching) return
    bumpSubscriptionSyncGen()
    setSwitching(true)
    try {
      const res = (await subscriptionApi.updateTier(planId)) as Record<string, unknown>
      const tierNorm = normalizeTierId(String(res?.tier ?? planId))
      setSub(
        res && typeof res === 'object'
          ? { ...res, tier: tierNorm }
          : res,
      )
      updateUser({
        subscription_tier: tierNorm,
        monthly_token_limit: res?.monthly_limit as number | undefined,
        monthly_token_used: res?.monthly_used as number | undefined,
      })
      bumpSubscriptionSyncGen()
      try {
        const me = (await authApi.getMe()) as {
          email?: string
          username?: string
          is_active?: boolean
          created_at?: string
          avatar_url?: string | null
          subscription_tier?: string
          monthly_token_limit?: number
          monthly_token_used?: number
        }
        const resolvedTier = normalizeTierId(me.subscription_tier ?? tierNorm)
        updateUser({
          email: me.email,
          username: me.username,
          is_active: me.is_active,
          created_at: me.created_at,
          avatar_url: me.avatar_url ?? undefined,
          subscription_tier: resolvedTier,
          monthly_token_limit: me.monthly_token_limit ?? (res.monthly_limit as number | undefined),
          monthly_token_used: me.monthly_token_used ?? (res.monthly_used as number | undefined),
        })
        setSub((prev: unknown) =>
          prev && typeof prev === 'object' ? { ...(prev as object), tier: resolvedTier } : prev,
        )
      } catch {
        updateUser({ subscription_tier: tierNorm })
        setSub((prev: unknown) =>
          prev && typeof prev === 'object' ? { ...(prev as object), tier: tierNorm } : prev,
        )
      }
      void queryClient.invalidateQueries({ queryKey: ['dashboard', 'usage'] })
      toast.success(`已切换至 ${tierDisplayName(planId)} 方案（演示环境无需支付）`)
    } catch (e) {
      const msg = isApiError(e) ? mapErrorToMessage(e) : '切换方案失败，请稍后重试'
      toast.error(msg, { id: 'subscription-tier-switch' })
    } finally {
      setSwitching(false)
    }
  }

  const plans: {
    id: SubscriptionTierId
    name: string
    price: string
    priceTail: string
    tokenLine: string
    color: 'slate' | 'sky' | 'jade' | 'amber'
    features: string[]
    popular?: boolean
  }[] = [
    {
      id: 'free',
      name: 'Free',
      price: '¥0',
      priceTail: '永久',
      tokenLine: '每月 5 千万 · 订阅 tokens',
      color: 'slate',
      features: [
        '基础 AI（订阅 tokens）',
        '档案库与各类记忆入口（关系成员、国家记忆实体等）',
        '记忆录入与语义搜索',
        '存储方案 · 云空间 1GB',
      ],
    },
    {
      id: 'lite',
      name: 'Lite',
      price: '¥39',
      priceTail: '/月',
      tokenLine: '每月 1 亿 · 订阅 tokens',
      color: 'sky',
      features: [
        '包含 Free 全部能力',
        '故事书生成',
        '记忆胶囊',
        '存储方案 · 云空间 3GB',
      ],
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '¥99',
      priceTail: '/月',
      tokenLine: '每月 3 亿 · 订阅 tokens',
      color: 'jade',
      features: [
        '包含 Lite 全部能力',
        '优先队列体验',
        '存储方案 · 云空间 10GB',
        '邮件支持',
      ],
      popular: true,
    },
    {
      id: 'max',
      name: 'Max',
      price: '¥199',
      priceTail: '/月',
      tokenLine: '每月 8 亿 · 订阅 tokens',
      color: 'amber',
      features: [
        '包含 Pro 全部能力',
        '最高档订阅 tokens',
        '自定义模型 / 网关（自备 Key 另计）',
        '存储方案 · 云空间 50GB',
        '专属支持',
      ],
    },
  ]

  const currentTier = resolveCurrentTier(sub, user)

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map(i => (
          <div
            key={i}
            className={cn(
              panels.panelBase,
              'rounded-2xl min-h-[22rem] h-56 animate-pulse bg-muted/55 border border-default/70',
            )}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-ink-primary mb-1">订阅方案</h3>
        <p className="text-sm text-ink-muted">
          所列 tokens 均为订阅配额；自备 API Key 用量在个人中心另行统计。
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {plans.map(plan => (
          <div
            key={plan.id}
            className={cn(
              panels.panelBase,
              'relative flex flex-col rounded-2xl border-2 p-5 transition-all h-full min-h-[22rem]',
              currentTier === plan.id
                ? 'border-brand shadow-e2 ring-1 ring-brand/25 bg-brand/[0.07] dark:bg-brand/[0.12]'
                : 'border-default/80 hover:border-brand/45',
              plan.popular && 'md:scale-[1.02] z-[1]',
            )}
          >
            {/* 「最受欢迎」内置在留白内：液态玻璃 (.mtc-liquid-glass) 使用 overflow:hidden，负向绝对定位会被裁切 */}
            {plan.popular ?
              <div className="flex justify-center shrink-0 mb-2">
                <span className="bg-brand text-ink-inverse text-xs px-3 py-1 rounded-full font-medium shadow-e2">
                  最受欢迎
                </span>
              </div>
            : null}

            <div className="text-center mb-4">
              <h4 className="font-bold text-ink-primary">{plan.name}</h4>
              <div className="mt-2 flex items-baseline justify-center gap-0.5 flex-wrap">
                <span className="text-2xl font-bold text-ink-primary">{plan.price}</span>
                <span className="text-ink-muted text-sm">{plan.priceTail}</span>
              </div>
              <div className="mt-1 text-xs text-ink-muted">{plan.tokenLine}</div>
            </div>

            <ul className="space-y-2 mb-4 flex-1 min-h-0">
              {plan.features.map(f => (
                <li key={f} className="flex items-start gap-2 text-sm text-ink-secondary">
                  <Check
                    size={14}
                    className={cn(
                      'flex-shrink-0 mt-0.5',
                      currentTier === plan.id ? 'text-brand' : 'text-ink-muted',
                    )}
                  />
                  {f}
                </li>
              ))}
            </ul>

            <button
              type="button"
              disabled={currentTier === plan.id || switching}
              onClick={() => void handleSelectPlan(plan.id)}
              className={cn(
                'w-full shrink-0 min-h-[2.5rem] py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer mt-auto',
                currentTier === plan.id || switching
                  ? 'bg-muted text-ink-muted cursor-not-allowed opacity-75'
                  : plan.id === 'free'
                    ? 'bg-muted text-ink-primary border border-default hover:bg-subtle'
                    : 'bg-brand text-ink-inverse hover:bg-brand-hover shadow-e1',
              )}
            >
              {subscriptionPlanButtonLabel(currentTier, plan.id, switching)}
            </button>
          </div>
        ))}
      </div>

      {/* 用量警告 */}
      {sub && sub.usage_percent > 70 && (
        <div
          className={cn(
            panels.panelBase,
            'rounded-xl border-amber-300/70 dark:border-amber-700/85 bg-amber-50/75 dark:bg-amber-950/35 p-4',
          )}
        >
          <div className="flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-medium text-amber-800 dark:text-amber-200 text-sm">用量即将达到上限</div>
            <div className="text-amber-700 dark:text-amber-300/95 text-xs mt-1">
              已使用 {sub.usage_percent.toFixed(1)}%，建议升级到更高订阅方案以获得更多订阅 tokens。
            </div>
          </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** 账号与安全（头像、用户名、密码等） */
function AccountPanel() {
  const panels = usePersonalCenterPanels()
  const { user, updateUser } = useAuthStore()
  const [username, setUsername] = useState(user?.username || '')
  const [saving, setSaving] = useState(false)

  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)

  // 头像上传相关
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarImgError, setAvatarImgError] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (user?.username) setUsername(user.username)
  }, [user])

  useEffect(() => {
    setAvatarImgError(false)
  }, [user?.avatar_url])

  // 头像预览处理（选图后先压缩，减少上传时间）
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.files?.[0]
    if (!raw) return
    if (raw.size > 5 * 1024 * 1024) {
      toast.error('头像文件不能超过 5MB')
      return
    }
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(raw.type)) {
      toast.error('仅支持 JPG、PNG、GIF、WebP 格式')
      return
    }
    const file = await compressImageFileForAvatar(raw)
    setAvatarFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  // 上传头像
  const handleUploadAvatar = async () => {
    if (!avatarFile) return
    setAvatarUploading(true)
    try {
      const res = (await authApi.uploadAvatar(avatarFile)) as {
        url?: string
        user?: {
          avatar_url?: string | null
          email?: string
          username?: string
          is_active?: boolean
          created_at?: string
        }
      }
      // 先 bump，丢弃 App 中在途的 getMe，避免用旧 /auth/me 覆盖刚写入的头像
      bumpSubscriptionSyncGen()
      const u = res.user
      if (u && typeof u === 'object') {
        updateUser({
          email: u.email,
          username: u.username,
          is_active: u.is_active,
          created_at: u.created_at,
          avatar_url: (u.avatar_url ?? res.url) ?? undefined,
        })
      } else {
        const nextUrl = res.url
        if (nextUrl) updateUser({ avatar_url: nextUrl })
      }
      setAvatarImgError(false)
      toast.success('头像已更新')
      setAvatarFile(null)
      setAvatarPreview(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch {
      toast.error('头像上传失败')
    } finally {
      setAvatarUploading(false)
    }
  }

  // 删除头像
  const handleDeleteAvatar = async () => {
    try {
      await authApi.deleteAvatar() as any
      bumpSubscriptionSyncGen()
      updateUser({ avatar_url: undefined })
      setAvatarImgError(false)
      toast.success('头像已删除')
    } catch {
      toast.error('删除失败')
    }
  }

  const handleSaveProfile = async () => {
    if (!username.trim()) {
      toast.error('用户名不能为空')
      return
    }
    if (username === user?.username) {
      toast.success('用户名未修改')
      return
    }
    setSaving(true)
    try {
      const res = await authApi.updateMe({ username }) as any
      updateUser({ username: res.username })
      toast.success('用户名已更新')
    } catch {
      toast.error('更新失败')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (!oldPassword) {
      toast.error('请输入旧密码')
      return
    }
    if (!newPassword || newPassword.length < 6) {
      toast.error('新密码至少 6 位')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('两次输入的密码不一致')
      return
    }
    setPasswordSaving(true)
    try {
      toast.success('密码已更新（演示模式）')
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch {
      toast.error('修改失败')
    } finally {
      setPasswordSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* 基本信息 */}
      <div className={panels.section}>
        <h3 className="font-semibold text-ink-primary mb-4">基本信息</h3>
        <div className="space-y-4">
          {/* 头像上传：渐变外环 + 内嵌图（同域 /api 代理，避免直连 MinIO 裂图）*/}
          <div>
            <label className="block text-sm font-medium text-ink-secondary mb-1.5">头像</label>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
              <div className="relative flex-shrink-0">
                <div className="relative h-[5.5rem] w-[5.5rem] sm:h-24 sm:w-24">
                  <div
                    className="absolute inset-0 rounded-full bg-gradient-to-br from-brand via-brand-hover to-brand-active shadow-e3 ring-1 ring-brand/25"
                    aria-hidden
                  />
                  <div className="absolute inset-[3px] overflow-hidden rounded-full bg-muted ring-1 ring-surface/50 shadow-inner">
                    {avatarPreview || (user?.avatar_url && !avatarImgError) ? (
                      <img
                        src={(avatarPreview || user?.avatar_url) as string}
                        alt=""
                        className="h-full w-full object-cover"
                        onError={() => setAvatarImgError(true)}
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand to-brand-hover text-2xl font-bold tracking-tight text-ink-inverse">
                        {user?.username?.charAt(0)?.toUpperCase() || 'U'}
                      </div>
                    )}
                  </div>
                </div>
                {avatarUploading && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 ring-1 ring-inset ring-white/15 dark:ring-ink-inverse/15">
                    <RefreshCw size={20} className="text-white animate-spin" />
                  </div>
                )}
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={handleAvatarChange}
                  className="hidden"
                  id="avatar-upload"
                />
                <label
                  htmlFor="avatar-upload"
                  className="px-4 py-2 bg-brand/12 text-brand border border-brand/35 rounded-xl text-sm font-medium hover:bg-brand/18 transition-colors cursor-pointer text-center"
                >
                  更换头像
                </label>
                {avatarFile && (
                  <button
                    onClick={handleUploadAvatar}
                    disabled={avatarUploading}
                    className="px-4 py-2 bg-brand text-ink-inverse rounded-xl text-sm font-medium hover:bg-brand-hover disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    确认上传
                  </button>
                )}
                {user?.avatar_url && !avatarFile && (
                  <button
                    onClick={handleDeleteAvatar}
                    className="px-4 py-2 text-red-500 text-sm hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                  >
                    删除头像
                  </button>
                )}
                <p className="text-xs text-ink-muted">支持 JPG、PNG、GIF、WebP，最大 5MB</p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-secondary mb-1.5">用户名</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full px-3 py-2.5 border border-default rounded-xl focus:ring-2 focus:ring-brand/40 focus:border-brand/40 outline-none bg-muted text-sm text-ink-primary"
              minLength={2}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-secondary mb-1.5">邮箱</label>
            <input
              type="email"
              defaultValue={user?.email}
              disabled
              className="w-full px-3 py-2.5 border border-default rounded-xl bg-muted text-ink-muted text-sm"
            />
            <p className="text-xs text-ink-muted mt-1">邮箱暂不支持修改</p>
          </div>
          <button
            onClick={handleSaveProfile}
            disabled={saving}
            className="px-5 py-2.5 bg-brand text-ink-inverse rounded-xl font-medium hover:bg-brand-hover disabled:opacity-50 transition-all shadow-e2 text-sm cursor-pointer"
          >
            {saving ? '保存中...' : '保存修改'}
          </button>
        </div>
      </div>

      {/* 修改密码 */}
      <div className={panels.section}>
        <h3 className="font-semibold text-ink-primary mb-4">修改密码</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink-secondary mb-1.5">旧密码</label>
            <div className="relative">
              <input
                type={showOld ? 'text' : 'password'}
                value={oldPassword}
                onChange={e => setOldPassword(e.target.value)}
                placeholder="输入旧密码"
                className="w-full px-3 py-2.5 border border-default rounded-xl focus:ring-2 focus:ring-brand/40 focus:border-brand/40 outline-none bg-muted text-sm text-ink-primary"
              />
              <button onClick={() => setShowOld(!showOld)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-brand cursor-pointer p-1">
                {showOld ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-secondary mb-1.5">新密码</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="至少 6 位"
                className="w-full px-3 py-2.5 border border-default rounded-xl focus:ring-2 focus:ring-brand/40 focus:border-brand/40 outline-none bg-muted text-sm text-ink-primary"
              />
              <button onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-brand cursor-pointer p-1">
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-secondary mb-1.5">确认新密码</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="再次输入新密码"
              className="w-full px-3 py-2.5 border border-default rounded-xl focus:ring-2 focus:ring-brand/40 focus:border-brand/40 outline-none bg-muted text-sm text-ink-primary"
            />
          </div>
          <button
            onClick={handleChangePassword}
            disabled={passwordSaving}
            className="px-5 py-2.5 bg-subtle text-ink-primary rounded-xl font-medium hover:bg-muted border border-default disabled:opacity-50 transition-all text-sm cursor-pointer"
          >
            {passwordSaving ? '修改中...' : '修改密码'}
          </button>
        </div>
      </div>

      {/* 危险操作 */}
      <div
        className={cn(
          panels.panelBase,
          'rounded-2xl p-6 border-2 border-red-300/95 dark:border-red-800/90 bg-red-50/35 dark:bg-red-950/25',
        )}
      >
        <h3 className="font-semibold text-red-600 mb-2">危险操作</h3>
        <p className="text-sm text-ink-muted mb-4">注销账号后，所有数据将被永久删除且无法恢复。</p>
        <button className="px-5 py-2.5 bg-red-50 text-red-600 border border-red-200 rounded-xl font-medium hover:bg-red-100 transition-all text-sm cursor-pointer">
          注销账号
        </button>
      </div>
    </div>
  )
}

/** DIY UI 面板 */
function AppearancePanel() {
  const [, setPrefs] = useState<any>(null)
  const [, setSaving] = useState(false)
  const bgFileInputRef = useRef<HTMLInputElement>(null)
  const [bgUploading, setBgUploading] = useState(false)
  type LocalPrefsShape = {
    theme: string
    primary_color: string
    card_style: string
    font_size: string
    app_background_url: string
    /** 与后端一致：'' 表示沿用 URL 推断 */
    app_background_kind: '' | 'image' | 'video'
  }
  const [localPrefs, setLocalPrefs] = useState<LocalPrefsShape>({
    theme: 'light',
    primary_color: 'jade',
    card_style: 'glass',
    font_size: 'medium',
    app_background_url: '',
    app_background_kind: '',
  })

  const applyFromLocal = (p: LocalPrefsShape) => {
    const rawUrl = p.app_background_url.trim()
    const k = p.app_background_kind
    applyTheme({
      mode: p.theme as ThemeMode,
      primaryColor: p.primary_color as PrimaryColor,
      cardStyle: p.card_style as CardStyle,
      fontSize: p.font_size as FontSize,
      appBackgroundUrl: rawUrl || null,
      appBackgroundKind:
        k === 'video' ? 'video' : k === 'image' ? 'image' : rawUrl ? inferAppBackgroundKind(rawUrl) : null,
    })
  }

  useEffect(() => {
    preferencesApi.get().then((raw) => {
      const res = raw as unknown as Record<string, unknown>
      setPrefs(res)
      const url = typeof res.app_background_url === 'string' ? res.app_background_url : ''
      const kindRaw = res.app_background_kind
      const nk: LocalPrefsShape = {
        theme: (res.theme as string) || 'light',
        primary_color: (res.primary_color as string) || 'jade',
        card_style: (res.card_style as string) || 'glass',
        font_size: (res.font_size as string) || 'medium',
        app_background_url: url,
        app_background_kind: kindRaw === 'video' ? 'video' : kindRaw === 'image' ? 'image' : '',
      }
      setLocalPrefs(nk)
      applyFromLocal(nk)
    })
  }, [])

  const updatePref = async (key: string, value: string) => {
    let newPrefs: LocalPrefsShape = { ...localPrefs, [key]: value }
    if (key === 'app_background_url') {
      const t = value.trim()
      newPrefs = {
        ...newPrefs,
        app_background_kind: t ? (inferAppBackgroundKind(t) === 'video' ? 'video' : 'image') : '',
      }
    }
    setLocalPrefs(newPrefs)
    applyFromLocal(newPrefs)

    setSaving(true)
    try {
      if (key === 'app_background_url') {
        const t = value.trim()
        await preferencesApi.update({
          app_background_url: t || null,
          app_background_kind: t ? (inferAppBackgroundKind(t) === 'video' ? 'video' : 'image') : null,
        })
      } else {
        await preferencesApi.update({ [key]: value })
      }
    } catch {
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const syncPrefsFromServerObject = (raw: Record<string, unknown>) => {
    const url = typeof raw.app_background_url === 'string' ? raw.app_background_url : ''
    const kindRaw = raw.app_background_kind
    const nk: LocalPrefsShape = {
      theme: (raw.theme as string) || 'light',
      primary_color: (raw.primary_color as string) || 'jade',
      card_style: (raw.card_style as string) || 'glass',
      font_size: (raw.font_size as string) || 'medium',
      app_background_url: url,
      app_background_kind: kindRaw === 'video' ? 'video' : kindRaw === 'image' ? 'image' : '',
    }
    setLocalPrefs(nk)
    applyFromLocal(nk)
  }

  const handleAppBgFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBgUploading(true)
    try {
      const raw = await preferencesApi.uploadAppBackground(file)
      const out = raw as unknown as {
        preferences: Record<string, unknown>
        kind: 'image' | 'video'
      }
      syncPrefsFromServerObject(out.preferences)
      toast.success(out.kind === 'video' ? '视频背景已上传并应用' : '图片/GIF/WebP 背景已上传并应用')
    } catch (err) {
      toast.error(isApiError(err) ? mapErrorToMessage(err) : '上传失败')
    } finally {
      setBgUploading(false)
    }
  }

  const themeOptions = [
    { value: 'light', label: '浅色', icon: Sun },
    { value: 'dark', label: '深色', icon: Moon },
    { value: 'auto', label: '跟随系统', icon: Monitor },
  ]

  const cardStyleOptions = [
    { value: 'glass', label: '液态玻璃', desc: '半透明 + 慢旋柔和高光，背景模糊' },
    { value: 'minimal', label: '简约', desc: '干净的无边框设计' },
    { value: 'elevated', label: '悬浮', desc: '突出阴影层次感' },
  ]

  const fontSizeOptions = [
    { value: 'small', label: '小' },
    { value: 'medium', label: '中' },
    { value: 'large', label: '大' },
  ]

  /** DIY 各区块外壳随「卡片风格」变化；暗色下走 surface/border token */
  const diyShell = cn(panelClassFromCardStyle(localPrefs.card_style as CardStyle), 'rounded-2xl p-6')

  return (
    <div className="space-y-6">
      {/* 主题 */}
      <div className={diyShell}>
        <h3 className="font-semibold text-ink-primary mb-4">主题模式</h3>
        <div className="flex gap-3">
          {themeOptions.map(opt => {
            const Icon = opt.icon
            return (
              <button
                key={opt.value}
                onClick={() => updatePref('theme', opt.value)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all cursor-pointer font-medium text-sm',
                  localPrefs.theme === opt.value
                    ? 'border-brand bg-subtle text-ink-secondary shadow-e1'
                    : 'border-default hover:border-brand/50 text-ink-muted'
                )}
              >
                <Icon size={16} />
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* 主色调 */}
      <div className={diyShell}>
        <h3 className="font-semibold text-ink-primary mb-4">主色调</h3>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {COLOR_OPTIONS.map(color => (
            <button
              key={color.value}
              onClick={() => updatePref('primary_color', color.value)}
              className={cn(
                'relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all cursor-pointer',
                localPrefs.primary_color === color.value
                  ? 'border-current bg-opacity-10 scale-105 shadow-e1'
                  : 'border-default hover:scale-105'
              )}
              style={{ color: color.hex }}
            >
              <div
                className="w-10 h-10 rounded-full shadow-md"
                style={{ backgroundColor: color.hex }}
              />
              <span className="text-xs font-medium text-ink-muted">{color.label}</span>
              {localPrefs.primary_color === color.value && (
                <Check size={14} className="absolute top-2 right-2" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 卡片风格 */}
      <div className={diyShell}>
        <h3 className="font-semibold text-ink-primary mb-4">卡片风格</h3>
        <div className="flex gap-3">
          {cardStyleOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => updatePref('card_style', opt.value)}
              className={cn(
                'flex-1 text-left p-4 rounded-xl border-2 transition-all cursor-pointer',
                localPrefs.card_style === opt.value
                  ? 'border-brand bg-subtle shadow-e1'
                  : 'border-default hover:border-brand/40'
              )}
            >
              <div className="font-medium text-sm text-ink-primary">{opt.label}</div>
              <div className="text-xs text-ink-muted mt-1">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 字号 */}
      <div className={diyShell}>
        <h3 className="font-semibold text-ink-primary mb-4">字号</h3>
        <div className="flex gap-3">
          {fontSizeOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => updatePref('font_size', opt.value)}
              className={cn(
                'flex-1 py-3 rounded-xl border-2 font-medium text-sm transition-all cursor-pointer',
                localPrefs.font_size === opt.value
                  ? 'border-brand bg-subtle text-ink-secondary shadow-e1'
                  : 'border-default hover:border-brand/40 text-ink-muted'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 全站背景：本机素材或外链（静图/GIF/CSS）与视频链路分离 */}
      <div className={diyShell}>
        <h3 className="font-semibold text-ink-primary mb-1 flex items-center gap-2">
          <Image size={18} className="text-brand" />
          网页应用背景
        </h3>
        <p className="text-sm text-ink-muted mb-4 leading-relaxed">
          铺在登录后<strong>导航栏与主内容背后</strong>。<strong>本地上传</strong>会存入你的对象存储并从同源地址展示（GIF 动画、短片均可）；也可用下方输入框粘贴{' '}
          <code className="text-xs bg-muted px-1 rounded text-ink-primary">https://</code> / <code className="text-xs bg-muted px-1 rounded text-ink-primary">data:</code>{' '}
          等资源地址。视频外链请使用可直接访问的{' '}
          <code className="text-xs bg-muted px-1 rounded text-ink-primary">.mp4</code> /{' '}
          <code className="text-xs bg-muted px-1 rounded text-ink-primary">.webm</code> 等结尾链接；留空为默认浅色底。
        </p>
        <input
          ref={bgFileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
          className="sr-only"
          onChange={handleAppBgFile}
        />
        <div className="flex flex-col gap-3 mb-4">
          <button
            type="button"
            disabled={bgUploading}
            onClick={() => bgFileInputRef.current?.click()}
            className="w-full sm:w-auto px-4 py-2.5 border-2 border-brand text-ink-secondary bg-subtle rounded-xl text-sm font-medium hover:bg-muted/70 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {bgUploading ? '上传中…' : '从本机选择图片 / GIF / WebP / 短片'}
          </button>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={localPrefs.app_background_url}
              onChange={(e) =>
                setLocalPrefs((p) => ({
                  ...p,
                  app_background_url: e.target.value,
                }))
              }
              placeholder="https://… 或同源 /api/… ，或先在上方本机上传自动生成"
              className="flex-1 px-3 py-2.5 border border-default rounded-xl focus:ring-2 focus:ring-brand/40 outline-none bg-muted/40 text-sm text-ink-primary"
            />
            <button
              type="button"
              onClick={() => updatePref('app_background_url', localPrefs.app_background_url)}
              className="px-4 py-2.5 bg-brand text-ink-inverse rounded-xl text-sm font-medium hover:bg-brand-hover shadow-e2 transition-colors cursor-pointer whitespace-nowrap"
            >
              应用链接
            </button>
            <button
              type="button"
              onClick={() => updatePref('app_background_url', '')}
              className="px-4 py-2.5 border border-default rounded-xl text-sm text-ink-muted hover:bg-muted/60 transition-colors cursor-pointer whitespace-nowrap"
            >
              清除
            </button>
          </div>
        </div>
      </div>

      {/* 预览 */}
      <div className={diyShell}>
        <h3 className="font-semibold text-ink-primary mb-4">预览</h3>
        <div
          className={cn('p-6 rounded-xl', panelClassFromCardStyle(localPrefs.card_style as CardStyle))}
          style={{ fontSize: localPrefs.font_size === 'small' ? '14px' : localPrefs.font_size === 'large' ? '18px' : '16px' }}
        >
          <div
            className="font-bold text-ink-primary mb-2"
            style={{ color: COLOR_OPTIONS.find((c) => c.value === localPrefs.primary_color)?.hex }}
          >
            卡片预览
          </div>
          <div className="text-ink-muted leading-relaxed">
            这是一个示例卡片，用于预览主题样式效果。文字大小、颜色和卡片风格都已根据你的设置进行调整。
          </div>
        </div>
      </div>
    </div>
  )
}

/** 从用户上传的 JSON 解析出若干个角色备份包（单包或账号 bundle） */
function parseArchiveImportPackages(root: unknown): Record<string, unknown>[] {
  if (root === null || typeof root !== 'object') throw new Error('INVALID_BACKUP_FORMAT')
  const o = root as Record<string, unknown>
  const isRolePkg = (x: unknown): x is Record<string, unknown> =>
    !!x &&
    typeof x === 'object' &&
    ((x as Record<string, unknown>).format === 'mtc-archive-roles-v1' ||
      (x as Record<string, unknown>).format === 'mtc-archive-roles-v2')

  if (o.format === 'mtc-user-archives-bundle-v1') {
    const arr = o.archives
    if (!Array.isArray(arr) || arr.length === 0) throw new Error('EMPTY_BUNDLE')
    const pkgs = arr.filter(isRolePkg)
    if (pkgs.length === 0) throw new Error('INVALID_BACKUP_FORMAT')
    return pkgs
  }
  if (isRolePkg(o)) return [o]
  throw new Error('INVALID_BACKUP_FORMAT')
}

function createParamsFromRolesBackup(pkg: Record<string, unknown>, fallbackIndex: number) {
  const raw = pkg.archive
  const meta = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  let name = typeof meta.name === 'string' ? meta.name.trim() : ''
  if (!name) name = `导入的档案 ${fallbackIndex}`
  const description = typeof meta.description === 'string' ? meta.description : undefined
  const t = typeof meta.archive_type === 'string' ? meta.archive_type.trim() : ''
  const archive_type = t.length > 0 ? t : 'family'
  return { name, description, archive_type }
}

async function restoreRolesPackagesAsNewArchives(pkgs: Record<string, unknown>[]): Promise<number> {
  let n = 0
  for (let i = 0; i < pkgs.length; i++) {
    const pkg = pkgs[i]!
    const body = createParamsFromRolesBackup(pkg, i + 1)
    const created = (await archiveApi.create(body)) as { id?: number }
    const nid = typeof created?.id === 'number' ? created.id : NaN
    if (!Number.isFinite(nid) || nid < 1) throw new Error('CREATE_ARCHIVE_FAILED')
    await archiveApi.restoreRolesBackup(nid, pkg)
    n++
  }
  return n
}

/** 云端存储面板 */
function CloudPanel() {
  const panels = usePersonalCenterPanels()
  const { summaries, lastUpdated, syncEnabled, syncing, toggleSync, forceSync, clearMemory } = useAIContext()
  const queryClient = useQueryClient()
  const [archiveExportBusy, setArchiveExportBusy] = useState(false)
  const [archiveImportBusy, setArchiveImportBusy] = useState(false)
  const importArchiveInputRef = useRef<HTMLInputElement | null>(null)

  const handleExportAllArchives = async () => {
    if (archiveExportBusy) return
    setArchiveExportBusy(true)
    try {
      const raw = await archiveApi.list()
      const archives = Array.isArray(raw) ? raw : []
      const bundles: unknown[] = []
      for (const a of archives as { id: number }[]) {
        if (!a?.id) continue
        const blob = await archiveApi.downloadRolesBackup(a.id, true, true)
        const text = await blob.text()
        bundles.push(JSON.parse(text))
      }
      const mega = {
        format: 'mtc-user-archives-bundle-v1',
        exported_at: new Date().toISOString(),
        archives: bundles,
      }
      const out = new Blob([JSON.stringify(mega, null, 2)], {
        type: 'application/json;charset=utf-8',
      })
      const url = URL.createObjectURL(out)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `mtc-all-archives-${new Date().toISOString().slice(0, 10)}.json`
      anchor.rel = 'noopener'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      toast.success(`已导出 ${bundles.length} 个档案（含角色、记忆与关系网）`)
    } catch (e) {
      toast.error(isApiError(e) ? mapErrorToMessage(e) : '导出失败，请稍后重试')
    } finally {
      setArchiveExportBusy(false)
    }
  }

  const handleImportArchiveFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setArchiveImportBusy(true)
    try {
      let data: unknown
      try {
        data = JSON.parse(await file.text()) as unknown
      } catch {
        toast.error('文件不是合法的 JSON')
        return
      }
      let pkgs: Record<string, unknown>[]
      try {
        pkgs = parseArchiveImportPackages(data)
      } catch (err) {
        if (err instanceof Error) {
          if (err.message === 'EMPTY_BUNDLE') toast.error('bundle 为空或不含有效档案备份')
          else if (err.message === 'INVALID_BACKUP_FORMAT')
            toast.error('不是 MTC 档案备份（需 mtc-archive-roles-v1/v2，或 bundle mtc-user-archives-bundle-v1）')
          else toast.error(err.message)
        } else toast.error('无法解析备份')
        return
      }
      const n = await restoreRolesPackagesAsNewArchives(pkgs)
      await queryClient.invalidateQueries({ queryKey: ['archives'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success(n === 1 ? '已新建 1 个档案并写入备份内容' : `已新建 ${n} 个档案并写入备份内容`)
    } catch (e) {
      if (e instanceof Error && e.message === 'CREATE_ARCHIVE_FAILED') {
        toast.error('新建档案失败，请稍后重试')
      } else {
        toast.error(isApiError(e) ? mapErrorToMessage(e) : '导入失败，请稍后重试')
      }
    } finally {
      setArchiveImportBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* 账号级档案备份（服务端数据） */}
      <div className={panels.section}>
        <div className="flex items-start gap-3 mb-4">
          <div className="rounded-lg bg-brand/12 p-2 text-brand shrink-0">
            <HardDrive className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 space-y-1">
            <h3 className="font-semibold text-ink-primary">档案与关系网备份</h3>
            <p className="text-sm text-ink-muted leading-relaxed">
              <strong>导出</strong>
              ：单个 JSON 包含<strong>全部档案</strong>下的成员、记忆与 Mnemo 关系网。<strong>导入</strong>
              ：会为备份中的<strong>每一份</strong>档案<strong>新建</strong>服务端档案（不会覆盖同名旧档案）。
            </p>
            <p className="text-xs text-ink-muted leading-relaxed">
              若在<strong>已有</strong>某档案内追加成员而非新建档案，请到{' '}
              <Link to="/archives" className="text-brand font-medium hover:underline">
                档案库
              </Link>{' '}
              → 该档案详情 → 「从备份导入」。
            </p>
          </div>
        </div>
        <input
          ref={importArchiveInputRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={handleImportArchiveFile}
        />
        <div className="flex flex-col sm:flex-row flex-wrap gap-3">
          <button
            type="button"
            onClick={() => importArchiveInputRef.current?.click()}
            disabled={archiveImportBusy || archiveExportBusy}
            className="w-full sm:w-auto px-5 py-2.5 border-2 border-brand text-ink-secondary bg-brand/10 rounded-xl font-medium hover:bg-brand/16 disabled:opacity-50 transition-all text-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            <Upload size={15} />
            {archiveImportBusy ? '正在导入备份…' : '导入备份 JSON'}
          </button>
          <button
            type="button"
            onClick={() => void handleExportAllArchives()}
            disabled={archiveExportBusy || archiveImportBusy}
            className="w-full sm:w-auto px-5 py-2.5 bg-brand text-ink-inverse rounded-xl font-medium hover:bg-brand-hover disabled:opacity-50 transition-all shadow-e2 text-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            <Download size={15} />
            {archiveExportBusy ? '正在打包全部档案…' : '导出全部档案 JSON'}
          </button>
        </div>
      </div>

      {/* AI 记忆同步 */}
      <div className={panels.section}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-ink-primary">AI 模型记忆同步</h3>
            <p className="text-sm text-ink-muted mt-1">开启后，AI 会记住跨会话的对话上下文</p>
          </div>
          <button
            onClick={() => toggleSync(!syncEnabled)}
            className={cn(
              'relative w-12 h-7 rounded-full transition-all cursor-pointer',
              syncEnabled ? 'bg-brand' : 'bg-muted'
            )}
          >
            <div
              className={cn(
                'absolute top-1 w-5 h-5 bg-surface rounded-full shadow transition-all',
                syncEnabled ? 'left-6' : 'left-1'
              )}
            />
          </button>
        </div>

        {syncEnabled && (
          <>
            <div className="flex items-center justify-between text-sm mb-4">
              <span className="text-ink-secondary">
                {summaries.length > 0 ? `已保存 ${summaries.length} 条对话摘要` : '暂无记忆记录'}
              </span>
              {syncing ? (
                <RefreshCw size={14} className="text-brand animate-spin" />
              ) : (
                <button onClick={forceSync} className="text-brand hover:text-brand-hover font-medium cursor-pointer">
                  手动同步
                </button>
              )}
            </div>

            {lastUpdated && (
              <p className="text-xs text-ink-muted mb-4">
                最后同步：{new Date(lastUpdated).toLocaleString('zh-CN')}
              </p>
            )}

            {/* 记忆摘要列表 */}
            {summaries.length > 0 && (
              <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
                {summaries.slice(-5).reverse().map((s, i) => (
                  <div
                    key={s.id || i}
                    className="rounded-xl border border-default/60 bg-muted/40 p-3 text-sm backdrop-blur-sm"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-ink-secondary text-xs">
                        {s.memberName || '通用对话'} · {new Date(s.date).toLocaleDateString('zh-CN')}
                      </span>
                    </div>
                    <div className="text-ink-secondary text-xs line-clamp-2">{s.summary}</div>
                    {s.emotionTags && s.emotionTags.length > 0 && (
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {s.emotionTags.map((tag, j) => (
                          <span key={j} className="text-xs bg-brand/18 text-brand px-1.5 py-0.5 rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* 同步说明 */}
      <div className={panels.sectionCompact}>
        <h4 className="font-medium text-ink-secondary text-sm mb-2">关于 AI 记忆同步</h4>
        <ul className="text-xs text-ink-muted space-y-1.5">
          <li>· 每次对话结束后，系统会自动生成对话摘要并保存</li>
          <li>· 新对话时，摘要内容会作为上下文注入 AI，帮助保持记忆连贯性</li>
          <li>· 最多保留最近 10 条对话摘要</li>
          <li>· 关闭同步后，已保存的摘要不会自动删除，可手动清除</li>
          <li>· 清除记忆后，所有摘要将被永久删除</li>
        </ul>
      </div>

      {/* 清除记忆 */}
      {summaries.length > 0 && (
        <button
          onClick={() => {
            if (confirm('确定要清除所有 AI 记忆吗？此操作不可恢复。')) {
              clearMemory()
            }
          }}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-red-500 border border-red-200 rounded-xl hover:bg-red-50 transition-all text-sm cursor-pointer"
        >
          <Trash2 size={14} />
          清除所有记忆
        </button>
      )}
    </div>
  )
}

// ========== 主组件 ==========

export default function PersonalCenterPage() {
  const tabShell = usePersonalCenterPanels()
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<TabId>(() => parseTabParam(searchParams))

  useEffect(() => {
    setActiveTab(parseTabParam(searchParams))
  }, [searchParams])

  const selectTab = (id: TabId) => {
    setActiveTab(id)
    setSearchParams(id === 'overview' ? {} : { tab: id }, { replace: true })
  }

  const tabContent: Record<TabId, React.ReactNode> = {
    overview: <OverviewPanel />,
    subscription: <SubscriptionPanel />,
    account: <AccountPanel />,
    appearance: <AppearancePanel />,
    cloud: <CloudPanel />,
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-ink-primary">
      <div className="flex flex-col md:flex-row gap-8">
        {/* 侧边导航 */}
        <div className="md:w-48 flex-shrink-0">
          <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
            {tabs.map(tab => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => selectTab(tab.id as TabId)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-[box-shadow,color,background-color] whitespace-nowrap cursor-pointer',
                    activeTab === tab.id
                      ? cn(
                          tabShell.panelBase,
                          'text-ink-secondary font-semibold shadow-e2 ring-1 ring-border-default',
                        )
                      : 'text-ink-muted hover:bg-muted/60 hover:text-ink-secondary hover:backdrop-blur-[2px]',
                  )}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>

        {/* 内容区 */}
        <div className="flex-1 min-w-0">
          {tabContent[activeTab]}
        </div>
      </div>
    </div>
  )
}
