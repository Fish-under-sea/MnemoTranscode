/**
 * Drawer · 侧边抽屉
 * 对应 docs/design-system.md §6.2
 * - 方向：left / right / bottom
 * - 基于 Radix Dialog + motion slide
 */
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { fadeIn, slideLeft, slideRight, slideUp } from '@/lib/motion'

type Side = 'left' | 'right' | 'bottom'

export interface DrawerProps {
  open: boolean
  onClose: () => void
  side?: Side
  title?: string
  children: ReactNode
  width?: string
  height?: string
  hideClose?: boolean
  footer?: ReactNode
  className?: string
}

const sideClasses: Record<Side, string> = {
  left: 'left-0 top-0 h-full border-r',
  right: 'right-0 top-0 h-full border-l',
  bottom: 'left-0 bottom-0 w-full border-t rounded-t-3xl',
}

const variantMap = {
  left: slideLeft,
  right: slideRight,
  bottom: slideUp,
} as const

export default function Drawer({
  open,
  onClose,
  side = 'right',
  title,
  children,
  width = 'w-[min(420px,90vw)]',
  height = 'h-[min(70vh,720px)]',
  hideClose,
  footer,
  className,
}: DrawerProps) {
  const isBottom = side === 'bottom'
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
                className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
                variants={variantMap[side]}
                initial="hidden"
                animate="visible"
                exit="exit"
                className={cn(
                  'fixed z-50 bg-surface border border-border-default shadow-e4 flex flex-col',
                  sideClasses[side],
                  isBottom ? height : width,
                  className,
                )}
              >
                {(title || !hideClose) && (
                  <div className="flex items-center justify-between px-5 py-4 border-b border-border-default">
                    {title ? (
                      <Dialog.Title className="font-serif text-h4 text-ink-primary">{title}</Dialog.Title>
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
                <div className="flex-1 overflow-auto p-5">{children}</div>
                {footer && (
                  <div className="px-5 py-4 border-t border-border-default bg-subtle/40">{footer}</div>
                )}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}
