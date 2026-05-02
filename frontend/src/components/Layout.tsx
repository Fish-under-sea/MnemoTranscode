/**
 * 页面布局组件 — 顶部导航 + 侧边栏
 */
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { getResumeDialoguePath } from '@/lib/dialogueStorage'
import { useAuthStore } from '@/hooks/useAuthStore'
import {
  Home, FolderOpen, MessageCircle, LogOut, Menu, X,
  ChevronDown, LayoutDashboard, Package, Bot, ExternalLink,
} from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { useAppBackgroundRuntime } from '@/lib/theme'
import Avatar from '@/components/ui/Avatar'
import { normalizeTierId, tierBadgeClass, tierDisplayName } from '@/lib/subscriptionTier'

const navItems = [
  { path: 'dashboard', label: '首页', icon: Home },
  { path: 'archives', label: '档案库', icon: FolderOpen },
  { path: 'dialogue', label: 'AI 对话', icon: MessageCircle },
  { path: 'capsules', label: '记忆胶囊', icon: Package },
  { path: 'model-settings', label: '模型设置', icon: Bot },
]

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, clearAuth } = useAuthStore()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const appBg = useAppBackgroundRuntime()

  // 个人资料与订阅由 App 在登录后统一 GET /auth/me 拉取，避免与 Layout 重复请求

  // 点击外部关闭用户菜单
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = () => {
    clearAuth()
    navigate('/')
  }

  const getActive = (path: string) => {
    const raw = location.pathname
    const norm = (raw.startsWith('/dashboard') ? raw.replace(/^\/dashboard(\/|$)/, '/') : raw) || '/'
    if (path === 'dashboard') return norm === '/' || norm === '/dashboard'
    const target = `/${path}`
    if (path === 'dialogue')
      return norm === '/dialogue' || /^\/dialogue\/[1-9]\d*\/[1-9]\d*$/.test(norm)
    if (path === 'archives') return norm === '/archives' || norm.startsWith('/archives/')
    return norm === target
  }

  const displayName = user?.username?.trim() || '用户'

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* 全站背景：图片用 CSS 变量；视频用 <video>（Tailwind 任意类里 var(--x,none) 的逗号会破坏解析，故改内联 style） */}
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-canvas bg-cover bg-center bg-fixed bg-no-repeat"
        style={appBg.mode === 'image' ? { backgroundImage: 'var(--app-background-image)' } : undefined}
        aria-hidden
      />
      {appBg.mode === 'video' && appBg.src ? (
        <video
          className="pointer-events-none fixed inset-0 -z-10 h-full w-full object-cover"
          src={appBg.src}
          autoPlay
          muted
          loop
          playsInline
          aria-hidden
        />
      ) : null}
      {/* 顶栏：全宽 —— Logo 贴左、主导航居中、用户区贴右 */}
      <header className="bg-surface/80 border-b border-default backdrop-blur-md sticky top-0 z-50">
        <div className="w-full min-w-0 pl-3 pr-[max(0.75rem,env(safe-area-inset-right,0px))] sm:pl-4 sm:pr-[max(1rem,env(safe-area-inset-right,0px))] lg:pl-6 lg:pr-8">
          <div className="grid grid-cols-[auto_1fr_auto] items-center h-14 gap-2 sm:gap-4 min-w-0">
            {/* Logo — 视口左侧 */}
            <Link to="/" className="flex items-center gap-2 shrink-0 min-w-0 justify-self-start">
              <div className="w-8 h-8 bg-gradient-to-br from-jade-400 to-jade-600 rounded-lg flex items-center justify-center shadow-jade shrink-0">
                <span className="text-white font-bold text-sm">MTC</span>
              </div>
              <span className="font-display font-semibold text-ink-primary hidden sm:block truncate">
                Memory To Code
              </span>
            </Link>

            {/* 桌面导航 — 中间列居中 */}
            <nav className="hidden md:flex items-center justify-center gap-1 min-w-0 justify-self-center max-w-full overflow-x-auto">
              <Link
                to="/welcome"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm text-ink-muted hover:text-ink-secondary hover:bg-subtle transition-all duration-200 shrink-0"
                title="返回官网落地页，无需退出登录"
              >
                <ExternalLink size={16} />
                官网
              </Link>
              {navItems.map((item) => {
                const Icon = item.icon
                const active = getActive(item.path)
                const to = item.path === 'dialogue' ? getResumeDialoguePath() : `/${item.path}`
                return (
                  <Link
                    key={item.path}
                    to={to}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm transition-all duration-200 shrink-0',
                      active
                        ? 'bg-subtle text-brand font-semibold ring-1 ring-border-default'
                        : 'text-ink-secondary hover:text-brand hover:bg-subtle'
                    )}
                  >
                    <Icon size={16} />
                    {item.label}
                  </Link>
                )
              })}
            </nav>

            {/* 用户信息 + 移动端菜单 — 视口右侧 */}
            <div className="flex items-center justify-end gap-2 sm:gap-2 shrink-0 justify-self-end min-w-0" ref={menuRef}>
              {/* 用户下拉菜单 */}
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className={cn(
                    'flex items-center gap-2 px-2.5 py-1.5 rounded-xl transition-all duration-200 cursor-pointer',
                    userMenuOpen
                      ? 'bg-subtle text-brand'
                      : 'hover:bg-subtle text-ink-secondary'
                  )}
                >
                  <Avatar
                    src={user?.avatar_url || undefined}
                    name={displayName}
                    size={32}
                    className="ring-2 ring-surface shadow-e1 shrink-0"
                  />
                  <span className="text-sm font-medium hidden sm:block max-w-[120px] truncate">
                    {user?.username}
                  </span>
                  <ChevronDown size={14} className={cn('transition-transform', userMenuOpen && 'rotate-180')} />
                </button>

                {/* 下拉内容 */}
                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-60 rounded-2xl bg-surface py-2 shadow-e3 border border-default animate-fade-in z-50">
                    {/* 用户信息头部 */}
                    <div className="px-4 py-3 border-b border-default flex gap-3">
                      <Avatar
                        src={user?.avatar_url || undefined}
                        name={displayName}
                        size={40}
                        className="shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-ink-primary text-sm truncate">{user?.username}</div>
                        <div className="text-xs text-ink-muted truncate mt-0.5">{user?.email}</div>
                        {user?.subscription_tier && (
                          <div className="mt-1.5">
                            <span
                              className={cn(
                                'text-xs px-2 py-0.5 rounded-full font-medium',
                                tierBadgeClass(normalizeTierId(user.subscription_tier)),
                              )}
                            >
                              {tierDisplayName(normalizeTierId(user.subscription_tier))}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 菜单项 */}
                    <div className="py-1">
                      <Link
                        to="/welcome"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink-secondary hover:bg-subtle hover:text-brand transition-colors cursor-pointer"
                      >
                        <ExternalLink size={16} />
                        官网落地页
                      </Link>
                      <Link
                        to="/personal-center"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink-secondary hover:bg-subtle hover:text-brand transition-colors cursor-pointer"
                      >
                        <LayoutDashboard size={16} />
                        个人中心
                      </Link>
                    </div>

                    {/* 分割线 */}
                    <div className="border-t border-default py-1">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-500/10 hover:text-red-600 transition-colors cursor-pointer dark:hover:bg-red-500/15"
                      >
                        <LogOut size={16} />
                        退出登录
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 移动端菜单按钮 */}
              <button
                className="md:hidden p-2 text-ink-secondary hover:text-brand hover:bg-subtle rounded-xl transition-colors cursor-pointer"
                onClick={() => setMobileOpen(!mobileOpen)}
              >
                {mobileOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>

        {/* 移动端导航 */}
        {mobileOpen && (
          <nav className="md:hidden border-t border-default px-4 py-2 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = getActive(item.path)
              const to = item.path === 'dialogue' ? getResumeDialoguePath() : `/${item.path}`
              return (
                <Link
                  key={item.path}
                  to={to}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-all duration-200',
                    active ? 'bg-subtle text-brand font-semibold ring-1 ring-border-default' : 'text-ink-secondary hover:bg-subtle hover:text-brand'
                  )}
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
              )
            })}
            <div className="border-t border-default pt-1 mt-1 space-y-1">
              <Link
                to="/welcome"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-ink-secondary hover:bg-subtle transition-colors"
              >
                <ExternalLink size={18} />
                官网落地页
              </Link>
              <Link
                to="/personal-center"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-ink-secondary hover:bg-subtle transition-colors"
              >
                <LayoutDashboard size={18} />
                个人中心
              </Link>
            </div>
          </nav>
        )}
      </header>

      {/* 主内容区 */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* 页脚 */}
      <footer className="bg-muted/70 border-t border-default py-5 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-ink-muted">
          MTC — Memory To Code · 用 AI 守护每一段珍贵的记忆
        </div>
      </footer>
    </div>
  )
}
