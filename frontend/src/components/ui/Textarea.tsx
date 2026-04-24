/**
 * Textarea · A 子项目基础组件
 * 对应 docs/design-system.md §6.1
 * - 自动高度（可选）
 * - 字符计数（传 maxLength 时自动显示）
 */
import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type MutableRefObject,
  type TextareaHTMLAttributes,
} from 'react'
import { cn } from '@/lib/utils'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  hint?: string
  error?: string
  autoGrow?: boolean
  fullWidth?: boolean
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    label,
    hint,
    error,
    className,
    autoGrow,
    fullWidth,
    id,
    maxLength,
    value,
    defaultValue,
    onChange,
    ...rest
  },
  ref,
) {
  const autoId = useId()
  const taId = id ?? autoId
  const innerRef = useRef<HTMLTextAreaElement | null>(null)
  const [len, setLen] = useState<number>(
    typeof value === 'string'
      ? value.length
      : typeof defaultValue === 'string'
        ? defaultValue.length
        : 0,
  )

  useEffect(() => {
    if (!autoGrow) return
    const el = innerRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [autoGrow, value])

  return (
    <div className={cn('flex flex-col gap-1.5', fullWidth && 'w-full')}>
      {label && (
        <label htmlFor={taId} className="text-body-sm font-medium text-ink-secondary">
          {label}
        </label>
      )}
      <textarea
        ref={(el) => {
          innerRef.current = el
          if (typeof ref === 'function') ref(el)
          else if (ref) (ref as MutableRefObject<HTMLTextAreaElement | null>).current = el
        }}
        id={taId}
        maxLength={maxLength}
        value={value}
        defaultValue={defaultValue}
        onChange={(e) => {
          setLen(e.target.value.length)
          onChange?.(e)
        }}
        aria-invalid={Boolean(error)}
        className={cn(
          'min-h-24 w-full rounded-md bg-subtle text-ink-primary placeholder:text-ink-muted',
          'border border-transparent focus:border-brand',
          'focus:outline-none focus:ring-2 focus:ring-brand/25',
          'px-4 py-3 text-body',
          'resize-y transition-colors duration-150',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          error && 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/25',
          className,
        )}
        {...rest}
      />
      <div className="flex items-start justify-between gap-2">
        <span className={cn('text-caption', error ? 'text-rose-600' : 'text-ink-muted')}>
          {error ?? hint ?? ''}
        </span>
        {typeof maxLength === 'number' && (
          <span className="text-caption text-ink-muted tabular-nums">
            {len}/{maxLength}
          </span>
        )}
      </div>
    </div>
  )
})

export default Textarea
export { Textarea }
