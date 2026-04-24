import { useQuery } from '@tanstack/react-query'
import { memoryApi } from '@/services/api'

/**
 * 单条记忆查询（M2 包一层，供 Drawer / 详情预载；M3 可叠媒体 key）
 */
export function useMemory(memoryId: number | null) {
  return useQuery({
    queryKey: ['memory', memoryId],
    queryFn: () => memoryApi.get(memoryId!) as any,
    enabled: !!memoryId,
    staleTime: 60 * 1000,
  })
}
