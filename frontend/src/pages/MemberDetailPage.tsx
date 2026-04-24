/**
 * 成员详情页
 */
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { FileText, MessageCircle, Plus } from 'lucide-react'
import { motion } from 'motion/react'
import { archiveApi, memoryApi } from '@/services/api'
import MediaGallery from '@/components/media/MediaGallery'
import MediaUploader from '@/components/media/MediaUploader'
import { EMOTION_LABELS } from '@/lib/utils'
import MemoryCard from '@/components/memory/MemoryCard'
import MemoryDetailDrawer from '@/components/memory/MemoryDetailDrawer'
import type { Memory } from '@/services/memoryTypes'
import Modal from '@/components/ui/Modal'
import { useState } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import Select from '@/components/ui/Select'
import { LoadingState, ErrorState, EmptyState } from '@/components/ui'
import { useApiError } from '@/hooks/useApiError'
import MemberProfile from '@/components/member/MemberProfile'
import { fadeUp, staggerContainer } from '@/lib/motion'

export default function MemberDetailPage() {
  const { archiveId, memberId } = useParams<{ archiveId: string; memberId: string }>()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { show } = useApiError()

  const [createMemoryModal, setCreateMemoryModal] = useState(false)
  const [newMemory, setNewMemory] = useState({
    title: '',
    content_text: '',
    timestamp: '',
    location: '',
    emotion_label: '',
  })
  const [activeMemory, setActiveMemory] = useState<Memory | null>(null)

  const EMOTION_OPTIONS = [
    { value: '', label: '（无）' },
    ...EMOTION_LABELS.map((e) => ({ value: e.value, label: `● ${e.label}` })),
  ]

  const { data: archive } = useQuery({
    queryKey: ['archive', archiveId],
    queryFn: () => archiveApi.get(Number(archiveId)) as any,
    enabled: !!archiveId,
  })

  const { data: member, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['member', archiveId, memberId],
    queryFn: () => archiveApi.getMember(Number(archiveId), Number(memberId)) as any,
    enabled: !!archiveId && !!memberId,
  })

  const { data: memories = [] } = useQuery({
    queryKey: ['memories', 'member', memberId],
    queryFn: () => memoryApi.list({ member_id: Number(memberId) }) as any,
    enabled: !!memberId,
  })

  const createMemoryMutation = useMutation({
    mutationFn: (data: typeof newMemory) =>
      memoryApi.create({
        member_id: Number(memberId),
        title: data.title,
        content_text: data.content_text,
        timestamp: data.timestamp ? new Date(data.timestamp).toISOString() : undefined,
        location: data.location || undefined,
        emotion_label: data.emotion_label || undefined,
      }) as Promise<unknown>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memories', 'member', memberId] })
      setCreateMemoryModal(false)
      setNewMemory({ title: '', content_text: '', timestamp: '', location: '', emotion_label: '' })
      toast.success('记忆创建成功')
    },
    onError: (err) => show(err),
  })

  if (isLoading) {
    return <LoadingState message="正在加载成员信息…" />
  }
  if (isError || !member) {
    return <ErrorState error={error ?? '未找到该成员'} onRetry={() => void refetch()} />
  }

  return (
    <motion.div
      variants={staggerContainer()}
      initial="hidden"
      animate="visible"
      className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8"
    >
      <motion.div variants={fadeUp} className="text-caption text-ink-muted mb-4">
        <Link to="/archives" className="hover:text-jade-600">
          档案库
        </Link>
        <span className="mx-2">/</span>
        <Link to={`/archives/${archiveId}`} className="hover:text-jade-600">
          {archive?.name ?? '档案'}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-ink-primary">{member.name}</span>
      </motion.div>

      <motion.div variants={fadeUp}>
        <Card variant="plain" className="mb-6">
          <MemberProfile member={member} />
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              leftIcon={<MessageCircle size={18} />}
              onClick={() => void navigate(`/dialogue/${archiveId}/${memberId}`)}
            >
              与 Ta 对话
            </Button>
            <span className="text-body-sm text-ink-muted self-center ml-auto">
              {memories.length} 条记忆
            </span>
          </div>
        </Card>
      </motion.div>

      <motion.div variants={fadeUp}>
        <Card variant="plain" className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-body-lg font-medium text-ink-primary">相册</h2>
            <MediaUploader
              memberId={Number(memberId)}
              purpose="archive_photo"
              onComplete={() =>
                queryClient.invalidateQueries({ queryKey: ['member-media', Number(memberId)] })
              }
            />
          </div>
          <MediaGallery memberId={Number(memberId)} memberName={member.name} />
        </Card>
      </motion.div>

      <motion.div variants={fadeUp}>
        <Card variant="plain">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-medium text-ink-primary text-body-lg flex items-center gap-2">
              <FileText size={18} />
              记忆 ({memories.length})
            </h2>
            <Button size="sm" leftIcon={<Plus size={16} />} onClick={() => setCreateMemoryModal(true)}>
              添加记忆
            </Button>
          </div>

          {memories.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="还没有记忆条目"
              description="讲述你们的故事吧"
              action={{ label: '添加记忆', onClick: () => setCreateMemoryModal(true) }}
            />
          ) : (
            <div className="space-y-4">
              {memories.map((memory: Record<string, unknown>) => {
                const m = memory
                const rec: Memory = {
                  id: Number(m.id),
                  title: String(m.title ?? ''),
                  content_text: String(m.content_text ?? ''),
                  timestamp: m.timestamp as string | null | undefined,
                  location: m.location as string | null | undefined,
                  emotion_label: m.emotion_label as string | null | undefined,
                  member_id: Number(m.member_id),
                  archive_id: Number(archiveId),
                }
                return (
                  <MemoryCard
                    key={String(m.id)}
                    {...rec}
                    variant="list"
                    onClick={() => setActiveMemory(rec)}
                  />
                )
              })}
            </div>
          )}
        </Card>
      </motion.div>

      <MemoryDetailDrawer
        memory={activeMemory}
        memberName={member.name}
        onClose={() => setActiveMemory(null)}
        onDelete={
          activeMemory
            ? async () => {
                try {
                  await memoryApi.delete(activeMemory.id)
                  queryClient.invalidateQueries({ queryKey: ['memories', 'member', memberId] })
                  setActiveMemory(null)
                  toast.success('记忆已删除')
                } catch (err) {
                  show(err)
                }
              }
            : undefined
        }
      />

      <Modal
        open={createMemoryModal}
        onClose={() => setCreateMemoryModal(false)}
        title="添加记忆"
        size="lg"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            createMemoryMutation.mutate(newMemory)
          }}
          className="space-y-4"
        >
          <Input
            label="记忆标题"
            value={newMemory.title}
            onChange={(e) => setNewMemory({ ...newMemory, title: e.target.value })}
            placeholder="给这段记忆起个名字"
            fullWidth
            required
          />
          <Textarea
            label="记忆内容"
            value={newMemory.content_text}
            onChange={(e) => setNewMemory({ ...newMemory, content_text: e.target.value })}
            rows={6}
            placeholder="详细描述这段记忆…"
            fullWidth
            required
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              type="datetime-local"
              label="发生时间"
              value={newMemory.timestamp}
              onChange={(e) => setNewMemory({ ...newMemory, timestamp: e.target.value })}
              fullWidth
            />
            <Input
              label="地点"
              value={newMemory.location}
              onChange={(e) => setNewMemory({ ...newMemory, location: e.target.value })}
              placeholder="例如：北京、上海"
              fullWidth
            />
          </div>
          <Select
            label="情感基调（可选）"
            options={EMOTION_OPTIONS}
            value={newMemory.emotion_label}
            onValueChange={(v) => setNewMemory({ ...newMemory, emotion_label: v })}
            fullWidth
          />
          <div className="flex gap-3 pt-2">
            <Button
              variant="ghost"
              type="button"
              onClick={() => setCreateMemoryModal(false)}
              fullWidth
            >
              取消
            </Button>
            <Button
              type="submit"
              loading={createMemoryMutation.isPending}
              fullWidth
            >
              保存
            </Button>
          </div>
        </form>
      </Modal>
    </motion.div>
  )
}
