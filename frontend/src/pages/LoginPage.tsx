/**
 * 登录页 — 子项目 B · A 基座 + useAuthForm
 */
import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import { Heart, Eye, EyeOff, Mail, Lock } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { useAuthForm } from '@/hooks/useAuthForm'
import { fadeUp, staggerContainer } from '@/lib/motion'

export default function LoginPage() {
  const form = useAuthForm({ mode: 'login' })

  return (
    <div className="relative min-h-screen overflow-hidden bg-warm-50 flex items-center justify-center px-4 py-12">
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="floating-orb floating-orb-jade w-[480px] h-[480px] -top-32 -left-32 opacity-40" />
        <div className="floating-orb floating-orb-amber w-[360px] h-[360px] -bottom-24 -right-24 opacity-30" />
      </div>

      <motion.div
        className="relative w-full max-w-md"
        variants={staggerContainer(0.06)}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={fadeUp} className="text-center mb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-ink-secondary hover:text-jade-600 transition-colors"
          >
            <Heart className="w-6 h-6 text-jade-600" fill="currentColor" />
            <span className="font-serif text-2xl tracking-wider">MTC</span>
          </Link>
          <h1 className="font-serif text-3xl text-ink-primary mt-4">欢迎回来</h1>
          <p className="text-ink-secondary mt-2">回到你守护的记忆里</p>
        </motion.div>

        <motion.div variants={fadeUp}>
          <Card variant="glass" padding="lg">
            <form onSubmit={form.handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-ink-secondary mb-1.5">
                  邮箱
                </label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  leftIcon={<Mail className="w-4 h-4" />}
                  value={form.email}
                  onChange={(e) => form.setEmail(e.target.value)}
                  placeholder="you@example.com"
                  disabled={form.loading}
                  fullWidth
                  required
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-ink-secondary mb-1.5">
                  密码
                </label>
                <Input
                  id="password"
                  type={form.showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  leftIcon={<Lock className="w-4 h-4" />}
                  rightIcon={
                    <button
                      type="button"
                      onClick={form.togglePassword}
                      className="text-ink-muted hover:text-ink-primary transition-colors"
                      aria-label={form.showPassword ? '隐藏密码' : '显示密码'}
                    >
                      {form.showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                  value={form.password}
                  onChange={(e) => form.setPassword(e.target.value)}
                  placeholder="请输入密码"
                  disabled={form.loading}
                  fullWidth
                  required
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-ink-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.rememberMe}
                  onChange={(e) => form.setRememberMe(e.target.checked)}
                  className="rounded border-ink-muted text-jade-600 focus:ring-jade-500"
                />
                <span>记住我（7 天免登录）</span>
              </label>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                disabled={form.loading}
                loading={form.loading}
              >
                {form.loading ? '登录中...' : '登录'}
              </Button>
            </form>
          </Card>
        </motion.div>

        <motion.p variants={fadeUp} className="text-center text-sm text-ink-secondary mt-6">
          还没有账号？{' '}
          <Link to="/register" className="text-jade-600 hover:text-jade-700 font-medium">
            立即注册
          </Link>
        </motion.p>
      </motion.div>
    </div>
  )
}
