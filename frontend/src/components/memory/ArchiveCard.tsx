/**
 * 档案卡片组件
 */
import { Link } from 'react-router-dom'
import { Users, FileText } from 'lucide-react'
import { ARCHIVE_TYPE_OPTIONS } from '@/lib/utils'

interface ArchiveCardProps {
  id: number
  name: string
  description?: string | null
  archive_type: string
  member_count: number
  memory_count: number
  onDelete?: () => void
}

export default function ArchiveCard({
  id, name, description, archive_type, member_count, memory_count,
  onDelete,
}: ArchiveCardProps) {
  const typeInfo = ARCHIVE_TYPE_OPTIONS.find((t) => t.value === archive_type)
  const icon = typeInfo?.icon || '📁'

  return (
    <div className="bg-white rounded-xl border border-warm-200 p-5 hover:shadow-glass hover:border-jade-200 transition-all">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <div>
            <Link
              to={`/archives/${id}`}
              className="font-semibold text-slate-900 hover:text-jade-600 transition-colors"
            >
              {name}
            </Link>
            <p className="text-xs text-slate-400 mt-0.5">
              {typeInfo?.label || archive_type}
            </p>
          </div>
        </div>
      </div>

      {description && (
        <p className="mt-3 text-sm text-slate-500 line-clamp-2">{description}</p>
      )}

      <div className="mt-4 flex items-center gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1">
          <Users size={14} />
          {member_count} 位成员
        </span>
        <span className="flex items-center gap-1">
          <FileText size={14} />
          {memory_count} 条记忆
        </span>
      </div>

      <div className="mt-4 pt-4 border-t border-warm-100 space-y-1">
        <Link
          to={`/archives/${id}`}
          className="block w-full text-center py-2 text-sm text-jade-600 hover:bg-jade-50 rounded-xl transition-colors font-medium cursor-pointer"
        >
          查看详情
        </Link>
        {onDelete ? (
          <button
            type="button"
            className="block w-full text-center py-2 text-sm text-red-600 hover:bg-red-50 rounded-xl transition-colors"
            onClick={onDelete}
          >
            删除档案
          </button>
        ) : null}
      </div>
    </div>
  )
}
