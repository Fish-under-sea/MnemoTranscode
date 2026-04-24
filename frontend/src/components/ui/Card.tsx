/**
 * Card · 统一卡片容器
 * 对应 docs/design-system.md §6.2
 * - 三变体：plain / glass / accent
 */
import { forwardRef, type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'plain' | 'glass' | 'accent'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant
  padding?: 'none' | 'sm' | 'md' | 'lg'
  hoverable?: boolean
}

const variantClasses: Record<Variant, string> = {
  plain: 'bg-surface border border-border-default shadow-e1 dark:border-amber-400/20',
  glass:
    'bg-white/70 backdrop-blur-md border border-jade-200/40 shadow-e2 dark:bg-white/5 dark:border-amber-400/20',
  accent:
    'bg-gradient-to-br from-jade-50 to-amber-50 border border-jade-200/60 shadow-e2 dark:from-amber-400/10 dark:to-transparent dark:border-amber-400/30',
}

const paddingClasses = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
}

const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = 'plain', padding = 'md', hoverable, className, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'rounded-2xl',
        variantClasses[variant],
        paddingClasses[padding],
        hoverable && 'transition-shadow duration-[250ms] hover:shadow-e3',
        className,
      )}
      {...rest}
    />
  )
})

export default Card
export { Card }
