/**
 * 对话气泡内：单张表情包缩略（经鉴权预签名 URL）
 */
import { Loader2 } from 'lucide-react'
import { useMediaUrl } from '@/hooks/useMediaUrl'
import { cn } from '@/lib/utils'

export function DialogueStickerThumb({ mediaId, className }: { mediaId: number; className?: string }) {
  const { data, isLoading, error } = useMediaUrl(mediaId)
  const url = data?.get_url

  if (error) {
    return (
      <div
        className={cn('rounded-lg bg-white/10 text-caption px-1 py-0.5 text-center', className)}
        title="加载失败"
      >
        ?
      </div>
    )
  }
  if (isLoading || !url) {
    return (
      <div className={cn('flex items-center justify-center rounded-lg bg-white/10', className)}>
        <Loader2 className="w-4 h-4 animate-spin opacity-70" aria-label="加载" />
      </div>
    )
  }
  return (
    <img
      src={url}
      alt=""
      className={cn('rounded-lg object-cover border border-white/20', className)}
      loading="lazy"
    />
  )
}
