/**
 * Select · A 子项目基础组件
 * 基于 @radix-ui/react-select
 * 对应 docs/design-system.md §6.1
 */
import * as RadixSelect from '@radix-ui/react-select'
import { ChevronDown, Check } from 'lucide-react'
import { forwardRef } from 'react'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'
import { scaleIn } from '@/lib/motion'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps {
  value?: string
  defaultValue?: string
  onValueChange?: (v: string) => void
  options: SelectOption[]
  placeholder?: string
  label?: string
  disabled?: boolean
  className?: string
  triggerClassName?: string
  fullWidth?: boolean
}

const Select = forwardRef<HTMLButtonElement, SelectProps>(function Select(
  {
    value,
    defaultValue,
    onValueChange,
    options,
    placeholder = '请选择',
    label,
    disabled,
    className,
    triggerClassName,
    fullWidth,
  },
  ref,
) {
  return (
    <div className={cn('flex flex-col gap-1.5', fullWidth && 'w-full', className)}>
      {label && <span className="text-body-sm font-medium text-ink-secondary">{label}</span>}
      <RadixSelect.Root
        value={value}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
        disabled={disabled}
      >
        <RadixSelect.Trigger
          ref={ref}
          className={cn(
            'inline-flex items-center justify-between gap-2',
            'h-11 px-4 rounded-md bg-subtle text-body text-ink-primary',
            'border border-transparent hover:border-brand/40 focus:border-brand',
            'focus:outline-none focus:ring-2 focus:ring-brand/25',
            'transition-colors duration-150',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            fullWidth && 'w-full',
            triggerClassName,
          )}
        >
          <RadixSelect.Value placeholder={<span className="text-ink-muted">{placeholder}</span>} />
          <RadixSelect.Icon className="text-ink-muted">
            <ChevronDown size={16} />
          </RadixSelect.Icon>
        </RadixSelect.Trigger>
        <RadixSelect.Portal>
          <RadixSelect.Content position="popper" sideOffset={6} asChild>
            <motion.div
              variants={scaleIn}
              initial="hidden"
              animate="visible"
              className="z-50 overflow-hidden rounded-xl bg-surface border border-border-default shadow-e3 min-w-[var(--radix-select-trigger-width)]"
            >
              <RadixSelect.Viewport className="p-1">
                {options.map((opt) => (
                  <RadixSelect.Item
                    key={opt.value}
                    value={opt.value}
                    disabled={opt.disabled}
                    className={cn(
                      'relative flex items-center gap-2 px-3 py-2 rounded-md text-body text-ink-primary cursor-pointer',
                      'data-[highlighted]:bg-jade-50 data-[highlighted]:outline-none',
                      'data-[state=checked]:text-brand font-medium',
                      'data-[disabled]:opacity-40 data-[disabled]:cursor-not-allowed',
                      'dark:data-[highlighted]:bg-amber-400/10',
                    )}
                  >
                    <RadixSelect.ItemText>{opt.label}</RadixSelect.ItemText>
                    <RadixSelect.ItemIndicator className="ml-auto">
                      <Check size={14} />
                    </RadixSelect.ItemIndicator>
                  </RadixSelect.Item>
                ))}
              </RadixSelect.Viewport>
            </motion.div>
          </RadixSelect.Content>
        </RadixSelect.Portal>
      </RadixSelect.Root>
    </div>
  )
})

export default Select
export { Select }
