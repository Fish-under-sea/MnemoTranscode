import { Inbox, type LucideIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { Button, type ButtonProps } from '@/components/ui/Button'
import { fadeUp } from '@/lib/motion'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
    variant?: ButtonProps['variant']
  }
  className?: string
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className={cn('flex flex-col items-center justify-center text-center py-12 px-6', className)}
    >
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-ink-muted" />
      </div>
      <h3 className="font-serif text-xl text-ink-primary mb-2">{title}</h3>
      {description && <p className="text-ink-secondary max-w-md mb-6">{description}</p>}
      {action && (
        <Button variant={action.variant ?? 'primary'} onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </motion.div>
  )
}
