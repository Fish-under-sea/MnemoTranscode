/**
 * ScrollReveal · 滚动进入视口时触发动画
 * 对应 docs/design-system.md §6.4 + §5.3
 * - 直接用 motion 的 whileInView（尊重 reduced-motion）
 * - direction / delay / stagger 可控
 */
import { motion, type Variants } from 'motion/react'
import type { ReactNode } from 'react'
import { motionPresets } from '@/lib/motion'

type Direction = 'up' | 'down' | 'left' | 'right' | 'none'

export interface ScrollRevealProps {
  children: ReactNode
  direction?: Direction
  distance?: number
  delay?: number
  once?: boolean
  className?: string
}

const offsetMap: Record<Direction, (d: number) => Record<string, number>> = {
  up: (d) => ({ y: d }),
  down: (d) => ({ y: -d }),
  left: (d) => ({ x: d }),
  right: (d) => ({ x: -d }),
  none: () => ({}),
}

export default function ScrollReveal({
  children,
  direction = 'up',
  distance = 24,
  delay = 0,
  once = true,
  className,
}: ScrollRevealProps) {
  const variants: Variants = {
    hidden: { opacity: 0, ...offsetMap[direction](distance) },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: { ...motionPresets.confident, delay },
    },
  }
  return (
    <motion.div
      variants={variants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin: '-10%' }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function ScrollRevealGroup({
  children,
  stagger = 0.08,
  className,
}: {
  children: ReactNode
  stagger?: number
  className?: string
}) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-10%' }}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: stagger, delayChildren: 0.05 } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
