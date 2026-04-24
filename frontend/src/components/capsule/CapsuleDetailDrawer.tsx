// frontend/src/components/capsule/CapsuleDetailDrawer.tsx
import Drawer from '@/components/ui/Drawer'
import Badge from '@/components/ui/Badge'
import { LoadingState } from '@/components/ui/state'
import { useCapsuleDetail } from '@/hooks/useCapsules'
import { formatDate } from '@/lib/capsuleUtils'

interface CapsuleDetailDrawerProps {
  capsuleId: number | null
  onClose: () => void
}

export default function CapsuleDetailDrawer({ capsuleId, onClose }: CapsuleDetailDrawerProps) {
  const { data: capsule, isLoading } = useCapsuleDetail(capsuleId)

  return (
    <Drawer
      open={capsuleId !== null}
      onClose={onClose}
      side="right"
      title={capsule?.title ?? '胶囊详情'}
    >
      {isLoading ? (
        <LoadingState message="加载中…" />
      ) : capsule ? (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Badge tone={capsule.status === 'delivered' ? 'jade' : 'neutral'} size="sm">
              {capsule.status === 'delivered' ? '已解封' : '锁定中'}
            </Badge>
          </div>

          <div className="space-y-1 text-caption text-ink-muted">
            <div>解封时间：{formatDate(capsule.unlock_date)}</div>
            <div>创建时间：{formatDate(capsule.created_at)}</div>
          </div>

          {capsule.content ? (
            <div className="font-display text-ink-primary leading-[1.9] text-body whitespace-pre-wrap">
              {capsule.content}
            </div>
          ) : (
            <div className="text-center py-12 text-ink-muted">
              <div className="text-4xl mb-3">🔒</div>
              <p className="text-body-sm">此胶囊尚未解锁</p>
            </div>
          )}
        </div>
      ) : null}
    </Drawer>
  )
}
