import { User } from 'lucide-react'
import MemberStatusBadge from './MemberStatusBadge'
import Avatar from '@/components/ui/Avatar'
import type { ReactNode } from 'react'

export interface MemberProfileData {
  name: string
  relationship?: string | null
  relationship_type?: string | null
  birth_year?: number | null
  end_year?: number | null
  status?: string | null
  bio?: string | null
  /** 后端签名后的展示 URL */
  avatar_url?: string | null
}

export default function MemberProfile({
  member,
  actions,
}: {
  member: MemberProfileData
  /** 例如更换头像按钮区 */
  actions?: ReactNode
}) {
  const rel = member.relationship ?? member.relationship_type
  const hasCustomAvatar = Boolean(member.avatar_url?.trim())
  return (
    <div>
      <div className="flex items-start gap-4">
        {hasCustomAvatar ? (
          <Avatar src={member.avatar_url ?? undefined} name={member.name} size={64} className="shrink-0 ring-2 ring-border-default" />
        ) : (
          <div
            className="w-16 h-16 shrink-0 rounded-full bg-subtle border border-border-default flex items-center justify-center text-ink-muted"
            aria-hidden
          >
            <User size={32} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-display text-ink-primary">{member.name}</h1>
          {rel ? <p className="text-ink-secondary mt-1 text-body">{rel}</p> : null}
          <div className="mt-2">
            <MemberStatusBadge
              status={member.status}
              birthYear={member.birth_year}
              endYear={member.end_year}
            />
          </div>
          {actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      </div>
      {member.bio ? (
        <p className="mt-4 text-body text-ink-primary whitespace-pre-wrap">{member.bio}</p>
      ) : null}
    </div>
  )
}
