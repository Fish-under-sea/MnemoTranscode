/**
 * 主题提供者 · 子项目 A 增强版
 * ---------------------------------------------------------------
 * 变更点（docs/superpowers/plans/2026-04-24-A-design-system-plan.md M2·任务 7）：
 *   1. 匿名用户首次访问：优先读取 localStorage 上次选择，
 *      若无则跟随系统 `prefers-color-scheme: dark` 自动落位 light / dark。
 *   2. 登录用户：读后端 preferences，theme 字段为空时回落 localStorage，再回落 light。
 *   3. 监听系统主题变化：仅在用户"未显式选择"（localStorage 空）或选 auto 时响应。
 *
 * applyTheme 本身（见 src/lib/theme.ts）已处理 `.dark` class 切换 + auto 模式。
 * 本文件只负责"决定下一帧用什么 ThemeConfig"。
 */
import { useEffect } from 'react'
import { useAuthStore } from '@/hooks/useAuthStore'
import { preferencesApi } from '@/services/api'
import { applyTheme, getDefaultTheme, type ThemeConfig } from '@/lib/theme'

const STORAGE_KEY = 'mtc.theme'

type ThemeMode = ThemeConfig['mode']

function readLocalMode(): ThemeMode | null {
  const v = localStorage.getItem(STORAGE_KEY)
  return v === 'light' || v === 'dark' || v === 'auto' ? v : null
}

/**
 * 匿名用户的主题解析：
 *   1. 若 localStorage 有显式选择 → 用它（'light' / 'dark' / 'auto'）
 *   2. 否则按系统 prefers-color-scheme 定位 light/dark
 */
function resolveAnonymous(): ThemeConfig {
  const base = getDefaultTheme()
  const local = readLocalMode()
  if (local) return { ...base, mode: local }
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  return { ...base, mode: prefersDark ? 'dark' : 'light' }
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()

  useEffect(() => {
    async function loadAndApplyTheme() {
      if (!isAuthenticated) {
        applyTheme(resolveAnonymous())
        return
      }

      try {
        const prefs = await preferencesApi.get() as any
        const config: ThemeConfig = {
          mode: (prefs.theme as ThemeMode) || readLocalMode() || 'light',
          primaryColor: prefs.primary_color || 'jade',
          cardStyle: prefs.card_style || 'glass',
          fontSize: prefs.font_size || 'medium',
          appBackgroundUrl: (prefs.app_background_url as string | null | undefined) ?? null,
        }
        applyTheme(config)
        if (config.mode) localStorage.setItem(STORAGE_KEY, config.mode)
      } catch {
        applyTheme(resolveAnonymous())
      }
    }

    loadAndApplyTheme()
  }, [isAuthenticated])

  // 系统主题变化 → 只在"未显式选择"或选 auto 时重新应用
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      const local = readLocalMode()
      if (local === null || local === 'auto') {
        applyTheme(resolveAnonymous())
      }
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return <>{children}</>
}

/**
 * 对外工具：供 UI 切换按钮使用（例如未来 Header 的 theme toggle）。
 * 注意：此处用 getDefaultTheme() 组装，会重置 primaryColor/cardStyle/fontSize。
 *       登录用户切主题应走后端 preferencesApi.update() 保持其他偏好不丢失。
 */
export function setThemeMode(mode: ThemeMode) {
  localStorage.setItem(STORAGE_KEY, mode)
  applyTheme({ ...getDefaultTheme(), mode })
}
