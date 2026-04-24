/**
 * 设计系统 · UI 组件 barrel export
 * ---------------------------------------------------------------
 * 对应 docs/design-system.md §7 / plan M6·任务 24.1。
 *
 * 使用：
 *   import { Button, Card, Modal, toast } from '@/components/ui'
 *
 * 不要从单文件 `@/components/ui/Button` 等深层路径 import——这会绕过 barrel
 * 导致 IDE 自动 import 混乱、打破 re-export 的类型归一。
 */

// ========== M3 · 输入类 ==========
export { default as Button, type ButtonProps } from './Button'
export { default as Input, type InputProps } from './Input'
export { default as Textarea, type TextareaProps } from './Textarea'
export { default as Select, type SelectProps, type SelectOption } from './Select'
export { default as ConfirmDialog, type ConfirmDialogProps } from './ConfirmDialog'

// ========== M4 · 容器与导航 ==========
export { default as Card, type CardProps } from './Card'
export { default as Modal, type ModalProps } from './Modal'
export { default as Drawer, type DrawerProps } from './Drawer'
export { default as Tabs, type TabsProps } from './Tabs'
export { default as Dropdown, type DropdownProps, type DropdownItem } from './Dropdown'

// ========== M5 · 反馈与动效基座 ==========
export { toast, ToastHost } from './Toast'
export { default as Skeleton, SkeletonLine, SkeletonCircle, SkeletonCard } from './Skeleton'
export { default as Badge, type BadgeProps } from './Badge'
export { default as Avatar, AvatarGroup, type AvatarProps } from './Avatar'
export { default as PageTransition } from './PageTransition'
export { default as ScrollReveal, ScrollRevealGroup, type ScrollRevealProps } from './ScrollReveal'
export * from './state'
