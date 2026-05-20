/**
 * 普卢奇克情绪轮选择器（成员页添加记忆等）
 */
import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { emotionDisplay } from '@/lib/plutchikEmotions'
import type { PlutchikEmotion } from '@/lib/plutchikEmotions'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import EmotionWheelPanel from '@/components/memory/EmotionWheelPanel'

export interface EmotionWheelPickerProps {
  value: string
  onChange: (value: string) => void
  label?: string
  className?: string
}

export default function EmotionWheelPicker({
  value,
  onChange,
  label = '情感基调（可选）',
  className,
}: EmotionWheelPickerProps) {
  const [open, setOpen] = useState(false)
  const display = useMemo(() => emotionDisplay(value || null), [value])

  const pick = (e: PlutchikEmotion) => {
    onChange(e.value)
    setOpen(false)
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <span className="text-body-sm font-medium text-ink-secondary">{label}</span>
      <div className="flex flex-wrap items-center gap-2">
        {display ? (
          <span
            className="inline-flex items-center gap-2 rounded-full border border-border-default bg-subtle px-3 py-1.5 text-body-sm text-ink-primary"
            title={display.value}
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: display.color }}
              aria-hidden
            />
            {display.label}
          </span>
        ) : (
          <span className="text-body-sm text-ink-muted">未选择</span>
        )}
        <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
          打开情绪轮
        </Button>
        {value ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange('')}>
            清除
          </Button>
        ) : null}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="普卢奇克情绪轮" size="full">
        <EmotionWheelPanel mode="select" selectedValue={value} onSelect={pick} />
      </Modal>
    </div>
  )
}
