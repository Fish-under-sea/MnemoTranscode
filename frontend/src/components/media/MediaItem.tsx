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
  const stickerTags =
    typeof media.extras === 'object' &&
    media.extras !== null &&
    Array.isArray((media.extras as { sticker_tags?: unknown }).sticker_tags) ?
      ((media.extras as { sticker_tags: string[] }).sticker_tags as string[])
    : []
  const stickerErr =
    typeof media.extras === 'object' && media.extras !== null ?
      (media.extras as { sticker_analyze_error?: string }).sticker_analyze_error
    : undefined

  if (p === 'archive_photo' || p === 'archive_sticker') {
    return (
      <div className="flex flex-col gap-1.5 w-full">
        <button
          type="button"
          onClick={onOpen}
          className="group relative aspect-square w-full overflow-hidden rounded-xl border border-border-default bg-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <img
            src={url}
            alt=""
            className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
          />
          {p === 'archive_sticker' && (
            <span className="absolute bottom-1 right-1 rounded bg-ink-primary/70 px-1.5 py-0.5 text-caption text-white">
              表情
            </span>
          )}
        </button>
        {p === 'archive_sticker' && stickerTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {stickerTags.slice(0, 8).map((t) => (
              <span
                key={`${media.id}-${t}`}
                className="truncate max-w-[7rem] text-caption px-1.5 py-0.5 rounded-md bg-subtle border border-border-default text-ink-secondary"
              >
                {t}
              </span>
            ))}
          </div>
        )}
        {p === 'archive_sticker' && stickerErr && stickerTags.length === 0 && (
          <p className="text-caption text-amber-800" title={stickerErr}>
            <span className="font-medium">标注未成功</span>
            {stickerErr.length > 0 ?
              <>：{stickerErr.length > 120 ? `${stickerErr.slice(0, 120)}…` : stickerErr}</>
            : null}
            <span className="block mt-1 text-ink-muted">
              请确认服务端已执行数据库迁移、且 LLM_MODEL 为支持图像的模型（与 LLM_BASE_URL / LLM_API_KEY 同一套配置）。
            </span>
          </p>
        )}
      </div>
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
