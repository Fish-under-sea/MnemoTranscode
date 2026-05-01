/**
 * 成员详情页
 */
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { FileText, MessageCircle, Plus, MessageSquareShare, Upload } from 'lucide-react'
import { motion } from 'motion/react'
import { lazy, Suspense, useState, useRef } from 'react'
import { archiveApi, memoryApi } from '@/services/api'
import MediaGallery from '@/components/media/MediaGallery'
import MediaUploader from '@/components/media/MediaUploader'
import { EMOTION_LABELS, RADIX_SELECT_NONE } from '@/lib/utils'
import MemoryCard from '@/components/memory/MemoryCard'
import MemoryDetailDrawer from '@/components/memory/MemoryDetailDrawer'
import type { Memory } from '@/services/memoryTypes'
import Modal from '@/components/ui/Modal'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import Select from '@/components/ui/Select'
import { LoadingState, ErrorState, EmptyState } from '@/components/ui'
import { useApiError } from '@/hooks/useApiError'
import MemberProfile from '@/components/member/MemberProfile'
import { fadeUp, staggerContainer } from '@/lib/motion'
import { cn } from '@/lib/utils'

const MemoryRelationGraph = lazy(() => import('@/components/memory/MemoryRelationGraph'))

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

  const [importChatOpen, setImportChatOpen] = useState(false)
  const [importRaw, setImportRaw] = useState('')
  const [importSource, setImportSource] = useState<'auto' | 'wechat' | 'plain'>('auto')
  const [importTxtName, setImportTxtName] = useState<string | null>(null)
  const [importDropActive, setImportDropActive] = useState(false)

  const avatarFileRef = useRef<HTMLInputElement>(null)
  const importTxtRef = useRef<HTMLInputElement>(null)

  /** 与后端 ChatImportRequest.raw_text max_length 对齐 */
  const CHAT_IMPORT_MAX_CHARS = 500_000

  const applyImportedTxt = (text: string, filename: string | null) => {
    if (text.length > CHAT_IMPORT_MAX_CHARS) {
      toast.error(`文本过长（>${CHAT_IMPORT_MAX_CHARS} 字），请删减或分批导入`)
      return
    }
    setImportRaw(text)
    setImportTxtName(filename)
  }

  const readTxtFile = (file: File) => {
    const maxBytes = 12 * 1024 * 1024
    if (file.size > maxBytes) {
      toast.error('文件过大（建议 ≤12MB），请分批导入')
      return
    }
    const lower = file.name.toLowerCase()
    const isTxtName = lower.endsWith('.txt')
    const isTextLike =
      !file.type ||
      file.type === 'text/plain' ||
      file.type.startsWith('text/') ||
      file.type === 'application/octet-stream'
    if (file.type.startsWith('image/') || file.type.startsWith('video/') || file.type.startsWith('audio/')) {
      toast.error('请使用聊天记录导出的 .txt 文本')
      return
    }
    if (!isTxtName && !isTextLike) {
      toast.error('请使用 .txt 或使用「粘贴」导入其他纯文本')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : ''
      if (!text.trim()) {
        toast.error('文件为空或无法解码为文本')
        return
      }
      applyImportedTxt(text, file.name)
      toast.success(`已载入 ${file.name}（${text.length.toLocaleString()} 字）`)
    }
    reader.onerror = () => toast.error('读取文件失败')
    reader.readAsText(file, 'UTF-8')
  }

  const uploadMemberAvatarMutation = useMutation({
    mutationFn: (file: File) =>
      archiveApi.uploadMemberAvatar(Number(archiveId), Number(memberId), file) as Promise<unknown>,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['member', archiveId, memberId] })
      void queryClient.invalidateQueries({ queryKey: ['members', archiveId] })
      toast.success('头像已更新')
    },
    onError: (err) => show(err),
  })

  const deleteMemberAvatarMutation = useMutation({
    mutationFn: () => archiveApi.deleteMemberAvatar(Number(archiveId), Number(memberId)) as Promise<unknown>,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['member', archiveId, memberId] })
      void queryClient.invalidateQueries({ queryKey: ['members', archiveId] })
      toast.success('已恢复默认头像')
    },
    onError: (err) => show(err),
  })

  const importChatMutation = useMutation({
    mutationFn: () =>
      memoryApi.importChat({
        member_id: Number(memberId),
        raw_text: importRaw,
        source: importSource,
        build_graph: true,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['memories', 'member', memberId] })
      queryClient.invalidateQueries({ queryKey: ['mnemo-graph', Number(memberId)] })
      setImportChatOpen(false)
      setImportRaw('')
      setImportTxtName(null)
      toast.success(
        `已导入 ${data.created_count} 条记忆；时间链边 ${data.graph_temporal_edges}，关联边 ${data.graph_llm_edges}`,
      )
    },
    onError: (err) => show(err),
  })

  const EMOTION_OPTIONS = [
    { value: RADIX_SELECT_NONE, label: '（无）' },
    ...EMOTION_LABELS.map((e) => ({ value: e.value, label: `● ${e.label}` })),
  ]

  const emotionSelectValue =
    newMemory.emotion_label === '' ? RADIX_SELECT_NONE : newMemory.emotion_label

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
      queryClient.invalidateQueries({ queryKey: ['mnemo-graph', Number(memberId)] })
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
          <MemberProfile
            member={member}
            actions={
              <>
                <input
                  ref={avatarFileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="sr-only"
                  aria-hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    e.target.value = ''
                    if (f) uploadMemberAvatarMutation.mutate(f)
                  }}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  type="button"
                  loading={uploadMemberAvatarMutation.isPending}
                  onClick={() => avatarFileRef.current?.click()}
                >
                  更换头像
                </Button>
                {Boolean((member as { avatar_url?: string | null }).avatar_url) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    type="button"
                    loading={deleteMemberAvatarMutation.isPending}
                    onClick={() => deleteMemberAvatarMutation.mutate()}
                  >
                    移除头像
                  </Button>
                )}
              </>
            }
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              leftIcon={<MessageCircle size={18} />}
              onClick={() => void navigate(`/dialogue/${archiveId}/${memberId}`)}
            >
              与 Ta 对话
            </Button>
            <Button
              variant="secondary"
              leftIcon={<MessageSquareShare size={18} />}
              onClick={() => setImportChatOpen(true)}
            >
              导入聊天记录
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
        <Card variant="plain" className="mb-6">
          <h2 className="text-body-lg font-medium text-ink-primary mb-3">记忆神经网络</h2>
          <p className="text-caption text-ink-muted mb-4">
            导入 txt 或粘贴记录后，系统写入记忆并由 AI 推断联结；下图按力导向排布，边的颜色表示关系类型（时间链 / 因果 / 主题等）。
          </p>
          <Suspense fallback={<LoadingState message="载入记忆网络…" />}>
            <MemoryRelationGraph memberId={Number(memberId)} />
          </Suspense>
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
            <div>
              <EmptyState
                icon={FileText}
                title="还没有记忆条目"
                description="可「添加记忆」手写；或「导入聊天记录」拖拽/选择 .txt 或粘贴全文，解析后由 AI 绘制记忆网络。"
                action={{ label: '添加记忆', onClick: () => setCreateMemoryModal(true) }}
              />
              <div className="flex justify-center -mt-4 mb-4">
                <Button variant="secondary" size="sm" onClick={() => setImportChatOpen(true)}>
                  导入聊天记录
                </Button>
              </div>
            </div>
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
            value={emotionSelectValue}
            onValueChange={(v) =>
              setNewMemory({
                ...newMemory,
                emotion_label: v === RADIX_SELECT_NONE ? '' : v,
              })
            }
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

      <Modal
        open={importChatOpen}
        onClose={() => {
          setImportChatOpen(false)
          setImportDropActive(false)
        }}
        title="导入聊天记录"
        size="lg"
      >
        <div className="space-y-4">
          <input
            ref={importTxtRef}
            type="file"
            accept=".txt,text/plain"
            className="sr-only"
            aria-hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) readTxtFile(f)
            }}
          />
          <p className="text-caption text-ink-muted leading-relaxed">
            可<strong className="font-medium text-ink-secondary"> 拖拽或选择 .txt </strong>
            （微信/QQ 导出），也可在下方粘贴全文。解析为多段记忆后，由 AI 构建
            <strong className="font-medium text-ink-secondary"> 记忆关系网 </strong>
            （需后台配置可用 LLM；单篇文本上限 {CHAT_IMPORT_MAX_CHARS.toLocaleString()} 字）。
          </p>
          <div
            role="button"
            tabIndex={0}
            className={cn(
              'rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-jade-500/40',
              importDropActive
                ? 'border-jade-500 bg-jade-500/10'
                : 'border-border-default bg-subtle/50 hover:border-jade-400/60',
            )}
            onDragEnter={(e) => {
              e.preventDefault()
              setImportDropActive(true)
            }}
            onDragOver={(e) => {
              e.preventDefault()
              setImportDropActive(true)
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setImportDropActive(false)
            }}
            onDrop={(e) => {
              e.preventDefault()
              setImportDropActive(false)
              const f = e.dataTransfer.files?.[0]
              if (f) readTxtFile(f)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                importTxtRef.current?.click()
              }
            }}
          >
            <Upload className="mx-auto mb-2 h-8 w-8 text-ink-muted" aria-hidden />
            <p className="text-body-sm text-ink-secondary">
              将聊天记录 .txt 拖到此处
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => importTxtRef.current?.click()}
            >
              选择 txt 文件
            </Button>
            {importTxtName ? (
              <p className="text-caption text-jade-700 dark:text-jade-400 mt-2">
                已载入文件：{importTxtName}
              </p>
            ) : null}
          </div>
          <Select
            label="解析模式"
            options={[
              { value: 'auto', label: '自动识别（推荐）' },
              { value: 'wechat', label: '微信风格（日期/昵称行）' },
              { value: 'plain', label: '纯文本：按空行分段' },
            ]}
            value={importSource}
            onValueChange={(v) => setImportSource(v as 'auto' | 'wechat' | 'plain')}
            fullWidth
          />
          <Textarea
            label="聊天原文（可编辑）"
            value={importRaw}
            onChange={(e) => {
              setImportRaw(e.target.value)
              setImportTxtName(null)
            }}
            rows={12}
            placeholder="粘贴全文，或从上方载入 txt…"
            fullWidth
          />
          <div className="flex gap-3">
            <Button variant="ghost" type="button" onClick={() => setImportChatOpen(false)} fullWidth>
              取消
            </Button>
            <Button
              type="button"
              loading={importChatMutation.isPending}
              disabled={!importRaw.trim()}
              onClick={() => importChatMutation.mutate()}
              fullWidth
            >
              导入并构建关系网
            </Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  )
}
