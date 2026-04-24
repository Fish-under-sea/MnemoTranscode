import type { LucideIcon } from 'lucide-react'
import { Sun, Sunset, HelpCircle } from 'lucide-react'

export type MemberStatus = 'alive' | 'deceased' | 'unknown'
export type BadgeTone = 'jade' | 'amber' | 'neutral'

interface StatusMeta {
  label: string
  tone: BadgeTone
  icon: LucideIcon
  /** 当需要展示 end_year 时的 label（alive 状态永不展示 end_year） */
  endYearLabel: string | null
  /** 该 status 下 end_year 是否显示（false = 输入框隐藏） */
  showEndYear: boolean
}

export const STATUS_META: Record<MemberStatus, StatusMeta> = {
  alive: {
    label: 'Ta 现在还在',
    tone: 'jade',
    icon: Sun,
    endYearLabel: null,
    showEndYear: false,
  },
  deceased: {
    label: 'Ta 已经离开',
    tone: 'amber',
    icon: Sunset,
    endYearLabel: '辞世年（可选）',
    showEndYear: true,
  },
  unknown: {
    label: '未说明',
    tone: 'neutral',
    icon: HelpCircle,
    endYearLabel: '最后一次有音讯的年份（可选）',
    showEndYear: true,
  },
}

/** 容错读：字段缺失 / null / 空字符串 / 未知字符串 → 都归为 unknown */
export function normalizeStatus(raw: unknown): MemberStatus {
  if (raw === 'alive' || raw === 'deceased' || raw === 'unknown') return raw
  return 'unknown'
}

/** 给 Select 组件使用的 option 数组（值恒定） */
export const STATUS_OPTIONS = (Object.keys(STATUS_META) as MemberStatus[]).map((key) => ({
  value: key,
  label: STATUS_META[key].label,
}))

/**
 * 生成一条人类可读的年份行。
 * - alive：1960（或空）
 * - deceased + endYear：1960 – 2023（或 辞世于 2023 年）
 * - deceased：辞世年未填，只显示 birth
 * - unknown + endYear：最后音讯：2023 年
 */
export function formatMemberLifespan(
  birthYear?: number | null,
  endYear?: number | null,
  status?: MemberStatus,
): string | null {
  const s = normalizeStatus(status)
  if (s === 'alive') {
    return birthYear ? `${birthYear} 年出生` : null
  }
  if (s === 'deceased') {
    if (birthYear && endYear) return `${birthYear} – ${endYear}`
    if (endYear) return `辞世于 ${endYear} 年`
    if (birthYear) return `${birthYear} 年出生`
    return null
  }
  // unknown
  if (endYear) return `最后音讯：${endYear} 年`
  if (birthYear) return `${birthYear} 年出生`
  return null
}
