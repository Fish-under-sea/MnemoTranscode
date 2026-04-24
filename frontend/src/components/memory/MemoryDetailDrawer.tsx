/**
 * 单条记忆详情 · 右侧抽屉（M2 正文 + M3 关联媒体区）
 */
import Drawer from '@/components/ui/Drawer'
import Button from '@/components/ui/Button'
import { Edit, Trash, MapPin, Calendar } from 'lucide-react'
import { formatDate, EMOTION_LABELS } from '@/lib/utils'

/** 与列表/接口一致的记忆结构 */
export interface MemoryRecord {
  id: number
  title: string
  content_text: string
  timestamp?: string | null
  location?: string | null
  emotion_label?: string | null
  member_id: number
  archive_id: number
}

export interface MemoryDetailDrawerProps {
  memory: MemoryRecord | null
  memberName: string
  onClose: () => void
  onEdit?: () => void
  onDelete?: () => void
  /** M3 接入后由父级传入 true 以展示 MediaGallery */
  showMediaGallery?: boolean
}

export default function MemoryDetailDrawer({
  memory,
  memberName,
  onClose,
  onEdit,
  onDelete,
  showMediaGallery = false,
}: MemoryDetailDrawerProps) {
  if (!memory) return null
  const emotionInfo = EMOTION_LABELS.find((e) => e.value === memory.emotion_label)

  return (
    <Drawer
      open={!!memory}
      onClose={onClose}
      title={memory.title}
      side="right"
      width="w-[min(480px,92vw)]"
    >
      <div className="flex flex-wrap items-center gap-3 text-caption text-ink-muted mb-4">
        {memory.timestamp && (
          <span className="inline-flex items-center gap-1">
            <Calendar size={12} />
            {formatDate(memory.timestamp)}
          </span>
        )}
        {memory.location && (
          <span className="inline-flex items-center gap-1">
            <MapPin size={12} />
            {memory.location}
          </span>
        )}
        {emotionInfo && (
          <span className="inline-flex items-center gap-1">
            <span
              style={{
                backgroundColor: emotionInfo.color,
                width: 6,
                height: 6,
                borderRadius: '50%',
                display: 'inline-block',
              }}
            />
            {emotionInfo.label}
          </span>
        )}
        <span className="ml-auto">隶属于 {memberName}</span>
      </div>

      <div className="max-w-none whitespace-pre-wrap text-body text-ink-primary leading-relaxed">
        {memory.content_text}
      </div>

      <div className="mt-6 pt-6 border-t border-border-default">
        <h3 className="text-body-lg font-medium text-ink-primary mb-3">关联媒体</h3>
        {showMediaGallery ? (
          <div className="text-body-sm text-ink-muted">请在 M3 集成后由 MediaGallery 渲染</div>
        ) : (
          <div className="text-body-sm text-ink-muted">M3 实现后这里会展示 Ta 的最近媒体。</div>
        )}
      </div>

      {(onEdit || onDelete) && (
        <div className="mt-6 pt-6 border-t border-border-default flex gap-2 flex-wrap">
          {onEdit && (
            <Button variant="ghost" leftIcon={<Edit size={16} />} onClick={onEdit}>
              编辑
            </Button>
          )}
          {onDelete && (
            <Button variant="danger" leftIcon={<Trash size={16} />} onClick={onDelete}>
              删除
            </Button>
          )}
        </div>
      )}
    </Drawer>
  )
}
