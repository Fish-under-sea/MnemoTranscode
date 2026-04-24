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
}

function initials(name: string) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function Avatar({ src, name, size = 40, shape = 'circle', className, ...rest }: AvatarProps) {
  const [imgOk, setImgOk] = useState(true)
  useEffect(() => {
    setImgOk(true)
  }, [src])
  return (
    <RadixAvatar.Root
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden bg-jade-100 text-jade-700 font-semibold select-none',
        shape === 'circle' ? 'rounded-full' : 'rounded-lg',
        'dark:bg-amber-400/20 dark:text-amber-200',
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
      <RadixAvatar.Fallback delayMs={300} className="leading-none">
        {initials(name)}
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
