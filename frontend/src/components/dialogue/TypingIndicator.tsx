// frontend/src/components/dialogue/TypingIndicator.tsx
import { motion } from 'motion/react'

const dotVariants = {
  hidden: { y: 0, opacity: 0.4 },
  bounce: {
    y: [-4, 0],
    opacity: [1, 0.4],
    transition: { duration: 0.5, repeat: Infinity, repeatType: 'reverse' as const },
  },
}

export default function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-1 py-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          variants={dotVariants}
          initial="hidden"
          animate="bounce"
          style={{ transitionDelay: `${i * 0.15}s` }}
          transition={{ delay: i * 0.15, duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
          className="block w-2 h-2 rounded-full bg-ink-muted"
        />
      ))}
    </div>
  )
}
