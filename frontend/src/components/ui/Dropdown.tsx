/**
 * Dropdown · 下拉菜单
 * 对应 docs/design-system.md §6.2
 * - 基于 @radix-ui/react-dropdown-menu
 */
import * as RadixDropdown from '@radix-ui/react-dropdown-menu'
import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { scaleIn } from '@/lib/motion'

export interface DropdownItem {
  label?: string
  onSelect?: () => void
  icon?: ReactNode
  danger?: boolean
  disabled?: boolean
  separator?: boolean
}

export interface DropdownProps {
  trigger: ReactNode
  items: DropdownItem[]
  align?: 'start' | 'center' | 'end'
  className?: string
}

export default function Dropdown({ trigger, items, align = 'end', className }: DropdownProps) {
  return (
    <RadixDropdown.Root>
      <RadixDropdown.Trigger asChild>{trigger}</RadixDropdown.Trigger>
      <RadixDropdown.Portal>
        <RadixDropdown.Content align={align} sideOffset={6} asChild>
          <motion.div
            variants={scaleIn}
            initial="hidden"
            animate="visible"
            className={cn(
              'z-50 min-w-40 rounded-xl bg-surface border border-border-default shadow-e3 p-1',
              className,
            )}
          >
            {items.map((item, i) =>
              item.separator ? (
                <RadixDropdown.Separator key={`sep-${i}`} className="my-1 h-px bg-border-default" />
              ) : (
                <RadixDropdown.Item
                  key={`${item.label ?? 'item'}-${i}`}
                  onSelect={item.onSelect}
                  disabled={item.disabled}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-md text-body-sm cursor-pointer',
                    'text-ink-primary data-[highlighted]:bg-jade-50 data-[highlighted]:outline-none',
                    'data-[disabled]:opacity-40 data-[disabled]:cursor-not-allowed',
                    'dark:data-[highlighted]:bg-amber-400/10',
                    item.danger && 'text-rose-600 data-[highlighted]:bg-rose-50 dark:data-[highlighted]:bg-rose-400/10',
                  )}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </RadixDropdown.Item>
              ),
            )}
          </motion.div>
        </RadixDropdown.Content>
      </RadixDropdown.Portal>
    </RadixDropdown.Root>
  )
}
