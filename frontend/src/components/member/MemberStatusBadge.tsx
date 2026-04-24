import Badge from '@/components/ui/Badge'
import { STATUS_META, normalizeStatus, formatMemberLifespan, type MemberStatus } from '@/lib/memberStatus'

export interface MemberStatusBadgeProps {
  status?: MemberStatus | string | null
  birthYear?: number | null
  endYear?: number | null
  /** 是否同时展示生命周期文本（默认 true） */
  showLifespan?: boolean
  size?: 'sm' | 'md'
}

export default function MemberStatusBadge({
  status,
  birthYear,
  endYear,
  showLifespan = true,
  size = 'sm',
}: MemberStatusBadgeProps) {
  const normalized: MemberStatus = normalizeStatus(status)
  const meta = STATUS_META[normalized]
  const Icon = meta.icon
  const lifespan = showLifespan ? formatMemberLifespan(birthYear, endYear, normalized) : null

  return (
    <div className="inline-flex items-center gap-2 flex-wrap">
      <Badge tone={meta.tone} size={size} icon={<Icon size={12} />}>
        {meta.label}
      </Badge>
      {lifespan && <span className="text-caption text-ink-muted">{lifespan}</span>}
    </div>
  )
}
