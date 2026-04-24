/**
 * 登录弹窗 — 子项目 B · A 基座 Modal + useAuthForm
 */
import { Heart, Eye, EyeOff, Mail, Lock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Modal from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuthForm } from '@/hooks/useAuthForm'

interface LoginModalProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

export default function LoginModal({ open, onClose, onSuccess }: LoginModalProps) {
  const navigate = useNavigate()

  const form = useAuthForm({
    mode: 'login',
    onSuccess: () => {
      onClose()
      if (onSuccess) {
        onSuccess()
      } else {
        navigate('/dashboard')
      }
    },
  })

  return (
    <Modal open={open} onClose={onClose} size="md" title="登录">
      <div className="text-center mb-4">
        <div className="inline-flex items-center gap-2 text-ink-secondary">
          <Heart className="w-6 h-6 text-jade-600" fill="currentColor" />
          <span className="font-serif text-xl tracking-wider">MTC</span>
        </div>
        <p className="text-ink-secondary text-sm mt-2">继续守护你的记忆</p>
      </div>

      <form onSubmit={form.handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="modal-email" className="block text-sm font-medium text-ink-secondary mb-1.5">
            邮箱
          </label>
          <Input
            id="modal-email"
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
          <label htmlFor="modal-password" className="block text-sm font-medium text-ink-secondary mb-1.5">
            密码
          </label>
          <Input
            id="modal-password"
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

        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={form.loading} loading={form.loading}>
          {form.loading ? '登录中...' : '登录'}
        </Button>
      </form>

      <div className="text-center text-sm text-ink-secondary mt-4">
        还没有账号？{' '}
        <button
          type="button"
          onClick={() => {
            onClose()
            navigate('/register')
          }}
          className="text-jade-600 hover:text-jade-700 font-medium"
        >
          创建账号
        </button>
      </div>
    </Modal>
  )
}
