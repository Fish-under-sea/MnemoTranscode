/**
 * 个人中心页面 — 整合订阅管理、账号设置、DIY UI、云端存储
 */
import { useState, useEffect, useRef } from 'react'
import { useAuthStore } from '@/hooks/useAuthStore'
import { authApi, usageApi, preferencesApi, subscriptionApi } from '@/services/api'
import { useAIContext } from '@/hooks/useAIContext'
import { applyTheme, COLOR_OPTIONS, type PrimaryColor, type ThemeMode, type CardStyle, type FontSize } from '@/lib/theme'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'
import {
  User, CreditCard, Palette, Cloud, BarChart3,
  Check, RefreshCw, Download, Trash2, Moon, Sun, Monitor,
  AlertTriangle, Eye, EyeOff
} from 'lucide-react'

type TabId = 'overview' | 'subscription' | 'account' | 'appearance' | 'cloud'

const tabs = [
  { id: 'overview', label: '概览', icon: BarChart3 },
  { id: 'subscription', label: '订阅管理', icon: CreditCard },
  { id: 'account', label: '账号设置', icon: User },
  { id: 'appearance', label: 'DIY UI', icon: Palette },
  { id: 'cloud', label: '云端存储', icon: Cloud },
]

// ========== 子组件 ==========

/** 用量环形图 */
function UsageRing({ used, limit, color }: { used: number; limit: number; color: string }) {
  const percent = Math.min(100, (used / limit) * 100)
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
        <span className="text-2xl font-bold text-slate-900">{percent.toFixed(0)}%</span>
        <span className="text-xs text-slate-500">已使用</span>
      </div>
    </div>
  )
}

