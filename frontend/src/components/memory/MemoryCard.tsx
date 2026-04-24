/**
 * 记忆条目卡片组件（A 基座 + 情感色点 + 可选点击）
 */
import { Calendar, MapPin } from 'lucide-react'
import { motion } from 'motion/react'
import Card from '@/components/ui/Card'
import { formatDate, EMOTION_LABELS } from '@/lib/utils'
import { motionPresets } from '@/lib/motion'

export interface MemoryCardData {
  id: number
  title: string
  content_text: string
  timestamp?: string | null
  location?: string | null
  emotion_label?: string | null
  member_id: number
  archive_id: number
}

interface MemoryCardProps extends MemoryCardData {
  onClick?: () => void
  /** 1–3 个预览图 URL，M3 后由父组件传入 */
  mediaPreview?: string[]
  /** list：较长摘要；grid：两行使列表更整齐 */
  variant?: 'grid' | 'list'
}

export default function MemoryCard({
  title,
  content_text,
  timestamp,
  location,
  emotion_label,
  onClick,
  mediaPreview,
  variant = 'grid',
}: MemoryCardProps) {
  const emotionInfo = EMOTION_LABELS.find((e) => e.value === emotion_label)
  const lineClamp = variant === 'list' ? 'line-clamp-3' : 'line-clamp-2'

  const body = (
    <Card
      hoverable
      variant="plain"
      padding="md"
      className="h-full w-full"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-lg text-ink-primary truncate">{title}</h3>
          <p className={`mt-2 text-body text-ink-secondary ${lineClamp}`}>{content_text}</p>
        </div>
      </div>

      {mediaPreview && mediaPreview.length > 0 && (
        <div
          className={`mt-3 grid gap-1.5 ${
            mediaPreview.length >= 3 ? 'grid-cols-3' : mediaPreview.length === 2 ? 'grid-cols-2' : 'grid-cols-1'
          }`}
        >
          {mediaPreview.slice(0, 3).map((url, i) => (
            <div
              key={i}
              className="aspect-video rounded-lg overflow-hidden bg-subtle border border-border-default"
            >
              <img src={url} alt="" className="h-full w-full object-cover" />
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3 text-caption text-ink-muted">
        {timestamp && (
          <span className="inline-flex items-center gap-1">
            <Calendar size={12} />
            {formatDate(timestamp)}
          </span>
        )}
        {location && (
          <span className="inline-flex items-center gap-1">
            <MapPin size={12} />
            {location}
          </span>
        )}
        {emotion_label && emotionInfo && (
          <div className="inline-flex items-center gap-1.5">
            <span
              style={{
                backgroundColor: emotionInfo.color,
                width: 6,
                height: 6,
                borderRadius: '50%',
                display: 'inline-block',
              }}
            />
            <span className="text-caption text-ink-muted">{emotionInfo.label}</span>
          </div>
        )}
      </div>
    </Card>
  )

  if (onClick) {
    return (
      <motion.div whileHover={{ y: -2 }} transition={motionPresets.confident}>
        <button type="button" onClick={onClick} className="block w-full text-left p-0 border-0 bg-transparent cursor-pointer">
          {body}
        </button>
      </motion.div>
    )
  }

  return (
    <motion.div whileHover={{ y: -2 }} transition={motionPresets.confident}>
      {body}
    </motion.div>
  )
}
