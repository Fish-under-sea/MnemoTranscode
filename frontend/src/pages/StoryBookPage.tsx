/**
 * 故事书生成页面
 */
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { BookOpen, Loader2 } from 'lucide-react'
import { archiveApi, memoryApi } from '@/services/api'

const STORY_STYLES = [
  { value: 'nostalgic', label: '怀旧温情', desc: '像翻看老照片一样温暖' },
  { value: 'literary', label: '文学风格', desc: '优美的散文叙事' },
  { value: 'simple', label: '简洁平实', desc: '朴实无华的叙述' },
  { value: 'dialogue', label: '对话为主', desc: '以对话展现故事' },
]

export default function StoryBookPage() {
  const { archiveId } = useParams<{ archiveId: string }>()
  const [style, setStyle] = useState('nostalgic')
  const [story, setStory] = useState('')
  const [generating, setGenerating] = useState(false)

  const { data: archive } = useQuery({
    queryKey: ['archive', archiveId],
    queryFn: () => archiveApi.get(Number(archiveId)) as any,
    enabled: !!archiveId,
  })

  const { data: members = [] } = useQuery({
    queryKey: ['members', archiveId],
    queryFn: () => archiveApi.listMembers(Number(archiveId)) as any,
    enabled: !!archiveId,
  })

  const { data: memories = [] } = useQuery({
    queryKey: ['memories', 'archive', archiveId],
    queryFn: () => memoryApi.list({ archive_id: Number(archiveId), limit: 100 }) as any,
    enabled: !!archiveId,
  })

  const generateStory = async () => {
    if (memories.length === 0) {
      toast.error('暂无记忆数据，无法生成故事')
      return
    }
    setGenerating(true)
    try {
      const response = await fetch('/api/v1/storybook/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          archive_id: Number(archiveId),
          member_id: members[0]?.id,
          memories,
          style,
        }),
      })
      const data = await response.json()
      setStory(data.story || '故事生成服务暂不可用，请稍后再试。')
    } catch {
      toast.error('生成失败，请稍后重试')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{archive?.name} — 家族故事书</h1>
        <p className="text-gray-500 mt-1">
          基于 {memories.length} 条记忆自动生成
        </p>
      </div>

      {/* 风格选择 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
        <h2 className="font-medium text-gray-900 mb-4">选择故事风格</h2>
        <div className="grid grid-cols-2 gap-3">
          {STORY_STYLES.map((s) => (
            <button
              key={s.value}
              onClick={() => setStyle(s.value)}
              className={`p-4 rounded-xl border text-left transition-base ${
                style === s.value
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-medium text-gray-900">{s.label}</div>
              <div className="text-xs text-gray-500 mt-1">{s.desc}</div>
            </button>
          ))}
        </div>

        <button
          onClick={generateStory}
          disabled={generating || memories.length === 0}
          className="mt-6 w-full py-3 bg-accent-coral text-white rounded-xl hover:bg-accent-coral/90 disabled:opacity-50 transition-base flex items-center justify-center gap-2 font-medium"
        >
          {generating ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              AI 正在创作中...
            </>
          ) : (
            <>
              <BookOpen size={18} />
              生成故事书
            </>
          )}
        </button>
      </div>

      {/* 故事内容 */}
      {story && (
        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-semibold text-gray-900">
              {archive?.name} 的故事
            </h2>
            <button
              onClick={() => navigator.clipboard.writeText(story)}
              className="text-sm text-primary-600 hover:underline"
            >
              复制全文
            </button>
          </div>
          <div className="prose prose-gray max-w-none">
            <p className="whitespace-pre-wrap text-gray-700 leading-relaxed">{story}</p>
          </div>
        </div>
      )}
    </div>
  )
}
