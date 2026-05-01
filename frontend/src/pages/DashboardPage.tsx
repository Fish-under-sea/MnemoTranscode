/**
 * 仪表盘 — 子项目 B · 数据聚合 + 空错载态
 */
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'
import { Archive, FileHeart, Clock, HardDrive, MessageCircle, BookOpen, Plus, Users, type LucideIcon } from 'lucide-react'
import { useAuthStore } from '@/hooks/useAuthStore'
import { useDashboardStats } from '@/hooks/useDashboardStats'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui'
import ScrollReveal, { ScrollRevealGroup } from '@/components/ui/ScrollReveal'
import { fadeUp, staggerContainer } from '@/lib/motion'
import { getResumeDialoguePath } from '@/lib/dialogueStorage'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

const ARCHIVE_TYPE_LABELS: Record<string, string> = {
  family: '家人',
  friend: '挚友',
  lover: '爱人',
  relative: '至亲',
  celebrity: '伟人',
  nation: '国家历史',
  mentor: '良师',
  idol: '偶像',
  other: '其他',
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const stats = useDashboardStats()

  const welcomeTitle = user?.username ? `${user.username}，欢迎回来` : '欢迎'
  const isEmpty = !stats.isLoading && stats.archiveCount === 0 && !stats.isError

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <motion.header
        variants={staggerContainer(0.05)}
        initial="hidden"
        animate="visible"
        className="mb-8"
      >
        <motion.h1 variants={fadeUp} className="font-serif text-3xl md:text-4xl text-ink-primary">
          {welcomeTitle}
        </motion.h1>
        <motion.p variants={fadeUp} className="text-ink-secondary mt-2">
          每一段记忆都值得被守护
        </motion.p>
      </motion.header>

      {isEmpty && (
        <EmptyState
          icon={Archive}
          title="开始你的第一段记忆"
          description="创建一个档案，把想守护的关系安顿进来"
          action={{
            label: '创建档案',
            onClick: () => navigate('/archives?new=1'),
          }}
        />
      )}

      {!isEmpty && (
        <>
          <ScrollRevealGroup stagger={0.06} className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <KPICard
              icon={Archive}
              label="关系档案"
              value={stats.archiveCount}
              suffix="个"
              loading={stats.isLoading}
              error={stats.errors.archives}
              onRetry={stats.refetchAll}
            />
            <KPICard
              icon={FileHeart}
              label="守护的记忆"
              value={stats.memoryCount}
              suffix="条"
              loading={stats.isLoading}
              error={stats.errors.archives}
              onRetry={stats.refetchAll}
            />
            <KPICard
              icon={Clock}
              label="最近守护"
              value={stats.lastActivityAt ? dayjs(stats.lastActivityAt).fromNow() : '—'}
              loading={stats.isLoading}
              error={stats.errors.recentMemories}
              onRetry={stats.refetchAll}
            />
            <KPICard
              icon={HardDrive}
              label="存储用量"
              value={formatStorageUsage(stats.usage)}
              loading={stats.isLoading}
              error={stats.errors.usage}
              onRetry={stats.refetchAll}
            />
          </ScrollRevealGroup>

          <ScrollReveal>
            <Card variant="plain" padding="lg" className="mb-8">
              <h2 className="font-serif text-xl text-ink-primary mb-4">快捷操作</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <QuickAction
                  icon={Plus}
                  label="创建档案"
                  onClick={() => navigate('/archives?new=1')}
                />
                <QuickAction
                  icon={MessageCircle}
                  label="与记忆对话"
                  onClick={() => void navigate(getResumeDialoguePath())}
                />
                <QuickAction
                  icon={BookOpen}
                  label="生成生命故事"
                  onClick={() => navigate('/archives')}
                />
                <QuickAction
                  icon={Users}
                  label="所有档案"
                  onClick={() => navigate('/archives')}
                />
              </div>
            </Card>
          </ScrollReveal>

          {stats.archives.length > 0 && (
            <ScrollReveal>
              <Card variant="plain" padding="lg" className="mb-8">
                <h2 className="font-serif text-xl text-ink-primary mb-4">档案分布</h2>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(stats.archivesByType).map(([type, count]) => (
                    <Badge key={type} tone="jade">
                      {ARCHIVE_TYPE_LABELS[type] ?? type} · {count}
                    </Badge>
                  ))}
                </div>
              </Card>
            </ScrollReveal>
          )}

          <ScrollReveal>
            <Card variant="plain" padding="lg">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-serif text-xl text-ink-primary">最近的记忆</h2>
                {stats.recentMemories.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => navigate('/archives')}>
                    查看全部
                  </Button>
                )}
              </div>

              {stats.isLoading ? (
                <LoadingState variant="skeleton-list" count={3} />
              ) : stats.errors.recentMemories ? (
                <ErrorState
                  size="sm"
                  error={stats.errors.recentMemories as Error}
                  onRetry={stats.refetchAll}
                />
              ) : stats.recentMemories.length === 0 ? (
                <EmptyState
                  icon={FileHeart}
                  title="还没有记忆"
                  description="去档案里记下第一条吧"
                  className="py-8"
                />
              ) : (
                <motion.ul
                  variants={staggerContainer(0.04)}
                  initial="hidden"
                  animate="visible"
                  className="space-y-3"
                >
                  {stats.recentMemories.map((m) => (
                    <motion.li
                      key={m.id}
                      variants={fadeUp}
                      className="flex items-start gap-3 p-3 rounded-lg hover:bg-warm-100/60 transition-colors cursor-pointer"
                      onClick={() =>
                        m.archive_id != null
                          ? navigate(`/archives/${m.archive_id}`)
                          : navigate('/archives')
                      }
                    >
                      <div className="w-2 h-2 rounded-full bg-jade-500 mt-2 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <h3 className="text-ink-primary font-medium truncate">{m.title}</h3>
                        <p className="text-ink-secondary text-sm line-clamp-2 mt-1">
                          {m.content_text}
                        </p>
                      </div>
                      <span className="text-ink-muted text-xs whitespace-nowrap">
                        {dayjs(m.created_at).fromNow()}
                      </span>
                    </motion.li>
                  ))}
                </motion.ul>
              )}
            </Card>
          </ScrollReveal>
        </>
      )}
    </div>
  )
}

