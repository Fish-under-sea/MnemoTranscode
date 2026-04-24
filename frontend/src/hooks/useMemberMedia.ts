import { useQuery } from '@tanstack/react-query'
import { mediaApi, type MediaPurpose } from '@/services/api'

export function useMemberMedia(
  memberId: number | null,
  purpose?: MediaPurpose,
) {
  return useQuery({
    queryKey: ['member-media', memberId, purpose],
    queryFn: () => mediaApi.list({ member_id: memberId!, purpose }),
    enabled: memberId != null && memberId > 0,
    staleTime: 30 * 1000,
  })
}
