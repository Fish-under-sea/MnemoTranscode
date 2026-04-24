/**
 * 页面布局组件 — 顶部导航 + 侧边栏
 */
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/hooks/useAuthStore'
import {
  Home, FolderOpen, MessageCircle, Settings, LogOut, Menu, X, User,
  ChevronDown, LayoutDashboard
} from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

const navItems = [
  { path: 'dashboard', label: '首页', icon: Home },
  { path: 'archives', label: '档案库', icon: FolderOpen },
  { path: 'dialogue', label: 'AI 对话', icon: MessageCircle },
  { path: 'settings', label: '设置', icon: Settings },
]

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, clearAuth } = useAuthStore()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

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
    const current = location.pathname.replace('/dashboard', '') || '/'
    const target = path === 'dashboard' ? '/' : `/${path}`
    return current === target
  }

  const initials = user?.username ? user.username.charAt(0).toUpperCase() : 'U'

  return (
    <div className="min-h-screen flex flex-col">
      {/* 顶部导航 */}
      <header className="bg-warm-50/80 border-b border-warm-200 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-jade-400 to-jade-600 rounded-lg flex items-center justify-center shadow-jade">
                <span className="text-white font-bold text-sm">MTC</span>
              </div>
              <span className="font-display font-semibold text-slate-900 hidden sm:block">
                Memory To Code
              </span>
            </Link>

            {/* 桌面导航 */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon
                const active = getActive(item.path)
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm transition-all duration-200',
                      active
                        ? 'bg-jade-50 text-jade-700 font-semibold'
                        : 'text-slate-600 hover:text-jade-700 hover:bg-jade-50'
                    )}
                  >
                    <Icon size={16} />
                    {item.label}
                  </Link>
                )
              })}
            </nav>

            {/* 用户信息 */}
            <div className="flex items-center gap-3" ref={menuRef}>
              {/* 用户下拉菜单 */}
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className={cn(
                    'flex items-center gap-2 px-2.5 py-1.5 rounded-xl transition-all duration-200 cursor-pointer',
                    userMenuOpen
                      ? 'bg-jade-50 text-jade-700'
                      : 'hover:bg-jade-50 text-slate-600'
                  )}
                >
                  {/* 头像 */}
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-jade-400 to-jade-600 flex items-center justify-center">
                    <span className="text-white font-bold text-sm">{initials}</span>
                  </div>
                  <span className="text-sm font-medium hidden sm:block max-w-[120px] truncate">
                    {user?.username}
                  </span>
                  <ChevronDown size={14} className={cn('transition-transform', userMenuOpen && 'rotate-180')} />
                </button>

                {/* 下拉内容 */}
                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-glass-lg border border-warm-200 py-2 animate-fade-in z-50">
                    {/* 用户信息头部 */}
                    <div className="px-4 py-3 border-b border-warm-100">
                      <div className="font-semibold text-slate-900 text-sm truncate">{user?.username}</div>
                      <div className="text-xs text-slate-500 truncate mt-0.5">{user?.email}</div>
                      {user?.subscription_tier && (
                        <div className="mt-1.5">
                          <span className={cn(
                            'text-xs px-2 py-0.5 rounded-full font-medium',
                            user.subscription_tier === 'pro' ? 'bg-jade-100 text-jade-700' :
                            user.subscription_tier === 'enterprise' ? 'bg-amber-100 text-amber-700' :
                            'bg-slate-100 text-slate-600'
                          )}>
                            {user.subscription_tier === 'pro' ? 'Pro' :
                             user.subscription_tier === 'enterprise' ? 'Enterprise' : 'Free'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* 菜单项 */}
                    <div className="py-1">
                      <Link
                        to="/personal-center"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-jade-50 hover:text-jade-700 transition-colors cursor-pointer"
                      >
                        <LayoutDashboard size={16} />
                        个人中心
                      </Link>
                      <Link
                        to="/settings"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-jade-50 hover:text-jade-700 transition-colors cursor-pointer"
                      >
                        <User size={16} />
                        账号设置
                      </Link>
                    </div>

                    {/* 分割线 */}
                    <div className="border-t border-warm-100 py-1">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
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
                className="md:hidden p-2 text-slate-600 hover:text-jade-700 hover:bg-jade-50 rounded-xl transition-colors cursor-pointer"
                onClick={() => setMobileOpen(!mobileOpen)}
              >
                {mobileOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>

        {/* 移动端导航 */}
        {mobileOpen && (
          <nav className="md:hidden border-t border-warm-200 px-4 py-2 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = getActive(item.path)
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-all duration-200',
                    active ? 'bg-jade-50 text-jade-700 font-semibold' : 'text-slate-600 hover:bg-jade-50'
                  )}
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
              )
            })}
            <div className="border-t border-warm-200 pt-1 mt-1">
              <Link
                to="/personal-center"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-slate-600 hover:bg-jade-50 transition-colors"
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
      <footer className="bg-warm-100 border-t border-warm-200 py-5 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-slate-400">
          MTC — Memory To Code · 用 AI 守护每一段珍贵的记忆
        </div>
      </footer>
    </div>
  )
}
