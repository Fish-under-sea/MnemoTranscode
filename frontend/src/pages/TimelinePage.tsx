/**
 * 记忆时间线页面
 */
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { archiveApi, memoryApi } from '@/services/api'
import Timeline from '@/components/timeline/Timeline'

export default function TimelinePage() {
  const { archiveId } = useParams<{ archiveId: string }>()

  const { data: archive } = useQuery({
    queryKey: ['archive', archiveId],
    queryFn: () => archiveApi.get(Number(archiveId)) as any,
    enabled: !!archiveId,
  })

  const { data: members = [] } = useQuery({
    queryKey: ['members', archiveId],
    queryFn: () => archiveApi.listMembers(Number(archiveId)) as any,
    enabled: !!archiveId,
  })

  const { data: allMemories = [] } = useQuery({
    queryKey: ['memories', 'archive', archiveId],
    queryFn: () => memoryApi.list({ archive_id: Number(archiveId), limit: 200 }) as any,
    enabled: !!archiveId,
  })

  const timelineItems = allMemories
    .map((m: any) => ({
      id: m.id,
      title: m.title,
      description: m.content_text.slice(0, 100) + (m.content_text.length > 100 ? '...' : ''),
      year: m.timestamp ? new Date(m.timestamp).getFullYear() : undefined,
      timestamp: m.timestamp,
      emotion_label: m.emotion_label,
      memory_count: 1,
    }))
    .sort((a: any, b: any) => {
      if (a.timestamp && b.timestamp) return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      return 0
    })

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{archive?.name} — 记忆时间线</h1>
        <p className="text-gray-500 mt-1">
          共 {allMemories.length} 条记忆，按时间顺序排列
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <Timeline items={timelineItems} />
      </div>
    </div>
  )
}
