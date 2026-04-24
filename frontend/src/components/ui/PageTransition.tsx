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

export default function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        variants={pageTransition}
        initial="initial"
        animate="animate"
        exit="exit"
        className="min-h-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