function KPICard(props: {
  icon: LucideIcon
  label: string
  value: string | number
  suffix?: string
  loading?: boolean
  error?: unknown
  onRetry?: () => void
}) {
  const Icon = props.icon
  if (props.error && !props.loading) {
    return (
      <Card variant="plain" padding="md">
        <ErrorState size="sm" error={props.error as Error} onRetry={props.onRetry} />
      </Card>
    )
  }
  return (
    <motion.div variants={fadeUp}>
      <Card variant="plain" padding="md" hoverable>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-jade-50 flex items-center justify-center">
            <Icon className="w-5 h-5 text-jade-600" />
          </div>
          <span className="text-ink-secondary text-sm">{props.label}</span>
        </div>
        <div className="font-serif text-2xl text-ink-primary tabular-nums">
          {props.loading ? '—' : props.value}
          {props.suffix && <span className="text-base text-ink-muted ml-1">{props.suffix}</span>}
        </div>
      </Card>
    </motion.div>
  )
}

function QuickAction(props: { icon: LucideIcon; label: string; onClick: () => void }) {
  const Icon = props.icon
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="flex flex-col items-center gap-2 p-4 rounded-lg bg-warm-100/60 hover:bg-jade-50 transition-colors group"
    >
      <div className="w-10 h-10 rounded-full bg-surface flex items-center justify-center group-hover:bg-jade-100 transition-colors">
        <Icon className="w-5 h-5 text-jade-600" />
      </div>
      <span className="text-sm text-ink-secondary">{props.label}</span>
    </button>
  )
}

function formatStorageUsage(usage: { storage_used?: number; storage_quota?: number } | null): string {
  if (!usage || usage.storage_used === undefined || usage.storage_quota === undefined) return '—'
  const used = formatBytes(usage.storage_used)
  const quota = formatBytes(usage.storage_quota)
  return `${used} / ${quota}`
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}
