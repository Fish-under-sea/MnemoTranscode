// frontend/src/components/storybook/StoryPreview.tsx
import { useRef } from 'react'
import { Copy, Printer } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import toast from 'react-hot-toast'

const STYLE_LABELS: Record<string, string> = {
  nostalgic: '怀旧温情',
  literary: '文学风格',
  simple: '简洁平实',
  dialogue: '对话为主',
}

interface StoryPreviewProps {
  story: string
  archiveName: string
  memberName: string
  style: string
  memoryCount: number
}

export default function StoryPreview({
  story,
  archiveName,
  memberName,
  style,
  memoryCount,
}: StoryPreviewProps) {
  const printRootRef = useRef<HTMLDivElement>(null)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(story)
    toast.success('故事已复制到剪贴板')
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <>
      {/* 打印样式 */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          #story-print-root { display: block !important; position: static !important; }
          #story-print-root .no-print { display: none !important; }
        }
      `}</style>

      <div id="story-print-root" ref={printRootRef}>
        <Card variant="plain" padding="lg">
          {/* 元信息 header */}
          <div className="flex items-start justify-between mb-6 no-print">
            <div>
              <h2 className="text-h3 font-display font-bold text-ink-primary">
                {archiveName} — {memberName} 的故事
              </h2>
              <div className="flex items-center gap-2 mt-2">
                <Badge tone="jade" size="sm">{STYLE_LABELS[style] || style}</Badge>
                <span className="text-caption text-ink-muted">基于 {memoryCount} 条记忆</span>
              </div>
            </div>
          </div>

          {/* 打印时显示的 header */}
          <div className="hidden print:block mb-8">
            <h1 className="text-2xl font-bold">{archiveName} — {memberName} 的故事</h1>
            <p className="text-sm text-gray-500 mt-1">{STYLE_LABELS[style]} · 基于 {memoryCount} 条记忆</p>
          </div>

          {/* 正文 */}
          <div className="font-display text-ink-primary leading-[1.9] whitespace-pre-wrap text-body">
            {story}
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-3 mt-8 pt-6 border-t border-border-default no-print">
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Copy size={14} />}
              onClick={handleCopy}
            >
              复制全文
            </Button>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Printer size={14} />}
              onClick={handlePrint}
            >
              打印 / 导出 PDF
            </Button>
          </div>
        </Card>
      </div>
    </>
  )
}
