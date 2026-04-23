import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
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

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      {/* 公开路由 */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/app" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* 受保护的应用路由 */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/archives" element={<ArchiveListPage />} />
                <Route path="/archives/:id" element={<ArchiveDetailPage />} />
                <Route path="/archives/:archiveId/members/:memberId" element={<MemberDetailPage />} />
                <Route path="/dialogue" element={<DialoguePage />} />
                <Route path="/dialogue/:archiveId/:memberId" element={<DialoguePage />} />
                <Route path="/timeline/:archiveId" element={<TimelinePage />} />
                <Route path="/storybook/:archiveId" element={<StoryBookPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* 未匹配路由重定向到落地页 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
