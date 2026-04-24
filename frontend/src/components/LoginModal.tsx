/**
 * 登录弹窗组件 — 落地页内嵌式登录
 * 支持 returnTo 参数，登录成功后返回指定页面
 */
import { useState } from 'react'
import { Mail, Lock, LogIn, Eye, EyeOff, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { authApi } from '@/services/api'
import { useAuthStore } from '@/hooks/useAuthStore'

interface LoginModalProps {
  onClose: () => void
  returnTo?: string
}

export default function LoginModal({ onClose, returnTo }: LoginModalProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)

  const { setAuth } = useAuthStore()

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

      // 根据 returnTo 决定跳转
      if (returnTo && returnTo !== '/') {
        window.location.href = returnTo
      } else {
        onClose()
      }
    } catch (error: any) {
      console.error('[LoginModal] error:', error)
      toast.error(error.detail || '登录失败，请检查邮箱和密码')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 遮罩 */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 弹窗 */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 animate-fade-up">
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Logo */}
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-jade-400 to-jade-600 rounded-2xl mb-4 shadow-jade">
            <span className="text-white font-bold text-lg">MTC</span>
          </div>
          <h2 className="font-display text-xl font-bold text-slate-900">欢迎回来</h2>
          <p className="text-slate-500 text-sm mt-1">登录到你的记忆银行</p>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">邮箱</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full pl-9 pr-4 py-2.5 border border-warm-200 rounded-xl focus:ring-2 focus:ring-jade-400 focus:border-jade-400 outline-none bg-warm-50 text-sm"
                required
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">密码</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-10 py-2.5 border border-warm-200 rounded-xl focus:ring-2 focus:ring-jade-400 focus:border-jade-400 outline-none bg-warm-50 text-sm"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-jade-600 transition-colors cursor-pointer p-1"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* 记住我 */}
          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-warm-300 text-jade-500 focus:ring-jade-400 cursor-pointer"
              />
              <span className="text-slate-600">记住我（7天免登录）</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-jade-500 text-white rounded-xl font-semibold hover:bg-jade-600 active:bg-jade-700 disabled:opacity-50 transition-all shadow-jade hover:shadow-jade-lg flex items-center justify-center gap-2 text-sm cursor-pointer mt-2"
          >
            <LogIn size={15} />
            {loading ? '登录中...' : '登录'}
          </button>
        </form>

        {/* 注册入口 */}
        <div className="mt-5 pt-5 border-t border-warm-200 text-center">
          <p className="text-sm text-slate-500">
            还没有账号？{' '}
            <Link
              to={returnTo ? `/register?returnTo=${encodeURIComponent(returnTo)}` : '/register'}
              onClick={onClose}
              className="text-jade-600 hover:underline font-semibold"
            >
              立即注册
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
