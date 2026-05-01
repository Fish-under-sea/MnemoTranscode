import { useQuery } from '@tanstack/react-query'
import { archiveApi, memoryApi, usageApi } from '@/services/api'

interface ArchiveItem {
  id: number
  name: string
  archive_type: string
  member_count: number
  memory_count: number
}

interface MemoryItem {
  id: number
  title: string
  content_text: string
  created_at: string
  member_id: number
  archive_id?: number
  /** 后端 MemoryResponse 展示字段；旧缓存无此字段时可用 archive 列表兜底档案名 */
  member_name?: string | null
  archive_name?: string | null
}

interface UsageStats {
  storage_used?: number
  storage_quota?: number
  storage_usage_percent?: number
  /** 与 storage 无关：本月订阅口径 token（计入限额） */
  monthly_used?: number
  /** 自备 API Key / 网关消耗，不计入订阅限额 */
  monthly_used_user_key?: number
  monthly_limit?: number
  ai_tokens_this_month?: number
  ai_tokens_quota?: number
}

export interface DashboardStats {
  archives: ArchiveItem[]
  recentMemories: MemoryItem[]
  usage: UsageStats | null
  archiveCount: number
  memoryCount: number
  archivesByType: Record<string, number>
  lastActivityAt: string | null
  isLoading: boolean
  isError: boolean
  errors: {
    archives: unknown
    recentMemories: unknown
    usage: unknown
  }
  refetchAll: () => void
}

export function useDashboardStats(): DashboardStats {
  const archivesQuery = useQuery<ArchiveItem[]>({
    queryKey: ['dashboard', 'archives'],
    queryFn: () => archiveApi.list() as unknown as Promise<ArchiveItem[]>,
    staleTime: 30_000,
  })

  const memoriesQuery = useQuery<MemoryItem[]>({
    queryKey: ['dashboard', 'recent-memories'],
    queryFn: () => memoryApi.list({ limit: 10 }) as unknown as Promise<MemoryItem[]>,
    staleTime: 30_000,
  })

  const usageQuery = useQuery<UsageStats>({
    queryKey: ['dashboard', 'usage'],
    queryFn: () => usageApi.getStats() as unknown as Promise<UsageStats>,
    staleTime: 60_000,
  })

  const archives = archivesQuery.data ?? []
  const rawRecent = memoriesQuery.data ?? []
  const archiveNameById = new Map(archives.map((a) => [a.id, a.name]))
  const recentMemories = rawRecent.map((m) => ({
    ...m,
    archive_name:
      m.archive_name ??
      (m.archive_id != null ? archiveNameById.get(m.archive_id) ?? null : null),
  }))
  const usage = usageQuery.data ?? null

  const archiveCount = archives.length
  const memoryCount = archives.reduce((sum, a) => sum + (a.memory_count ?? 0), 0)

  const archivesByType: Record<string, number> = {}
  for (const a of archives) {
    archivesByType[a.archive_type] = (archivesByType[a.archive_type] ?? 0) + 1
  }

  const sortedTimes = recentMemories
    .map((m) => m.created_at)
    .filter(Boolean)
    .sort()
  const lastActivityAt = sortedTimes.length > 0 ? sortedTimes[sortedTimes.length - 1]! : null

  return {
    archives,
    recentMemories,
    usage,
    archiveCount,
    memoryCount,
    archivesByType,
    lastActivityAt,
    isLoading: archivesQuery.isLoading || memoriesQuery.isLoading || usageQuery.isLoading,
    isError: archivesQuery.isError && memoriesQuery.isError && usageQuery.isError,
    errors: {
      archives: archivesQuery.error,
      recentMemories: memoriesQuery.error,
      usage: usageQuery.error,
    },
    refetchAll: () => {
      void archivesQuery.refetch()
      void memoriesQuery.refetch()
      void usageQuery.refetch()
    },
  }
}
