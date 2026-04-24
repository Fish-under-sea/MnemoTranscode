import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import Layout from './components/Layout'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import ArchiveListPage from './pages/ArchiveListPage'
import ArchiveDetailPage from './pages/ArchiveDetailPage'
import MemberDetailPage from './pages/MemberDetailPage'
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

export default function App() {
  const { isAuthenticated, authChecked, checkAuth } = useAuthStore()

  useEffect(() => {
    checkAuth()
  }, [])

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
          {/* 公开页面 */}
          <Route path="/" element={<LandingPage />} />
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
              <Route path="dialogue" element={<DialoguePage />} />
              <Route path="dialogue/:archiveId/:memberId" element={<DialoguePage />} />
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
