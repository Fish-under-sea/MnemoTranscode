/**
 * 成员相册：按类型分 Tab + 缩略图 / 播放器
 */
import { useState } from 'react'
import Tabs from '@/components/ui/Tabs'
import { useMemberMedia } from '@/hooks/useMemberMedia'
import { LoadingState, ErrorState, EmptyState } from '@/components/ui'
import type { MediaAsset } from '@/services/api'
import { Image as ImageIcon, Video, Music } from 'lucide-react'
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

  const [lightbox, setLightbox] = useState<MediaAsset | null>(null)

  const loading = photos.isLoading || videos.isLoading || audios.isLoading
  const err = photos.error || videos.error || audios.error

  if (loading) {
    return <LoadingState message="正在取出 Ta 的媒体…" />
  }
  if (err) {
    return <ErrorState error={err} onRetry={() => {
      void photos.refetch()
      void videos.refetch()
      void audios.refetch()
    }} />
  }

  const photoList = photos.data ?? []
  const videoList = videos.data ?? []
  const audioList = audios.data ?? []
  const label = memberName ?? 'Ta'

  return (
    <>
      <Tabs
        defaultValue="photos"
        items={[
          {
            value: 'photos',
            label: `照片 (${photoList.length})`,
            content: photoList.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {photoList.map((p) => (
                  <MediaItem key={p.id} media={p} onOpen={() => setLightbox(p)} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={ImageIcon}
                title="还没有照片"
                description={`为 ${label} 上传第一张`}
              />
            ),
          },
          {
            value: 'videos',
            label: `视频 (${videoList.length})`,
            content: videoList.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {videoList.map((v) => (
                  <MediaItem key={v.id} media={v} />
                ))}
              </div>
            ) : (
              <EmptyState icon={Video} title="还没有视频" />
            ),
          },
          {
            value: 'audios',
            label: `音频 (${audioList.length})`,
            content: audioList.length > 0 ? (
              <div className="flex flex-col gap-2">
                {audioList.map((a) => (
                  <MediaItem key={a.id} media={a} />
                ))}
              </div>
            ) : (
              <EmptyState icon={Music} title="还没有音频" />
            ),
          },
        ]}
      />
      {lightbox && <MediaLightbox media={lightbox} onClose={() => setLightbox(null)} />}
    </>
  )
}
