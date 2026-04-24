/**
 * Skeleton · 骨架屏
 * 对应 docs/design-system.md §6.3
 * - 子组件：Line / Circle / Card
 * - 呼吸动效；遵循 prefers-reduced-motion（通过 Tailwind animate-pulse-soft）
 */
import { cn } from '@/lib/utils'

function base(className?: string) {
  return cn('bg-muted animate-pulse-soft rounded-md', className)
}

export function SkeletonLine({ className }: { className?: string }) {
  return <div className={base(cn('h-4 w-full', className))} />
}

export function SkeletonCircle({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <div className={cn(base(), 'rounded-full', className)} style={{ width: size, height: size }} />
  )
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'p-4 rounded-2xl bg-surface border border-border-default flex flex-col gap-3',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <SkeletonCircle />
        <div className="flex flex-col gap-2 flex-1">
          <SkeletonLine className="h-3 w-1/3" />
          <SkeletonLine className="h-3 w-1/5" />
        </div>
      </div>
      <SkeletonLine />
      <SkeletonLine className="w-5/6" />
      <SkeletonLine className="w-2/3" />
    </div>
  )
}

const Skeleton = { Line: SkeletonLine, Circle: SkeletonCircle, Card: SkeletonCard }
export default Skeleton
