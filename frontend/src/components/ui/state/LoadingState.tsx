import { Loader2 } from 'lucide-react'
import { motion } from 'motion/react'
import { fadeIn } from '@/lib/motion'
import { SkeletonLine } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'

interface LoadingStateProps {
  variant?: 'spinner' | 'skeleton-cards' | 'skeleton-list'
  message?: string
  count?: number
  className?: string
}

export function LoadingState({
  variant = 'spinner',
  message,
  count = 3,
  className,
}: LoadingStateProps) {
  if (variant === 'skeleton-cards') {
    return (
      <div className={cn('grid gap-4 md:grid-cols-2 lg:grid-cols-3', className)}>
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonLine key={i} className="h-40 rounded-lg" />
        ))}
      </div>
    )
  }

  if (variant === 'skeleton-list') {
    return (
      <div className={cn('space-y-3', className)}>
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonLine key={i} className="h-16 rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <motion.div
      variants={fadeIn}
      initial="hidden"
      animate="visible"
      className={cn('flex flex-col items-center justify-center py-12 px-6', className)}
    >
      <Loader2 className="w-8 h-8 text-jade-600 animate-spin mb-3" />
      {message && <p className="text-sm text-ink-secondary">{message}</p>}
    </motion.div>
  )
}
