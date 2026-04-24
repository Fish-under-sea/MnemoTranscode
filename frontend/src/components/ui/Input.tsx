/**
 * Input · A 子项目基础组件
 * 对应 docs/design-system.md §6.1
 * - label / hint / error 三 slot
 * - 前后缀 icon
 */
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string
  hint?: string
  error?: string
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
}

const sizeH: Record<NonNullable<InputProps['size']>, string> = {
  sm: 'h-9 text-body-sm',
  md: 'h-11 text-body',
  lg: 'h-13 text-body-lg',
}

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, leftIcon, rightIcon, className, size = 'md', fullWidth, id, ...rest },
  ref,
) {
  const autoId = useId()
  const inputId = id ?? autoId
  const hasError = Boolean(error)

  return (
    <div className={cn('flex flex-col gap-1.5', fullWidth && 'w-full')}>
      {label && (
        <label htmlFor={inputId} className="text-body-sm font-medium text-ink-secondary">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {leftIcon && (
          <span className="absolute left-3 flex items-center text-ink-muted pointer-events-none">
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={hasError}
          aria-describedby={hint || error ? `${inputId}-desc` : undefined}
          className={cn(
            'w-full rounded-md bg-subtle text-ink-primary placeholder:text-ink-muted',
            'border border-transparent focus:border-brand',
            'focus:outline-none focus:ring-2 focus:ring-brand/25',
            'transition-colors duration-150 ease-out',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            sizeH[size],
            leftIcon ? 'pl-10' : 'pl-4',
            rightIcon ? 'pr-10' : 'pr-4',
            hasError && 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/25',
            className,
          )}
          {...rest}
        />
        {rightIcon && (
          <span className="absolute right-3 flex items-center text-ink-muted">{rightIcon}</span>
        )}
      </div>
      {(hint || error) && (
        <span
          id={`${inputId}-desc`}
          className={cn('text-caption', hasError ? 'text-rose-600' : 'text-ink-muted')}
        >
          {error ?? hint}
        </span>
      )}
    </div>
  )
})

export default Input
export { Input }
