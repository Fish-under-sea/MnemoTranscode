import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
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
import SettingsPage from './pages/SettingsPage'

export default function App() {
  const [authChecked, setAuthChecked] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('mtc-token')
    setIsLoggedIn(!!token)
    setAuthChecked(true)
  }, [])

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-warm-100">
        <div className="w-12 h-12 bg-gradient-to-br from-jade-400 to-jade-600 rounded-2xl animate-pulse" />
      </div>
    )
  }

  return (
    <Routes>
      {/* 公开页面 */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* 受保护的应用页面 */}
      {isLoggedIn ? (
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
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      ) : (
        <Route path="*" element={<Navigate to="/login" replace />} />
      )}
    </Routes>
  )
}
