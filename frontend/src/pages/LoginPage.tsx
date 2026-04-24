/**
 * 登录页面 — 支持 returnTo 参数返回来源页面
 */
import { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Mail, Lock, LogIn, Eye, EyeOff } from 'lucide-react'
import { authApi } from '@/services/api'
import { useAuthStore } from '@/hooks/useAuthStore'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()

  const returnTo = searchParams.get('returnTo') || '/dashboard'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    try {
      const response = await authApi.login(email, password) as any
      if (!response?.access_token || !response?.user) {
        throw new Error('登录响应格式异常')
      }

      if (rememberMe) {
        localStorage.setItem('mtc-remember', 'true')
      }

      setAuth(response.access_token, response.user)
      toast.success('登录成功')

      // 安全检查：只能重定向到同源页面
      const target = returnTo.startsWith('/') ? returnTo : '/dashboard'
      window.location.href = target
    } catch (error: any) {
      console.error('[Login] error:', error)
      toast.error(error.detail || '登录失败，请检查邮箱和密码')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-warm-100 px-4">
      {/* 浮动装饰背景 */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="floating-orb w-[500px] h-[500px] bg-jade-200 top-[-200px] right-[-100px] animate-blob" style={{ animationDuration: '15s' }} />
        <div className="floating-orb w-[400px] h-[400px] bg-amber-100 bottom-[-100px] left-[-100px] animate-blob" style={{ animationDuration: '18s', animationDelay: '-5s' }} />
      </div>

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-jade-400 to-jade-600 rounded-2xl mb-5 shadow-jade">
            <span className="text-white font-bold text-xl">MTC</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-slate-900">欢迎回来</h1>
          <p className="text-slate-500 mt-2">登录到你的记忆银行</p>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-glass-lg p-8 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">邮箱</label>
            <div className="relative">
              <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full pl-10 pr-4 py-3 border border-warm-200 rounded-xl focus:ring-2 focus:ring-jade-400 focus:border-jade-400 outline-none bg-warm-50 text-sm"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">密码</label>
            <div className="relative">
              <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-12 py-3 border border-warm-200 rounded-xl focus:ring-2 focus:ring-jade-400 focus:border-jade-400 outline-none bg-warm-50 text-sm"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-jade-600 transition-colors cursor-pointer p-1"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* 记住我 */}
          <div className="flex items-center">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-warm-300 text-jade-500 focus:ring-jade-400 cursor-pointer"
              />
              <span className="text-sm text-slate-600">记住我（7天免登录）</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-jade-500 text-white rounded-xl font-semibold hover:bg-jade-600 active:bg-jade-700 disabled:opacity-50 transition-all shadow-jade hover:shadow-jade-lg flex items-center justify-center gap-2 text-sm cursor-pointer"
          >
            <LogIn size={16} />
            {loading ? '登录中...' : '登录'}
          </button>

          <p className="text-center text-sm text-slate-500">
            还没有账号？{' '}
            <Link to={returnTo !== '/dashboard' ? `/register?returnTo=${encodeURIComponent(returnTo)}` : '/register'} className="text-jade-600 hover:underline font-semibold">
              立即注册
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
