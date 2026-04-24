/**
 * Modal · A 子项目升级版
 * 对应 docs/design-system.md §6.2
 * - 保留原 API：open / onClose / title / children / size='sm'|'md'|'lg'
 * - 新增（全部可选）：size='full' / closeOnOverlayClick / closeOnEsc / hideClose / footer
 * - 基于 @radix-ui/react-dialog + motion 入场
 */
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { fadeIn, scaleIn } from '@/lib/motion'

type Size = 'sm' | 'md' | 'lg' | 'full'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  size?: Size
  closeOnOverlayClick?: boolean
  closeOnEsc?: boolean
  hideClose?: boolean
  footer?: ReactNode
  className?: string
}

const sizeClasses: Record<Size, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  full: 'max-w-[min(96vw,1200px)] max-h-[92vh]',
}

export default function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
  closeOnOverlayClick = true,
  closeOnEsc = true,
  hideClose,
  footer,
  className,
}: ModalProps) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                variants={fadeIn}
                initial="hidden"
                animate="visible"
                exit="hidden"
                className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
                onClick={(e) => {
                  if (!closeOnOverlayClick) e.stopPropagation()
                }}
              />
            </Dialog.Overlay>
            <Dialog.Content
              onPointerDownOutside={(e) => {
                if (!closeOnOverlayClick) e.preventDefault()
              }}
              onEscapeKeyDown={(e) => {
                if (!closeOnEsc) e.preventDefault()
              }}
              asChild
            >
              {/* flex 居中：避免 motion scale 覆盖 translate 导致弹窗卡在右下 */}
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
                <motion.div
                  variants={scaleIn}
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                  className={cn(
                    'pointer-events-auto w-full max-h-[min(90vh,920px)] overflow-hidden flex flex-col',
                    'rounded-2xl bg-surface shadow-e4',
                    'border border-border-default',
                    sizeClasses[size],
                    size === 'full' && 'max-h-[92vh]',
                    className,
                  )}
                >
                {(title || !hideClose) && (
                  <div className="flex items-center justify-between px-6 py-4 border-b border-border-default">
                    {title ? (
                      <Dialog.Title className="font-serif text-h4 text-ink-primary">
                        {title}
                      </Dialog.Title>
                    ) : (
                      <span />
                    )}
                    {!hideClose && (
                      <Dialog.Close asChild>
                        <button
                          type="button"
                          aria-label="关闭"
                          className="p-1.5 text-ink-muted hover:text-ink-primary hover:bg-subtle rounded-lg transition-colors"
                        >
                          <X size={18} />
                        </button>
                      </Dialog.Close>
                    )}
                  </div>
                )}
                <div className={cn('p-6 overflow-y-auto min-h-0', size === 'full' && 'flex-1')}>
                  {children}
                </div>
                {footer && (
                  <div className="px-6 py-4 border-t border-border-default bg-subtle/40 shrink-0">
                    {footer}
                  </div>
                )}
                </motion.div>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}
