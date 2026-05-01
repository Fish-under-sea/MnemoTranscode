import { useEffect, useState } from 'react'
import { mediaApi } from '@/services/api'

/** 通过同源 API 拉取媒体为 Blob 并生成本地 URL，避免 img/video 无法携带 JWT 且 MinIO 预签名常不可达的问题 */
export function useMediaUrl(mediaId: number | null) {
  const [data, setData] = useState<{ get_url: string } | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    if (mediaId == null || mediaId <= 0) {
      setData(undefined)
      setIsLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    let objectUrl: string | null = null

    setIsLoading(true)
    setError(null)
    setData(undefined)

    ;(async () => {
      try {
        const blob = await mediaApi.getFileBlob(mediaId)
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setData({ get_url: objectUrl })
      } catch (e) {
        if (!cancelled) setError(e)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [mediaId])

  return { data, isLoading, error }
}
