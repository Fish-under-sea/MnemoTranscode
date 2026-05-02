/**
 * Avatar · 头像
 * 对应 docs/design-system.md §6.3
 * - 图片 / initials 回落
 * - AvatarGroup 叠加
 */
import * as RadixAvatar from '@radix-ui/react-avatar'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import type { HTMLAttributes, ReactNode } from 'react'

export interface AvatarProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  src?: string
  name: string
  size?: number
  shape?: 'circle' | 'square'
  /** 无图或图片加载失败时展示（覆盖默认首字母） */
  fallback?: ReactNode
}

function initials(name: string) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function Avatar({
  src,
  name,
  size = 40,
  shape = 'circle',
  className,
  fallback,
  ...rest
}: AvatarProps) {
  /** 仅在「曾经有 src 且解码失败」时隐藏 Image，迫使走 Fallback（首字母或自定义占位） */
  const [imgOk, setImgOk] = useState(true)
  useEffect(() => {
    setImgOk(true)
  }, [src])
  /** Radix Fallback：有任何有效 src 时勿用 delayMs=0，否则 Layers 等与 Image 争抢首帧易盖住成功加载的图（国线封面尤甚） */
  const hasRenderableSrc = typeof src === 'string' && !!src.trim()
  const fallbackDelayMs = hasRenderableSrc ? 600 : fallback ? 0 : 300
  return (
    <RadixAvatar.Root
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden bg-jade-100 text-jade-700 font-semibold select-none',
        shape === 'circle' ? 'rounded-full' : 'rounded-lg',
        'dark:bg-amber-400/20 dark:text-amber-200',
        fallback && 'text-ink-muted dark:text-ink-muted',
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      {...rest}
    >
      {src && imgOk && (
        <RadixAvatar.Image
          src={src}
          alt={name}
          className="w-full h-full object-cover"
          onError={() => setImgOk(false)}
        />
      )}
      <RadixAvatar.Fallback delayMs={fallbackDelayMs} className="leading-none flex items-center justify-center">
        {fallback ?? initials(name)}
      </RadixAvatar.Fallback>
    </RadixAvatar.Root>
  )
}

export function AvatarGroup({
  children,
  max = 4,
  size = 32,
}: {
  children: ReactNode
  max?: number
  size?: number
}) {
  const arr = Array.isArray(children) ? children : [children]
  const visible = arr.slice(0, max)
  const rest = arr.length - visible.length
  return (
    <div className="inline-flex items-center">
      {visible.map((c, i) => (
        <div key={i} className="-ml-2 first:ml-0 ring-2 ring-surface rounded-full">
          {c}
        </div>
      ))}
      {rest > 0 && (
        <div
          className="-ml-2 inline-flex items-center justify-center rounded-full bg-subtle text-ink-secondary text-caption font-semibold ring-2 ring-surface"
          style={{ width: size, height: size }}
        >
          +{rest}
        </div>
      )}
    </div>
  )
}
