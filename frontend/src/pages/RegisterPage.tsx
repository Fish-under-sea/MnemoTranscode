/**
 * 注册页面
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Mail, User, UserPlus, Eye, EyeOff } from 'lucide-react'
import { authApi } from '@/services/api'
import { setAuth } from '@/hooks/useAuth'

export default function RegisterPage() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    if (password !== confirmPassword) {
      toast.error('两次输入的密码不一致')
      return
    }
    setLoading(true)
    try {
      const response = await authApi.register({ username, email, password }) as any
      if (!response?.access_token || !response?.user) {
        throw new Error('注册响应格式异常')
      }
      setAuth(response.access_token, response.user)
      toast.success('注册成功')
      window.location.href = '/dashboard'
    } catch (error: any) {
      toast.error(error.detail || '注册失败')
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
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-jade-400 to-jade-600 rounded-2xl mb-5 shadow-jade">
            <span className="text-white font-bold text-xl">MTC</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-slate-900">创建账号</h1>
          <p className="text-slate-500 mt-2">开始守护你的珍贵记忆</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-glass-lg p-8 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">用户名</label>
            <div className="relative">
              <User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="你的名字"
                className="w-full pl-10 pr-4 py-3 border border-warm-200 rounded-xl focus:ring-2 focus:ring-jade-400 focus:border-jade-400 outline-none bg-warm-50 text-sm"
                required
                minLength={2}
              />
            </div>
          </div>

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
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="至少 6 位"
                className="w-full pl-4 pr-12 py-3 border border-warm-200 rounded-xl focus:ring-2 focus:ring-jade-400 focus:border-jade-400 outline-none bg-warm-50 text-sm"
                required
                minLength={6}
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

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">确认密码</label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="再次输入密码"
                className="w-full pl-4 pr-12 py-3 border border-warm-200 rounded-xl focus:ring-2 focus:ring-jade-400 focus:border-jade-400 outline-none bg-warm-50 text-sm"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-jade-600 transition-colors cursor-pointer p-1"
              >
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-jade-500 text-white rounded-xl font-semibold hover:bg-jade-600 active:bg-jade-700 disabled:opacity-50 transition-all shadow-jade hover:shadow-jade-lg flex items-center justify-center gap-2 text-sm cursor-pointer mt-6"
          >
            <UserPlus size={16} />
            {loading ? '注册中...' : '注册'}
          </button>

          <p className="text-center text-sm text-slate-500">
            已有账号？{' '}
            <Link to="/login" className="text-jade-600 hover:underline font-semibold">
              立即登录
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
