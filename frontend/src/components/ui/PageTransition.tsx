/**
 * PageTransition · 路由级页面过渡
 * 对应 docs/design-system.md §6.4
 * - 用法：在 <Routes> 外包一层 <AnimatePresence>，子路由用本组件包裹
 * - 或作为 Outlet 包装器
 */
import { AnimatePresence, motion } from 'motion/react'
import { useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { pageTransition } from '@/lib/motion'
import { cn } from '@/lib/utils'

export default function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation()
  /** 对话页：与 Layout main 等高，避免 min-h 与百分比链条断裂导致整页误滚条 */
  const dialogueImmersive = location.pathname.startsWith('/dialogue')
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        variants={pageTransition}
        initial="initial"
        animate="animate"
        exit="exit"
        className={cn('min-h-full', dialogueImmersive && 'h-full min-h-0')}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
