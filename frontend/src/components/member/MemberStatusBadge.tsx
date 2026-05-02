import { Layers } from 'lucide-react'
import {
  STATUS_META,
  normalizeStatus,
  formatMemberLifespan,
  formatNationalMemoryEntityYearLine,
  type MemberStatus,
} from '@/lib/memberStatus'
import {
  nationalCapsuleTagStaticClass,
  nationalCapsuleTagStaticClassMd,
  nationalCapsuleBadgeIconSize,
} from '@/lib/nationalMemoryCapsuleClasses'

export type MemberBadgePresentation = 'member' | 'national_memory_entity'

export interface MemberStatusBadgeProps {
  status?: MemberStatus | string | null
  birthYear?: number | null
  endYear?: number | null
  showLifespan?: boolean
  size?: 'sm' | 'md'
  presentation?: MemberBadgePresentation
  nationalEmptyYearText?: string
}

export default function MemberStatusBadge({
  status,
  birthYear,
  endYear,
  showLifespan = true,
  size = 'sm',
  presentation = 'member',
  nationalEmptyYearText = '未填写关键年份',
}: MemberStatusBadgeProps) {
  const capsuleClass =
    size === 'md' ? nationalCapsuleTagStaticClassMd() : nationalCapsuleTagStaticClass()
  const layersPx = nationalCapsuleBadgeIconSize(size)

  const isNationalEntity = presentation === 'national_memory_entity'

  if (isNationalEntity) {
    const yearLine = formatNationalMemoryEntityYearLine(birthYear, endYear)
    return (
      <div className="inline-flex items-center gap-2 flex-wrap">
        <span className={capsuleClass}>
          <Layers size={layersPx} className="shrink-0 opacity-90" aria-hidden />
          记忆实体
        </span>
        {showLifespan ?
          yearLine ?
            <span className="text-caption text-ink-muted">{yearLine}</span>
          : <span className="text-caption text-ink-muted">{nationalEmptyYearText}</span>

        : null}
      </div>
    )
  }

  const normalized: MemberStatus = normalizeStatus(status)
  const meta = STATUS_META[normalized]
  const lifespan = showLifespan ? formatMemberLifespan(birthYear, endYear, normalized) : null

  return (
    <div className="inline-flex items-center gap-2 flex-wrap">
      <span className={capsuleClass}>
        <Layers size={layersPx} className="shrink-0 opacity-90" aria-hidden />
        {meta.label}
      </span>
      {lifespan ? <span className="text-caption text-ink-muted">{lifespan}</span> : null}
    </div>
  )
}
