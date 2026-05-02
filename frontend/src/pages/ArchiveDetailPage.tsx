/**
 * 档案详情页
 */
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { motion } from 'motion/react'
import { Plus, MessageCircle, Clock, BookOpen, Users, FileText, Trash2, PencilLine, Download, Upload, Copy, Pin } from 'lucide-react'
import { archiveApi, memoryApi } from '@/services/api'
import { ARCHIVE_TYPE_OPTIONS, formatDate } from '@/lib/utils'
import type { MemberStatus } from '@/lib/memberStatus'
import { memberStatusToApi } from '@/lib/memberStatus'
import { staggerContainer, fadeUp } from '@/lib/motion'
import MemoryCard from '@/components/memory/MemoryCard'
import MemoryDetailDrawer from '@/components/memory/MemoryDetailDrawer'
import type { Memory } from '@/services/memoryTypes'
import Modal from '@/components/ui/Modal'
import { useState, useRef, useEffect } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import { LoadingState, ErrorState, EmptyState } from '@/components/ui'
import { useApiError } from '@/hooks/useApiError'
import MemberStatusBadge from '@/components/member/MemberStatusBadge'
import MemberStatusInput from '@/components/member/MemberStatusInput'
import Avatar from '@/components/ui/Avatar'

type NewMemberState = {
  name: string
  relationship: string
  birth_year?: number
  status: MemberStatus
  end_year?: number
  bio: string
}

