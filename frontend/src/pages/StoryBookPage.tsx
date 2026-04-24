// frontend/src/pages/StoryBookPage.tsx
import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'motion/react'
import { BookOpen, Loader2 } from 'lucide-react'
import { archiveApi, memoryApi, storybookApi } from '@/services/api'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import Badge from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import PageTransition from '@/components/ui/PageTransition'
import { LoadingState } from '@/components/ui/state'
import { useApiError } from '@/hooks/useApiError'
import StoryPreview from '@/components/storybook/StoryPreview'
import { fadeUp, fadeIn, staggerContainer } from '@/lib/motion'
import { cn } from '@/lib/utils'

const STORY_STYLES = [
  { value: 'nostalgic', label: '怀旧温情', desc: '像翻看老照片一样温暖', emoji: '📸' },
  { value: 'literary', label: '文学风格', desc: '优美的散文叙事', emoji: '✍️' },
  { value: 'simple', label: '简洁平实', desc: '朴实无华的叙述', emoji: '📄' },
  { value: 'dialogue', label: '对话为主', desc: '以对话展现故事', emoji: '💬' },
] as const

type StyleValue = (typeof STORY_STYLES)[number]['value']

const PROGRESS_TEXTS = [
  '正在整理记忆碎片…',
  '正在编织故事线索…',
  '正在润色语言…',
  '即将完成…',
]

