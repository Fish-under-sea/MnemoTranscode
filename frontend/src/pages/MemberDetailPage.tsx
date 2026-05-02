/**
 * 成员详情页
 */
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { FileText, MessageCircle, Plus, MessageSquareShare, Trash2, Upload } from 'lucide-react'
import { motion } from 'motion/react'
import { lazy, Suspense, useState, useRef, useEffect, useMemo } from 'react'
import { archiveApi, memoryApi, mediaApi } from '@/services/api'
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
import { LoadingState, ErrorState, EmptyState, ConfirmDialog } from '@/components/ui'
import { useApiError } from '@/hooks/useApiError'
import MemberProfile from '@/components/member/MemberProfile'
import { fadeUp, staggerContainer } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { savePendingChatImport } from '@/lib/chatImportSession'
import { buildClientLlmPayload } from '@/lib/buildClientLlmPayload'
import { readStoredLlmUserConfig } from '@/hooks/useLlmUserConfig'

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
  const [importBuildGraph, setImportBuildGraph] = useState(true)
  const [importAiRefine, setImportAiRefine] = useState(true)
  const [importDropActive, setImportDropActive] = useState(false)

  const [selectedMemoryIds, setSelectedMemoryIds] = useState<Set<number>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [deleteAllMemoriesOpen, setDeleteAllMemoriesOpen] = useState(false)

  const avatarFileRef = useRef<HTMLInputElement>(null)
  const masterCheckboxRef = useRef<HTMLInputElement>(null)
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
        build_graph: importBuildGraph,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['memories', 'member', memberId] })
      queryClient.invalidateQueries({ queryKey: ['mnemo-graph', Number(memberId)] })
      setImportChatOpen(false)
      setImportRaw('')
      setImportTxtName(null)
      toast.success(
        `已导入 ${data.created_count} 条记忆；时间链边 ${data.graph_temporal_edges}，关联边 ${data.graph_llm_edges}` +
          (data.vectors_deferred ? '（大批量已暂缓写入语义向量，对话时会逐步补齐）' : ''),
      )
    },
    onError: (err) => show(err),
  })

  const startChatImportOnProgressPage = () => {
    if (!importRaw.trim()) {
      toast.error('请先粘贴或载入聊天记录文本')
      return
    }
    if (!archiveId || !memberId) return

    // 开启 AI 精炼但浏览器未携带密钥时，服务端须有 LLM_*；提前提示避免进度页才看到 401
    if (importAiRefine) {
      const cfg = readStoredLlmUserConfig()
      const llm = buildClientLlmPayload(cfg)
      const hasBrowserKey = !!(llm?.api_key && llm.api_key.trim())
      if (cfg.mode !== 'ollama' && (!llm || !hasBrowserKey)) {
        toast(
          '提示：当前未在「模型设置」保存 API Key，导入将仅靠服务端 LLM 环境变量；若遇 401，请到模型配置填写密钥并保存。',
          { duration: 6500, icon: 'ℹ️' },
        )
      }
    }

    let jobId: string
    try {
      ;({ jobId } = savePendingChatImport({
        member_id: Number(memberId),
        archive_id: Number(archiveId),
        raw_text: importRaw,
        source: importSource,
        build_graph: importBuildGraph,
        ai_refine: importAiRefine,
        client_llm: buildClientLlmPayload(readStoredLlmUserConfig()) ?? undefined,
      }))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '无法写入临时数据')
      return
    }
    const path = `/archives/${archiveId}/members/${memberId}/chat-import`
    const q = new URLSearchParams({ job: jobId })
    setImportChatOpen(false)
    toast.success('正在进入 AI 导入进度页，请保持页面直至完成')
    navigate(`${path}?${q.toString()}`)
  }

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

  const {
    data: memories,
    isError: memoriesIsError,
    error: memoriesQueryError,
    refetch: refetchMemories,
  } = useQuery({
    queryKey: ['memories', 'member', memberId],
    queryFn: () => memoryApi.list({ member_id: Number(memberId), limit: 500 }) as any,
    enabled: !!memberId,
  })
  const memoriesList = memories ?? []

  const memoryListIds = useMemo(
    () => memoriesList.map((m: { id: unknown }) => Number(m.id)),
    [memoriesList],
  )

  useEffect(() => {
    const el = masterCheckboxRef.current
    if (!el) return
    const n = memoryListIds.length
    const sel = selectedMemoryIds.size
    el.checked = n > 0 && sel === n
    el.indeterminate = sel > 0 && sel < n
  }, [memoryListIds, selectedMemoryIds])

  useEffect(() => {
    const allowed = new Set(memoryListIds)
    setSelectedMemoryIds((prev) => {
      let prune = false
      const next = new Set<number>()
      prev.forEach((id) => {
        if (allowed.has(id)) next.add(id)
        else prune = true
      })
      return prune || next.size !== prev.size ? next : prev
    })
  }, [memoryListIds])

  const onMasterCheckboxChange = () => {
    if (selectedMemoryIds.size === memoryListIds.length && memoryListIds.length > 0) {
      setSelectedMemoryIds(new Set())
    } else {
      setSelectedMemoryIds(new Set(memoryListIds))
    }
  }

  const toggleMemorySelected = (id: number) => {
    setSelectedMemoryIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

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

  const batchDeleteMemoriesMutation = useMutation({
    mutationFn: (memory_ids: number[]) =>
      memoryApi.batchDelete({ memory_ids, member_id: Number(memberId) }),
    onSuccess: (data, memory_ids) => {
      void queryClient.invalidateQueries({ queryKey: ['memories', 'member', memberId] })
      void queryClient.invalidateQueries({ queryKey: ['mnemo-graph', Number(memberId)] })
      setSelectedMemoryIds(new Set())
      setBulkDeleteOpen(false)
      setDeleteAllMemoriesOpen(false)
      if (activeMemory && memory_ids.includes(activeMemory.id)) {
        setActiveMemory(null)
      }
      toast.success(`已删除 ${data.deleted_count} 条记忆`)
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
              {memoriesIsError ? '记忆列表加载失败' : `${memoriesList.length} 条记忆`}
            </span>
          </div>
        </Card>
      </motion.div>

      <motion.div variants={fadeUp}>
        <Card variant="plain" className="mb-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
            <div>
              <h2 className="text-body-lg font-medium text-ink-primary">珍藏 · 影像与表情</h2>
              <p className="text-caption text-ink-muted mt-1">
                区分照片、音视频与表情包；表情包上传后将尝试自动识图并写入标签（需模型支持图像输入）。
              </p>
            </div>
            <div className="flex flex-col items-stretch gap-2 sm:items-end shrink-0">
              <MediaUploader
                autoClassify
                memberId={Number(memberId)}
                onComplete={() => {
                  void queryClient.invalidateQueries({ queryKey: ['member-media', Number(memberId)] })
                  void queryClient.invalidateQueries({ queryKey: ['dashboard', 'usage'] })
                }}
              />
              <MediaUploader
                purpose="archive_sticker"
                memberId={Number(memberId)}
                onComplete={(assets) => {
                  void queryClient.invalidateQueries({ queryKey: ['member-media', Number(memberId)] })
                  void queryClient.invalidateQueries({ queryKey: ['dashboard', 'usage'] })
                  void Promise.allSettled(
                    assets
                      .filter((a) => String(a.purpose) === 'archive_sticker')
                      .map((a) =>
                        mediaApi.analyzeStickerTags(a.id).then((out) => {
                          // 后端 HTTP 200 也会把失败写进 extras.sticker_analyze_error，须显式判错
                          const ex = out.extras
                          const errRaw =
                            ex &&
                            typeof ex === 'object' &&
                            typeof (ex as { sticker_analyze_error?: unknown }).sticker_analyze_error ===
                              'string' ?
                              String((ex as { sticker_analyze_error: string }).sticker_analyze_error)
                            : null
                          if (errRaw) {
                            throw new Error(errRaw)
                          }
                          return out
                        }),
                      ),
                  )
                    .then((results) => {
                      void queryClient.invalidateQueries({ queryKey: ['member-media', Number(memberId)] })
                      const failed = results.filter((r) => r.status === 'rejected')
                      if (failed.length === 0 && results.length > 0) {
                        toast.success('表情包已上传，AI 标注已写入')
                        return
                      }
                      if (failed.length > 0) {
                        const first =
                          failed[0]?.status === 'rejected' && failed[0].reason instanceof Error ?
                            failed[0].reason.message
                          : ''
                        const detail =
                          first.slice(0, 240) ||
                          '请检查 backend/.env 的 LLM_BASE_URL、LLM_API_KEY、LLM_MODEL（须支持 image_url 多模态）。'
                        toast.error(
                          `表情包已上传，${failed.length} 条 AI 标注未成功：${detail}${
                            failed.length > 1 ? ` 等共 ${failed.length} 条` : ''
                          }`,
                        )
                      }
                    })
                    .catch(() => {
                      void queryClient.invalidateQueries({ queryKey: ['member-media', Number(memberId)] })
                    })
                }}
              />
            </div>
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
            <h2 className="font-medium text-ink-primary text-body-lg flex items-center gap-2">
              <FileText size={18} />
              记忆 ({memoriesIsError ? '—' : memoriesList.length})
            </h2>
            <Button size="sm" leftIcon={<Plus size={16} />} onClick={() => setCreateMemoryModal(true)}>
              添加记忆
            </Button>
          </div>

          {memoriesIsError ? (
            <ErrorState error={memoriesQueryError ?? '无法加载记忆列表'} onRetry={() => void refetchMemories()} />
          ) : memoriesList.length === 0 ? (
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
            <>
              <div className="flex flex-wrap items-center gap-3 mb-4 pb-3 border-b border-border-default">
                <label className="inline-flex items-center gap-2 text-body-sm text-ink-secondary cursor-pointer select-none">
                  <input
                    ref={masterCheckboxRef}
                    type="checkbox"
                    className="h-4 w-4 rounded border-border-default text-jade-600 focus:ring-jade-500"
                    onChange={onMasterCheckboxChange}
                  />
                  全选
                </label>
                <span className="text-caption text-ink-muted">
                  已选 {selectedMemoryIds.size} / {memoriesList.length}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  leftIcon={<Trash2 size={14} />}
                  disabled={selectedMemoryIds.size === 0 || batchDeleteMemoriesMutation.isPending}
                  onClick={() => setBulkDeleteOpen(true)}
                >
                  删除选中
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  leftIcon={<Trash2 size={14} />}
                  disabled={batchDeleteMemoriesMutation.isPending}
                  onClick={() => setDeleteAllMemoriesOpen(true)}
                >
                  删除本页全部
                </Button>
              </div>
              <p className="text-caption text-ink-muted -mt-2 mb-4">
                当前列表最多加载 500 条；若成员下记忆更多，请分批删除或后续再扩展分页。
              </p>
              <div className="space-y-4">
                {memoriesList.map((memory: Record<string, unknown>) => {
                  const m = memory
                  const rec: Memory = {
                    id: Number(m.id),
                    title: String(m.title ?? ''),
                    content_text: String(m.content_text ?? ''),
                    timestamp: m.timestamp as string | null | undefined,
                    created_at: (m.created_at as string | null | undefined) ?? undefined,
                    location: m.location as string | null | undefined,
                    emotion_label: m.emotion_label as string | null | undefined,
                    member_id: Number(m.member_id),
                    archive_id: Number(archiveId),
                  }
                  const mid = rec.id
                  return (
                    <div key={String(m.id)} className={cn('flex gap-3 items-stretch')}>
                      <label className="flex items-start pt-4 shrink-0 cursor-pointer">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-border-default text-jade-600 focus:ring-jade-500"
                          checked={selectedMemoryIds.has(mid)}
                          onChange={() => toggleMemorySelected(mid)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`选择记忆：${rec.title}`}
                        />
                      </label>
                      <div className="flex-1 min-w-0">
                        <MemoryCard {...rec} variant="list" onClick={() => setActiveMemory(rec)} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </Card>
      </motion.div>

      <ConfirmDialog
        open={bulkDeleteOpen}
        title="删除选中的记忆"
        description={`确定删除已选中的 ${selectedMemoryIds.size} 条记忆？删除后不可恢复。`}
        confirmText="删除"
        variant="danger"
        loading={batchDeleteMemoriesMutation.isPending}
        onCancel={() => setBulkDeleteOpen(false)}
        onConfirm={() => void batchDeleteMemoriesMutation.mutateAsync([...selectedMemoryIds])}
      />
      <ConfirmDialog
        open={deleteAllMemoriesOpen}
        title="删除本页全部记忆"
        description={`将删除当前列表中的全部 ${memoryListIds.length} 条记忆（单页最多 500 条），删除后不可恢复。`}
        confirmText="全部删除"
        variant="danger"
        loading={batchDeleteMemoriesMutation.isPending}
        onCancel={() => setDeleteAllMemoriesOpen(false)}
        onConfirm={() => void batchDeleteMemoriesMutation.mutateAsync([...memoryListIds])}
      />

      <MemoryDetailDrawer
        memory={activeMemory}
        memberName={member.name}
        onClose={() => setActiveMemory(null)}
        onDelete={
          activeMemory
            ? async () => {
                try {
                  await memoryApi.delete(activeMemory.id)
                  void queryClient.invalidateQueries({ queryKey: ['memories', 'member', memberId] })
                  void queryClient.invalidateQueries({ queryKey: ['mnemo-graph', Number(memberId)] })
                  setSelectedMemoryIds((prev) => {
                    const next = new Set(prev)
                    next.delete(activeMemory.id)
                    return next
                  })
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
            （微信/QQ 导出），也可在下方粘贴全文。
            <strong className="font-medium text-ink-secondary"> 推荐 </strong>
            使用「跳转 AI 导入进度页」：规则分段后由多批 LLM 提炼为记忆条目（类「分析—写入」管线），并
            <strong className="font-medium text-ink-secondary"> 实时显示进度</strong>。
            单篇上限 {CHAT_IMPORT_MAX_CHARS.toLocaleString()} 字。
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
          <div className="space-y-2 rounded-xl border border-border-default bg-subtle/40 px-3 py-3">
            <label className="flex cursor-pointer items-start gap-2 text-body-sm text-ink-secondary">
              <input
                type="checkbox"
                className="mt-1 rounded border-border-default"
                checked={importAiRefine}
                onChange={(e) => setImportAiRefine(e.target.checked)}
              />
              <span>
                使用 AI 精炼记忆正文（多批处理，需配置 LLM；关则仅保留解析分段，与旧版相近）
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 text-body-sm text-ink-secondary">
              <input
                type="checkbox"
                className="mt-1 rounded border-border-default"
                checked={importBuildGraph}
                onChange={(e) => setImportBuildGraph(e.target.checked)}
              />
              <span>导入后构建记忆关系网（时间链 + LLM 联结）</span>
            </label>
          </div>
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
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button variant="ghost" type="button" onClick={() => setImportChatOpen(false)} fullWidth>
              取消
            </Button>
            <Button
              type="button"
              variant="secondary"
              loading={importChatMutation.isPending}
              disabled={!importRaw.trim()}
              onClick={() => importChatMutation.mutate()}
              fullWidth
            >
              单次请求导入（无进度页）
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={!importRaw.trim()}
              onClick={startChatImportOnProgressPage}
              fullWidth
            >
              跳转 AI 导入进度页
            </Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  )
}
