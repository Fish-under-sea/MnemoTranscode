/**
 * ConfirmDialog · 危险操作确认弹窗
 * 对应 docs/design-system.md §6.1
 * - 用 <Modal> 作为底座
 * - 两个按钮：取消 / 确认（可配置 danger）
 */
import Button from './Button'
import Modal from './Modal'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'danger'
  loading?: boolean
  onConfirm: () => void | Promise<void>
  onCancel: () => void
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmText = '确认',
  cancelText = '取消',
  variant = 'default',
  loading,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel} size="sm" title={title}>
      {description && <p className="text-body text-ink-secondary mb-6">{description}</p>}
      <div className="flex items-center justify-end gap-3">
        <Button variant="ghost" onClick={onCancel} disabled={loading}>
          {cancelText}
        </Button>
        <Button variant={variant === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
          {confirmText}
        </Button>
      </div>
    </Modal>
  )
}