/** 概览面板 */
function OverviewPanel() {
  const { user } = useAuthStore()
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    usageApi.getStats().then((res: any) => {
      setStats(res)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const limit = user?.monthly_token_limit || 100000
  const used = stats?.monthly_used || user?.monthly_token_used || 0

  return (
    <div className="space-y-6">
      {/* 用户卡片 */}
      <div className="bg-gradient-to-br from-jade-50 to-jade-100 rounded-2xl p-6 border border-jade-200">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-jade-400 to-jade-600 flex items-center justify-center shadow-jade">
            <span className="text-white font-bold text-xl">{user?.username?.charAt(0)?.toUpperCase() || 'U'}</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">{user?.username}</h2>
            <p className="text-slate-500 text-sm">{user?.email}</p>
            <span className={cn(
              'inline-block mt-1.5 text-xs px-2.5 py-0.5 rounded-full font-medium',
              user?.subscription_tier === 'pro' ? 'bg-jade-200 text-jade-800' :
              user?.subscription_tier === 'enterprise' ? 'bg-amber-200 text-amber-800' :
              'bg-slate-200 text-slate-600'
            )}>
              {user?.subscription_tier === 'pro' ? 'Pro 会员' :
               user?.subscription_tier === 'enterprise' ? 'Enterprise' : 'Free'}
            </span>
          </div>
        </div>
      </div>

      {/* 用量卡片 */}
      <div className="bg-white rounded-2xl border border-warm-200 p-6">
        <h3 className="font-semibold text-slate-900 mb-4">本月 AI 用量</h3>
        {loading ? (
          <div className="flex items-center gap-6">
            <div className="w-32 h-32 bg-slate-100 rounded-full animate-pulse" />
            <div className="space-y-2 flex-1">
              <div className="h-4 bg-slate-100 rounded w-3/4 animate-pulse" />
              <div className="h-4 bg-slate-100 rounded w-1/2 animate-pulse" />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-6">
            <UsageRing used={used} limit={limit} color="#10B981" />
            <div className="space-y-3 flex-1">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">已使用</span>
                <span className="font-semibold text-slate-900">{used.toLocaleString()} tokens</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">限额</span>
                <span className="font-semibold text-slate-900">{limit.toLocaleString()} tokens</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">剩余</span>
                <span className="font-semibold text-jade-600">{Math.max(0, limit - used).toLocaleString()} tokens</span>
              </div>
              {/* 用量类型分布 */}
              {stats?.usage_by_type && Object.keys(stats.usage_by_type).length > 0 && (
                <div className="pt-2 border-t border-warm-100 space-y-1.5">
                  {Object.entries(stats.usage_by_type).map(([type, count]) => (
                    <div key={type} className="flex justify-between text-xs text-slate-500">
                      <span>{type === 'dialogue' ? 'AI 对话' : type === 'storybook' ? '故事书' : type === 'search' ? '语义搜索' : type}</span>
                      <span>{(count as number).toLocaleString()} tokens</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 快速操作 */}
      <div className="grid grid-cols-2 gap-4">
        <button className="bg-white rounded-xl border border-warm-200 p-4 text-left hover:border-jade-200 hover:shadow-glass transition-all cursor-pointer">
          <CreditCard size={20} className="text-jade-500 mb-2" />
          <div className="font-semibold text-slate-900 text-sm">升级方案</div>
          <div className="text-xs text-slate-500 mt-0.5">解锁更多用量</div>
        </button>
        <button className="bg-white rounded-xl border border-warm-200 p-4 text-left hover:border-jade-200 hover:shadow-glass transition-all cursor-pointer">
          <Download size={20} className="text-jade-500 mb-2" />
          <div className="font-semibold text-slate-900 text-sm">导出数据</div>
          <div className="text-xs text-slate-500 mt-0.5">下载全部档案</div>
        </button>
      </div>
    </div>
  )
}

/** 订阅管理面板 */
function SubscriptionPanel() {
  const { user, updateUser } = useAuthStore()
  const [sub, setSub] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    subscriptionApi.get().then((res: any) => {
      setSub(res)
      updateUser({
        subscription_tier: res.tier,
        monthly_token_limit: res.monthly_limit,
        monthly_token_used: res.monthly_used,
      })
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const plans = [
    {
      id: 'free',
      name: 'Free',
      price: '¥0',
      period: '永久',
      tokens: '100K',
      color: 'slate',
      features: ['基础 AI 对话', '档案管理', '记忆录入', '语义搜索'],
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '¥29',
      period: '/月',
      tokens: '2M',
      color: 'jade',
      features: ['全部 Free 功能', '故事书生成', '记忆胶囊', '优先队列', '5x 用量限额', '邮件支持'],
      popular: true,
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: '¥199',
      period: '/月',
      tokens: '无限制',
      color: 'amber',
      features: ['全部 Pro 功能', '无限用量', '自定义模型', 'API 访问', '专属支持', '多用户协作'],
    },
  ]

  const currentTier = user?.subscription_tier || 'free'

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-48 bg-slate-100 rounded-2xl animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-slate-900 mb-1">订阅方案</h3>
        <p className="text-sm text-slate-500">选择适合你的用量方案</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {plans.map(plan => (
          <div
            key={plan.id}
            className={cn(
              'relative rounded-2xl border-2 p-5 transition-all',
              currentTier === plan.id
                ? plan.color === 'jade' ? 'border-jade-400 bg-jade-50 shadow-jade' :
                  plan.color === 'amber' ? 'border-amber-400 bg-amber-50 shadow-amber' :
                  'border-slate-400 bg-slate-50'
                : 'border-warm-200 bg-white hover:border-jade-200',
              plan.popular && 'md:scale-105'
            )}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-jade-500 text-white text-xs px-3 py-1 rounded-full font-medium shadow-jade">
                  最受欢迎
                </span>
              </div>
            )}

            <div className="text-center mb-4">
              <h4 className="font-bold text-slate-900">{plan.name}</h4>
              <div className="mt-2">
                <span className="text-2xl font-bold text-slate-900">{plan.price}</span>
                <span className="text-slate-500 text-sm">/{plan.period}</span>
              </div>
              <div className="mt-1 text-xs text-slate-500">每月 {plan.tokens} tokens</div>
            </div>

            <ul className="space-y-2 mb-4">
              {plan.features.map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                  <Check size={14} className={cn(
                    'flex-shrink-0',
                    currentTier === plan.id ? 'text-jade-500' : 'text-slate-400'
                  )} />
                  {f}
                </li>
              ))}
            </ul>

            <button
              disabled={currentTier === plan.id}
              className={cn(
                'w-full py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer',
                currentTier === plan.id
                  ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                  : plan.color === 'jade'
                  ? 'bg-jade-500 text-white hover:bg-jade-600 shadow-jade'
                  : 'bg-slate-900 text-white hover:bg-slate-800'
              )}
            >
              {currentTier === plan.id ? '当前方案' : plan.id === 'free' ? '降级' : '升级'}
            </button>
          </div>
        ))}
      </div>

      {/* 用量警告 */}
      {sub && sub.usage_percent > 70 && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-medium text-amber-800 text-sm">用量即将达到上限</div>
            <div className="text-amber-700 text-xs mt-1">
              已使用 {sub.usage_percent.toFixed(1)}%，建议升级到 Pro 方案获得更多用量。
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** 账号设置面板 */
function AccountPanel() {
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
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (user?.username) setUsername(user.username)
  }, [user])

  // 头像预览处理
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error('头像文件不能超过 5MB')
      return
    }
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
      toast.error('仅支持 JPG、PNG、GIF、WebP 格式')
      return
    }
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
      const res = await authApi.uploadAvatar(avatarFile) as any
      updateUser({ avatar_url: res.url })
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
      updateUser({ avatar_url: undefined })
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
      <div className="bg-white rounded-2xl border border-warm-200 p-6">
        <h3 className="font-semibold text-slate-900 mb-4">基本信息</h3>
        <div className="space-y-4">
          {/* 头像上传 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">头像</label>
            <div className="flex items-center gap-4">
              {/* 当前头像 */}
              <div className="relative flex-shrink-0">
                <div className="w-20 h-20 rounded-full overflow-hidden bg-gradient-to-br from-jade-400 to-jade-600 flex items-center justify-center shadow-md">
                  {avatarPreview || user?.avatar_url ? (
                    <img
                      src={avatarPreview || user?.avatar_url || ''}
                      alt="头像"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-white font-bold text-2xl">
                      {user?.username?.charAt(0)?.toUpperCase() || 'U'}
                    </span>
                  )}
                </div>
                {/* 上传中遮罩 */}
                {avatarUploading && (
                  <div className="absolute inset-0 bg-slate-900/50 rounded-full flex items-center justify-center">
                    <RefreshCw size={16} className="text-white animate-spin" />
                  </div>
                )}
              </div>

              {/* 上传操作 */}
              <div className="flex flex-col gap-2">
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
                  className="px-4 py-2 bg-jade-50 text-jade-700 border border-jade-200 rounded-xl text-sm font-medium hover:bg-jade-100 transition-colors cursor-pointer text-center"
                >
                  更换头像
                </label>
                {avatarFile && (
                  <button
                    onClick={handleUploadAvatar}
                    disabled={avatarUploading}
                    className="px-4 py-2 bg-jade-500 text-white rounded-xl text-sm font-medium hover:bg-jade-600 disabled:opacity-50 transition-colors cursor-pointer"
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
                <p className="text-xs text-slate-400">支持 JPG、PNG、GIF、WebP，最大 5MB</p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">用户名</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full px-3 py-2.5 border border-warm-200 rounded-xl focus:ring-2 focus:ring-jade-400 focus:border-jade-400 outline-none bg-warm-50 text-sm"
              minLength={2}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">邮箱</label>
            <input
              type="email"
              defaultValue={user?.email}
              disabled
              className="w-full px-3 py-2.5 border border-warm-200 rounded-xl bg-slate-50 text-slate-500 text-sm"
            />
            <p className="text-xs text-slate-400 mt-1">邮箱暂不支持修改</p>
          </div>
          <button
            onClick={handleSaveProfile}
            disabled={saving}
            className="px-5 py-2.5 bg-jade-500 text-white rounded-xl font-medium hover:bg-jade-600 disabled:opacity-50 transition-all shadow-jade text-sm cursor-pointer"
          >
            {saving ? '保存中...' : '保存修改'}
          </button>
        </div>
      </div>

      {/* 修改密码 */}
      <div className="bg-white rounded-2xl border border-warm-200 p-6">
        <h3 className="font-semibold text-slate-900 mb-4">修改密码</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">旧密码</label>
            <div className="relative">
              <input
                type={showOld ? 'text' : 'password'}
                value={oldPassword}
                onChange={e => setOldPassword(e.target.value)}
                placeholder="输入旧密码"
                className="w-full px-3 py-2.5 border border-warm-200 rounded-xl focus:ring-2 focus:ring-jade-400 focus:border-jade-400 outline-none bg-warm-50 text-sm"
              />
              <button onClick={() => setShowOld(!showOld)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-jade-600 cursor-pointer p-1">
                {showOld ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">新密码</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="至少 6 位"
                className="w-full px-3 py-2.5 border border-warm-200 rounded-xl focus:ring-2 focus:ring-jade-400 focus:border-jade-400 outline-none bg-warm-50 text-sm"
              />
              <button onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-jade-600 cursor-pointer p-1">
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">确认新密码</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="再次输入新密码"
              className="w-full px-3 py-2.5 border border-warm-200 rounded-xl focus:ring-2 focus:ring-jade-400 focus:border-jade-400 outline-none bg-warm-50 text-sm"
            />
          </div>
          <button
            onClick={handleChangePassword}
            disabled={passwordSaving}
            className="px-5 py-2.5 bg-slate-800 text-white rounded-xl font-medium hover:bg-slate-700 disabled:opacity-50 transition-all text-sm cursor-pointer"
          >
            {passwordSaving ? '修改中...' : '修改密码'}
          </button>
        </div>
      </div>

      {/* 危险操作 */}
      <div className="bg-white rounded-2xl border border-red-200 p-6">
        <h3 className="font-semibold text-red-600 mb-2">危险操作</h3>
        <p className="text-sm text-slate-500 mb-4">注销账号后，所有数据将被永久删除且无法恢复。</p>
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
  const [localPrefs, setLocalPrefs] = useState({
    theme: 'light',
    primary_color: 'jade',
    card_style: 'glass',
    font_size: 'medium',
  })

  useEffect(() => {
    preferencesApi.get().then((res: any) => {
      setPrefs(res)
      setLocalPrefs({
        theme: res.theme || 'light',
        primary_color: res.primary_color || 'jade',
        card_style: res.card_style || 'glass',
        font_size: res.font_size || 'medium',
      })
    })
  }, [])

  const updatePref = async (key: string, value: string) => {
    const newPrefs = { ...localPrefs, [key]: value }
    setLocalPrefs(newPrefs)

    // 乐观更新主题预览
    applyTheme({
      mode: newPrefs.theme as ThemeMode,
      primaryColor: newPrefs.primary_color as PrimaryColor,
      cardStyle: newPrefs.card_style as CardStyle,
      fontSize: newPrefs.font_size as FontSize,
    })

    setSaving(true)
    try {
      await preferencesApi.update({ [key]: value })
    } catch {
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const themeOptions = [
    { value: 'light', label: '浅色', icon: Sun },
    { value: 'dark', label: '深色', icon: Moon },
    { value: 'auto', label: '跟随系统', icon: Monitor },
  ]

  const cardStyleOptions = [
    { value: 'glass', label: '毛玻璃', desc: '半透明玻璃态效果' },
    { value: 'minimal', label: '简约', desc: '干净的无边框设计' },
    { value: 'elevated', label: '悬浮', desc: '突出阴影层次感' },
  ]

  const fontSizeOptions = [
    { value: 'small', label: '小' },
    { value: 'medium', label: '中' },
    { value: 'large', label: '大' },
  ]

  return (
    <div className="space-y-6">
      {/* 主题 */}
      <div className="bg-white rounded-2xl border border-warm-200 p-6">
        <h3 className="font-semibold text-slate-900 mb-4">主题模式</h3>
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
                    ? 'border-jade-400 bg-jade-50 text-jade-700'
                    : 'border-warm-200 hover:border-jade-200 text-slate-600'
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
      <div className="bg-white rounded-2xl border border-warm-200 p-6">
        <h3 className="font-semibold text-slate-900 mb-4">主色调</h3>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {COLOR_OPTIONS.map(color => (
            <button
              key={color.value}
              onClick={() => updatePref('primary_color', color.value)}
              className={cn(
                'relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all cursor-pointer',
                localPrefs.primary_color === color.value
                  ? 'border-current bg-opacity-10 scale-105'
                  : 'border-warm-200 hover:scale-105'
              )}
              style={{ color: color.hex }}
            >
              <div
                className="w-10 h-10 rounded-full shadow-md"
                style={{ backgroundColor: color.hex }}
              />
              <span className="text-xs font-medium text-slate-600">{color.label}</span>
              {localPrefs.primary_color === color.value && (
                <Check size={14} className="absolute top-2 right-2" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 卡片风格 */}
      <div className="bg-white rounded-2xl border border-warm-200 p-6">
        <h3 className="font-semibold text-slate-900 mb-4">卡片风格</h3>
        <div className="flex gap-3">
          {cardStyleOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => updatePref('card_style', opt.value)}
              className={cn(
                'flex-1 text-left p-4 rounded-xl border-2 transition-all cursor-pointer',
                localPrefs.card_style === opt.value
                  ? 'border-jade-400 bg-jade-50'
                  : 'border-warm-200 hover:border-jade-200'
              )}
            >
              <div className="font-medium text-sm text-slate-900">{opt.label}</div>
              <div className="text-xs text-slate-500 mt-1">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 字号 */}
      <div className="bg-white rounded-2xl border border-warm-200 p-6">
        <h3 className="font-semibold text-slate-900 mb-4">字号</h3>
        <div className="flex gap-3">
          {fontSizeOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => updatePref('font_size', opt.value)}
              className={cn(
                'flex-1 py-3 rounded-xl border-2 font-medium text-sm transition-all cursor-pointer',
                localPrefs.font_size === opt.value
                  ? 'border-jade-400 bg-jade-50 text-jade-700'
                  : 'border-warm-200 hover:border-jade-200 text-slate-600'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 预览 */}
      <div className="bg-white rounded-2xl border border-warm-200 p-6">
        <h3 className="font-semibold text-slate-900 mb-4">预览</h3>
        <div
          className={cn(
            'p-6 rounded-xl',
            localPrefs.card_style === 'glass' && 'bg-white/70 backdrop-blur-md border border-jade-200 shadow-glass',
            localPrefs.card_style === 'minimal' && 'bg-white border border-transparent',
            localPrefs.card_style === 'elevated' && 'bg-white border border-warm-200 shadow-lg',
          )}
          style={{ fontSize: localPrefs.font_size === 'small' ? '14px' : localPrefs.font_size === 'large' ? '18px' : '16px' }}
        >
          <div className="font-bold text-slate-900 mb-2" style={{ color: localPrefs.primary_color === 'jade' ? '#10B981' : localPrefs.primary_color === 'amber' ? '#F59E0B' : localPrefs.primary_color === 'rose' ? '#F43F5E' : localPrefs.primary_color === 'sky' ? '#0EA5E9' : localPrefs.primary_color === 'violet' ? '#8B5CF6' : '#22C55E' }}>
            卡片预览
          </div>
          <div className="text-slate-600 leading-relaxed">
            这是一个示例卡片，用于预览主题样式效果。文字大小、颜色和卡片风格都已根据你的设置进行调整。
          </div>
        </div>
      </div>
    </div>
  )
}

/** 云端存储面板 */
function CloudPanel() {
  const {
    summaries, lastUpdated, syncEnabled, syncing,
    toggleSync, forceSync, clearMemory, getContextForPrompt
  } = useAIContext()
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      const data = {
        exported_at: new Date().toISOString(),
        ai_memory: {
          summaries,
          last_updated: lastUpdated,
          prompt_context: getContextForPrompt(),
        },
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `mtc-ai-memory-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('导出成功')
    } catch {
      toast.error('导出失败')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* AI 记忆同步 */}
      <div className="bg-white rounded-2xl border border-warm-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-slate-900">AI 模型记忆同步</h3>
            <p className="text-sm text-slate-500 mt-1">开启后，AI 会记住跨会话的对话上下文</p>
          </div>
          <button
            onClick={() => toggleSync(!syncEnabled)}
            className={cn(
              'relative w-12 h-7 rounded-full transition-all cursor-pointer',
              syncEnabled ? 'bg-jade-500' : 'bg-slate-300'
            )}
          >
            <div
              className={cn(
                'absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all',
                syncEnabled ? 'left-6' : 'left-1'
              )}
            />
          </button>
        </div>

        {syncEnabled && (
          <>
            <div className="flex items-center justify-between text-sm mb-4">
              <span className="text-slate-600">
                {summaries.length > 0 ? `已保存 ${summaries.length} 条对话摘要` : '暂无记忆记录'}
              </span>
              {syncing ? (
                <RefreshCw size={14} className="text-jade-500 animate-spin" />
              ) : (
                <button onClick={forceSync} className="text-jade-600 hover:text-jade-700 font-medium cursor-pointer">
                  手动同步
                </button>
              )}
            </div>

            {lastUpdated && (
              <p className="text-xs text-slate-400 mb-4">
                最后同步：{new Date(lastUpdated).toLocaleString('zh-CN')}
              </p>
            )}

            {/* 记忆摘要列表 */}
            {summaries.length > 0 && (
              <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
                {summaries.slice(-5).reverse().map((s, i) => (
                  <div key={s.id || i} className="bg-warm-50 rounded-xl p-3 text-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-slate-700 text-xs">
                        {s.memberName || '通用对话'} · {new Date(s.date).toLocaleDateString('zh-CN')}
                      </span>
                    </div>
                    <div className="text-slate-600 text-xs line-clamp-2">{s.summary}</div>
                    {s.emotionTags && s.emotionTags.length > 0 && (
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {s.emotionTags.map((tag, j) => (
                          <span key={j} className="text-xs bg-jade-100 text-jade-700 px-1.5 py-0.5 rounded">
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

      {/* 数据导出 */}
      <div className="bg-white rounded-2xl border border-warm-200 p-6">
        <h3 className="font-semibold text-slate-900 mb-2">数据导出</h3>
        <p className="text-sm text-slate-500 mb-4">
          将你的 AI 记忆数据导出为 JSON 文件，方便备份或迁移。
        </p>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="px-5 py-2.5 bg-jade-500 text-white rounded-xl font-medium hover:bg-jade-600 disabled:opacity-50 transition-all shadow-jade text-sm flex items-center gap-2 cursor-pointer"
        >
          <Download size={15} />
          {exporting ? '导出中...' : '导出数据'}
        </button>
      </div>

      {/* 同步说明 */}
      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5">
        <h4 className="font-medium text-slate-700 text-sm mb-2">关于 AI 记忆同步</h4>
        <ul className="text-xs text-slate-500 space-y-1.5">
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
  const [activeTab, setActiveTab] = useState<TabId>('overview')

  const panels: Record<TabId, React.ReactNode> = {
    overview: <OverviewPanel />,
    subscription: <SubscriptionPanel />,
    account: <AccountPanel />,
    appearance: <AppearancePanel />,
    cloud: <CloudPanel />,
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col md:flex-row gap-8">
        {/* 侧边导航 */}
        <div className="md:w-48 flex-shrink-0">
          <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
            {tabs.map(tab => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabId)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all whitespace-nowrap cursor-pointer',
                    activeTab === tab.id
                      ? 'bg-jade-50 text-jade-700 font-semibold'
                      : 'text-slate-600 hover:bg-warm-100 hover:text-jade-600'
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
          {panels[activeTab]}
        </div>
      </div>
    </div>
  )
}
