/**
 * 档案卡片组件
 */
import type { CSSProperties, HTMLAttributes } from 'react'
import { Link } from 'react-router-dom'
import type { DraggableAttributes } from '@dnd-kit/core'
import { Users, FileText, MapPin, Pin, GripVertical } from 'lucide-react'
import { ARCHIVE_TYPE_OPTIONS, cn } from '@/lib/utils'
import { panelClassFromCardStyle, useThemeAppliedSnapshot } from '@/lib/theme'

interface ArchiveCardProps {
  id: number
  name: string
  description?: string | null
  archive_type: string
  member_count: number
  memory_count: number
  /** 国家/非遗档案：发源地与流传地域等单行预览 */
  heritageOriginPreview?: string | null
  isPinned?: boolean
  onTogglePin?: () => void
  pinBusy?: boolean
  onRename?: () => void
  onDelete?: () => void
  /** 拖拽排序手柄（仅用 listeners/attributes，避免整块卡片抢点击） */
  showDragHandle?: boolean
  dragHandleListeners?: HTMLAttributes<HTMLElement>
  dragHandleAttributes?: DraggableAttributes
  /** 整块卡片拖拽态（半透明） */
  isDragging?: boolean
  /** Sortable 根 ref + 变换样式 */
  sortableRef?: (node: HTMLElement | null) => void
  sortableStyle?: CSSProperties
  /** 与外层 grid `items-stretch` 配合：`h-full` 拉齐行高 */
  className?: string
}

export default function ArchiveCard({
  id,
  name,
  description,
  archive_type,
  member_count,
  memory_count,
  heritageOriginPreview,
  isPinned = false,
  onTogglePin,
  pinBusy = false,
  onRename,
  onDelete,
  showDragHandle = false,
  dragHandleListeners,
  dragHandleAttributes,
  isDragging = false,
  sortableRef,
  sortableStyle,
  className,
}: ArchiveCardProps) {
  const { cardStyle } = useThemeAppliedSnapshot()
  const typeInfo = ARCHIVE_TYPE_OPTIONS.find((t) => t.value === archive_type)
  const icon = typeInfo?.icon || '📁'
  const descText = typeof description === 'string' ? description.trim() : ''
  const originPreview =
    typeof heritageOriginPreview === 'string' ? heritageOriginPreview.trim() : ''

  return (
    <div
      ref={sortableRef}
      style={sortableStyle}
      className={cn(
        'relative rounded-xl p-4 transition-all hover:shadow-e3 hover:border-brand/35',
        panelClassFromCardStyle(cardStyle),
        'h-full min-h-[14.25rem] flex flex-col',
        isDragging ? 'opacity-75 ring-2 ring-brand/35 z-[1]' : '',
        className,
      )}
    >
      {onTogglePin ? (
        <button
          type="button"
          className={cn(
            'absolute top-2.5 right-2.5 z-20 rounded-lg p-1.5 text-brand',
            'hover:bg-brand/12 border border-transparent hover:border-brand/25',
            'transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
          )}
          aria-label={isPinned ? '取消置顶' : '置顶'}
          aria-pressed={isPinned}
          disabled={pinBusy}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onTogglePin()
          }}
        >
          <Pin
            className={cn(
              // 固定图示尺寸（非正文字阶）
              'h-[1.125rem] w-[1.125rem]',
              isPinned ? 'fill-current text-brand' : 'text-ink-muted',
            )}
          />
        </button>
      ) : null}

      <div className={cn('flex items-start shrink-0 gap-2 pr-11', showDragHandle ? 'pl-0' : '')}>
        {showDragHandle && dragHandleListeners ? (
          <button
            type="button"
            className={cn(
              'touch-none shrink-0 mt-0.5 p-1 rounded-lg cursor-grab active:cursor-grabbing',
              'text-ink-muted hover:text-brand hover:bg-brand/10 border border-transparent',
              'outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
            )}
            aria-label="拖动排序"
            {...dragHandleAttributes}
            {...dragHandleListeners}
          >
            <GripVertical size={18} aria-hidden />
          </button>
        ) : null}
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          <span className="text-2xl shrink-0 leading-none pt-0.5" aria-hidden>
            {icon}
          </span>
          <div className="min-w-0">
            <Link
              to={`/archives/${id}`}
              className="font-semibold text-ink-primary hover:text-brand transition-colors line-clamp-2 leading-snug min-h-[2.35rem] block"
              title={name}
            >
              {name}
            </Link>
            <p className="text-xs text-ink-muted mt-0.5 line-clamp-1">
              {typeInfo?.label || archive_type}
            </p>
            {originPreview ? (
              <p className="text-xs text-ink-secondary mt-1 flex items-start gap-1 line-clamp-2">
                <MapPin size={14} className="shrink-0 mt-0.5 text-ink-muted" aria-hidden />
                <span>{originPreview}</span>
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-2 shrink-0 min-h-[2.5rem]" aria-live="polite">
        {descText ? (
          <p className="text-sm text-ink-secondary line-clamp-2 leading-relaxed">{descText}</p>
        ) : (
          <span className="sr-only">无简介</span>
        )}
      </div>

      <div className="mt-3 flex items-center gap-4 text-xs text-ink-muted shrink-0 tabular-nums">
        <span className="flex items-center gap-1 min-w-0">
          <Users size={14} className="shrink-0 text-ink-muted" aria-hidden />
          {member_count} 位成员
        </span>
        <span className="flex items-center gap-1 min-w-0">
          <FileText size={14} className="shrink-0 text-ink-muted" aria-hidden />
          {memory_count} 条记忆
        </span>
      </div>

      <div className="mt-auto pt-3 shrink-0 border-t border-default space-y-1">
        <Link
          to={`/archives/${id}`}
          className="block w-full text-center py-1.5 text-sm font-medium text-brand hover:bg-brand/10 rounded-xl transition-colors cursor-pointer"
        >
          查看详情
        </Link>
        {onRename ? (
          <button
            type="button"
            className="block w-full text-center py-1.5 text-sm text-brand hover:bg-brand/10 rounded-xl transition-colors"
            onClick={onRename}
          >
            重命名
          </button>
        ) : null}
        {onDelete ? (
          <button
            type="button"
            className="block w-full text-center py-1.5 text-sm text-red-600 hover:bg-red-500/10 dark:hover:bg-red-500/15 rounded-xl transition-colors"
            onClick={onDelete}
          >
            删除档案
          </button>
        ) : null}
      </div>
    </div>
  )
}
