/**
 * 档案详情页
 */
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, MessageCircle, Clock, BookOpen, Users, FileText, Edit2, Trash2 } from 'lucide-react'
import { archiveApi, memoryApi } from '@/services/api'
import { ARCHIVE_TYPE_OPTIONS, formatDate } from '@/lib/utils'
import MemoryCard from '@/components/memory/MemoryCard'
import Modal from '@/components/ui/Modal'
import { useState } from 'react'

export default function ArchiveDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [createMemberModal, setCreateMemberModal] = useState(false)
  const [newMember, setNewMember] = useState({
    name: '',
    relationship: '',
    birth_year: undefined as number | undefined,
    death_year: undefined as number | undefined,
    bio: '',
  })

  const { data: archive, isLoading } = useQuery({
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
    mutationFn: (data: typeof newMember) => archiveApi.createMember(Number(id), data) as any,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', id] })
      setCreateMemberModal(false)
      setNewMember({ name: '', relationship: '', birth_year: undefined, death_year: undefined, bio: '' })
      toast.success('成员添加成功')
    },
  })

  if (isLoading) {
    return <div className="text-center py-12">加载中...</div>
  }

  if (!archive) {
    return <div className="text-center py-12 text-gray-500">档案不存在</div>
  }

  const typeInfo = ARCHIVE_TYPE_OPTIONS.find((t) => t.value === archive.archive_type)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 面包屑 */}
      <div className="text-sm text-gray-500 mb-4">
        <Link to="/archives" className="hover:text-primary-600">档案库</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">{archive.name}</span>
      </div>

      {/* 档案头部 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <span className="text-4xl">{typeInfo?.icon || '📁'}</span>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{archive.name}</h1>
              <p className="text-gray-500 mt-1">
                {typeInfo?.label} · 创建于 {formatDate(archive.created_at)}
              </p>
              {archive.description && (
                <p className="text-gray-600 mt-2">{archive.description}</p>
              )}
            </div>
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <Users size={20} className="mx-auto text-gray-400 mb-1" />
            <div className="text-xl font-semibold text-gray-900">{archive.member_count}</div>
            <div className="text-xs text-gray-500">成员</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <FileText size={20} className="mx-auto text-gray-400 mb-1" />
            <div className="text-xl font-semibold text-gray-900">{archive.memory_count}</div>
            <div className="text-xs text-gray-500">记忆</div>
          </div>
          <Link
            to={`/dialogue/${id}`}
            className="bg-primary-50 rounded-lg p-4 text-center hover:bg-primary-100 transition-base"
          >
            <MessageCircle size={20} className="mx-auto text-primary-600 mb-1" />
            <div className="text-sm font-medium text-primary-700">AI 对话</div>
          </Link>
          <Link
            to={`/timeline/${id}`}
            className="bg-accent-orange/10 rounded-lg p-4 text-center hover:bg-accent-orange/20 transition-base"
          >
            <Clock size={20} className="mx-auto text-accent-orange mb-1" />
            <div className="text-sm font-medium text-accent-orange">时间线</div>
          </Link>
        </div>
      </div>

      {/* 成员列表 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">成员</h2>
          <button
            onClick={() => setCreateMemberModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-base"
          >
            <Plus size={16} />
            添加成员
          </button>
        </div>

        {members.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            还没有成员，点击上方按钮添加
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {members.map((member: any) => (
              <div
                key={member.id}
                className="p-4 rounded-xl border border-gray-200 hover:border-primary-200 hover:bg-primary-50/30 cursor-pointer transition-base"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900">{member.name}</h3>
                    <p className="text-sm text-gray-500">{member.relationship}</p>
                  </div>
                  <Link
                    to={`/dialogue/${id}/${member.id}`}
                    className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg"
                    title="与此人对话"
                  >
                    <MessageCircle size={18} />
                  </Link>
                </div>
                <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
                  {member.birth_year && (
                    <span>{member.birth_year} 年出生</span>
                  )}
                  {member.death_year && (
                    <span>— {member.death_year} 年</span>
                  )}
                  {member.is_alive === false && (
                    <span className="text-gray-400">已故</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 记忆列表 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">记忆</h2>
          <Link
            to={`/storybook/${id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-accent-coral hover:bg-accent-coral/10 rounded-lg transition-base"
          >
            <BookOpen size={16} />
            生成故事书
          </Link>
        </div>

        {memories.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            还没有记忆条目
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {memories.slice(0, 6).map((memory: any) => (
              <MemoryCard
                key={memory.id}
                id={memory.id}
                title={memory.title}
                content_text={memory.content_text}
                timestamp={memory.timestamp}
                location={memory.location}
                emotion_label={memory.emotion_label}
                member_id={memory.member_id}
                archive_id={archive.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* 添加成员弹窗 */}
      <Modal
        open={createMemberModal}
        onClose={() => setCreateMemberModal(false)}
        title="添加成员"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            createMemberMutation.mutate(newMember)
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">姓名</label>
            <input
              type="text"
              value={newMember.name}
              onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
              placeholder="成员的姓名"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">关系</label>
            <input
              type="text"
              value={newMember.relationship}
              onChange={(e) => setNewMember({ ...newMember, relationship: e.target.value })}
              placeholder="例如：父亲、妻子、挚友"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">出生年份</label>
              <input
                type="number"
                value={newMember.birth_year || ''}
                onChange={(e) => setNewMember({ ...newMember, birth_year: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="例：1960"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">去世年份（可选）</label>
              <input
                type="number"
                value={newMember.death_year || ''}
                onChange={(e) => setNewMember({ ...newMember, death_year: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="如已故"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">简介（可选）</label>
            <textarea
              value={newMember.bio}
              onChange={(e) => setNewMember({ ...newMember, bio: e.target.value })}
              rows={3}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none resize-none"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setCreateMemberModal(false)}
              className="flex-1 py-2.5 border border-gray-300 rounded-lg"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={createMemberMutation.isPending}
              className="flex-1 py-2.5 bg-primary-600 text-white rounded-lg disabled:opacity-50"
            >
              {createMemberMutation.isPending ? '添加中...' : '添加'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
