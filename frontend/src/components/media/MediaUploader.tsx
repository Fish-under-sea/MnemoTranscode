/**
 * 两阶段直传 + 进度 + 失败重试 1 次
 * 支持单类型（purpose）或混合选择（autoClassify，按 MIME/扩展名自动归入照片/视频/音频）
 */
import { useState, useRef } from 'react'
import { mediaApi, type MediaAsset, type MediaPurpose } from '@/services/api'
import Button from '@/components/ui/Button'
import { useApiError } from '@/hooks/useApiError'
import { Upload, CheckCircle, XCircle, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

type UploadablePurpose = 'archive_photo' | 'archive_video' | 'archive_audio' | 'archive_sticker'

interface UploadItem {
  id: string
  file: File
  purpose: UploadablePurpose
  status: 'pending' | 'init' | 'putting' | 'completing' | 'done' | 'failed'
  progress: number
  error?: string
  result?: { media_id: number; object_key: string }
  retryCount: number
}

interface BaseUploaderProps {
  archiveId?: number
  memberId?: number
  onComplete?: (assets: MediaAsset[]) => void
  multiple?: boolean
}

/** 固定单一 purpose 的传统模式 */
export type SinglePurposeUploaderProps = BaseUploaderProps & {
  purpose: UploadablePurpose
  autoClassify?: false
}

/** 一次可选照片/视频/音频，服务端按推断的 purpose 落库（与后端 PURPOSE_CONTENT_TYPES 对齐） */
export type MixedUploaderProps = BaseUploaderProps & {
  autoClassify: true
}

export type MediaUploaderProps = SinglePurposeUploaderProps | MixedUploaderProps

const PURPOSE_ACCEPT: Record<UploadablePurpose, string> = {
  archive_photo: 'image/jpeg,image/png,image/webp,image/heic',
  archive_video: 'video/mp4,video/webm,video/quicktime',
  archive_audio: 'audio/mpeg,audio/wav,audio/ogg,audio/mp3,audio/mp4,audio/webm',
  archive_sticker: 'image/jpeg,image/png,image/webp,image/gif',
}

/** 与后端 media.py MAX_SIZE_BYTES 对齐，避免前端放过、接口拒绝 */
const PURPOSE_MAX_SIZE: Record<UploadablePurpose, number> = {
  archive_photo: 100 * 1024 * 1024,
  archive_video: 500 * 1024 * 1024,
  archive_audio: 100 * 1024 * 1024,
  archive_sticker: 30 * 1024 * 1024,
}

const PURPOSE_LABEL: Record<UploadablePurpose, string> = {
  archive_photo: '照片',
  archive_video: '视频',
  archive_audio: '音频',
  archive_sticker: '表情包',
}

const PHOTO_CT = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
const VIDEO_CT = new Set(['video/mp4', 'video/webm', 'video/quicktime'])
const AUDIO_CT = new Set([
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/mp3',
  'audio/mp4',
  'audio/webm',
])

/** 浏览器 file.type 常为空或与后端不一致时，按扩展名补全（与后端 _sniff_content_type 一致） */
function sniffContentType(filename: string, reported: string): string {
  const r = (reported || '').trim()
  if (r && r !== 'application/octet-stream') return r
  const low = (filename || '').toLowerCase()
  if (low.endsWith('.png')) return 'image/png'
  if (low.endsWith('.jpg') || low.endsWith('.jpeg')) return 'image/jpeg'
  if (low.endsWith('.webp')) return 'image/webp'
  if (low.endsWith('.heic')) return 'image/heic'
  if (low.endsWith('.gif')) return 'image/gif'
  if (low.endsWith('.mp4')) return 'video/mp4'
  if (low.endsWith('.webm')) return 'video/webm'
  if (low.endsWith('.mov')) return 'video/quicktime'
  if (low.endsWith('.mp3') || low.endsWith('.mpeg')) return 'audio/mpeg'
  if (low.endsWith('.wav')) return 'audio/wav'
  if (low.endsWith('.ogg')) return 'audio/ogg'
  return r || 'application/octet-stream'
}

const STICKER_CT = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

function inferArchivePurpose(sniffed: string): UploadablePurpose | null {
  if (PHOTO_CT.has(sniffed)) return 'archive_photo'
  if (VIDEO_CT.has(sniffed)) return 'archive_video'
  if (AUDIO_CT.has(sniffed)) return 'archive_audio'
  return null
}

function inferStickerPurpose(sniffed: string): UploadablePurpose | null {
  if (STICKER_CT.has(sniffed)) return 'archive_sticker'
  return null
}

const MIXED_ACCEPT = [
  PURPOSE_ACCEPT.archive_photo,
  PURPOSE_ACCEPT.archive_video,
  PURPOSE_ACCEPT.archive_audio,
].join(',')

function makeId() {
  return `u-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export default function MediaUploader(props: MediaUploaderProps) {
  const { archiveId, memberId, onComplete, multiple = true } = props
  const autoClassify = props.autoClassify === true
  const fixedPurpose = autoClassify ? undefined : props.purpose

  const { show } = useApiError()
  const inputRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<UploadItem[]>([])

  const accept = autoClassify ? MIXED_ACCEPT : PURPOSE_ACCEPT[fixedPurpose!]
  const buttonLabel = autoClassify
    ? '上传照片 / 视频 / 音频（自动分类）'
    : fixedPurpose === 'archive_sticker'
      ? '上传表情包 · 上传后 AI 自动打标签'
      : `上传${PURPOSE_LABEL[fixedPurpose!]}`

  const setItem = (id: string, patch: Partial<UploadItem> | ((prev: UploadItem) => UploadItem)) => {
    setItems((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p
        return typeof patch === 'function' ? patch(p) : { ...p, ...patch }
      }),
    )
  }

  async function uploadOne(item: UploadItem): Promise<UploadItem> {
    const maxB = PURPOSE_MAX_SIZE[item.purpose]
    if (item.file.size > maxB) {
      return {
        ...item,
        status: 'failed',
        error: `文件过大（> ${Math.round(maxB / 1024 / 1024)}MB）`,
      }
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        setItem(item.id, { status: 'putting', progress: 0, error: undefined })
        const completeRes = await mediaApi.uploadDirect(
          {
            file: item.file,
            purpose: item.purpose as MediaPurpose,
            archive_id: archiveId,
            member_id: memberId,
          },
          (pct) => setItem(item.id, { progress: pct }),
        )
        return {
          ...item,
          status: 'done',
          progress: 100,
          result: { media_id: completeRes.media_id, object_key: completeRes.object_key },
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
      const contentType = sniffContentType(start.file.name, start.file.type)
      // eslint-disable-next-line no-await-in-loop
      const end = await uploadOne({ ...start, status: 'pending' })
      setItem(start.id, () => end)
      if (end.status === 'done' && end.result) {
        uploaded.push({
          id: end.result.media_id,
          object_key: end.result.object_key,
          bucket: '',
          content_type: contentType,
          size: start.file.size,
          purpose: start.purpose,
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

    const skippedNames: string[] = []
    const next: UploadItem[] = []

    for (const file of Array.from(files)) {
      const sniffed = sniffContentType(file.name, file.type)
      let purpose: UploadablePurpose | null = null
      if (autoClassify) {
        purpose = inferArchivePurpose(sniffed)
      } else if (fixedPurpose === 'archive_sticker') {
        purpose = inferStickerPurpose(sniffed)
      } else {
        purpose = fixedPurpose!
      }

      if (!purpose) {
        skippedNames.push(file.name)
        continue
      }

      next.push({
        id: makeId(),
        file,
        purpose,
        status: 'pending',
        progress: 0,
        retryCount: 0,
      })
    }

    if (skippedNames.length > 0) {
      const msg = autoClassify
        ? `已跳过 ${skippedNames.length} 个无法归入照片/音视频的文件（GIF 表情包请使用下方专属上传）`
        : fixedPurpose === 'archive_sticker'
          ? `已跳过 ${skippedNames.length} 个文件（表情包仅支持 JPG / PNG / WebP / GIF）`
          : `已跳过 ${skippedNames.length} 个与当前类型不匹配的文件`
      toast.error(msg)
    }

    if (next.length === 0) return
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
        accept={accept}
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
        {buttonLabel}
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
                  {PURPOSE_LABEL[item.purpose]} · {(item.file.size / 1024 / 1024).toFixed(1)} MB ·{' '}
                  {item.status}
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
