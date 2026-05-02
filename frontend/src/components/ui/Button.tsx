/**
 * Button · A 子项目基础组件
 * 对应 docs/design-system.md §6.1
 */
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'amber'
type Size = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  loading?: boolean
  fullWidth?: boolean
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-brand text-ink-inverse hover:bg-brand-hover active:bg-brand-active shadow-e2 hover:shadow-e3',
  secondary:
    'bg-surface text-brand border border-brand/35 hover:bg-muted hover:border-brand/45',
  ghost:
    'bg-transparent text-brand hover:bg-brand/12 active:bg-brand/18',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 shadow-e2',
  amber: 'bg-amber-500 text-white hover:bg-amber-600 active:bg-amber-700 shadow-e2',
}

const sizeClasses: Record<Size, string> = {
  sm: 'h-9 px-4 text-body-sm rounded-lg gap-1.5',
  md: 'h-11 px-6 text-body rounded-xl gap-2',
  lg: 'h-13 px-8 text-body-lg rounded-2xl gap-2.5',
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    className,
    children,
    leftIcon,
    rightIcon,
    loading,
    fullWidth,
    disabled,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-sans font-semibold',
        'transition-colors duration-150 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        leftIcon
      )}
      <span>{children}</span>
      {!loading && rightIcon}
    </button>
  )
})

export default Button
export { Button }
