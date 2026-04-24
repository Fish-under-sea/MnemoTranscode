/**
 * 主题提供者 — 从 API 读取用户偏好并应用主题
 */
import { useEffect } from 'react'
import { useAuthStore } from '@/hooks/useAuthStore'
import { preferencesApi } from '@/services/api'
import { applyTheme, ThemeConfig, getDefaultTheme } from '@/lib/theme'

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()

  useEffect(() => {
    async function loadAndApplyTheme() {
      if (!isAuthenticated) {
        applyTheme(getDefaultTheme())
        return
      }

      try {
        const prefs = await preferencesApi.get() as any
        const config: ThemeConfig = {
          mode: prefs.theme || 'light',
          primaryColor: prefs.primary_color || 'jade',
          cardStyle: prefs.card_style || 'glass',
          fontSize: prefs.font_size || 'medium',
        }
        applyTheme(config)
      } catch {
        applyTheme(getDefaultTheme())
      }
    }

    loadAndApplyTheme()
  }, [isAuthenticated])

  return <>{children}</>
}
