import { useQuery } from '@tanstack/react-query'
import { mediaApi } from '@/services/api'

export function useMediaUrl(mediaId: number | null) {
  return useQuery({
    queryKey: ['media-url', mediaId],
    queryFn: () => mediaApi.getDownloadUrl(mediaId!),
    enabled: mediaId != null && mediaId > 0,
    staleTime: 5 * 60 * 1000,
  })
}
