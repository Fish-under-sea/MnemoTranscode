/**
 * Card · 统一卡片容器
 * 对应 docs/design-system.md §6.2
 * - plain：跟随 DIY「卡片风格」（液态玻璃 / 简约 / 悬浮）
 * - glass / accent：Playground / 特例下强制样式
 */
import { forwardRef, useMemo, type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { panelClassFromCardStyle, useThemeAppliedSnapshot } from '@/lib/theme'

type Variant = 'plain' | 'glass' | 'accent' | 'flat'

/** 与设计系统 Accent 渐变块一致；不受 DIY 卡片风格切换 */
const accentClasses =
  'bg-gradient-to-br from-brand/12 to-brand-accent/8 border border-brand/20 shadow-e2 dark:border-brand/25'

/** 实底卡片：不套用 DIY「液态玻璃」，用于须与 .mtc-liquid-glass 脱钩的区域 */
const flatClasses =
  'bg-surface border border-default shadow-none ring-1 ring-black/[0.04] dark:border-amber-400/12 dark:ring-white/[0.06]'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant
  padding?: 'none' | 'sm' | 'md' | 'lg'
  hoverable?: boolean
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
  const { cardStyle } = useThemeAppliedSnapshot()

  const variantClasses = useMemo(() => {
    if (variant === 'accent') return accentClasses
    if (variant === 'glass') return panelClassFromCardStyle('glass')
    if (variant === 'flat') return flatClasses
    return panelClassFromCardStyle(cardStyle)
  }, [variant, cardStyle])

  return (
    <div
      ref={ref}
      className={cn(
        'rounded-2xl',
        variantClasses,
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
