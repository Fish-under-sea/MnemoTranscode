import { AlertCircle, RefreshCw } from 'lucide-react'
import { motion } from 'motion/react'
import { Button } from '@/components/ui/Button'
import { fadeUp } from '@/lib/motion'
import { isApiError, mapErrorToMessage, type ApiError } from '@/services/errors'
import { cn } from '@/lib/utils'

interface ErrorStateProps {
  title?: string
  error?: ApiError | Error | string | null
  onRetry?: () => void
  size?: 'sm' | 'md'
  className?: string
}

export function ErrorState({
  title = '出了点问题',
  error,
  onRetry,
  size = 'md',
  className,
}: ErrorStateProps) {
  const message = resolveMessage(error)
  const isSmall = size === 'sm'

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className={cn(
        'flex flex-col items-center justify-center text-center',
        isSmall ? 'py-6 px-4' : 'py-12 px-6',
        className,
      )}
    >
      <div
        className={cn(
          'rounded-full bg-muted dark:bg-rose-950/25 flex items-center justify-center mb-3',
          isSmall ? 'w-10 h-10' : 'w-14 h-14',
        )}
      >
        <AlertCircle className={cn('text-rose-500', isSmall ? 'w-5 h-5' : 'w-7 h-7')} />
      </div>
      <h3
        className={cn('font-serif text-ink-primary mb-1', isSmall ? 'text-base' : 'text-xl')}
      >
        {title}
      </h3>
      {message && (
        <p
          className={cn(
            'text-ink-secondary max-w-md',
            isSmall ? 'text-xs mb-3' : 'text-sm mb-4',
          )}
        >
          {message}
        </p>
      )}
      {onRetry && (
        <Button
          variant="secondary"
          size={isSmall ? 'sm' : 'md'}
          onClick={onRetry}
          leftIcon={<RefreshCw className={isSmall ? 'w-3 h-3' : 'w-4 h-4'} />}
        >
          重试
        </Button>
      )}
    </motion.div>
  )
}

function resolveMessage(err: ApiError | Error | string | null | undefined): string | null {
  if (!err) return null
  if (typeof err === 'string') return err
  if (isApiError(err)) return mapErrorToMessage(err)
  if (err instanceof Error) return err.message
  return null
}
