/**
 * Badge · 徽章
 * 对应 docs/design-system.md §6.3
 * - 情感 / 类型 / 数值 三种用途的变体
 */
import { cn } from '@/lib/utils'
import type { HTMLAttributes, ReactNode } from 'react'

type Tone = 'jade' | 'amber' | 'rose' | 'sky' | 'violet' | 'forest' | 'neutral'
type Size = 'sm' | 'md'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
  size?: Size
  dot?: boolean
  icon?: ReactNode
}

const toneClasses: Record<Tone, string> = {
  jade: 'bg-jade-50 text-jade-700 border-jade-200/60',
  amber: 'bg-amber-50 text-amber-700 border-amber-200/60',
  rose: 'bg-rose-50 text-rose-700 border-rose-200/60',
  sky: 'bg-sky-50 text-sky-700 border-sky-200/60',
  violet: 'bg-violet-50 text-violet-700 border-violet-200/60',
  forest: 'bg-forest-50 text-forest-700 border-forest-200/60',
  neutral: 'bg-subtle text-ink-secondary border-border-default',
}

const sizeClasses: Record<Size, string> = {
  sm: 'h-5 px-2 text-caption gap-1',
  md: 'h-6 px-2.5 text-body-sm gap-1.5',
}

export default function Badge({
  tone = 'neutral',
  size = 'sm',
  dot,
  icon,
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-medium',
        toneClasses[tone],
        sizeClasses[size],
        className,
      )}
      {...rest}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />}
      {icon}
      {children}
    </span>
  )
}
