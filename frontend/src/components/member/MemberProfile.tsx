import { User, Layers } from 'lucide-react'
import MemberStatusBadge from './MemberStatusBadge'
import Avatar from '@/components/ui/Avatar'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

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

export type MemberProfilePresentation = 'member' | 'national_memory_entity'

export default function MemberProfile({
  member,
  actions,
  presentation = 'member',
  nationalYearEmptyCaption = '未填写关键年份（可选用创建实体时的年份字段）',
}: {
  member: MemberProfileData
  /** 例如更换头像按钮区 */
  actions?: ReactNode
  /** 「国家记忆」档案：与关系成员页的徽章、年份话术完全分离 */
  presentation?: MemberProfilePresentation
  /** presentation 为国家实体时：无年份时展示的说明（与列表卡默认短语可区分） */
  nationalYearEmptyCaption?: string
}) {
  const rel = member.relationship ?? member.relationship_type
  const trimmedAvatar = typeof member.avatar_url === 'string' ? member.avatar_url.trim() : ''
  const avatarSrc = trimmedAvatar.length > 0 ? trimmedAvatar : undefined
  const isNationalEntity = presentation === 'national_memory_entity'

  /** 国线封面：Radix Avatar + 固定 Layers fallback 在同一组件内易与 Image 争抢显示层，改用原生 img，失败再回落占位 */
  const [nationalCoverErr, setNationalCoverErr] = useState(false)
  useEffect(() => {
    setNationalCoverErr(false)
  }, [avatarSrc])

  const nationalFallback = (
    <div
      className={cn(
        'flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-white bg-white/[0.42] text-ink-secondary shadow-none ring-2 ring-border-default dark:border-white/[0.28]',
      )}
      aria-hidden
    >
      <Layers size={32} />
    </div>
  )

  return (
    <div>
      <div className="flex items-start gap-4">
        {isNationalEntity ?
          avatarSrc && !nationalCoverErr ?
            <img
              src={avatarSrc}
              alt={`「${member.name}」封面`}
              width={64}
              height={64}
              decoding="async"
              className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-border-default"
              onError={() => setNationalCoverErr(true)}
            />
          : nationalFallback
        : <Avatar
            src={avatarSrc}
            name={member.name}
            size={64}
            fallback={
              avatarSrc ?
                undefined
              : <User size={32} aria-hidden />
            }
            className={cn(
              'shrink-0 ring-2 ring-border-default',
              !avatarSrc && '!bg-subtle dark:!bg-secondary/35 !border !border-border-default !font-normal',
            )}
          />}
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-display text-ink-primary">{member.name}</h1>
          {rel ?
            <div className="mt-1">
              {isNationalEntity ?
                <p className="text-caption text-ink-muted mb-0.5">实体类型 · 归类模型</p>
              : null}
              <p className="text-body text-ink-secondary">{rel}</p>
            </div>
          : null}
          <div className="mt-2">
            {isNationalEntity ?
              <MemberStatusBadge
                presentation="national_memory_entity"
                status={member.status}
                birthYear={member.birth_year}
                endYear={member.end_year}
                nationalEmptyYearText={nationalYearEmptyCaption}
              />
            : <MemberStatusBadge
                status={member.status}
                birthYear={member.birth_year}
                endYear={member.end_year}
              />}
          </div>
          {actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      </div>
      {member.bio ?
        <div className="mt-4">
          {isNationalEntity ?
            <p className="text-caption text-ink-muted mb-1">说明 · 史料与引用摘录</p>
          : null}
          <p className="text-body text-ink-primary whitespace-pre-wrap">{member.bio}</p>
        </div>
      : null}
    </div>
  )
}
