/**
 * 成员详情页
 */
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, MessageCircle, FileText } from 'lucide-react'
import { archiveApi, memoryApi } from '@/services/api'
import MemoryCard from '@/components/memory/MemoryCard'
import Modal from '@/components/ui/Modal'
import { useState } from 'react'
import { formatDate } from '@/lib/utils'

export default function MemberDetailPage() {
  const { archiveId, memberId } = useParams<{ archiveId: string; memberId: string }>()
  const queryClient = useQueryClient()

  const [createMemoryModal, setCreateMemoryModal] = useState(false)
  const [newMemory, setNewMemory] = useState({
    title: '',
    content_text: '',
    timestamp: '',
    location: '',
    emotion_label: '',
  })

  const { data: member } = useQuery({
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
        ...data,
        timestamp: data.timestamp ? new Date(data.timestamp).toISOString() : undefined,
      }) as any,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memories', 'member', memberId] })
      setCreateMemoryModal(false)
      setNewMemory({ title: '', content_text: '', timestamp: '', location: '', emotion_label: '' })
      toast.success('记忆创建成功')
    },
  })

  if (!member) return <div className="text-center py-12">加载中...</div>

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 面包屑 */}
      <div className="text-sm text-gray-500 mb-4">
        <Link to="/archives" className="hover:text-primary-600">档案库</Link>
        <span className="mx-2">/</span>
        <Link to={`/archives/${archiveId}`} className="hover:text-primary-600">
          {member?.archive_id}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">{member.name}</span>
      </div>

      {/* 成员信息卡片 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{member.name}</h1>
            <p className="text-gray-500 mt-1">{member.relationship}</p>
          </div>
          <Link
            to={`/dialogue/${archiveId}/${memberId}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-base"
          >
            <MessageCircle size={18} />
            与 {member.name} 对话
          </Link>
        </div>

        {member.bio && <p className="mt-4 text-gray-600">{member.bio}</p>}

        <div className="mt-4 flex items-center gap-4 text-sm text-gray-500">
          {member.birth_year && <span>出生于 {member.birth_year} 年</span>}
          {member.death_year && <span>于 {member.death_year} 年去世</span>}
          {!member.is_alive && member.death_year === null && <span className="text-gray-400">已故</span>}
          <span className="ml-auto">{memories.length} 条记忆</span>
        </div>
      </div>

      {/* 记忆列表 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <FileText size={18} />
            记忆 ({memories.length})
          </h2>
          <button
            onClick={() => setCreateMemoryModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-base"
          >
            <Plus size={16} />
            添加记忆
          </button>
        </div>

        {memories.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            还没有记忆条目，讲述你们的故事吧
          </div>
        ) : (
          <div className="space-y-4">
            {memories.map((memory: any) => (
              <MemoryCard
                key={memory.id}
                id={memory.id}
                title={memory.title}
                content_text={memory.content_text}
                timestamp={memory.timestamp}
                location={memory.location}
                emotion_label={memory.emotion_label}
                member_id={memory.member_id}
                archive_id={Number(archiveId)}
              />
            ))}
          </div>
        )}
      </div>

      {/* 添加记忆弹窗 */}
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">记忆标题</label>
            <input
              type="text"
              value={newMemory.title}
              onChange={(e) => setNewMemory({ ...newMemory, title: e.target.value })}
              placeholder="给这段记忆起个名字"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">记忆内容</label>
            <textarea
              value={newMemory.content_text}
              onChange={(e) => setNewMemory({ ...newMemory, content_text: e.target.value })}
              rows={6}
              placeholder="详细描述这段记忆..."
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none resize-none"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">发生时间</label>
              <input
                type="datetime-local"
                value={newMemory.timestamp}
                onChange={(e) => setNewMemory({ ...newMemory, timestamp: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">地点</label>
              <input
                type="text"
                value={newMemory.location}
                onChange={(e) => setNewMemory({ ...newMemory, location: e.target.value })}
                placeholder="例如：北京、上海"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setCreateMemoryModal(false)} className="flex-1 py-2.5 border border-gray-300 rounded-lg">取消</button>
            <button type="submit" disabled={createMemoryMutation.isPending} className="flex-1 py-2.5 bg-primary-600 text-white rounded-lg disabled:opacity-50">
              {createMemoryMutation.isPending ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
