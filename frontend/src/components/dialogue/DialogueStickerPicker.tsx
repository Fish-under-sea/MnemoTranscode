/**
 * 对话输入区：从当前成员表情包库多选（最多 8 张，与后端一致）
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Laugh, X } from 'lucide-react'
import { mediaApi, type MediaAsset } from '@/services/api'
import { Button } from '@/components/ui'
import Modal from '@/components/ui/Modal'
import { cn } from '@/lib/utils'
import { DialogueStickerThumb } from '@/components/dialogue/DialogueStickerThumb'

const MAX = 8

interface DialogueStickerPickerProps {
  memberId: number
  disabled?: boolean
  selectedIds: number[]
  onChangeSelected: (ids: number[]) => void
}

export default function DialogueStickerPicker({
  memberId,
  disabled,
  selectedIds,
  onChangeSelected,
}: DialogueStickerPickerProps) {
  const [open, setOpen] = useState(false)

  const q = useQuery({
    queryKey: ['member-media', memberId, 'archive_sticker'],
    queryFn: () => mediaApi.list({ member_id: memberId, purpose: 'archive_sticker' }),
    enabled: open && memberId > 0,
    staleTime: 20_000,
  })

  const list = (q.data ?? []) as MediaAsset[]

  const toggle = (id: number) => {
    if (selectedIds.includes(id)) {
      onChangeSelected(selectedIds.filter((x) => x !== id))
      return
    }
    if (selectedIds.length >= MAX) return
    onChangeSelected([...selectedIds, id])
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="shrink-0 h-9 w-9 p-0"
        disabled={disabled}
        aria-label="选择表情包"
        title="从成员表情包库选择（可与文字同时发送）"
        onClick={() => setOpen(true)}
      >
        <Laugh size={20} className="text-ink-secondary" />
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="选择表情包"
        size="md"
        footer={
          <div className="flex justify-end">
            <Button type="button" variant="primary" size="sm" onClick={() => setOpen(false)}>
              完成
            </Button>
          </div>
        }
      >
        <p className="text-caption text-ink-muted mb-3">
          点击选择，最多 {MAX} 张；需先在成员页上传表情包。
        </p>
        {q.isLoading && <p className="text-caption text-ink-muted py-4 text-center">加载中…</p>}
        {q.isError && (
          <p className="text-caption text-rose-600 py-2">加载失败，请稍后重试</p>
        )}
        {!q.isLoading && !q.isError && list.length === 0 && (
          <p className="text-caption text-ink-muted py-3">暂无表情包，请先到成员详情页上传。</p>
        )}
        <div className="grid grid-cols-4 gap-2 max-h-[min(50vh,280px)] overflow-y-auto pr-1">
          {list.map((m) => {
            const on = selectedIds.includes(m.id)
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => toggle(m.id)}
                className={cn(
                  'relative aspect-square rounded-lg overflow-hidden border-2 transition-colors',
                  on ? 'border-jade-500 ring-2 ring-jade-200' : 'border-transparent hover:border-border-default',
                )}
              >
                <DialogueStickerThumb mediaId={m.id} className="w-full h-full" />
              </button>
            )
          })}
        </div>
      </Modal>
    </>
  )
}

/** 输入框上方展示已选 id，可逐张移除 */
export function SelectedStickerChips({
  ids,
  onRemove,
}: {
  ids: number[]
  onRemove: (id: number) => void
}) {
  if (ids.length === 0) return null
  return (
    <div className="mb-2 flex flex-wrap gap-2 items-center">
      <span className="text-caption text-ink-muted shrink-0">已选表情：</span>
      {ids.map((id) => (
        <div
          key={id}
          className="relative w-11 h-11 rounded-lg overflow-hidden border border-border-default shrink-0"
        >
          <DialogueStickerThumb mediaId={id} className="w-full h-full" />
          <button
            type="button"
            className="absolute inset-0 flex items-start justify-end p-0.5 bg-ink-primary/35 opacity-80 hover:opacity-100"
            onClick={() => onRemove(id)}
            aria-label="移除"
          >
            <span className="rounded-full bg-canvas p-0.5">
              <X size={12} className="text-ink-primary" />
            </span>
          </button>
        </div>
      ))}
    </div>
  )
}
