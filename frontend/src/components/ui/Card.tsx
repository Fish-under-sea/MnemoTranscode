/**
 * Card · 统一卡片容器
 * 对应 docs/design-system.md §6.2
 * - plain：跟随 DIY「卡片风格」（液态玻璃 / 简约 / 悬浮）
 * - glass / accent：Playground / 特例下强制样式
 */
import { forwardRef, useMemo, type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { panelClassFromCardStyle, useThemeAppliedSnapshot } from '@/lib/theme'

type Variant = 'plain' | 'glass' | 'accent'

/** 与设计系统 Accent 渐变块一致；不受 DIY 卡片风格切换 */
const accentClasses =
  'bg-gradient-to-br from-brand/12 to-brand-accent/8 border border-brand/20 shadow-e2 dark:border-brand/25'

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
