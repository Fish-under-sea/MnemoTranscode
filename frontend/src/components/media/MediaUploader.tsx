/**
 * 两阶段直传 + 进度 + 失败重试 1 次
 */
import { useState, useRef } from 'react'
import { mediaApi, uploadToPresignedUrl, type MediaAsset, type MediaPurpose } from '@/services/api'
import Button from '@/components/ui/Button'
import { useApiError } from '@/hooks/useApiError'
import { Upload, CheckCircle, XCircle, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

type UploadablePurpose = 'archive_photo' | 'archive_video' | 'archive_audio'

interface UploadItem {
  id: string
  file: File
  status: 'pending' | 'init' | 'putting' | 'completing' | 'done' | 'failed'
  progress: number
  error?: string
  result?: { media_id: number; object_key: string }
  retryCount: number
}

interface MediaUploaderProps {
  archiveId?: number
  memberId?: number
  purpose: UploadablePurpose
  onComplete?: (assets: MediaAsset[]) => void
  multiple?: boolean
}

const PURPOSE_ACCEPT: Record<UploadablePurpose, string> = {
  archive_photo: 'image/jpeg,image/png,image/webp,image/heic',
  archive_video: 'video/mp4,video/webm,video/quicktime',
  archive_audio: 'audio/mpeg,audio/wav,audio/ogg,audio/mp3,audio/mp4,audio/webm',
}

const PURPOSE_MAX_SIZE: Record<UploadablePurpose, number> = {
  archive_photo: 20 * 1024 * 1024,
  archive_video: 500 * 1024 * 1024,
  archive_audio: 100 * 1024 * 1024,
}

const PURPOSE_LABEL: Record<UploadablePurpose, string> = {
  archive_photo: '照片',
  archive_video: '视频',
  archive_audio: '音频',
}

function makeId() {
  return `u-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export default function MediaUploader({
  archiveId,
  memberId,
  purpose,
  onComplete,
  multiple = true,
}: MediaUploaderProps) {
  const { show } = useApiError()
  const inputRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<UploadItem[]>([])

  const setItem = (id: string, patch: Partial<UploadItem> | ((prev: UploadItem) => UploadItem)) => {
    setItems((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p
        return typeof patch === 'function' ? patch(p) : { ...p, ...patch }
      }),
    )
  }

  async function uploadOne(item: UploadItem): Promise<UploadItem> {
    if (item.file.size > PURPOSE_MAX_SIZE[purpose]) {
      return {
        ...item,
        status: 'failed',
        error: `文件过大（> ${PURPOSE_MAX_SIZE[purpose] / 1024 / 1024}MB）`,
      }
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        setItem(item.id, { status: 'putting', progress: 0, error: undefined })
        const initRes = await mediaApi.initUpload({
          filename: item.file.name,
          content_type: item.file.type || 'application/octet-stream',
          size: item.file.size,
          purpose: purpose as MediaPurpose,
          archive_id: archiveId,
          member_id: memberId,
        })
        setItem(item.id, { status: 'putting', progress: 0 })
        await uploadToPresignedUrl(
          initRes.put_url,
          item.file,
          item.file.type || 'application/octet-stream',
          (pct) => setItem(item.id, { progress: pct }),
        )
        setItem(item.id, { status: 'completing', progress: 100 })
        const completeRes = await mediaApi.completeUpload({
          upload_id: initRes.upload_id,
          object_key: initRes.object_key,
          size: item.file.size,
        })
        if (completeRes.media_id == null) {
          if (attempt === 0) continue
          return { ...item, status: 'failed', error: '服务器未返回 media_id' }
        }
        return {
          ...item,
          status: 'done',
          progress: 100,
          result: { media_id: completeRes.media_id, object_key: initRes.object_key },
        }
      } catch (err) {
        if (attempt === 0) continue
        show(err)
        const msg = (err as { message?: string })?.message ?? '上传失败'
        return { ...item, status: 'failed', error: msg }
      }
    }
    return { ...item, status: 'failed', error: '上传失败' }
  }

  async function runQueue(initial: UploadItem[]) {
    setItems(initial)
    const uploaded: MediaAsset[] = []
    for (const start of initial) {
      // eslint-disable-next-line no-await-in-loop
      const end = await uploadOne({ ...start, status: 'pending' })
      setItem(start.id, () => end)
      if (end.status === 'done' && end.result) {
        uploaded.push({
          id: end.result.media_id,
          object_key: end.result.object_key,
          bucket: '',
          content_type: start.file.type,
          size: start.file.size,
          purpose,
          archive_id: archiveId ?? null,
          member_id: memberId ?? null,
          created_at: new Date().toISOString(),
        })
      }
    }
    const successCount = uploaded.length
    const failCount = initial.length - successCount
    toast.success(
      `上传完成：成功 ${successCount} 个${failCount > 0 ? `，失败 ${failCount} 个` : ''}`,
    )
    onComplete?.(uploaded)
  }

  function handleFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return
    const next: UploadItem[] = Array.from(files).map((file) => ({
      id: makeId(),
      file,
      status: 'pending' as const,
      progress: 0,
      retryCount: 0,
    }))
    void runQueue(next)
  }

  function retryItem(item: UploadItem) {
    setItem(item.id, { status: 'pending', error: undefined, progress: 0, retryCount: 0 })
    void (async () => {
      const end = await uploadOne({ ...item, status: 'pending', retryCount: 0, error: undefined })
      setItem(item.id, () => end)
    })()
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={inputRef}
        type="file"
        accept={PURPOSE_ACCEPT[purpose]}
        multiple={multiple}
        onChange={(e) => handleFilesSelected(e.target.files)}
        className="hidden"
      />
      <Button
        variant="ghost"
        leftIcon={<Upload size={18} />}
        type="button"
        onClick={() => inputRef.current?.click()}
      >
        选择{PURPOSE_LABEL[purpose]}
      </Button>

      {items.length > 0 && (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-subtle border border-border-default"
            >
              <div className="flex-1 min-w-0">
                <div className="text-body-sm text-ink-primary truncate">{item.file.name}</div>
                <div className="text-caption text-ink-muted">
                  {(item.file.size / 1024 / 1024).toFixed(1)} MB · {item.status}
                </div>
                {item.status === 'putting' && (
                  <div className="mt-1 h-1 bg-border-default rounded-full overflow-hidden">
                    <div
                      className="h-full bg-jade-500 transition-all"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                )}
                {item.error && <div className="text-caption text-rose-600 mt-1">{item.error}</div>}
              </div>
              {item.status === 'done' && <CheckCircle size={18} className="text-jade-500 shrink-0" />}
              {item.status === 'failed' && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    leftIcon={<RefreshCw size={14} />}
                    type="button"
                    onClick={() => retryItem(item)}
                  >
                    重试
                  </Button>
                  <XCircle size={18} className="text-rose-500 shrink-0" />
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
