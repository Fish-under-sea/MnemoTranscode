import { cn } from '@/lib/utils'

/**
 * 国家记忆条线统一「半透明白药丸」肌理（与白边液态大卡解耦）。
 * — border-white · bg-white/45 · 墨色字 · Layers 前缀由上层组件挂载
 * — 无 shadow、无 backdrop-blur、不使用 mtc-liquid-glass
 */
export function nationalCapsuleSurfaceBase(extra?: string) {
  return cn(
    'inline-flex shrink-0 items-center justify-center font-sans font-semibold text-ink-secondary shadow-none',
    'rounded-full border border-white bg-white/[0.45]',
    'dark:border-white/[0.34] dark:bg-white/[0.12] dark:text-ink-muted',
    extra,
  )
}

/** 仅用展示（徽章、说明性 span），不参与 hover */
export function nationalCapsuleTagStaticClass(extra?: string) {
  return nationalCapsuleSurfaceBase(cn('h-5 min-h-5 gap-1 px-2 text-caption', extra))
}

const nationalCapsuleButtonInteractTailwind = cn(
  'transition-colors hover:bg-white/55 hover:text-ink-primary active:bg-white/[0.6]',
  'dark:hover:bg-white/[0.16] dark:hover:text-ink-primary dark:active:bg-white/[0.2]',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
  'disabled:opacity-50 disabled:cursor-not-allowed',
)

/** 可操作块：封面/头像/著录提交 */
export function nationalCapsuleControlButtonClass(extra?: string) {
  return nationalCapsuleSurfaceBase(
    cn(
      'h-9 min-h-[2.25rem] gap-2 px-4 text-body-sm',
      nationalCapsuleButtonInteractTailwind,
      extra,
    ),
  )
}

/** 列表区工具条：略矮，仍可点 */
export function nationalCapsuleToolbarButtonClass(extra?: string) {
  return nationalCapsuleSurfaceBase(
    cn(
      'h-8 min-h-8 gap-1.5 px-3 text-body-sm',
      nationalCapsuleButtonInteractTailwind,
      extra,
    ),
  )
}

/** tag 徽章「md」与设计系统 Badge md 同高 */
export function nationalCapsuleTagStaticClassMd(extra?: string) {
  return nationalCapsuleSurfaceBase(
    cn('h-6 min-h-6 gap-1.5 px-2.5 text-body-sm', extra),
  )
}

export function nationalCapsuleBadgeIconSize(size: 'sm' | 'md') {
  return size === 'md' ? 14 : 12
}

export function nationalCapsuleLayersSizeControl() {
  return nationalCapsuleBadgeIconSize('md')
}
