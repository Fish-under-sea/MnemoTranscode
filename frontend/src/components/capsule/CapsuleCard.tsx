// frontend/src/components/capsule/CapsuleCard.tsx
import { Lock, Unlock, Clock } from 'lucide-react'
import { motion } from 'motion/react'
import { Card } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import { formatCountdown, isCapsuleLocked, formatDate } from '@/lib/capsuleUtils'
import { fadeUp } from '@/lib/motion'
import { cn } from '@/lib/utils'
import type { CapsuleItem } from '@/services/api'

interface CapsuleCardProps {
  capsule: CapsuleItem
  onClick: () => void
}

export default function CapsuleCard({ capsule, onClick }: CapsuleCardProps) {
  const locked = isCapsuleLocked(capsule.unlock_date) && capsule.status === 'locked'
  const expired = !locked && capsule.status === 'locked'  // 已过期但后端未标记 delivered
  const delivered = !locked && !expired

  return (
    <motion.div variants={fadeUp}>
      <button onClick={onClick} className="w-full text-left">
        <Card
          variant={delivered ? 'accent' : 'glass'}
          padding="md"
          hoverable
          className="h-full"
        >
          {/* 状态 header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {locked && <Lock size={14} className="text-ink-muted" />}
              {expired && <Clock size={14} className="text-amber-600" />}
              {delivered && <Unlock size={14} className="text-brand" />}
              <Badge
                tone={locked ? 'neutral' : expired ? 'amber' : 'jade'}
                size="sm"
              >
                {locked ? '锁定中' : expired ? '已到期·待解封' : '已解封'}
              </Badge>
            </div>
          </div>

          {/* 标题 */}
          <h3 className="text-body font-semibold text-ink-primary mb-2 line-clamp-1">
            {capsule.title}
          </h3>

          {/* 锁定：倒计时 + 模糊内容 */}
          {locked && (
            <>
              <div className="mb-3">
                <div className="text-h3 font-display font-bold text-ink-primary tabular-nums">
                  {formatCountdown(capsule.unlock_date)}
                </div>
                <div className="text-caption text-ink-muted mt-0.5">
                  解封于 {formatDate(capsule.unlock_date)}
                </div>
              </div>
              <div
                className={cn(
                  'text-caption text-ink-secondary leading-relaxed',
                  'blur-sm select-none pointer-events-none',
                )}
              >
                ████████████████████████ 此胶囊尚未解锁 ████████████████████████
              </div>
            </>
          )}

          {/* 已到期待解封 */}
          {expired && (
            <p className="text-caption text-amber-600">
              此胶囊已到解封时间，点击查看内容
            </p>
          )}

          {/* 已解封：内容预览 */}
          {delivered && capsule.content && (
            <p className="text-caption text-ink-secondary leading-relaxed line-clamp-3">
              {capsule.content.slice(0, 80)}
              {capsule.content.length > 80 ? '…' : ''}
            </p>
          )}

          {/* 底部时间信息 */}
          <div className="mt-3 pt-3 border-t border-border-default">
            <span className="text-caption text-ink-muted">
              {capsule.created_at ? `创建于 ${formatDate(capsule.created_at)}` : ''}
            </span>
          </div>
        </Card>
      </button>
    </motion.div>
  )
}
