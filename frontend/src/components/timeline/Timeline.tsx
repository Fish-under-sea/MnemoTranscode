/**
 * 记忆时间线组件
 */
import { formatDate } from '@/lib/utils'
import { Circle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TimelineItem {
  id: number
  title: string
  description?: string
  year?: string | number
  timestamp?: string | null
  emotion_label?: string | null
  memory_count?: number
}

interface TimelineProps {
  items: TimelineItem[]
  onItemClick?: (item: TimelineItem) => void
}

export default function Timeline({ items, onItemClick }: TimelineProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        暂无时间线数据
      </div>
    )
  }

  return (
    <div className="relative">
      {/* 时间线中轴 */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-primary-200" />

      <div className="space-y-6">
        {items.map((item, index) => (
          <div
            key={item.id}
            className="relative flex gap-4 pl-12 cursor-pointer group"
            onClick={() => onItemClick?.(item)}
          >
            {/* 时间线节点 */}
            <div
              className={cn(
                'absolute left-0 w-8 h-8 rounded-full flex items-center justify-center z-10 transition-base',
                'bg-white border-2 border-primary-300 group-hover:border-primary-500 group-hover:scale-110'
              )}
            >
              <Circle
                size={12}
                className={cn(
                  'transition-base',
                  index === 0 ? 'fill-primary-500 text-primary-500' : 'text-primary-300'
                )}
              />
            </div>

            {/* 内容卡片 */}
            <div className="flex-1 bg-white rounded-xl border border-gray-200 p-4 group-hover:shadow-md group-hover:border-primary-200 transition-base">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900">{item.title}</h3>
                {item.year && (
                  <span className="text-xs font-medium text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">
                    {item.year}
                  </span>
                )}
              </div>
              {item.description && (
                <p className="mt-2 text-sm text-gray-600">{item.description}</p>
              )}
              <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
                {item.timestamp && <span>{formatDate(item.timestamp)}</span>}
                {item.memory_count !== undefined && (
                  <span>{item.memory_count} 条记忆</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
