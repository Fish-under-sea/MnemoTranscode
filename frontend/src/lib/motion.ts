/**
 * 动效 preset 与通用 variants
 * ---------------------------------------------------------------
 * 对应 docs/design-system.md §5.2-§5.3 · 柔中带力 Confident
 *
 * 组件里**只引用本文件的 preset / variants**，不要到处硬编码 duration / ease /
 * spring 参数。这样整个设计系统的"节奏"就被这一处控制，改一处全局统一。
 *
 * 使用示例：
 *   import { motion } from 'motion/react'
 *   import { fadeUp, motionPresets } from '@/lib/motion'
 *
 *   <motion.div variants={fadeUp} initial="hidden" animate="visible" />
 *   <motion.div animate={{ y: 0 }} transition={motionPresets.confident} />
 */
import type { Transition, Variants } from 'motion/react'

/**
 * 6 档节奏 preset · docs/design-system.md §5.2
 *
 *   instant   · 状态反馈（按钮按下、checkbox 勾选）
 *   gentle    · 颜色/尺寸微调（hover、focus ring）
 *   confident · 主干节奏（面板进出、列表项揭开，spring 略带回弹）
 *   cinematic · 首屏大元素揭幕（hero、sectional reveal）
 *   pageEnter · 路由进场
 *   pageExit  · 路由离场（比进场快，让下一页先显得爽利）
 */
export const motionPresets = {
  instant:   { duration: 0.15, ease: [0.4, 0, 0.2, 1] } as Transition,
  gentle:    { duration: 0.25, ease: [0.16, 1, 0.3, 1] } as Transition,
  confident: { type: 'spring', stiffness: 260, damping: 28, mass: 0.9 } as Transition,
  cinematic: { duration: 0.6,  ease: [0.16, 1, 0.3, 1] } as Transition,
  pageEnter: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } as Transition,
  pageExit:  { duration: 0.25, ease: [0.4, 0, 0.6, 1] } as Transition,
} as const

// ============ 基础动画 Variants ============

/** 主干：向上淡入，Card/列表项/内容块都用它 */
export const fadeUp: Variants = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: motionPresets.confident },
}

/** 纯淡入，用于背景蒙层 / tooltip / subtle 状态切换 */
export const fadeIn: Variants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: motionPresets.gentle },
}

/** 缩放淡入，Modal / Popover / Dropdown 内容默认动作 */
export const scaleIn: Variants = {
  hidden:  { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: motionPresets.confident },
}

/** 右侧推入：Drawer 右侧 / 移动端侧滑 */
export const slideRight: Variants = {
  hidden:  { x: '100%' },
  visible: { x: 0, transition: motionPresets.confident },
  exit:    { x: '100%', transition: motionPresets.pageExit },
}

/** 左侧推入：Drawer 左侧 / 面包屑式后退 */
export const slideLeft: Variants = {
  hidden:  { x: '-100%' },
  visible: { x: 0, transition: motionPresets.confident },
  exit:    { x: '-100%', transition: motionPresets.pageExit },
}

/** 底部推入：移动端 ActionSheet / 底部 Drawer */
export const slideUp: Variants = {
  hidden:  { y: '100%' },
  visible: { y: 0, transition: motionPresets.confident },
  exit:    { y: '100%', transition: motionPresets.pageExit },
}

// ============ 复合模式 ============

/**
 * 列表 stagger 容器。子元素若用 fadeUp，会按 stagger 间隔依次揭开。
 *
 *   <motion.ul variants={staggerContainer(0.08)} initial="hidden" animate="visible">
 *     {items.map(x => <motion.li key={x.id} variants={fadeUp} />)}
 *   </motion.ul>
 */
export const staggerContainer = (stagger = 0.06): Variants => ({
  hidden:  {},
  visible: {
    transition: { staggerChildren: stagger, delayChildren: 0.05 },
  },
})

/** 路由页切换：PageTransition 组件默认用这个 */
export const pageTransition: Variants = {
  initial:  { opacity: 0, y: 8 },
  animate:  { opacity: 1, y: 0,  transition: motionPresets.pageEnter },
  exit:     { opacity: 0, y: -8, transition: motionPresets.pageExit },
}
