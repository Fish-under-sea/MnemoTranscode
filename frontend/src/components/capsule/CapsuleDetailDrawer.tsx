// frontend/src/components/capsule/CapsuleDetailDrawer.tsx
import { useState } from 'react'
import toast from 'react-hot-toast'
import Drawer from '@/components/ui/Drawer'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { LoadingState } from '@/components/ui/state'
import { useCapsuleDetail, useForceUnlockCapsule } from '@/hooks/useCapsules'
import { useApiError } from '@/hooks/useApiError'
import { formatDate } from '@/lib/capsuleUtils'

interface CapsuleDetailDrawerProps {
  capsuleId: number | null
  onClose: () => void
}

export default function CapsuleDetailDrawer({ capsuleId, onClose }: CapsuleDetailDrawerProps) {
  const { data: capsule, isLoading } = useCapsuleDetail(capsuleId)
  const { show } = useApiError()
  const forceUnlock = useForceUnlockCapsule()
  const [password, setPassword] = useState('')

  const isTimeLocked =
    !!capsule &&
    capsule.status === 'locked' &&
    !capsule.content &&
    !!(capsule as { message?: string }).message

  const handleForceUnlock = async () => {
    if (capsuleId == null || !password.trim()) return
    try {
      await forceUnlock.mutateAsync({ id: capsuleId, password: password.trim() })
      setPassword('')
      toast.success('已凭账号密码解封')
    } catch (e) {
      show(e)
    }
  }

  return (
    <Drawer
      open={capsuleId !== null}
      onClose={() => {
        setPassword('')
        onClose()
      }}
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
            {capsule.created_at ? <div>创建时间：{formatDate(capsule.created_at)}</div> : null}
          </div>

          {capsule.content ? (
            <div className="font-display text-ink-primary leading-[1.9] text-body whitespace-pre-wrap">
              {capsule.content}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-center py-8 text-ink-muted">
                <div className="text-4xl mb-3">🔒</div>
                <p className="text-body-sm">
                  {(capsule as { message?: string }).message ?? '此胶囊尚未解锁'}
                </p>
              </div>

              {isTimeLocked ? (
                <div className="rounded-xl border border-border-default bg-subtle/40 p-4 space-y-3">
                  <p className="text-caption text-ink-secondary">
                    使用当前登录账号的密码可强制解封（请确认是你在 MTC 注册/登录时使用的密码）。
                  </p>
                  <Input
                    type="password"
                    label="账号密码"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="输入登录密码"
                    fullWidth
                  />
                  <Button
                    variant="primary"
                    fullWidth
                    loading={forceUnlock.isPending}
                    disabled={!password.trim()}
                    onClick={() => void handleForceUnlock()}
                  >
                    验证密码并解封
                  </Button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </Drawer>
  )
}
