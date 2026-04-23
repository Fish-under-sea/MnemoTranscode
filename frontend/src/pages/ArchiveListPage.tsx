/**
 * 档案列表页
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, Search } from 'lucide-react'
import { archiveApi } from '@/services/api'
import { ARCHIVE_TYPE_OPTIONS } from '@/lib/utils'
import ArchiveCard from '@/components/memory/ArchiveCard'
import Modal from '@/components/ui/Modal'

export default function ArchiveListPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string>('')
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [newArchive, setNewArchive] = useState({
    name: '',
    description: '',
    archive_type: 'family',
  })

  const { data: archives = [], isLoading } = useQuery({
    queryKey: ['archives', filterType],
    queryFn: () => archiveApi.list(filterType || undefined) as any,
  })

  const createMutation = useMutation({
    mutationFn: (data: typeof newArchive) => archiveApi.create(data) as any,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['archives'] })
      setCreateModalOpen(false)
      setNewArchive({ name: '', description: '', archive_type: 'family' })
      toast.success('档案创建成功')
    },
    onError: () => toast.error('创建失败'),
  })

  const filteredArchives = archives.filter((a: any) =>
    a.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 页面标题 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">档案库</h1>
          <p className="text-gray-500 mt-1">管理你的所有记忆档案</p>
        </div>
        <button
          onClick={() => setCreateModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-base"
        >
          <Plus size={18} />
          新建档案
        </button>
      </div>

      {/* 搜索和筛选 */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索档案..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterType('')}
            className={`px-3 py-2 rounded-lg text-sm transition-base ${
              filterType === ''
                ? 'bg-primary-100 text-primary-700'
                : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            全部
          </button>
          {ARCHIVE_TYPE_OPTIONS.map((type) => (
            <button
              key={type.value}
              onClick={() => setFilterType(type.value)}
              className={`px-3 py-2 rounded-lg text-sm transition-base ${
                filterType === type.value
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {type.icon} {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* 档案列表 */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">加载中...</div>
      ) : filteredArchives.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500 mb-4">
            {search ? '没有找到匹配的档案' : '还没有任何档案'}
          </p>
          {!search && (
            <button
              onClick={() => setCreateModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-base"
            >
              <Plus size={18} />
              创建第一个档案
            </button>
          )}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredArchives.map((archive: any) => (
            <ArchiveCard
              key={archive.id}
              id={archive.id}
              name={archive.name}
              description={archive.description}
              archive_type={archive.archive_type}
              member_count={archive.member_count}
              memory_count={archive.memory_count}
            />
          ))}
        </div>
      )}

      {/* 创建档案弹窗 */}
      <Modal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="新建档案"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            createMutation.mutate(newArchive)
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">档案名称</label>
            <input
              type="text"
              value={newArchive.name}
              onChange={(e) => setNewArchive({ ...newArchive, name: e.target.value })}
              placeholder="例如：李家族谱、致青春"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">档案类型</label>
            <div className="grid grid-cols-2 gap-2">
              {ARCHIVE_TYPE_OPTIONS.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setNewArchive({ ...newArchive, archive_type: type.value })}
                  className={`p-3 rounded-lg border text-sm text-left transition-base ${
                    newArchive.archive_type === type.value
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="mr-2">{type.icon}</span>
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">描述（可选）</label>
            <textarea
              value={newArchive.description}
              onChange={(e) => setNewArchive({ ...newArchive, description: e.target.value })}
              placeholder="简单描述这个档案的内容..."
              rows={3}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="flex-1 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-base"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex-1 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-base"
            >
              {createMutation.isPending ? '创建中...' : '创建'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
