/**
 * 注册页 — 子项目 B · A 基座 + useAuthForm
 */
import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import { Heart, Eye, EyeOff, Mail, Lock, User } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { useAuthForm } from '@/hooks/useAuthForm'
import { fadeUp, staggerContainer } from '@/lib/motion'

export default function RegisterPage() {
  const form = useAuthForm({ mode: 'register' })

  return (
    <div className="relative min-h-screen overflow-hidden bg-warm-50 flex items-center justify-center px-4 py-12">
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="floating-orb floating-orb-jade w-[480px] h-[480px] -top-32 -right-32 opacity-40" />
        <div className="floating-orb floating-orb-amber w-[360px] h-[360px] -bottom-24 -left-24 opacity-30" />
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
          <h1 className="font-serif text-3xl text-ink-primary mt-4">创建账号</h1>
          <p className="text-ink-secondary mt-2">开始守护你的珍贵记忆</p>
        </motion.div>

        <motion.div variants={fadeUp}>
          <Card variant="glass" padding="lg">
            <form onSubmit={form.handleSubmit} className="space-y-5">
              <FormField
                id="username"
                label="用户名"
                leftIcon={<User className="w-4 h-4" />}
                value={form.username}
                onChange={(v) => form.setUsername(v)}
                placeholder="如何称呼你"
                disabled={form.loading}
                required
                autoComplete="username"
              />

              <FormField
                id="email"
                label="邮箱"
                type="email"
                leftIcon={<Mail className="w-4 h-4" />}
                value={form.email}
                onChange={(v) => form.setEmail(v)}
                placeholder="you@example.com"
                disabled={form.loading}
                required
                autoComplete="email"
              />

              <PasswordField
                id="password"
                label="密码"
                value={form.password}
                onChange={(v) => form.setPassword(v)}
                show={form.showPassword}
                toggle={form.togglePassword}
                placeholder="至少 6 位"
                disabled={form.loading}
                autoComplete="new-password"
              />

              <PasswordField
                id="confirmPassword"
                label="确认密码"
                value={form.confirmPassword}
                onChange={(v) => form.setConfirmPassword(v)}
                show={form.showConfirm}
                toggle={form.toggleConfirm}
                placeholder="再次输入密码"
                disabled={form.loading}
                autoComplete="new-password"
              />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                disabled={form.loading}
                loading={form.loading}
              >
                {form.loading ? '注册中...' : '创建账号'}
              </Button>
            </form>
          </Card>
        </motion.div>

        <motion.p variants={fadeUp} className="text-center text-sm text-ink-secondary mt-6">
          已有账号？{' '}
          <Link to="/login" className="text-jade-600 hover:text-jade-700 font-medium">
            立即登录
          </Link>
        </motion.p>
      </motion.div>
    </div>
  )
}

function FormField({
  id,
  label,
  value,
  onChange,
  placeholder,
  disabled,
  required,
  type = 'text',
  autoComplete,
  leftIcon,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  disabled?: boolean
  required?: boolean
  type?: string
  autoComplete?: string
  leftIcon?: ReactNode
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink-secondary mb-1.5">
        {label}
      </label>
      <Input
        id={id}
        type={type}
        autoComplete={autoComplete}
        leftIcon={leftIcon}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        fullWidth
        required={required}
      />
    </div>
  )
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  show,
  toggle,
  placeholder,
  disabled,
  autoComplete,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  show: boolean
  toggle: () => void
  placeholder?: string
  disabled?: boolean
  autoComplete?: string
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink-secondary mb-1.5">
        {label}
      </label>
      <Input
        id={id}
        type={show ? 'text' : 'password'}
        autoComplete={autoComplete}
        leftIcon={<Lock className="w-4 h-4" />}
        rightIcon={
          <button
            type="button"
            onClick={toggle}
            className="text-ink-muted hover:text-ink-primary transition-colors"
            aria-label={show ? '隐藏密码' : '显示密码'}
          >
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        }
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        fullWidth
        required
      />
    </div>
  )
}
