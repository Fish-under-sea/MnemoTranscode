/**
 * 档案详情页
 */
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { motion } from 'motion/react'
import { Plus, MessageCircle, Clock, BookOpen, Users, FileText, Trash2 } from 'lucide-react'
import { archiveApi, memoryApi } from '@/services/api'
import { ARCHIVE_TYPE_OPTIONS, formatDate } from '@/lib/utils'
import type { MemberStatus } from '@/lib/memberStatus'
import { memberStatusToApi } from '@/lib/memberStatus'
import { staggerContainer, fadeUp } from '@/lib/motion'
import MemoryCard from '@/components/memory/MemoryCard'
import MemoryDetailDrawer from '@/components/memory/MemoryDetailDrawer'
import type { Memory } from '@/services/memoryTypes'
import Modal from '@/components/ui/Modal'
import { useState } from 'react'
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
  /** 二次确认删除成员（档案下的角色卡片） */
  const [confirmDeleteMember, setConfirmDeleteMember] = useState<{ id: number; name: string } | null>(null)

  const { data: archive, isLoading, error, refetch } = useQuery({
    queryKey: ['archive', id],
    queryFn: () => archiveApi.get(archiveId) as any,
    enabled: archiveIdValid,
  })

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

  const memberRows = members as { id: number; name?: string }[]
  const memberNameById = (mid: number) => memberRows.find((m) => Number(m.id) === mid)?.name ?? ''

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
            <Button
              variant="ghost"
              size="sm"
              type="button"
              className="shrink-0 text-red-600 hover:bg-red-50"
              leftIcon={<Trash2 size={16} />}
              onClick={() => setConfirmDeleteArchive(true)}
            >
              删除档案
            </Button>
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

      <motion.div variants={fadeUp} className="mt-6" id="section-members">
        <Card variant="plain" className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-body-lg font-medium text-ink-primary">成员</h2>
            <Button
              size="sm"
              leftIcon={<Plus size={16} />}
              onClick={() => setCreateMemberModal(true)}
            >
              添加成员
            </Button>
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
                return (
                  <div key={m.id} className="relative">
                    <Link
                      to={`/archives/${id}/members/${m.id}`}
                      className="block no-underline text-inherit"
                    >
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
