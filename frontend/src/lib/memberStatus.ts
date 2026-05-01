import type { LucideIcon } from 'lucide-react'
import { Sun, Sunset, HelpCircle } from 'lucide-react'

export type MemberStatus = 'alive' | 'deceased' | 'unknown'
/** 与后端 `MemberStatus` 字面量一致，创建/更新成员时直传，避免经代理后校验顺序异常。 */
export type MemberStatusApi = 'active' | 'passed' | 'distant' | 'pet' | 'other'
export type BadgeTone = 'jade' | 'amber' | 'neutral'

export function memberStatusToApi(s: MemberStatus): MemberStatusApi {
  if (s === 'alive') return 'active'
  if (s === 'deceased') return 'passed'
  return 'other'
}

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

/**
 * 容错读：兼容后端 MemberStatus（active/passed/…）与历史前端字面量（alive/deceased/unknown）。
 */
export function normalizeStatus(raw: unknown): MemberStatus {
  if (raw === 'alive' || raw === 'active') return 'alive'
  if (raw === 'deceased' || raw === 'passed') return 'deceased'
  if (raw === 'unknown') return 'unknown'
  // distant / pet / other：表单侧暂无单独徽章，归入未说明类展示
  if (raw === 'distant' || raw === 'pet' || raw === 'other') return 'unknown'
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
