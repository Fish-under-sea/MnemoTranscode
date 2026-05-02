/**
 * 主题系统 — 动态 CSS 变量注入
 * 根据用户偏好在根元素上注入主题变量
 */
import { useSyncExternalStore } from 'react'

export type PrimaryColor = 'jade' | 'amber' | 'rose' | 'sky' | 'violet' | 'forest'
export type ThemeMode = 'light' | 'dark' | 'auto'
export type CardStyle = 'glass' | 'minimal' | 'elevated'
export type FontSize = 'small' | 'medium' | 'large'

/** 全屏背景运行时：图片走 CSS 变量；视频/GIF 外链 MP4 等走 <video> */
export type AppBackgroundMode = 'none' | 'image' | 'video'

export type AppBackgroundRuntime = {
  mode: AppBackgroundMode
  /** 已解析的可直接用于 CSS url() 或 <video src> */
  src: string | null
}

let bgRuntime: AppBackgroundRuntime = { mode: 'none', src: null }
const bgListeners = new Set<() => void>()

export function getAppBackgroundRuntime(): AppBackgroundRuntime {
  return bgRuntime
}

export function subscribeAppBackground(onStoreChange: () => void): () => void {
  bgListeners.add(onStoreChange)
  return () => bgListeners.delete(onStoreChange)
}

function emitAppBackground() {
  bgListeners.forEach((fn) => fn())
}

function setAppBackgroundRuntime(next: AppBackgroundRuntime) {
  bgRuntime = next
  emitAppBackground()
}

export function useAppBackgroundRuntime(): AppBackgroundRuntime {
  return useSyncExternalStore(
    subscribeAppBackground,
    getAppBackgroundRuntime,
    () => ({ mode: 'none', src: null }),
  )
}

/** 据 URL / data URI 推断动静类型（GIF 仍为 image，由 CSS 动画） */
export function inferAppBackgroundKind(url: string): 'image' | 'video' {
  const trimmed = url.trim()
  const lower = trimmed.toLowerCase()
  const path = lower.split(/[?#]/)[0]
  if (lower.startsWith('data:video/')) return 'video'
  if (/\.(mp4|webm|mov|m4v|ogv)(\?.*)?$/i.test(path)) return 'video'
  return 'image'
}

function cssBackgroundImageValue(raw: string): string {
  const s = raw.trim()
  if (!s) return 'none'
  const escaped = s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  return `url("${escaped}")`
}

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
  /** 展示用地址：外链、data URI、或同源 /api/v1/preferences/app-background-file?… */
  appBackgroundUrl?: string | null
  /** 后端写入；缺省时由 inferAppBackgroundKind 推断 */
  appBackgroundKind?: 'image' | 'video' | null
}

/** DIY 卡片壳：与 Card variant="plain"、独立面板对齐；glass = 半透明 + backdrop + 液态玻璃慢旋高光 */
export function panelClassFromCardStyle(style: CardStyle): string {
  switch (style) {
    case 'glass':
      return [
        'mtc-liquid-glass',
        'border border-default ring-1 ring-black/[0.04]',
        'bg-surface/58 backdrop-blur-xl backdrop-saturate-[1.35]',
        'dark:bg-surface/36 dark:border-default dark:ring-white/[0.06]',
      ].join(' ')
    case 'minimal':
      return 'bg-surface shadow-none border border-transparent dark:border-white/[0.06]'
    case 'elevated':
    default:
      return [
        'bg-surface border border-default shadow-e3',
        'dark:border-amber-400/12',
      ].join(' ')
  }
}

type ThemeAppliedSnapshot = Pick<ThemeConfig, 'mode' | 'primaryColor' | 'cardStyle' | 'fontSize'>

const defaultAppliedSnapshot: ThemeAppliedSnapshot = {
  mode: 'light',
  primaryColor: 'jade',
  cardStyle: 'glass',
  fontSize: 'medium',
}

let themeAppliedSnapshot: ThemeAppliedSnapshot = { ...defaultAppliedSnapshot }
const themeAppliedListeners = new Set<() => void>()

export function getThemeAppliedSnapshot(): ThemeAppliedSnapshot {
  return themeAppliedSnapshot
}

export function subscribeThemeApplied(onChange: () => void): () => void {
  themeAppliedListeners.add(onChange)
  return () => themeAppliedListeners.delete(onChange)
}

function bumpThemeAppliedSnapshot(config: ThemeConfig) {
  themeAppliedSnapshot = {
    mode: config.mode,
    primaryColor: config.primaryColor,
    cardStyle: config.cardStyle,
    fontSize: config.fontSize,
  }
  themeAppliedListeners.forEach((fn) => fn())
}

export function useThemeAppliedSnapshot(): ThemeAppliedSnapshot {
  return useSyncExternalStore(
    subscribeThemeApplied,
    getThemeAppliedSnapshot,
    () => defaultAppliedSnapshot,
  )
}

export function applyTheme(config: ThemeConfig) {
  const root = document.documentElement
  const colors = COLOR_MAP[config.primaryColor]

  root.setAttribute('data-primary-color', config.primaryColor)
  root.setAttribute('data-theme', config.mode)
  root.setAttribute('data-card-style', config.cardStyle)

  for (const [key, value] of Object.entries(colors)) {
    root.style.setProperty(`--color-${key}`, value)
    root.style.setProperty(`--color-${key}-rgb`, hexToRgb(value))
  }

  /** 与设计系统语义色衔接：Tailwind bg-brand/text-brand/shadow-e* 跟随 DIY 主色 */
  root.style.setProperty('--brand-primary', colors.primary)
  root.style.setProperty('--brand-primary-hover', colors['primary-dark'])
  root.style.setProperty('--brand-primary-active', colors['primary-dark'])
  root.style.setProperty('--brand-accent', colors['primary-light'])
  root.style.setProperty('--shadow-color', hexToRgb(colors.primary))
  const fontSizes: Record<FontSize, string> = {
    small: '14px',
    medium: '16px',
    large: '18px',
  }
  root.style.setProperty('--font-base-size', fontSizes[config.fontSize])

  if (config.mode === 'dark' || (config.mode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }

  const bgRaw = (config.appBackgroundUrl ?? '').trim()
  const declared = config.appBackgroundKind
  let mediaKind: AppBackgroundMode = 'none'
  if (!bgRaw) {
    mediaKind = 'none'
  } else if (declared === 'video') {
    mediaKind = 'video'
  } else if (declared === 'image') {
    mediaKind = 'image'
  } else {
    mediaKind = inferAppBackgroundKind(bgRaw) === 'video' ? 'video' : 'image'
  }

  if (mediaKind === 'none') {
    root.style.setProperty('--app-background-image', 'none')
    setAppBackgroundRuntime({ mode: 'none', src: null })
  } else if (mediaKind === 'video') {
    root.style.setProperty('--app-background-image', 'none')
    setAppBackgroundRuntime({ mode: 'video', src: bgRaw })
  } else {
    root.style.setProperty('--app-background-image', cssBackgroundImageValue(bgRaw))
    setAppBackgroundRuntime({ mode: 'image', src: bgRaw })
  }

  bumpThemeAppliedSnapshot(config)
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
    appBackgroundKind: null,
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
