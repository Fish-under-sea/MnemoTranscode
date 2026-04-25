/**
 * 工具函数
 */
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

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

export const ARCHIVE_TYPE_OPTIONS = [
  { value: 'family', label: '家族记忆', icon: '👨‍👩‍👧‍👦' },
  { value: 'lover', label: '恋人记忆', icon: '💕' },
  { value: 'friend', label: '挚友记忆', icon: '🤝' },
  { value: 'relative', label: '至亲记忆', icon: '❤️' },
  { value: 'celebrity', label: '伟人记忆', icon: '⭐' },
  { value: 'nation', label: '国家历史', icon: '🏛️' },
] as const

export const EMOTION_LABELS = [
  { value: 'joy', label: '喜悦', color: '#FFD700' },
  { value: 'love', label: '爱', color: '#FF69B4' },
  { value: 'anger', label: '愤怒', color: '#FF4500' },
  { value: 'sadness', label: '悲伤', color: '#4682B4' },
  { value: 'fear', label: '恐惧', color: '#8B4513' },
  { value: 'surprise', label: '惊讶', color: '#9370DB' },
  { value: 'nostalgia', label: '怀念', color: '#DEB887' },
  { value: 'gratitude', label: '感恩', color: '#90EE90' },
  { value: 'regret', label: '遗憾', color: '#C0C0C0' },
  { value: 'peaceful', label: '平静', color: '#87CEEB' },
] as const
