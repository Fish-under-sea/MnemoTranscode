/**
 * 档案列表页
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { motion } from 'motion/react'
import { Plus, Search, FolderOpen } from 'lucide-react'
import { archiveApi } from '@/services/api'
import { ARCHIVE_TYPE_OPTIONS } from '@/lib/utils'
import { staggerContainer, fadeUp } from '@/lib/motion'
import ArchiveCard from '@/components/memory/ArchiveCard'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'
import Textarea from '@/components/ui/Textarea'
import { LoadingState, ErrorState, EmptyState } from '@/components/ui'
import { useApiError } from '@/hooks/useApiError'

export default function ArchiveListPage() {
  const queryClient = useQueryClient()
  const { show } = useApiError()
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string>('')
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [archiveToDelete, setArchiveToDelete] = useState<{ id: number; name: string } | null>(null)
  const [newArchive, setNewArchive] = useState({
    name: '',
    description: '',
    archive_type: 'family',
  })

  const { data: archives = [], isLoading, error, refetch } = useQuery({
    queryKey: ['archives', filterType],
    queryFn: () => archiveApi.list(filterType || undefined) as any,
  })

  const createMutation = useMutation({
    mutationFn: (data: typeof newArchive) => archiveApi.create(data) as Promise<unknown>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['archives'] })
      setCreateModalOpen(false)
      setNewArchive({ name: '', description: '', archive_type: 'family' })
      toast.success('档案创建成功')
    },
    onError: (err) => show(err),
  })

  const deleteArchiveMutation = useMutation({
    mutationFn: (archiveId: number) => archiveApi.delete(archiveId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['archives'] })
      setArchiveToDelete(null)
      toast.success('档案已删除')
    },
    onError: (err) => show(err),
  })

  const filteredArchives = (archives as any[]).filter((a) =>
    String(a.name).toLowerCase().includes(search.toLowerCase()),
  )

  if (isLoading) {
    return <LoadingState message="正在取出你的档案库…" />
  }
  if (error) {
    return <ErrorState error={error} onRetry={() => void refetch()} />
  }

  return (
    <motion.section
      variants={staggerContainer()}
      initial="hidden"
      animate="visible"
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"
    >
      <motion.div variants={fadeUp} className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display text-ink-primary">档案库</h1>
          <p className="text-body text-ink-secondary mt-1">管理你的所有记忆档案</p>
        </div>
        <Button leftIcon={<Plus size={18} />} onClick={() => setCreateModalOpen(true)}>
          新建档案
        </Button>
      </motion.div>

      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 mb-6">
        <Input
          leftIcon={<Search size={18} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索档案..."
          fullWidth
        />
        <div className="flex gap-2 flex-wrap sm:shrink-0 sm:max-w-md">
          <button type="button" onClick={() => setFilterType('')} className="p-0 border-0 bg-transparent cursor-pointer">
            <Badge tone={filterType === '' ? 'jade' : 'neutral'} size="md">
              全部
            </Badge>
          </button>
          {ARCHIVE_TYPE_OPTIONS.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => setFilterType(type.value)}
              className="p-0 border-0 bg-transparent cursor-pointer"
            >
              <Badge tone={filterType === type.value ? 'jade' : 'neutral'} size="md">
                {type.icon} {type.label}
              </Badge>
            </button>
          ))}
        </div>
      </motion.div>

      {filteredArchives.length === 0 ? (
        search ? (
          <EmptyState icon={Search} title="没有找到匹配的档案" description="换个关键词试试？" />
        ) : (
          <EmptyState
            icon={FolderOpen}
            title="还没有任何档案"
            description="每一段值得珍藏的关系都从一个档案开始"
            action={{ label: '创建第一个档案', onClick: () => setCreateModalOpen(true) }}
          />
        )
      ) : (
        <motion.div
          variants={staggerContainer()}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          {filteredArchives.map((archive: { id: unknown; name?: string; description?: string; archive_type?: string; member_count?: number; memory_count?: number }) => (
            <motion.div key={String(archive.id)} variants={fadeUp}>
              <ArchiveCard
                id={Number(archive.id)}
                name={String(archive.name ?? '')}
                description={String(archive.description ?? '')}
                archive_type={String(archive.archive_type ?? 'family')}
                member_count={Number(archive.member_count ?? 0)}
                memory_count={Number(archive.memory_count ?? 0)}
                onDelete={() =>
                  setArchiveToDelete({
                    id: Number(archive.id),
                    name: String(archive.name ?? ''),
                  })
                }
              />
            </motion.div>
          ))}
        </motion.div>
      )}

      <Modal open={archiveToDelete != null} onClose={() => setArchiveToDelete(null)} title="删除档案">
        {archiveToDelete ? (
          <div className="space-y-4">
            <p className="text-body-sm text-ink-secondary">
              确定删除「{archiveToDelete.name}」？将一并移除其成员与记忆等数据（不可撤销）。
            </p>
            <div className="flex gap-3 pt-2">
              <Button variant="ghost" type="button" onClick={() => setArchiveToDelete(null)} fullWidth>
                取消
              </Button>
              <Button
                variant="primary"
                type="button"
                fullWidth
                className="!bg-red-600 hover:!bg-red-700"
                loading={deleteArchiveMutation.isPending}
                onClick={() => deleteArchiveMutation.mutate(archiveToDelete.id)}
              >
                删除
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={createModalOpen} onClose={() => setCreateModalOpen(false)} title="新建档案">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            createMutation.mutate(newArchive)
          }}
          className="space-y-4"
        >
          <Input
            label="档案名称"
            value={newArchive.name}
            onChange={(e) => setNewArchive({ ...newArchive, name: e.target.value })}
            placeholder="例如：李家族谱、致青春"
            fullWidth
            required
          />
          <div>
            <span className="text-body-sm font-medium text-ink-secondary">档案类型</span>
            <div className="grid grid-cols-2 gap-2 mt-1.5">
              {ARCHIVE_TYPE_OPTIONS.map((type) => {
                const active = newArchive.archive_type === type.value
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setNewArchive({ ...newArchive, archive_type: type.value })}
                    className="text-left w-full p-0 border-0 bg-transparent cursor-pointer"
                  >
                    <Card hoverable variant={active ? 'accent' : 'plain'} padding="sm">
                      <span className="mr-2">{type.icon}</span>
                      <span className="text-body">{type.label}</span>
                    </Card>
                  </button>
                )
              })}
            </div>
          </div>
          <Textarea
            label="描述（可选）"
            value={newArchive.description}
            onChange={(e) => setNewArchive({ ...newArchive, description: e.target.value })}
            rows={3}
            placeholder="简单描述这个档案的内容..."
            fullWidth
          />
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" type="button" onClick={() => setCreateModalOpen(false)} fullWidth>
              取消
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={createMutation.isPending}
              fullWidth
            >
              创建
            </Button>
          </div>
        </form>
      </Modal>
    </motion.section>
  )
}
