import Modal from '@/components/ui/Modal'
import { useMediaUrl } from '@/hooks/useMediaUrl'
import type { MediaAsset } from '@/services/api'
import { Loader2 } from 'lucide-react'

interface MediaLightboxProps {
  media: MediaAsset
  onClose: () => void
}

export default function MediaLightbox({ media, onClose }: MediaLightboxProps) {
  const { data, isLoading } = useMediaUrl(media.id)
  const url = data?.get_url

  return (
    <Modal open onClose={onClose} title="" size="full" hideClose={false}>
      <div className="flex min-h-[50vh] items-center justify-center">
        {isLoading || !url ? (
          <Loader2 className="w-10 h-10 text-jade-600 animate-spin" aria-label="加载中" />
        ) : (
          <img src={url} alt="" className="max-h-[85vh] max-w-full object-contain mx-auto rounded-lg" />
        )}
      </div>
    </Modal>
  )
}
