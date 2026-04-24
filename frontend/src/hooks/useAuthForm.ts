import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { authApi } from '@/services/api'
import type { AuthUser as StoreAuthUser } from '@/hooks/useAuthStore'
import { useAuthStore } from '@/hooks/useAuthStore'
import { useApiError } from './useApiError'
import { isApiError } from '@/services/errors'

type AuthMode = 'login' | 'register'

export interface UseAuthFormOptions {
  mode: AuthMode
  /**
   * 成功后的回调。若未提供，默认 window.location.href = returnTo。
   * LoginModal 场景可传入 close modal 等副作用。
   */
  onSuccess?: () => void
  /**
   * 覆盖 returnTo。未提供时从 useSearchParams 读取 'returnTo'，回落 '/dashboard'。
   */
  returnToOverride?: string
}

export interface UseAuthFormReturn {
  email: string
  setEmail: (v: string) => void
  password: string
  setPassword: (v: string) => void
  username: string
  setUsername: (v: string) => void
  confirmPassword: string
  setConfirmPassword: (v: string) => void
  showPassword: boolean
  togglePassword: () => void
  showConfirm: boolean
  toggleConfirm: () => void
  rememberMe: boolean
  setRememberMe: (v: boolean) => void
  loading: boolean
  submitError: unknown | null
  handleSubmit: (e: FormEvent) => Promise<void>
}

export function useAuthForm({ mode, onSuccess, returnToOverride }: UseAuthFormOptions): UseAuthFormReturn {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitError, setSubmitError] = useState<unknown | null>(null)

  const [searchParams] = useSearchParams()
  const { setAuth } = useAuthStore()
  const apiError = useApiError()

  const returnTo = returnToOverride ?? searchParams.get('returnTo') ?? '/dashboard'

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (loading) return

    setSubmitError(null)

    if (!email.trim()) {
      toast.error('请输入邮箱')
      return
    }
    if (!password) {
      toast.error('请输入密码')
      return
    }
    if (mode === 'register') {
      if (!username.trim()) {
        toast.error('请输入用户名')
        return
      }
      if (password !== confirmPassword) {
        toast.error('两次输入的密码不一致')
        return
      }
      if (password.length < 6) {
        toast.error('密码至少 6 位')
        return
      }
    }

    setLoading(true)
    try {
      const response =
        mode === 'login'
          ? await authApi.login(email.trim(), password)
          : await authApi.register({ username: username.trim(), email: email.trim(), password })

      if (!response?.access_token || !response?.user) {
        throw new Error('登录响应格式异常，请联系管理员')
      }

      if (mode === 'login' && rememberMe) {
        localStorage.setItem('mtc-remember', 'true')
      }

      const u = response.user
      const forStore: StoreAuthUser = {
        id: u.id,
        email: u.email,
        username: u.username,
        is_active: u.is_active ?? true,
        created_at: u.created_at,
        avatar_url: u.avatar_url ?? undefined,
      }
      setAuth(response.access_token, forStore)
      toast.success(mode === 'login' ? '登录成功' : '注册成功，已自动登录')

      if (onSuccess) {
        onSuccess()
      } else {
        const target = returnTo.startsWith('/') ? returnTo : '/dashboard'
        window.location.href = target
      }
    } catch (err) {
      if (isApiError(err) || err instanceof Error) {
        setSubmitError(err)
      } else {
        setSubmitError(new Error('未知错误'))
      }
      apiError.show(err, mode === 'login' ? '登录失败' : '注册失败')
    } finally {
      setLoading(false)
    }
  }

  return {
    email,
    setEmail,
    password,
    setPassword,
    username,
    setUsername,
    confirmPassword,
    setConfirmPassword,
    showPassword,
    togglePassword: () => setShowPassword((v) => !v),
    showConfirm,
    toggleConfirm: () => setShowConfirm((v) => !v),
    rememberMe,
    setRememberMe,
    loading,
    submitError,
    handleSubmit,
  }
}
