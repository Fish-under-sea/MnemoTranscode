/**
 * 档案详情页
 */
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { motion } from 'motion/react'
import { Plus, MessageCircle, Clock, BookOpen, Users, FileText } from 'lucide-react'
import { archiveApi, memoryApi } from '@/services/api'
import { ARCHIVE_TYPE_OPTIONS, formatDate } from '@/lib/utils'
import type { MemberStatus } from '@/lib/memberStatus'
import { staggerContainer, fadeUp } from '@/lib/motion'
import MemoryCard from '@/components/memory/MemoryCard'
import Modal from '@/components/ui/Modal'
import { useState } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/state'
import { useApiError } from '@/hooks/useApiError'
import MemberStatusBadge from '@/components/member/MemberStatusBadge'
import MemberStatusInput from '@/components/member/MemberStatusInput'

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

  const { data: archive, isLoading, error, refetch } = useQuery({
    queryKey: ['archive', id],
    queryFn: () => archiveApi.get(Number(id)) as any,
    enabled: !!id,
  })

  const { data: members = [] } = useQuery({
    queryKey: ['members', id],
    queryFn: () => archiveApi.listMembers(Number(id)) as any,
    enabled: !!id,
  })

  const { data: memories = [] } = useQuery({
    queryKey: ['memories', 'archive', id],
    queryFn: () => memoryApi.list({ archive_id: Number(id) }) as any,
    enabled: !!id,
  })

  const createMemberMutation = useMutation({
    mutationFn: (data: NewMemberState) =>
      archiveApi.createMember(Number(id), {
        name: data.name,
        relationship_type: data.relationship,
        birth_year: data.birth_year,
        status: data.status,
        end_year: data.status === 'alive' ? undefined : data.end_year,
        bio: data.bio,
      }),
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
    onError: (err) => show(err),
  })

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
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
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
              to={`/dialogue/${id}`}
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
                }
                const rel = m.relationship ?? m.relationship_type ?? ''
                return (
                  <Link
                    key={m.id}
                    to={`/archives/${id}/members/${m.id}`}
                    className="block no-underline text-inherit"
                  >
                    <Card hoverable className="h-full">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-medium text-ink-primary truncate">{m.name}</h3>
                          {rel && <p className="text-sm text-ink-secondary">{rel}</p>}
                        </div>
                        <MessageCircle size={18} className="shrink-0 text-jade-600" aria-hidden />
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
                return (
                  <MemoryCard
                    key={String(mem.id)}
                    id={Number(mem.id)}
                    title={String(mem.title ?? '')}
                    content_text={String(mem.content_text ?? '')}
                    timestamp={mem.timestamp as string | null | undefined}
                    location={mem.location as string | null | undefined}
                    emotion_label={mem.emotion_label as string | null | undefined}
                    member_id={Number(mem.member_id)}
                    archive_id={Number(archive.id)}
                  />
                )
              })}
            </div>
          )}
        </Card>
      </motion.div>

      <Modal open={createMemberModal} onClose={() => setCreateMemberModal(false)} title="添加成员" size="lg">
        <form
          onSubmit={(e) => {
            e.preventDefault()
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
