/**
 * 认证状态管理 — Zustand Store
 * 统一管理全局认证状态，支持跨组件响应式订阅
 */
import { create } from 'zustand'

export interface AuthUser {
  id: number
  email: string
  username: string
  is_active: boolean
  created_at: string
  avatar_url?: string
  subscription_tier?: 'free' | 'pro' | 'enterprise'
  monthly_token_limit?: number
  monthly_token_used?: number
}

interface AuthState {
  token: string | null
  user: AuthUser | null
  isAuthenticated: boolean
  authChecked: boolean
}

interface AuthActions {
  setAuth: (token: string, user: AuthUser) => void
  updateUser: (user: Partial<AuthUser>) => void
  clearAuth: () => void
  checkAuth: () => void
}

const TOKEN_KEY = 'mtc-token'
const USER_KEY = 'mtc-user'
const REMEMBER_KEY = 'mtc-remember'

export const useAuthStore = create<AuthState & AuthActions>((set, get) => ({
  token: localStorage.getItem(TOKEN_KEY),
  user: (() => {
    const raw = localStorage.getItem(USER_KEY)
    if (!raw) return null
    try { return JSON.parse(raw) } catch { return null }
  })(),
  isAuthenticated: !!localStorage.getItem(TOKEN_KEY),
  authChecked: false,

  setAuth: (token, user) => {
    const remember = localStorage.getItem(REMEMBER_KEY) === 'true'
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(user))

    if (remember) {
      const expires = new Date()
      expires.setDate(expires.getDate() + 7)
      document.cookie = `${TOKEN_KEY}=${token};path=/;expires=${expires.toUTCString()};SameSite=Lax`
      document.cookie = `${USER_KEY}=${encodeURIComponent(JSON.stringify(user))};path=/;expires=${expires.toUTCString()};SameSite=Lax`
    }

    set({ token, user, isAuthenticated: true, authChecked: true })
  },

  updateUser: (partial) => {
    const current = get().user
    if (!current) return
    const clean = Object.fromEntries(
      Object.entries(partial).filter(([, v]) => v !== undefined),
    ) as Partial<AuthUser>
    const updated = { ...current, ...clean }
    localStorage.setItem(USER_KEY, JSON.stringify(updated))
    set({ user: updated })
  },

  clearAuth: () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem(REMEMBER_KEY)
    document.cookie = `${TOKEN_KEY}=;path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT`
    document.cookie = `${USER_KEY}=;path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT`
    set({ token: null, user: null, isAuthenticated: false, authChecked: true })
  },

  checkAuth: () => {
    const token = localStorage.getItem(TOKEN_KEY)
    const raw = localStorage.getItem(USER_KEY)
    let user: AuthUser | null = null
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as AuthUser
        // 预签名 URL 会过期，勿信任从本地恢复的 avatar_url，交给 App 中 GET /auth/me 重签
        const { avatar_url: _a, ...rest } = parsed
        user = rest as AuthUser
      } catch { /* ignore */ }
    }
    set({ token, user, isAuthenticated: !!token, authChecked: true })
  },
}))

export function setRemember(remember: boolean) {
  if (remember) {
    localStorage.setItem(REMEMBER_KEY, 'true')
  } else {
    localStorage.removeItem(REMEMBER_KEY)
  }
}
