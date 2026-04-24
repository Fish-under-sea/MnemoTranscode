// frontend/src/pages/CapsulePage.tsx
import { useState } from 'react'
import { motion } from 'motion/react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import PageTransition from '@/components/ui/PageTransition'
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/state'
import CapsuleCard from '@/components/capsule/CapsuleCard'
import CreateCapsuleModal from '@/components/capsule/CreateCapsuleModal'
import CapsuleDetailDrawer from '@/components/capsule/CapsuleDetailDrawer'
import { useCapsuleList } from '@/hooks/useCapsules'
import { isCapsuleLocked } from '@/lib/capsuleUtils'
import { staggerContainer } from '@/lib/motion'
import type { CapsuleItem } from '@/services/api'

type FilterTab = 'all' | 'locked' | 'delivered'

export default function CapsulePage() {
  const [filter, setFilter] = useState<FilterTab>('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedCapsuleId, setSelectedCapsuleId] = useState<number | null>(null)

  const { data: capsules = [], isLoading, isError, refetch } = useCapsuleList()

  const filteredCapsules: CapsuleItem[] = capsules.filter((c) => {
    if (filter === 'all') return true
    if (filter === 'locked') return isCapsuleLocked(c.unlock_date) && c.status === 'locked'
    if (filter === 'delivered') return !isCapsuleLocked(c.unlock_date) || c.status === 'delivered'
    return true
  })

  const tabItems = [
    {
      value: 'all',
      label: `全部 (${capsules.length})`,
      content: null,
    },
    {
      value: 'locked',
      label: `锁定中 (${capsules.filter((c) => isCapsuleLocked(c.unlock_date) && c.status === 'locked').length})`,
      content: null,
    },
    {
      value: 'delivered',
      label: `已解封 (${capsules.filter((c) => !isCapsuleLocked(c.unlock_date) || c.status === 'delivered').length})`,
      content: null,
    },
  ]

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start justify-between mb-6"
        >
          <div>
            <h1 className="text-h2 font-display font-bold text-ink-primary">记忆胶囊</h1>
            <p className="text-ink-secondary mt-1">封存给未来的信，等待解封的那天</p>
          </div>
          <Button
            variant="primary"
            leftIcon={<Plus size={16} />}
            onClick={() => setCreateOpen(true)}
          >
            创建胶囊
          </Button>
        </motion.div>

        {/* 筛选 Tabs（仅标签，实际过滤通过 state） */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <div className="inline-flex items-center gap-1 p-1 rounded-full bg-subtle">
            {tabItems.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setFilter(tab.value as FilterTab)}
                className={`px-4 py-2 text-body-sm font-medium rounded-full transition-all duration-200 ${
                  filter === tab.value
                    ? 'bg-surface shadow-e1 text-brand'
                    : 'text-ink-secondary hover:text-ink-primary'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* 内容区 */}
        {isLoading && <LoadingState variant="skeleton-cards" count={4} />}
        {isError && <ErrorState title="加载失败" onRetry={() => { refetch() }} />}

        {!isLoading && !isError && filteredCapsules.length === 0 && (
          <EmptyState
            title={filter === 'all' ? '还没有记忆胶囊' : '此分类下暂无胶囊'}
            description={filter === 'all' ? '创建第一个胶囊，封存一段珍贵的话语' : ''}
            action={
              filter === 'all'
                ? { label: '创建第一个胶囊', onClick: () => setCreateOpen(true) }
                : undefined
            }
          />
        )}

        {!isLoading && !isError && filteredCapsules.length > 0 && (
          <motion.div
            variants={staggerContainer(0.06)}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 sm:grid-cols-2 gap-4"
          >
            {filteredCapsules.map((capsule) => (
              <CapsuleCard
                key={capsule.id}
                capsule={capsule}
                onClick={() => setSelectedCapsuleId(capsule.id)}
              />
            ))}
          </motion.div>
        )}
      </div>

      {/* 创建弹窗 */}
      <CreateCapsuleModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />

      {/* 详情抽屉 */}
      <CapsuleDetailDrawer
        capsuleId={selectedCapsuleId}
        onClose={() => setSelectedCapsuleId(null)}
      />
    </PageTransition>
  )
}
