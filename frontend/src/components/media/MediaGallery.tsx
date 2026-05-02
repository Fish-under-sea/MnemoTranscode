/**
 * 成员影像资料：照片 / 视频 / 音频 / 表情包 Tab
 */
import { useState } from 'react'
import Tabs from '@/components/ui/Tabs'
import { useMemberMedia } from '@/hooks/useMemberMedia'
import { LoadingState, ErrorState, EmptyState } from '@/components/ui'
import type { MediaAsset } from '@/services/api'
import { Image as ImageIcon, Video, Music, Laugh } from 'lucide-react'
import MediaLightbox from '@/components/media/MediaLightbox'
import MediaItem from '@/components/media/MediaItem'

interface MediaGalleryProps {
  memberId: number
  memberName?: string
}

export default function MediaGallery({ memberId, memberName }: MediaGalleryProps) {
  const photos = useMemberMedia(memberId, 'archive_photo')
  const videos = useMemberMedia(memberId, 'archive_video')
  const audios = useMemberMedia(memberId, 'archive_audio')
  const stickers = useMemberMedia(memberId, 'archive_sticker')

  const [lightbox, setLightbox] = useState<MediaAsset | null>(null)

  const loading = photos.isLoading || videos.isLoading || audios.isLoading || stickers.isLoading
  const err = photos.error || videos.error || audios.error || stickers.error

  if (loading) {
    return <LoadingState message="正在加载媒体资料…" />
  }
  if (err) {
    return (
      <ErrorState
        error={err}
        onRetry={() => {
          void photos.refetch()
          void videos.refetch()
          void audios.refetch()
          void stickers.refetch()
        }}
      />
    )
  }

  const photoList = photos.data ?? []
  const videoList = videos.data ?? []
  const audioList = audios.data ?? []
  const stickerList = stickers.data ?? []
  const label = memberName ?? 'Ta'

  return (
    <>
      <Tabs
        defaultValue="photos"
        items={[
          {
            value: 'photos',
            label: `照片 (${photoList.length})`,
            content:
              photoList.length > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {photoList.map((p) => (
                    <MediaItem key={p.id} media={p} onOpen={() => setLightbox(p)} />
                  ))}
                </div>
              ) : (
                <EmptyState icon={ImageIcon} title="还没有照片" description={`可上传 JPG / PNG / WebP / HEIC`} />
              ),
          },
          {
            value: 'videos',
            label: `视频 (${videoList.length})`,
            content:
              videoList.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {videoList.map((v) => (
                    <MediaItem key={v.id} media={v} />
                  ))}
                </div>
              ) : (
                <EmptyState icon={Video} title="还没有视频" description="上传 MP4 / WebM / MOV" />
              ),
          },
          {
            value: 'audios',
            label: `音频 (${audioList.length})`,
            content:
              audioList.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {audioList.map((a) => (
                    <MediaItem key={a.id} media={a} />
                  ))}
                </div>
              ) : (
                <EmptyState icon={Music} title="还没有音频" />
              ),
          },
          {
            value: 'stickers',
            label: `表情包 (${stickerList.length})`,
            content:
              stickerList.length > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {stickerList.map((s) => (
                    <MediaItem key={s.id} media={s} onOpen={() => setLightbox(s)} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Laugh}
                  title="还没有表情包"
                  description={`用上方「表情包」按钮为 ${label} 上传 PNG / JPG / GIF 等；保存后将尝试自动识别情绪与常用标签（需配置支持图像的模型）。`}
                />
              ),
          },
        ]}
      />
      {lightbox && <MediaLightbox media={lightbox} onClose={() => setLightbox(null)} />}
    </>
  )
}
