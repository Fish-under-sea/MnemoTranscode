import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import Layout from './components/Layout'
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
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/*"
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
    </Routes>
  )
}
