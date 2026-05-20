/** 关系网等场景：工具栏按钮打开情绪轮图例（只读） */
import { useState } from 'react'
import { PieChart } from 'lucide-react'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import EmotionWheelPanel from '@/components/memory/EmotionWheelPanel'

export default function EmotionWheelReferenceButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        leftIcon={<PieChart size={16} />}
        onClick={() => setOpen(true)}
      >
        情绪轮
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="普卢奇克情绪轮" size="full">
        <EmotionWheelPanel mode="reference" />
      </Modal>
    </>
  )
}
