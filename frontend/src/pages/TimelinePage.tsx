/**
 * 档案下记忆时间线：三筛选 + 按年分组 + 抽屉
 */
import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { archiveApi, memoryApi } from '@/services/api'
import type { Memory } from '@/services/memoryTypes'
import { groupMemoriesByYear } from '@/lib/timelineUtils'
import Timeline from '@/components/timeline/Timeline'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { LoadingState, ErrorState, EmptyState } from '@/components/ui'
import MemoryDetailDrawer from '@/components/memory/MemoryDetailDrawer'
import { EMOTION_LABELS, RADIX_SELECT_ALL } from '@/lib/utils'
import { useApiError } from '@/hooks/useApiError'

const LIMIT = 100

export default function TimelinePage() {
  const queryClient = useQueryClient()
  const { show } = useApiError()
  const { archiveId } = useParams<{ archiveId: string }>()
  const [memberFilter, setMemberFilter] = useState(RADIX_SELECT_ALL)
  const [emotionFilter, setEmotionFilter] = useState(RADIX_SELECT_ALL)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [activeMemory, setActiveMemory] = useState<Memory | null>(null)

  const { data: archive, isLoading: aLoad, error: aErr, refetch: aRef } = useQuery({
    queryKey: ['archive', archiveId],
    queryFn: () => archiveApi.get(Number(archiveId)) as any,
    enabled: !!archiveId,
  })

  const { data: members = [] } = useQuery({
    queryKey: ['members', archiveId],
    queryFn: () => archiveApi.listMembers(Number(archiveId)) as any,
    enabled: !!archiveId,
  })

  const { data: allMemories = [], isLoading, error, refetch } = useQuery({
    queryKey: ['memories', 'archive', archiveId, LIMIT],
    queryFn: () => memoryApi.list({ archive_id: Number(archiveId), limit: LIMIT }) as any,
    enabled: !!archiveId,
  })

  const memberOptions = useMemo(
    () => [
      { value: RADIX_SELECT_ALL, label: '全部成员' },
      ...((members as { id: number; name: string }[]).map((m) => ({
        value: String(m.id),
        label: m.name,
      })) ),
    ],
    [members],
  )

  const emotionOptions = useMemo(
    () => [
      { value: RADIX_SELECT_ALL, label: '全部情感' },
      ...EMOTION_LABELS.map((e) => ({ value: e.value, label: e.label })),
    ],
    [],
  )

  const list = (allMemories as Memory[])

  const filteredMemories = useMemo(() => {
    return list.filter((m) => {
      if (memberFilter !== RADIX_SELECT_ALL && m.member_id !== Number(memberFilter))
        return false
      if (emotionFilter !== RADIX_SELECT_ALL && m.emotion_label !== emotionFilter) return false
      if (dateFrom) {
        if (!m.timestamp) return false
        const t = new Date(m.timestamp)
        const start = new Date(`${dateFrom}T00:00:00`)
        if (t < start) return false
      }
      if (dateTo) {
        if (!m.timestamp) return false
        const t = new Date(m.timestamp)
        const end = new Date(`${dateTo}T23:59:59.999`)
        if (t > end) return false
      }
      return true
    })
  }, [list, memberFilter, emotionFilter, dateFrom, dateTo])

  const groups = useMemo(() => groupMemoriesByYear(filteredMemories), [filteredMemories])

  const memberNameById = (id: number) =>
    (members as { id: number; name: string }[]).find((x) => x.id === id)?.name ?? ''

  if (aLoad) return <LoadingState message="正在加载档案…" />
  if (aErr) {
    return <ErrorState error={aErr} onRetry={() => void aRef()} />
  }
  if (isLoading) {
    return <LoadingState message="正在取出记忆时间线…" />
  }
  if (error) {
    return <ErrorState error={error} onRetry={() => void refetch()} />
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-display text-ink-primary">
          {archive?.name} — 记忆时间线
        </h1>
        <p className="text-body text-ink-secondary mt-1">
          共 {allMemories.length} 条（最多拉取 {LIMIT} 条）；筛选后 {filteredMemories.length} 条
        </p>
        {allMemories.length >= LIMIT && (
          <p className="text-caption text-amber-700 mt-2">
            已达单页上限 {LIMIT} 条，更多条目需后续加分页 / 游标能力。
          </p>
        )}
      </div>

      <Card variant="plain" padding="sm" className="sticky top-0 z-10 mb-4">
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          <div className="min-w-[200px] flex-1">
            <Select
              label="按成员"
              options={memberOptions}
              value={memberFilter}
              onValueChange={setMemberFilter}
              fullWidth
            />
          </div>
          <div className="min-w-[200px] flex-1">
            <Select
              label="按情感"
              options={emotionOptions}
              value={emotionFilter}
              onValueChange={setEmotionFilter}
              fullWidth
            />
          </div>
          <div className="min-w-[160px] flex-1">
            <Input
              type="date"
              label="从"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              fullWidth
            />
          </div>
          <div className="min-w-[160px] flex-1">
            <Input
              type="date"
              label="到"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              fullWidth
            />
          </div>
        </div>
      </Card>

      {filteredMemories.length === 0 ? (
        <EmptyState
          title="没有符合条件的记忆"
          description="调整筛选或回到档案/成员页添加新记忆"
        />
      ) : (
        <Card variant="plain">
          <Timeline
            key={`${memberFilter}-${emotionFilter}-${dateFrom}-${dateTo}`}
            groups={groups}
            onItemClick={(m) =>
              setActiveMemory({ ...m, archive_id: m.archive_id ?? Number(archiveId) })
            }
          />
        </Card>
      )}

      <MemoryDetailDrawer
        memory={activeMemory}
        memberName={activeMemory ? memberNameById(activeMemory.member_id) : ''}
        onClose={() => setActiveMemory(null)}
        onDelete={
          activeMemory
            ? async () => {
                try {
                  const mid = activeMemory.member_id
                  await memoryApi.delete(activeMemory.id)
                  void queryClient.invalidateQueries({ queryKey: ['memories'] })
                  void queryClient.invalidateQueries({ queryKey: ['mnemo-graph', mid] })
                  setActiveMemory(null)
                  toast.success('已删除')
                } catch (e) {
                  show(e)
                }
              }
            : undefined
        }
      />
    </div>
  )
}
