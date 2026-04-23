/**
 * 记忆条目卡片组件
 */
import { Calendar, MapPin, Tag } from 'lucide-react'
import { formatDate, EMOTION_LABELS } from '@/lib/utils'

interface MemoryCardProps {
  id: number
  title: string
  content_text: string
  timestamp?: string | null
  location?: string | null
  emotion_label?: string | null
  member_id: number
  archive_id: number
}

export default function MemoryCard({
  title, content_text, timestamp, location, emotion_label,
}: MemoryCardProps) {
  const emotionInfo = EMOTION_LABELS.find((e) => e.value === emotion_label)

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-base">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 truncate">{title}</h3>
          <p className="mt-2 text-sm text-gray-600 line-clamp-3">{content_text}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-gray-500">
        {timestamp && (
          <span className="flex items-center gap-1">
            <Calendar size={12} />
            {formatDate(timestamp)}
          </span>
        )}
        {location && (
          <span className="flex items-center gap-1">
            <MapPin size={12} />
            {location}
          </span>
        )}
        {emotion_label && emotionInfo && (
          <span
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-white"
            style={{ backgroundColor: emotionInfo.color }}
          >
            <Tag size={10} />
            {emotionInfo.label}
          </span>
        )}
      </div>
    </div>
  )
}
