/**
 * 首页仪表盘
 */
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, FolderOpen, MessageCircle, Clock, BookOpen } from 'lucide-react'
import { archiveApi } from '@/services/api'
import { ARCHIVE_TYPE_OPTIONS } from '@/lib/utils'

export default function DashboardPage() {
  const navigate = useNavigate()
  const { data: archives = [], isLoading } = useQuery({
    queryKey: ['archives'],
    queryFn: () => archiveApi.list() as any,
  })

  const stats = {
    total: archives.length,
    byType: ARCHIVE_TYPE_OPTIONS.reduce((acc, type) => {
      acc[type.value] = archives.filter((a: any) => a.archive_type === type.value).length
      return acc
    }, {} as Record<string, number>),
  }

  const recentArchives = archives.slice(0, 3)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 欢迎区 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">欢迎回来</h1>
        <p className="text-gray-500 mt-1">每一段记忆都值得被守护</p>
      </div>

      {/* 快捷入口 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <button
          onClick={() => navigate('/archives')}
          className="p-4 bg-white rounded-xl border border-gray-200 hover:shadow-md hover:border-primary-200 transition-base text-left"
        >
          <FolderOpen size={24} className="text-primary-600 mb-2" />
          <div className="font-medium text-gray-900">档案库</div>
          <div className="text-sm text-gray-500">{stats.total} 个档案</div>
        </button>

        <button
          onClick={() => navigate('/dialogue')}
          className="p-4 bg-white rounded-xl border border-gray-200 hover:shadow-md hover:border-primary-200 transition-base text-left"
        >
          <MessageCircle size={24} className="text-accent-green mb-2" />
          <div className="font-medium text-gray-900">AI 对话</div>
          <div className="text-sm text-gray-500">与记忆对话</div>
        </button>

        <button
          onClick={() => navigate('/archives')}
          className="p-4 bg-white rounded-xl border border-gray-200 hover:shadow-md hover:border-primary-200 transition-base text-left"
        >
          <Clock size={24} className="text-accent-orange mb-2" />
          <div className="font-medium text-gray-900">时间线</div>
          <div className="text-sm text-gray-500">记忆编年史</div>
        </button>

        <button
          onClick={() => navigate('/archives')}
          className="p-4 bg-white rounded-xl border border-gray-200 hover:shadow-md hover:border-primary-200 transition-base text-left"
        >
          <BookOpen size={24} className="text-accent-coral mb-2" />
          <div className="font-medium text-gray-900">故事书</div>
          <div className="text-sm text-gray-500">生成回忆录</div>
        </button>
      </div>

      {/* 档案类型分布 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
        <h2 className="font-medium text-gray-900 mb-4">档案分布</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {ARCHIVE_TYPE_OPTIONS.map((type) => (
            <div key={type.value} className="text-center">
              <div className="text-2xl mb-1">{type.icon}</div>
              <div className="text-sm text-gray-600">{type.label}</div>
              <div className="text-lg font-semibold text-gray-900">
                {stats.byType[type.value] || 0}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 最近档案 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-medium text-gray-900">最近访问</h2>
          <button
            onClick={() => navigate('/archives')}
            className="text-sm text-primary-600 hover:underline"
          >
            查看全部
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-gray-500">加载中...</div>
        ) : recentArchives.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">还没有任何档案</p>
            <button
              onClick={() => navigate('/archives')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-base"
            >
              <Plus size={18} />
              创建第一个档案
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-4">
            {recentArchives.map((archive: any) => (
              <div
                key={archive.id}
                onClick={() => navigate(`/archives/${archive.id}`)}
                className="p-4 rounded-lg border border-gray-200 hover:border-primary-200 hover:bg-primary-50/50 cursor-pointer transition-base"
              >
                <div className="font-medium text-gray-900">{archive.name}</div>
                <div className="text-sm text-gray-500 mt-1">
                  {ARCHIVE_TYPE_OPTIONS.find((t) => t.value === archive.archive_type)?.icon}{' '}
                  {ARCHIVE_TYPE_OPTIONS.find((t) => t.value === archive.archive_type)?.label}
                </div>
                <div className="text-xs text-gray-400 mt-2">
                  {archive.member_count} 成员 · {archive.memory_count} 条记忆
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
