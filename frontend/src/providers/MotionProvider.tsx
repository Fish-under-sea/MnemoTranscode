/**
 * MotionProvider · 全局动效配置
 * ---------------------------------------------------------------
 * 对应 docs/design-system.md §5.4 · 动效可访问性。
 *
 * 职责：
 *   1. 用 motion 的 MotionConfig 全局生效 `reducedMotion="user"`——当用户在
 *      系统里勾选"减少动画"（OS 级 prefers-reduced-motion: reduce）时，所有
 *      motion 组件会自动把过渡时长降到 0，而不必在每个组件里逐个处理。
 *   2. 未来若需要全局统一 transition 默认值或 layout 共享 Context，也集中在这里。
 *
 * 使用：挂在 App.tsx 最外层（路由之外），整棵树共享。
 */
import { MotionConfig } from 'motion/react'
import type { ReactNode } from 'react'

export default function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      {children}
    </MotionConfig>
  )
}
