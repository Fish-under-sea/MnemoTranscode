/**
 * 主题系统 — 动态 CSS 变量注入
 * 根据用户偏好在根元素上注入主题变量
 */

export type PrimaryColor = 'jade' | 'amber' | 'rose' | 'sky' | 'violet' | 'forest'
export type ThemeMode = 'light' | 'dark' | 'auto'
export type CardStyle = 'glass' | 'minimal' | 'elevated'
export type FontSize = 'small' | 'medium' | 'large'

const COLOR_MAP: Record<PrimaryColor, Record<string, string>> = {
  jade: {
    primary: '#10B981',
    'primary-dark': '#059669',
    'primary-light': '#34D399',
    'primary-bg': '#ECFDF5',
    'primary-border': '#A7F3D0',
    'primary-shadow': 'rgba(5, 150, 105, 0.25)',
  },
  amber: {
    primary: '#F59E0B',
    'primary-dark': '#D97706',
    'primary-light': '#FBBF24',
    'primary-bg': '#FFFBEB',
    'primary-border': '#FDE68A',
    'primary-shadow': 'rgba(245, 158, 11, 0.25)',
  },
  rose: {
    primary: '#F43F5E',
    'primary-dark': '#E11D48',
    'primary-light': '#FB7185',
    'primary-bg': '#FFF1F2',
    'primary-border': '#FECDD3',
    'primary-shadow': 'rgba(244, 63, 94, 0.25)',
  },
  sky: {
    primary: '#0EA5E9',
    'primary-dark': '#0284C7',
    'primary-light': '#38BDF8',
    'primary-bg': '#F0F9FF',
    'primary-border': '#BAE6FD',
    'primary-shadow': 'rgba(14, 165, 233, 0.25)',
  },
  violet: {
    primary: '#8B5CF6',
    'primary-dark': '#7C3AED',
    'primary-light': '#A78BFA',
    'primary-bg': '#F5F3FF',
    'primary-border': '#DDD6FE',
    'primary-shadow': 'rgba(139, 92, 246, 0.25)',
  },
  forest: {
    primary: '#22C55E',
    'primary-dark': '#16A34A',
    'primary-light': '#4ADE80',
    'primary-bg': '#F0FDF4',
    'primary-border': '#BBF7D0',
    'primary-shadow': 'rgba(34, 197, 94, 0.25)',
  },
}

export interface ThemeConfig {
  mode: ThemeMode
  primaryColor: PrimaryColor
  cardStyle: CardStyle
  fontSize: FontSize
  /** 全屏铺底背景图，http(s) 或站内需带鉴权的相对路径可写绝对站外 URL */
  appBackgroundUrl?: string | null
}

export function applyTheme(config: ThemeConfig) {
  const root = document.documentElement
  const colors = COLOR_MAP[config.primaryColor]

  root.setAttribute('data-primary-color', config.primaryColor)
  root.setAttribute('data-theme', config.mode)

  for (const [key, value] of Object.entries(colors)) {
    root.style.setProperty(`--color-${key}`, value)
    root.style.setProperty(`--color-${key}-rgb`, hexToRgb(value))
  }

  // 字号映射
  const fontSizes: Record<FontSize, string> = {
    small: '14px',
    medium: '16px',
    large: '18px',
  }
  root.style.setProperty('--font-base-size', fontSizes[config.fontSize])

  // 深色模式
  if (config.mode === 'dark' || (config.mode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }

  const bg = (config.appBackgroundUrl ?? '').trim()
  if (bg) {
    root.style.setProperty('--app-background-image', `url(${JSON.stringify(bg)})`)
  } else {
    root.style.setProperty('--app-background-image', 'none')
  }
}

export function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r}, ${g}, ${b}`
}

export function getDefaultTheme(): ThemeConfig {
  return {
    mode: 'light',
    primaryColor: 'jade',
    cardStyle: 'glass',
    fontSize: 'medium',
    appBackgroundUrl: null,
  }
}

export const COLOR_OPTIONS: { value: PrimaryColor; label: string; hex: string }[] = [
  { value: 'jade', label: '翠玉', hex: '#10B981' },
  { value: 'amber', label: '琥珀', hex: '#F59E0B' },
  { value: 'rose', label: '玫瑰', hex: '#F43F5E' },
  { value: 'sky', label: '天空', hex: '#0EA5E9' },
  { value: 'violet', label: '紫罗兰', hex: '#8B5CF6' },
  { value: 'forest', label: '森林', hex: '#22C55E' },
]
