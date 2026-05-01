import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import Layout from './components/Layout'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import ArchiveListPage from './pages/ArchiveListPage'
import ArchiveDetailPage from './pages/ArchiveDetailPage'
import MemberDetailPage from './pages/MemberDetailPage'
import ChatImportProgressPage from './pages/ChatImportProgressPage'
import DialoguePage from './pages/DialoguePage'
import TimelinePage from './pages/TimelinePage'
import StoryBookPage from './pages/StoryBookPage'
import ModelSettingsPage from './pages/ModelSettingsPage'
import PersonalCenterPage from './pages/PersonalCenterPage'
import CapsulePage from './pages/CapsulePage'
import DSPlayground from './pages/DSPlayground'
import ThemeProvider from './components/ThemeProvider'
import { ToastHost } from './components/ui/Toast'
import MotionProvider from './providers/MotionProvider'
import { useAuthStore } from './hooks/useAuthStore'
import { authApi, subscriptionApi } from './services/api'
import { getSubscriptionSyncGen } from './lib/subscriptionSyncGen'

export default function App() {
  const { isAuthenticated, authChecked, checkAuth } = useAuthStore()
  const subscriptionSyncedRef = useRef(false)

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (!authChecked) return
    if (!isAuthenticated) {
      subscriptionSyncedRef.current = false
      return
    }
    if (!useAuthStore.getState().user) return
    if (subscriptionSyncedRef.current) return
    subscriptionSyncedRef.current = true
    const at = getSubscriptionSyncGen()
    void authApi
      .getMe()
      .then((u: unknown) => {
        if (at !== getSubscriptionSyncGen()) return
        if (!u || typeof u !== 'object' || u === null) return
        const me = u as Record<string, unknown>
        // 只同步资料/头像，订阅单独 GET /auth/subscription，避免用滞后的 getMe 写 free
        useAuthStore.getState().updateUser({
          email: me.email as string,
          username: me.username as string,
          is_active: me.is_active as boolean,
          created_at: me.created_at as string,
          avatar_url: (me.avatar_url as string | null | undefined) ?? undefined,
        })
      })
      .catch(() => {})
    void subscriptionApi
      .get()
      .then((res: unknown) => {
        if (at !== getSubscriptionSyncGen()) return
        const r = res as { tier: string; monthly_limit: number; monthly_used: number }
        useAuthStore.getState().updateUser({
          subscription_tier: r.tier as 'free' | 'pro' | 'enterprise',
          monthly_token_limit: r.monthly_limit,
          monthly_token_used: r.monthly_used,
        })
      })
      .catch(() => {})
  }, [authChecked, isAuthenticated])

  // 切回页签时刷新 /auth/me，更新头像等预签名 URL，避免长期放置后链接过期
  useEffect(() => {
    if (!authChecked || !isAuthenticated) return
    const onVis = () => {
      if (document.visibilityState !== 'visible') return
      const at = getSubscriptionSyncGen()
      void authApi
        .getMe()
        .then((u: unknown) => {
          if (at !== getSubscriptionSyncGen()) return
          if (!u || typeof u !== 'object' || u === null) return
          const me = u as Record<string, unknown>
          useAuthStore.getState().updateUser({
            email: me.email as string,
            username: me.username as string,
            is_active: me.is_active as boolean,
            created_at: me.created_at as string,
            avatar_url: (me.avatar_url as string | null | undefined) ?? undefined,
          })
        })
        .catch(() => {})
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [authChecked, isAuthenticated])

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-warm-100">
        <div className="w-12 h-12 bg-gradient-to-br from-jade-400 to-jade-600 rounded-2xl animate-pulse" />
      </div>
    )
  }

  return (
    <MotionProvider>
      <ThemeProvider>
        <ToastHost />
        <Routes>
          {/* 公开页面（含落地页；/welcome 与 / 同页，方便已登录用户收藏「回退官网」） */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/welcome" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* dev-only：设计系统 Playground（prod 构建下不注册路由）
              必须在匿名 catch-all Navigate 之前，否则未登录访问会被跳走 */}
          {import.meta.env.DEV && (
            <Route path="/ds-playground" element={<DSPlayground />} />
          )}

          {/* 受保护的应用页面 */}
          {isAuthenticated ? (
            <Route element={<Layout />}>
              <Route index element={<DashboardPage />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="archives" element={<ArchiveListPage />} />
              <Route path="archives/:id" element={<ArchiveDetailPage />} />
              <Route path="archives/:archiveId/members/:memberId" element={<MemberDetailPage />} />
              <Route path="archives/:archiveId/members/:memberId/chat-import" element={<ChatImportProgressPage />} />
              <Route path="dialogue" element={<DialoguePage />} />
              <Route path="dialogue/:archiveId/:memberId" element={<DialoguePage />} />
              <Route path="dialogue/:archiveId" element={<Navigate to="/dialogue" replace />} />
              <Route path="timeline/:archiveId" element={<TimelinePage />} />
              <Route path="storybook/:archiveId" element={<StoryBookPage />} />
              <Route path="model-settings" element={<ModelSettingsPage />} />
              <Route path="settings" element={<Navigate to="/model-settings" replace />} />
              <Route path="personal-center" element={<PersonalCenterPage />} />
              <Route path="capsules" element={<CapsulePage />} />
            </Route>
          ) : (
            <Route path="*" element={<Navigate to="/" replace />} />
          )}
        </Routes>
      </ThemeProvider>
    </MotionProvider>
  )
}
