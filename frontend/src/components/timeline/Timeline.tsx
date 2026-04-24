/**
 * 时间线：按年份轴 + 情感色节点 + stagger
 */
import { motion } from 'motion/react'
import { staggerContainer, fadeUp } from '@/lib/motion'
import ScrollReveal from '@/components/ui/ScrollReveal'
import { EMOTION_LABELS } from '@/lib/utils'
import type { TimelineGroup } from '@/lib/timelineUtils'
import type { Memory } from '@/services/memoryTypes'

interface TimelineProps {
  groups: TimelineGroup[]
  onItemClick?: (m: Memory) => void
}

export default function Timeline({ groups, onItemClick }: TimelineProps) {
  if (groups.length === 0) {
    return null
  }

  return (
    <div className="relative">
      <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-jade-100 dark:bg-amber-400/20" />

      <div className="flex flex-col gap-8">
        {groups.map((group) => (
          <ScrollReveal key={group.year === null ? 'no-year' : String(group.year)}>
            <div className="relative">
              <div className="flex items-center gap-3 mb-4 ml-12">
                <span className="text-display-sm font-serif text-jade-700 tabular-nums">
                  {group.year === null ? '未标注时间' : group.year}
                </span>
                <span className="text-caption text-ink-muted">{group.items.length} 条记忆</span>
              </div>

              <motion.div
                variants={staggerContainer()}
                initial="hidden"
                animate="visible"
                className="flex flex-col gap-4"
              >
                {group.items.map((m) => {
                  const emotion = EMOTION_LABELS.find((e) => e.value === m.emotion_label)
                  const nodeColor = emotion?.color ?? '#059669'
                  return (
                    <motion.div
                      key={m.id}
                      layout
                      variants={fadeUp}
                      className="relative pl-12 cursor-pointer group"
                      onClick={() => onItemClick?.(m)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          onItemClick?.(m)
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <span
                        className="absolute left-3 top-4 w-4 h-4 rounded-full border-2 border-white shadow-e1"
                        style={{ backgroundColor: nodeColor }}
                      />
                      <div className="rounded-xl bg-surface border border-border-default p-4 group-hover:shadow-e2 transition-shadow duration-200">
                        <h3 className="text-body-lg font-medium text-ink-primary">{m.title}</h3>
                        <p className="text-body-sm text-ink-secondary line-clamp-2 mt-1">{m.content_text}</p>
                      </div>
                    </motion.div>
                  )
                })}
              </motion.div>
            </div>
          </ScrollReveal>
        ))}
      </div>
    </div>
  )
}
