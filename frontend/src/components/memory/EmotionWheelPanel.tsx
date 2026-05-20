/**
 * 普卢奇克情绪轮面板：emotion-wheel.png 贴图 + 标定热区
 */
import { emotionDisplay } from '@/lib/plutchikEmotions'
import type { PlutchikEmotion } from '@/lib/plutchikEmotions'
import PlutchikWheelClassic from '@/components/memory/PlutchikWheelClassic'

export interface EmotionWheelPanelProps {
  mode?: 'select' | 'reference'
  selectedValue?: string
  onSelect?: (emotion: PlutchikEmotion) => void
}

export default function EmotionWheelPanel({
  mode = 'select',
  selectedValue = '',
  onSelect,
}: EmotionWheelPanelProps) {
  const readOnly = mode === 'reference'
  const interactive = !readOnly
  const display = emotionDisplay(selectedValue || null)

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="w-full text-center text-body-sm text-ink-muted">
        {readOnly
          ? '由内向外强度递减（中心最强）；瓣间文字为复合情绪。关系网中 Emotion 结点颜色与此轮一致。'
          : '点击瓣面或复合情绪名称即可选中；由内向外强度递减，请据记忆原文选择。'}
      </p>

      <PlutchikWheelClassic
        size={480}
        selectedValue={selectedValue}
        onSelect={onSelect}
        interactive={interactive}
      />

      {interactive && display ? (
        <p className="text-body-sm text-ink-secondary">
          已选：
          <span className="ml-1 inline-flex items-center gap-1.5 font-medium text-ink-primary">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: display.color }}
              aria-hidden
            />
            {display.label}
          </span>
        </p>
      ) : null}
    </div>
  )
}
