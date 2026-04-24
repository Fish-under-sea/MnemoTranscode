/**
 * 单条媒体：按 purpose 渲染图片 / 视频 / 音频
 */
import { Loader2, Music } from 'lucide-react'
import { useMediaUrl } from '@/hooks/useMediaUrl'
import type { MediaAsset } from '@/services/api'

interface MediaItemProps {
  media: MediaAsset
  onOpen?: () => void
}

export default function MediaItem({ media, onOpen }: MediaItemProps) {
  const { data, isLoading, error } = useMediaUrl(media.id)
  const url = data?.get_url

  if (error) {
    return (
      <div className="rounded-xl border border-border-default p-4 text-caption text-rose-600">
        无法加载媒体
      </div>
    )
  }

  if (isLoading || !url) {
    return (
      <div className="aspect-square rounded-xl bg-subtle border border-border-default flex items-center justify-center">
        <Loader2 className="w-7 h-7 text-jade-600 animate-spin" aria-label="加载中" />
      </div>
    )
  }

  const p = String(media.purpose)
  if (p === 'archive_photo') {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="group relative aspect-square w-full overflow-hidden rounded-xl border border-border-default bg-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <img src={url} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]" />
      </button>
    )
  }
  if (p === 'archive_video') {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-xl border border-border-default bg-ink-primary">
        <video controls className="h-full w-full object-contain" src={url} />
      </div>
    )
  }
  if (p === 'archive_audio') {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border-default bg-subtle px-3 py-2">
        <span className="text-ink-muted" aria-hidden>
          <Music size={18} />
        </span>
        <audio controls className="w-full min-w-0" src={url} />
      </div>
    )
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="text-body-sm text-jade-600 underline"
    >
      打开文件
    </a>
  )
}