export default function ArchiveDetailPage() {
  const { id } = useParams<{ id: string }>()
  const archiveId = id != null && id !== '' ? Number(id) : NaN
  const archiveIdValid = Number.isInteger(archiveId) && archiveId > 0
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { show } = useApiError()

  const [createMemberModal, setCreateMemberModal] = useState(false)
  const [newMember, setNewMember] = useState<NewMemberState>({
    name: '',
    relationship: '',
    birth_year: undefined,
    status: 'alive',
    end_year: undefined,
    bio: '',
  })
  const [activeMemory, setActiveMemory] = useState<Memory | null>(null)
  const [confirmDeleteArchive, setConfirmDeleteArchive] = useState(false)
  const [renameArchiveOpen, setRenameArchiveOpen] = useState(false)
  const [renameArchiveName, setRenameArchiveName] = useState('')
  /** 二次确认删除成员（档案下的角色卡片） */
  const [confirmDeleteMember, setConfirmDeleteMember] = useState<{ id: number; name: string } | null>(null)

  /** 克隆/备份等多选的角色 id */
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<number>>(() => new Set())
  const backupFileRef = useRef<HTMLInputElement>(null)

  /** 「国家历史」档案：非遗名录式著录草稿 */
  const [heritageDraft, setHeritageDraft] = useState({
    heritage_origin_regions: '',
    heritage_listing_level: '',
    heritage_inscribed_year: '',
  })

  const { data: archive, isLoading, error, refetch } = useQuery({
    queryKey: ['archive', id],
    queryFn: () => archiveApi.get(archiveId) as any,
    enabled: archiveIdValid,
  })

  useEffect(() => {
    if (!archive || typeof archive !== 'object') return
    const a = archive as {
      heritage_origin_regions?: string | null
      heritage_listing_level?: string | null
      heritage_inscribed_year?: string | null
    }
    setHeritageDraft({
      heritage_origin_regions: String(a.heritage_origin_regions ?? ''),
      heritage_listing_level: String(a.heritage_listing_level ?? ''),
      heritage_inscribed_year: String(a.heritage_inscribed_year ?? ''),
    })
  }, [archive])

  const { data: members = [] } = useQuery({
    queryKey: ['members', id],
    queryFn: () => archiveApi.listMembers(archiveId) as any,
    enabled: archiveIdValid,
  })

  /** 档案总览卡片「AI 对话」：仅一名成员时直达双段路由（与 useDialogue 持久化一致），否则进选择页 */
  const dialogueFromArchiveHref =
    members.length === 1 ? `/dialogue/${id}/${(members[0] as { id: number }).id}` : '/dialogue'

  const { data: memories = [] } = useQuery({
    queryKey: ['memories', 'archive', id],
    queryFn: () => memoryApi.list({ archive_id: archiveId }) as any,
    enabled: archiveIdValid,
  })

  /** 全程可用：成员卡片多选克隆 / 备份，不依赖档案详情是否加载成功 */
  const memberRows = members as { id: number; name?: string }[]
  const memberNameById = (mid: number) =>
    memberRows.find((m) => Number(m.id) === mid)?.name ?? ''

  const allMemberSelectableIds = memberRows
    .map((m) => Number(m.id))
    .filter((x) => Number.isInteger(x) && x > 0)

  const toggleSelectMember = (mid: number) => {
    setSelectedMemberIds((prev) => {
      const n = new Set(prev)
      if (n.has(mid)) n.delete(mid)
      else n.add(mid)
      return n
    })
  }

  const toggleSelectAllMembers = () => {
    setSelectedMemberIds((prev) => {
      if (prev.size >= allMemberSelectableIds.length && allMemberSelectableIds.length > 0) {
        return new Set()
      }
      return new Set(allMemberSelectableIds)
    })
  }

  const createMemberMutation = useMutation({
    retry: 0,
    mutationFn: (data: NewMemberState) => {
      if (!archiveIdValid) {
        return Promise.reject(new Error('ARCHIVE_ID_INVALID'))
      }
      const state = data.status ?? 'alive'
      const status = memberStatusToApi(state)
      // 与地址栏 /archives/:id 使用同一数字，避免与接口返回的 id 字段不同步时拼出 /archives/undefined|NaN/members
      return archiveApi.createMember(archiveId, {
        name: data.name.trim(),
        relationship_type: data.relationship.trim(),
        birth_year: data.birth_year,
        status,
        end_year: state === 'alive' ? undefined : data.end_year,
        bio: data.bio?.trim() || undefined,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', id] })
      setCreateMemberModal(false)
      setNewMember({
        name: '',
        relationship: '',
        birth_year: undefined,
        status: 'alive',
        end_year: undefined,
        bio: '',
      })
      toast.success('成员添加成功')
    },
    onError: (err) => {
      if (err instanceof Error && err.message === 'ARCHIVE_ID_INVALID') {
        toast.error('档案 ID 无效，请从档案库重新进入', { id: 'add-member' })
        return
      }
      if (err instanceof Error && err.message.startsWith('INVALID_ARCHIVE_ID_IN_PATH')) {
        toast.error('档案 ID 无效，请刷新或从档案库重新进入', { id: 'add-member' })
        return
      }
      show(err)
    },
  })

  const deleteMemberMutation = useMutation({
    mutationFn: (memberId: number) =>
      archiveIdValid ? archiveApi.deleteMember(archiveId, memberId) : Promise.reject(new Error('ARCHIVE_ID_INVALID')),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', id] })
      queryClient.invalidateQueries({ queryKey: ['memories', 'archive', id] })
      setConfirmDeleteMember(null)
      toast.success('成员已删除')
    },
    onError: (err: unknown) => {
      if (err instanceof Error && err.message === 'ARCHIVE_ID_INVALID') {
        toast.error('档案无效，无法删除')
        return
      }
      show(err as Error)
    },
  })

  const deleteArchiveMutation = useMutation({
    mutationFn: () =>
      archiveIdValid ? archiveApi.delete(archiveId) : Promise.reject(new Error('ARCHIVE_ID_INVALID')),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['archives'] })
      setConfirmDeleteArchive(false)
      toast.success('档案已删除')
      navigate('/archives')
    },
    onError: (err: unknown) => {
      if (err instanceof Error && err.message === 'ARCHIVE_ID_INVALID') {
        toast.error('档案无效，无法删除')
        return
      }
      show(err as Error)
    },
  })

  const renameArchiveMutation = useMutation({
    mutationFn: (nextName: string) =>
      archiveIdValid
        ? (archiveApi.update(archiveId, { name: nextName.trim() }) as Promise<unknown>)
        : Promise.reject(new Error('ARCHIVE_ID_INVALID')),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['archive', id] })
      void queryClient.invalidateQueries({ queryKey: ['archives'] })
      setRenameArchiveOpen(false)
      setRenameArchiveName('')
      toast.success('档案名称已更新')
    },
    onError: (err: unknown) => {
      if (err instanceof Error && err.message === 'ARCHIVE_ID_INVALID') {
        toast.error('档案无效，无法重命名')
        return
      }
      show(err as Error)
    },
  })

  const saveHeritageMutation = useMutation({
    mutationFn: () => {
      if (!archiveIdValid) {
        return Promise.reject(new Error('ARCHIVE_ID_INVALID'))
      }
      const trimOrNull = (s: string) => {
        const t = s.trim()
        return t.length > 0 ? t : null
      }
      return archiveApi.update(archiveId, {
        heritage_origin_regions: trimOrNull(heritageDraft.heritage_origin_regions),
        heritage_listing_level: trimOrNull(heritageDraft.heritage_listing_level),
        heritage_inscribed_year: trimOrNull(heritageDraft.heritage_inscribed_year),
      }) as Promise<unknown>
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['archive', id] })
      void queryClient.invalidateQueries({ queryKey: ['archives'] })
      toast.success('著录信息已保存')
    },
    onError: (err: unknown) => {
      if (err instanceof Error && err.message === 'ARCHIVE_ID_INVALID') {
        toast.error('档案无效')
        return
      }
      show(err as Error)
    },
  })

  const togglePinArchiveMutation = useMutation({
    mutationFn: (next: boolean) =>
      archiveIdValid
        ? (archiveApi.update(archiveId, { is_pinned: next }) as Promise<unknown>)
        : Promise.reject(new Error('ARCHIVE_ID_INVALID')),
    onSuccess: (_d, next) => {
      void queryClient.invalidateQueries({ queryKey: ['archive', id] })
      void queryClient.invalidateQueries({ queryKey: ['archives'] })
      toast.success(next ? '已置顶' : '已取消置顶')
    },
    onError: (err: unknown) => {
      if (err instanceof Error && err.message === 'ARCHIVE_ID_INVALID') {
        toast.error('档案无效')
        return
      }
      show(err as Error)
    },
  })

  const downloadRolesBackupMutation = useMutation({
    mutationFn: () =>
      archiveIdValid ? archiveApi.downloadRolesBackup(archiveId, true) : Promise.reject(new Error('ARCHIVE_ID_INVALID')),
    onSuccess: (blob: Blob) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `mtc-archive-${archiveId}-roles-backup.json`
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success('角色备份已开始下载')
    },
    onError: (err: unknown) => {
      if (err instanceof Error && err.message === 'ARCHIVE_ID_INVALID') {
        toast.error('档案无效')
        return
      }
      show(err as Error)
    },
  })

  const restoreRolesBackupMutation = useMutation({
    mutationFn: async (jsonText: string): Promise<Record<string, unknown>> => {
      if (!archiveIdValid) {
        throw new Error('ARCHIVE_ID_INVALID')
      }
      let data: Record<string, unknown>
      try {
        data = JSON.parse(jsonText) as Record<string, unknown>
      } catch {
        throw new Error('INVALID_JSON_BACKUP')
      }
      if (data.format !== 'mtc-archive-roles-v1' && data.format !== 'mtc-archive-roles-v2') {
        throw new Error('INVALID_BACKUP_FORMAT')
      }
      const out = await archiveApi.restoreRolesBackup(archiveId, data)
      return out as unknown as Record<string, unknown>
    },
    onSuccess: (res: Record<string, unknown>) => {
      void queryClient.invalidateQueries({ queryKey: ['members', id] })
      void queryClient.invalidateQueries({ queryKey: ['memories', 'archive', id] })
      void queryClient.invalidateQueries({ queryKey: ['archive', id] })
      void queryClient.invalidateQueries({ queryKey: ['archives'] })
      setSelectedMemberIds(new Set())
      const ids = Array.isArray(res.created_member_ids) ? res.created_member_ids.length : 0
      const mc = typeof res.memories_created === 'number' ? res.memories_created : 0
      const mg =
        typeof (res as { mnemo_nodes_created?: number }).mnemo_nodes_created === 'number'
          ? (res as { mnemo_nodes_created: number }).mnemo_nodes_created
          : 0
      toast.success(
        `已从备份导入 ${ids} 名角色，记忆 ${mc} 条` +
          (mg > 0 ? `，关系网节点 ${mg} 个` : ''),
      )
    },
    onError: (err: unknown) => {
      if (err instanceof Error && err.message === 'ARCHIVE_ID_INVALID') {
        toast.error('档案无效')
        return
      }
      if (err instanceof Error && err.message === 'INVALID_JSON_BACKUP') {
        toast.error('文件不是合法的 JSON')
        return
      }
      if (err instanceof Error && err.message === 'INVALID_BACKUP_FORMAT') {
        toast.error('不是 MTC 角色备份文件（format 须为 mtc-archive-roles-v1 / v2）')
        return
      }
      show(err as Error)
    },
  })

  const cloneMembersMutation = useMutation({
    mutationFn: async (ids: number[]): Promise<Record<string, unknown>> => {
      if (!archiveIdValid) {
        throw new Error('ARCHIVE_ID_INVALID')
      }
      const out = await archiveApi.cloneMembers(archiveId, { member_ids: ids })
      return out as unknown as Record<string, unknown>
    },
    onSuccess: (res: Record<string, unknown>) => {
      void queryClient.invalidateQueries({ queryKey: ['members', id] })
      void queryClient.invalidateQueries({ queryKey: ['memories', 'archive', id] })
      void queryClient.invalidateQueries({ queryKey: ['archive', id] })
      void queryClient.invalidateQueries({ queryKey: ['mnemo-graph'] })
      setSelectedMemberIds(new Set())
      const cl = Array.isArray(res.cloned) ? res.cloned.length : 0
      const mc = typeof res.memories_copied === 'number' ? res.memories_copied : 0
      const mn =
        typeof (res as { mnemo_nodes_copied?: number }).mnemo_nodes_copied === 'number'
          ? (res as { mnemo_nodes_copied: number }).mnemo_nodes_copied
          : 0
      toast.success(
        mn > 0
          ? `已克隆 ${cl} 名角色（记忆 ${mc} 条，关系网节点 ${mn} 个）`
          : `已克隆 ${cl} 名角色（记忆 ${mc} 条）`,
      )
    },
    onError: (err: unknown) => {
      if (err instanceof Error && err.message === 'ARCHIVE_ID_INVALID') {
        toast.error('档案无效')
        return
      }
      show(err as Error)
    },
  })

  if (!archiveIdValid) {
    return <EmptyState title="无效的档案链接" description="请从档案库重新进入" />
  }

  if (isLoading) {
    return <LoadingState message="正在加载档案…" />
  }
  if (error) {
    return <ErrorState error={error} onRetry={() => void refetch()} />
  }
  if (!archive) {
    return <EmptyState title="档案不存在" description="请从档案库重新进入" />
  }

  const typeInfo = ARCHIVE_TYPE_OPTIONS.find((t) => t.value === String(archive.archive_type))

  return (
    <motion.div
      variants={staggerContainer()}
      initial="hidden"
      animate="visible"
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"
    >
      <motion.div variants={fadeUp} className="text-caption text-ink-muted mb-4">
        <Link to="/archives" className="hover:text-jade-600">
          档案库
        </Link>
        <span className="mx-2">/</span>
        <span className="text-ink-primary">{String(archive.name)}</span>
      </motion.div>

      <motion.div variants={fadeUp}>
        <Card variant="plain">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <span className="text-4xl">{typeInfo?.icon ?? '📁'}</span>
              <div>
                <h1 className="text-2xl font-display text-ink-primary">{String(archive.name)}</h1>
                <p className="text-ink-secondary mt-1 text-body">
                  {typeInfo?.label} · 创建于 {formatDate(String(archive.created_at))}
                </p>
                {archive.description ? (
                  <p className="text-ink-primary mt-2 text-body max-w-2xl">{String(archive.description)}</p>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0 justify-end">
              <Button
                variant="ghost"
                size="sm"
                type="button"
                leftIcon={<Pin size={16} />}
                loading={togglePinArchiveMutation.isPending}
                onClick={() =>
                  togglePinArchiveMutation.mutate(
                    !Boolean((archive as { is_pinned?: boolean }).is_pinned),
                  )
                }
              >
                {Boolean((archive as { is_pinned?: boolean }).is_pinned) ? '取消置顶' : '置顶'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                leftIcon={<PencilLine size={16} />}
                onClick={() => {
                  setRenameArchiveName(String(archive.name))
                  setRenameArchiveOpen(true)
                }}
              >
                重命名
              </Button>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                className="text-red-600 hover:bg-red-50"
                leftIcon={<Trash2 size={16} />}
                onClick={() => setConfirmDeleteArchive(true)}
              >
                删除档案
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <a href="#section-members" className="block no-underline text-inherit min-h-0">
              <Card hoverable variant="accent" padding="sm" className="h-full text-center">
                <Users size={20} className="mx-auto text-ink-muted mb-1" />
                <div className="text-xl font-semibold font-serif tabular-nums text-ink-primary">
                  {String(archive.member_count ?? 0)}
                </div>
                <div className="text-caption text-ink-muted">成员</div>
              </Card>
            </a>
            <a href="#section-memories" className="block no-underline text-inherit min-h-0">
              <Card hoverable variant="accent" padding="sm" className="h-full text-center">
                <FileText size={20} className="mx-auto text-ink-muted mb-1" />
                <div className="text-xl font-semibold font-serif tabular-nums text-ink-primary">
                  {String(archive.memory_count ?? 0)}
                </div>
                <div className="text-caption text-ink-muted">记忆</div>
              </Card>
            </a>
            <Link
              to={dialogueFromArchiveHref}
              className="block no-underline text-inherit min-h-0"
            >
              <Card hoverable variant="accent" padding="sm" className="h-full text-center">
                <MessageCircle size={20} className="mx-auto text-jade-600 mb-1" />
                <div className="text-sm font-medium text-jade-700">AI 对话</div>
              </Card>
            </Link>
            <Link
              to={`/timeline/${id}`}
              className="block no-underline text-inherit min-h-0"
            >
              <Card hoverable variant="accent" padding="sm" className="h-full text-center">
                <Clock size={20} className="mx-auto text-amber-600 mb-1" />
                <div className="text-sm font-medium text-amber-800">时间线</div>
              </Card>
            </Link>
          </div>
        </Card>
      </motion.div>

      {String(archive.archive_type) === 'nation' ? (
        <motion.div variants={fadeUp} className="mt-6">
          <Card variant="plain">
            <h2 className="text-body-lg font-medium text-ink-primary">国家与非遗著录</h2>
            <p className="text-caption text-ink-muted mb-4 max-w-3xl">
              可记录发源地与主要流传区域、名录层级（如代表作名录、急需保护名录或国家/省级名录），以及列入年份或批次。体裁参考 UNESCO
              申报材料中的申报地域、名录类型等字段，便于整理与检索。
            </p>
            <div className="space-y-4 max-w-2xl">
              <Textarea
                label="发源地与主要流传 / 申报地域"
                rows={3}
                value={heritageDraft.heritage_origin_regions}
                onChange={(e) =>
                  setHeritageDraft((d) => ({ ...d, heritage_origin_regions: e.target.value }))
                }
                placeholder="例：福建泉州；多国联合申报可逐条写出"
                fullWidth
              />
              <Input
                label="名录层级"
                value={heritageDraft.heritage_listing_level}
                onChange={(e) =>
                  setHeritageDraft((d) => ({ ...d, heritage_listing_level: e.target.value }))
                }
                placeholder="例：人类非物质文化遗产代表作名录 / 国家级非物质文化遗产"
                fullWidth
              />
              <Input
                label="列入年份或批次"
                value={heritageDraft.heritage_inscribed_year}
                onChange={(e) =>
                  setHeritageDraft((d) => ({ ...d, heritage_inscribed_year: e.target.value }))
                }
                placeholder="例：2008 · 第一批 ；或自拟批次说明"
                fullWidth
              />
            </div>
            <Button
              className="mt-4"
              variant="primary"
              type="button"
              loading={saveHeritageMutation.isPending}
              onClick={() => saveHeritageMutation.mutate()}
            >
              保存著录
            </Button>
          </Card>
        </motion.div>
      ) : null}

      <motion.div variants={fadeUp} className="mt-6" id="section-members">
        <Card variant="plain" className="mb-6">
          <div className="flex flex-col gap-3 mb-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-body-lg font-medium text-ink-primary">成员（角色）</h2>
              <Button size="sm" leftIcon={<Plus size={16} />} onClick={() => setCreateMemberModal(true)}>
                添加成员
              </Button>
            </div>
            {members.length > 0 ? (
              <div className="flex flex-col gap-2 rounded-xl bg-warm-50/80 dark:bg-subtle border border-border-default/70 px-3 py-2.5">
                <input
                  ref={backupFileRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  aria-hidden="true"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    e.target.value = ''
                    if (!f) return
                    void (async () => {
                      try {
                        const txt = await f.text()
                        restoreRolesBackupMutation.mutate(txt)
                      } catch {
                        toast.error('无法读取所选文件')
                      }
                    })()
                  }}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    loading={downloadRolesBackupMutation.isPending}
                    disabled={members.length === 0}
                    leftIcon={<Download size={14} />}
                    onClick={() => downloadRolesBackupMutation.mutate()}
                  >
                    备份 JSON
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    loading={restoreRolesBackupMutation.isPending}
                    leftIcon={<Upload size={14} />}
                    onClick={() => backupFileRef.current?.click()}
                  >
                    从备份导入
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    loading={cloneMembersMutation.isPending}
                    disabled={selectedMemberIds.size === 0}
                    leftIcon={<Copy size={14} />}
                    onClick={() => {
                      const ids = [...selectedMemberIds]
                      if (ids.length === 0) return
                      const ok = window.confirm(
                        `将克隆 ${ids.length} 名角色到本档案（名称后加后缀并复制记忆与 Mnemo 关系网拓扑）；向量索引不会自动补齐。确定继续？`,
                      )
                      if (!ok) return
                      cloneMembersMutation.mutate(ids)
                    }}
                  >
                    克隆选中
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={toggleSelectAllMembers}>
                    {selectedMemberIds.size >= allMemberSelectableIds.length &&
                    allMemberSelectableIds.length > 0
                      ? '取消全选'
                      : '全选角色'}
                  </Button>
                  <span className="text-caption text-ink-muted whitespace-nowrap">
                    已选 {selectedMemberIds.size}/{members.length}
                  </span>
                </div>
                <p className="text-caption text-ink-muted leading-relaxed">
                  备份导出全部角色、记忆与各成员的 <strong>Mnemo 关系网</strong>；
                  「从备份导入」会在<strong>当前档案</strong>
                  末尾追加角色。克隆在本档案内复制角色并复制关系网拓扑（语义向量需另行重建）。
                </p>
              </div>
            ) : null}
          </div>

          {members.length === 0 ? (
            <EmptyState
              icon={Users}
              title="还没有成员"
              description="为这段关系添加第一位成员"
              action={{ label: '添加成员', onClick: () => setCreateMemberModal(true) }}
            />
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {members.map((member: Record<string, unknown>) => {
                const m = member as {
                  id: number
                  name: string
                  relationship?: string
                  relationship_type?: string
                  birth_year?: number
                  end_year?: number
                  status?: string
                  avatar_url?: string | null
                }
                const rel = m.relationship ?? m.relationship_type ?? ''
                const selected = selectedMemberIds.has(m.id)
                return (
                  <div key={m.id} className="flex gap-3 items-stretch">
                    <label className="flex items-start shrink-0 cursor-pointer pt-4">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-border-default text-jade-600 focus:ring-jade-500"
                        checked={selected}
                        onChange={() => toggleSelectMember(m.id)}
                        aria-label={`选中角色：${m.name}`}
                      />
                    </label>
                    <div className="relative flex-1 min-w-0">
                      <Link to={`/archives/${id}/members/${m.id}`} className="block no-underline text-inherit">
                        <Card hoverable className="h-full pr-[5.25rem]">
                          <div className="flex items-start gap-3 min-w-0">
                            <Avatar
                              src={m.avatar_url ?? undefined}
                              name={m.name}
                              size={48}
                              className="shrink-0 ring-2 ring-border-default"
                            />
                            <div className="min-w-0 flex-1">
                              <h3 className="font-medium text-ink-primary truncate">{m.name}</h3>
                              {rel && <p className="text-sm text-ink-secondary truncate">{rel}</p>}
                            </div>
                          </div>
                          <div className="mt-3">
                            <MemberStatusBadge
                              status={m.status}
                              birthYear={m.birth_year}
                              endYear={m.end_year}
                            />
                          </div>
                        </Card>
                      </Link>
                      <div
                        className="absolute top-2.5 right-2.5 z-10 flex items-center gap-0.5 rounded-lg bg-warm-50/95 dark:bg-subtle border border-border-default/70 shadow-e1 p-0.5"
                        onClick={(e) => e.stopPropagation()}
                        role="toolbar"
                        aria-label={`${m.name} 的操作`}
                      >
                        <Link
                          to={`/dialogue/${id}/${m.id}`}
                          className="p-2 rounded-md text-jade-600 hover:bg-jade-500/10 transition-colors"
                          title="AI 对话"
                          aria-label={`与 ${m.name} 对话`}
                        >
                          <MessageCircle size={18} aria-hidden />
                        </Link>
                        <button
                          type="button"
                          aria-label={`删除成员 ${m.name}`}
                          className="p-2 rounded-md text-ink-muted hover:bg-red-50 hover:text-red-600 transition-colors"
                          onClick={() => setConfirmDeleteMember({ id: m.id, name: m.name })}
                        >
                          <Trash2 size={18} aria-hidden />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </motion.div>

      <motion.div variants={fadeUp} id="section-memories">
        <Card variant="plain">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-medium text-ink-primary text-body-lg">记忆</h2>
            <Link
              to={`/storybook/${id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
            >
              <BookOpen size={16} />
              生成故事书
            </Link>
          </div>

          {memories.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="还没有记忆条目"
              description="从成员页或此处后续入口添加你的第一条记忆"
            />
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {memories.slice(0, 6).map((memory: Record<string, unknown>) => {
                const mem = memory
                const rec: Memory = {
                  id: Number(mem.id),
                  title: String(mem.title ?? ''),
                  content_text: String(mem.content_text ?? ''),
                  timestamp: mem.timestamp as string | null | undefined,
                  created_at: (mem.created_at as string | null | undefined) ?? undefined,
                  location: mem.location as string | null | undefined,
                  emotion_label: mem.emotion_label as string | null | undefined,
                  member_id: Number(mem.member_id),
                  archive_id: Number(archive.id),
                }
                return (
                  <MemoryCard
                    key={String(mem.id)}
                    {...rec}
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
        memberName={activeMemory ? memberNameById(activeMemory.member_id) : ''}
        onClose={() => setActiveMemory(null)}
        onDelete={
          activeMemory
            ? async () => {
                try {
                  const mid = activeMemory.member_id
                  await memoryApi.delete(activeMemory.id)
                  void queryClient.invalidateQueries({ queryKey: ['memories', 'archive', id] })
                  void queryClient.invalidateQueries({ queryKey: ['mnemo-graph', mid] })
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
        open={renameArchiveOpen}
        onClose={() => {
          setRenameArchiveOpen(false)
          setRenameArchiveName('')
        }}
        title="重命名档案"
        size="md"
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            const t = renameArchiveName.trim()
            if (!t) {
              toast.error('名称不能为空')
              return
            }
            if (t === String(archive.name).trim()) {
              setRenameArchiveOpen(false)
              setRenameArchiveName('')
              return
            }
            renameArchiveMutation.mutate(t)
          }}
        >
          <Input
            label="档案名称"
            value={renameArchiveName}
            onChange={(e) => setRenameArchiveName(e.target.value)}
            placeholder="新的档案名称"
            fullWidth
            required
            autoFocus
          />
          <div className="flex gap-3 pt-2">
            <Button
              variant="ghost"
              type="button"
              fullWidth
              onClick={() => {
                setRenameArchiveOpen(false)
                setRenameArchiveName('')
              }}
            >
              取消
            </Button>
            <Button type="submit" variant="primary" fullWidth loading={renameArchiveMutation.isPending}>
              保存
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={confirmDeleteArchive}
        onClose={() => setConfirmDeleteArchive(false)}
        title="删除档案"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-body-sm text-ink-secondary">
            确定删除「{String(archive.name)}」？其成员、记忆与媒体等将一并移除（不可撤销）。
          </p>
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" type="button" onClick={() => setConfirmDeleteArchive(false)} fullWidth>
              取消
            </Button>
            <Button
              variant="primary"
              type="button"
              fullWidth
              className="!bg-red-600 hover:!bg-red-700"
              loading={deleteArchiveMutation.isPending}
              onClick={() => deleteArchiveMutation.mutate()}
            >
              删除
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={confirmDeleteMember != null}
        onClose={() => setConfirmDeleteMember(null)}
        title="删除成员"
        size="md"
      >
        {confirmDeleteMember ? (
          <div className="space-y-4">
            <p className="text-body-sm text-ink-secondary">
              确定删除「{confirmDeleteMember.name}」及其关联条目吗？此操作不可撤销。
            </p>
            <div className="flex gap-3 pt-2">
              <Button variant="ghost" type="button" onClick={() => setConfirmDeleteMember(null)} fullWidth>
                取消
              </Button>
              <Button
                variant="primary"
                type="button"
                fullWidth
                className="!bg-red-600 hover:!bg-red-700"
                loading={deleteMemberMutation.isPending}
                onClick={() => deleteMemberMutation.mutate(confirmDeleteMember.id)}
              >
                删除
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={createMemberModal} onClose={() => setCreateMemberModal(false)} title="添加成员" size="lg">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (createMemberMutation.isPending) return
            if (!archiveIdValid || !archive) {
              toast.error('档案未加载完成，请稍后再试', { id: 'add-member' })
              return
            }
            createMemberMutation.mutate(newMember)
          }}
          className="space-y-4"
        >
          <Input
            label="姓名"
            value={newMember.name}
            onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
            placeholder="成员的姓名"
            fullWidth
            required
          />
          <Input
            label="关系"
            value={newMember.relationship}
            onChange={(e) => setNewMember({ ...newMember, relationship: e.target.value })}
            placeholder="例如：父亲、妻子、挚友"
            fullWidth
            required
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              type="number"
              label="出生年份"
              value={newMember.birth_year ?? ''}
              onChange={(e) =>
                setNewMember({
                  ...newMember,
                  birth_year: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              placeholder="例：1960"
              fullWidth
            />
          </div>
          <MemberStatusInput
            status={newMember.status}
            endYear={newMember.end_year}
            onStatusChange={(next) => setNewMember({ ...newMember, status: next })}
            onEndYearChange={(next) => setNewMember({ ...newMember, end_year: next })}
          />
          <Textarea
            label="简介（可选）"
            value={newMember.bio}
            onChange={(e) => setNewMember({ ...newMember, bio: e.target.value })}
            rows={3}
            fullWidth
          />
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" type="button" onClick={() => setCreateMemberModal(false)} fullWidth>
              取消
            </Button>
            <Button type="submit" loading={createMemberMutation.isPending} fullWidth>
              添加
            </Button>
          </div>
        </form>
      </Modal>
    </motion.div>
  )
}
