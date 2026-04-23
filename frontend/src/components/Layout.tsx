/**
 * 页面布局组件
 */
import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth, clearAuth } from '@/hooks/useAuth'
import {
  Home, FolderOpen, MessageCircle, Settings, LogOut, Menu, X
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

const navItems = [
  { path: 'dashboard', label: '首页', icon: Home },
  { path: 'archives', label: '档案库', icon: FolderOpen },
  { path: 'dialogue', label: 'AI 对话', icon: MessageCircle },
  { path: 'settings', label: '设置', icon: Settings },
]

export default function Layout() {
  const location = useLocation()
  const { user } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = () => {
    clearAuth()
    window.location.href = '/login'
  }

  const getActive = (path: string) => {
    const current = location.pathname.replace('/dashboard', '') || '/'
    const target = path === 'dashboard' ? '/' : `/${path}`
    return current === target
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* 顶部导航 */}
      <header className="bg-warm-50/80 border-b border-warm-200 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <Link to="/dashboard" className="flex items-center gap-2">
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
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-600 hidden sm:block">
                {user?.username}
              </span>
              <button
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-jade-600 rounded-xl hover:bg-jade-50 transition-all duration-200 cursor-pointer"
                title="退出登录"
              >
                <LogOut size={18} />
              </button>
              {/* 移动端菜单按钮 */}
              <button
                className="md:hidden p-2"
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
