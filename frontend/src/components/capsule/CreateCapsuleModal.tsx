// frontend/src/components/capsule/CreateCapsuleModal.tsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Modal from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select, type SelectOption } from '@/components/ui/Select'
import { archiveApi } from '@/services/api'
import { useCreateCapsule } from '@/hooks/useCapsules'

interface CreateCapsuleModalProps {
  open: boolean
  onClose: () => void
}

export default function CreateCapsuleModal({ open, onClose }: CreateCapsuleModalProps) {
  const [selectedArchiveId, setSelectedArchiveId] = useState<string>('')
  const [selectedMemberId, setSelectedMemberId] = useState<string>('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [unlockDate, setUnlockDate] = useState('')

  const { mutate: createCapsule, isPending } = useCreateCapsule()

  // 获取档案列表
  const { data: archives = [] } = useQuery({
    queryKey: ['archives'],
    queryFn: () => archiveApi.list() as any,
    enabled: open,
  })

  // 获取选中档案的成员列表
  const { data: members = [] } = useQuery({
    queryKey: ['members', selectedArchiveId],
    queryFn: () => archiveApi.listMembers(Number(selectedArchiveId)) as any,
    enabled: !!selectedArchiveId,
  })

  const archiveOptions: SelectOption[] = (archives as any[])
    .filter((a: any) => a?.id != null && String(a.id) !== '')
    .map((a: any) => ({
      value: String(a.id),
      label: a.name ?? `档案 #${a.id}`,
    }))

  const memberOptions: SelectOption[] = selectedArchiveId
    ? (members as any[])
        .filter((m: any) => m?.id != null && String(m.id) !== '')
        .map((m: any) => ({
          value: String(m.id),
          label: m.name ?? `成员 #${m.id}`,
        }))
    : []

  // 最小解封时间为明天
  const minDatetime = (() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    d.setSeconds(0, 0)
    return d.toISOString().slice(0, 16)  // "YYYY-MM-DDTHH:mm"
  })()

  const handleSubmit = () => {
    if (!selectedMemberId || !title.trim() || !content.trim() || !unlockDate) return
    createCapsule(
      {
        member_id: Number(selectedMemberId),
        title: title.trim(),
        content: content.trim(),
        unlock_date: new Date(unlockDate).toISOString(),
      },
      {
        onSuccess: () => {
          onClose()
          setSelectedArchiveId('')
          setSelectedMemberId('')
          setTitle('')
          setContent('')
          setUnlockDate('')
        },
      },
    )
  }

  const isValid = !!selectedMemberId && title.trim().length > 0 && content.trim().length > 0 && !!unlockDate

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="创建记忆胶囊"
      size="md"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={isPending}>取消</Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!isValid || isPending}
          >
            {isPending ? '创建中…' : '创建胶囊'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Select
          label="选择档案"
          options={archiveOptions}
          value={selectedArchiveId || undefined}
          onValueChange={(v) => {
            setSelectedArchiveId(v)
            setSelectedMemberId('')
          }}
          placeholder={archiveOptions.length > 0 ? '请选择档案' : '暂无档案，请先在档案库创建'}
          fullWidth
        />
        <Select
          label="选择成员"
          options={memberOptions}
          value={selectedMemberId || undefined}
          onValueChange={setSelectedMemberId}
          placeholder={
            !selectedArchiveId
              ? '请先选择档案'
              : memberOptions.length > 0
                ? '请选择成员'
                : '该档案下暂无成员'
          }
          disabled={!selectedArchiveId}
          fullWidth
        />
        <Input
          label="胶囊标题"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="给这封信起个名字"
          fullWidth
        />
        <Textarea
          label="内容"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="写下你想说的话，未来的 Ta 会在解封时看到…"
          rows={6}
          fullWidth
        />
        <Input
          label="解封时间"
          type="datetime-local"
          value={unlockDate}
          onChange={(e) => setUnlockDate(e.target.value)}
          min={minDatetime}
          fullWidth
        />
        <p className="text-caption text-ink-muted">
          胶囊将在指定时间后可解封查看，创建后内容将被保护。
        </p>
      </div>
    </Modal>
  )
}