export default function StoryBookPage() {
  const { archiveId } = useParams<{ archiveId: string }>()
  const archiveIdNum = Number(archiveId)
  const [style, setStyle] = useState<StyleValue>('nostalgic')
  const [selectedMemberId, setSelectedMemberId] = useState<string>('all')
  const [story, setStory] = useState<{ text: string; memberName: string; memCount: number } | null>(null)
  const [generating, setGenerating] = useState(false)
  const [progressIdx, setProgressIdx] = useState(0)
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const { show: showError } = useApiError()

  const { data: archive, isLoading: archiveLoading } = useQuery({
    queryKey: ['archive', archiveIdNum],
    queryFn: () => archiveApi.get(archiveIdNum) as any,
  })

  const { data: members = [] } = useQuery({
    queryKey: ['members', archiveIdNum],
    queryFn: () => archiveApi.listMembers(archiveIdNum) as any,
    enabled: !!archiveIdNum,
  })

  const { data: memoriesRaw } = useQuery({
    queryKey: ['memories', 'archive', archiveIdNum],
    queryFn: () => memoryApi.list({ archive_id: archiveIdNum, limit: 100 }) as any,
    enabled: !!archiveIdNum,
  })

  const memories = Array.isArray(memoriesRaw) ? memoriesRaw : (memoriesRaw?.items ?? [])

  // 进度文案循环
  useEffect(() => {
    if (generating) {
      setProgressIdx(0)
      progressIntervalRef.current = setInterval(() => {
        setProgressIdx((prev) => (prev + 1) % PROGRESS_TEXTS.length)
      }, 1500)
    } else {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
    }
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
    }
  }, [generating])

  const memberOptions = [
    { value: 'all', label: '全部成员' },
    ...(members as any[]).map((m: any) => ({ value: String(m.id), label: m.name })),
  ]

  const handleGenerate = async () => {
    if (memories.length === 0) {
      showError(new Error('暂无记忆数据，无法生成故事'), '暂无记忆数据')
      return
    }
    setGenerating(true)
    setStory(null)
    try {
      const memberIdNum = selectedMemberId !== 'all' ? Number(selectedMemberId) : undefined
      const result = await storybookApi.generate({
        archive_id: archiveIdNum,
        member_id: memberIdNum,
        style,
      })
      const selectedMember = memberIdNum
        ? (members as any[]).find((m: any) => m.id === memberIdNum)
        : null
      setStory({
        text: result.story,
        memberName: selectedMember?.name ?? '全体成员',
        memCount: result.memory_count,
      })
    } catch (err) {
      showError(err, '故事生成失败，请稍后重试')
    } finally {
      setGenerating(false)
    }
  }

  if (archiveLoading) return <LoadingState />

  return (
    <PageTransition>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 页面标题 */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="mb-8">
          <h1 className="text-h2 font-display font-bold text-ink-primary">
            {(archive as any)?.name} — 故事书
          </h1>
          <p className="text-ink-secondary mt-1">用 AI 将记忆编织成一段流传的故事</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
          {/* 左侧配置栏 */}
          <motion.div
            variants={staggerContainer(0.06)}
            initial="hidden"
            animate="visible"
            className="space-y-4"
          >
            {/* 成员选择 */}
            <motion.div variants={fadeUp}>
              <Card variant="plain" padding="md">
                <Select
                  label="选择成员"
                  options={memberOptions}
                  value={selectedMemberId}
                  onValueChange={setSelectedMemberId}
                  fullWidth
                />
              </Card>
            </motion.div>

            {/* 风格选择 */}
            <motion.div variants={fadeUp}>
              <Card variant="plain" padding="md">
                <div className="text-body-sm font-medium text-ink-primary mb-3">故事风格</div>
                <div className="grid grid-cols-2 gap-2">
                  {STORY_STYLES.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => setStyle(s.value)}
                      className={cn(
                        'p-3 rounded-xl border text-left transition-all duration-200',
                        style === s.value
                          ? 'border-brand bg-jade-50 outline outline-2 outline-brand/30'
                          : 'border-border-default hover:border-jade-300 hover:bg-subtle'
                      )}
                    >
                      <div className="text-lg mb-1">{s.emoji}</div>
                      <div className="text-body-sm font-medium text-ink-primary">{s.label}</div>
                      <div className="text-caption text-ink-muted mt-0.5">{s.desc}</div>
                    </button>
                  ))}
                </div>
              </Card>
            </motion.div>

            {/* 数据概览 */}
            <motion.div variants={fadeUp}>
              <Card variant="accent" padding="sm">
                <div className="flex items-center justify-between">
                  <span className="text-caption text-ink-secondary">成员数</span>
                  <Badge tone="jade" size="sm">{(members as any[]).length}</Badge>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-caption text-ink-secondary">记忆数</span>
                  <Badge tone="amber" size="sm">{memories.length}</Badge>
                </div>
              </Card>
            </motion.div>

            {/* 生成按钮 */}
            <motion.div variants={fadeUp}>
              <Button
                variant="primary"
                fullWidth
                leftIcon={generating ? <Loader2 size={16} className="animate-spin" /> : <BookOpen size={16} />}
                onClick={handleGenerate}
                disabled={generating || memories.length === 0}
              >
                {generating ? 'AI 正在创作中…' : '生成故事书'}
              </Button>
            </motion.div>
          </motion.div>

          {/* 右侧预览区 */}
          <div className="min-h-[400px]">
            <AnimatePresence mode="wait">
              {generating && (
                <motion.div
                  key="progress"
                  variants={fadeIn}
                  initial="hidden"
                  animate="visible"
                  exit={{ opacity: 0 }}
                  className="h-full flex flex-col items-center justify-center py-20"
                >
                  <Loader2 size={32} className="text-brand animate-spin mb-6" />
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={progressIdx}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.4 }}
                      className="text-body text-ink-secondary"
                    >
                      {PROGRESS_TEXTS[progressIdx]}
                    </motion.p>
                  </AnimatePresence>
                </motion.div>
              )}

              {!generating && story && (
                <motion.div
                  key="story"
                  variants={fadeUp}
                  initial="hidden"
                  animate="visible"
                >
                  <StoryPreview
                    story={story.text}
                    archiveName={(archive as any)?.name ?? ''}
                    memberName={story.memberName}
                    style={style}
                    memoryCount={story.memCount}
                  />
                </motion.div>
              )}

              {!generating && !story && (
                <motion.div
                  key="empty"
                  variants={fadeIn}
                  initial="hidden"
                  animate="visible"
                  className="h-full flex flex-col items-center justify-center py-20 text-ink-muted"
                >
                  <BookOpen size={48} className="mb-4 opacity-30" />
                  <p className="text-body-sm">配置完成后点击"生成故事书"</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </PageTransition>
  )
}
