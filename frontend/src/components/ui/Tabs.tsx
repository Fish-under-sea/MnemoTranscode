/**
 * Tabs · 标签页
 * 对应 docs/design-system.md §6.2
 * - 基于 @radix-ui/react-tabs
 * - 两种样式：underline / pill
 */
import * as RadixTabs from '@radix-ui/react-tabs'
import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { motionPresets } from '@/lib/motion'

export interface TabsProps {
  items: { value: string; label: string; content: ReactNode; disabled?: boolean }[]
  defaultValue?: string
  value?: string
  onValueChange?: (v: string) => void
  variant?: 'underline' | 'pill'
  className?: string
}

export default function Tabs({
  items,
  defaultValue,
  value,
  onValueChange,
  variant = 'underline',
  className,
}: TabsProps) {
  const uncontrolledDefault = defaultValue ?? items[0]?.value
  return (
    <RadixTabs.Root
      className={cn('flex flex-col gap-4', className)}
      value={value}
      defaultValue={value === undefined ? uncontrolledDefault : undefined}
      onValueChange={onValueChange}
    >
      <RadixTabs.List
        className={cn(
          'inline-flex items-center gap-1',
          variant === 'underline' && 'border-b border-border-default',
          variant === 'pill' && 'p-1 rounded-full bg-subtle w-fit',
        )}
      >
        {items.map((item) => (
          <RadixTabs.Trigger
            key={item.value}
            value={item.value}
            disabled={item.disabled}
            className={cn(
              'relative px-4 py-2 text-body-sm font-medium text-ink-secondary',
              'transition-colors duration-150',
              'data-[state=active]:text-brand',
              'data-[disabled]:opacity-40 data-[disabled]:cursor-not-allowed',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 rounded-md',
              variant === 'pill' && 'rounded-full data-[state=active]:bg-surface data-[state=active]:shadow-e1',
            )}
          >
            {item.label}
            {variant === 'underline' && (
              <span
                className={cn(
                  'absolute left-2 right-2 -bottom-px h-0.5 rounded-full bg-brand',
                  'opacity-0 data-[state=active]:opacity-100',
                )}
              />
            )}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {items.map((item) => (
        <RadixTabs.Content key={item.value} value={item.value} asChild>
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={motionPresets.gentle}
            className="focus-visible:outline-none"
          >
            {item.content}
          </motion.div>
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  )
}
