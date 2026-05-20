/**
 * 工具函数
 */
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Radix Select.Item 禁止 value=""（库用空串表示清除选中）。筛选项「全部」、可选字段「未选」改用占位串。 */
export const RADIX_SELECT_ALL = '__mtc_radix_all__'
export const RADIX_SELECT_NONE = '__mtc_radix_none__'

export function formatDate(date: string | Date, format: string = 'YYYY-MM-DD'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const pad = (n: number) => n.toString().padStart(2, '0')

  return format
    .replace('YYYY', d.getFullYear().toString())
    .replace('MM', pad(d.getMonth() + 1))
    .replace('DD', pad(d.getDate()))
    .replace('HH', pad(d.getHours()))
    .replace('mm', pad(d.getMinutes()))
    .replace('ss', pad(d.getSeconds()))
}

/** 记忆条目时间展示：本地时区下精确到秒（API 为 ISO 或无时间时亦可解析） */
export function formatMemoryTimestamp(isoOrDate: string | Date | null | undefined): string {
  if (isoOrDate == null || isoOrDate === '') return ''
  if (isoOrDate instanceof Date) {
    if (Number.isNaN(isoOrDate.getTime())) return ''
    return formatDate(isoOrDate, 'YYYY-MM-DD HH:mm:ss')
  }
  const raw = isoOrDate.trim()
  let parseSrc = raw
  // ISO 仅为日期「YYYY-MM-DD」时本地解析为午夜，仍会显示 HH:mm:ss
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    parseSrc = `${raw}T00:00:00`
  }
  const d = new Date(parseSrc)
  if (Number.isNaN(d.getTime())) return raw
  return formatDate(d, 'YYYY-MM-DD HH:mm:ss')
}

export const ARCHIVE_TYPE_OPTIONS = [
  { value: 'family', label: '家族记忆', icon: '👨‍👩‍👧‍👦' },
  { value: 'lover', label: '恋人记忆', icon: '💕' },
  { value: 'friend', label: '挚友记忆', icon: '🤝' },
  { value: 'relative', label: '至亲记忆', icon: '❤️' },
  { value: 'celebrity', label: '伟人记忆', icon: '⭐' },
  { value: 'nation', label: '国家历史', icon: '🏛️' },
] as const

/** 普卢奇克情绪轮（32 项）；定义见 plutchikEmotions.ts */
export { EMOTION_LABELS, EMOTION_GROUPS, emotionDisplay, normalizeEmotionValue, resolveEmotion } from '@/lib/plutchikEmotions'
