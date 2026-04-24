import { User } from 'lucide-react'
import MemberStatusBadge from './MemberStatusBadge'

export interface MemberProfileData {
  name: string
  relationship?: string | null
  relationship_type?: string | null
  birth_year?: number | null
  end_year?: number | null
  status?: string | null
  bio?: string | null
}

export default function MemberProfile({ member }: { member: MemberProfileData }) {
  const rel = member.relationship ?? member.relationship_type
  return (
    <div>
      <div className="flex items-start gap-4">
        <div
          className="w-16 h-16 shrink-0 rounded-full bg-subtle border border-border-default flex items-center justify-center text-ink-muted"
          aria-hidden
        >
          <User size={32} />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-display text-ink-primary">{member.name}</h1>
          {rel ? <p className="text-ink-secondary mt-1 text-body">{rel}</p> : null}
          <div className="mt-2">
            <MemberStatusBadge
              status={member.status}
              birthYear={member.birth_year}
              endYear={member.end_year}
            />
          </div>
        </div>
      </div>
      {member.bio ? (
        <p className="mt-4 text-body text-ink-primary whitespace-pre-wrap">{member.bio}</p>
      ) : null}
    </div>
  )
}
