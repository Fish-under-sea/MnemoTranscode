/**
 * 档案列表页
 */
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
} from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { motion } from 'motion/react'
import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus, Search, FolderOpen } from 'lucide-react'
import { archiveApi, type ArchiveListSort } from '@/services/api'
import { ARCHIVE_TYPE_OPTIONS } from '@/lib/utils'
import { staggerContainer, fadeUp } from '@/lib/motion'
import ArchiveCard from '@/components/memory/ArchiveCard'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'
import Textarea from '@/components/ui/Textarea'
import Select from '@/components/ui/Select'
import { LoadingState, ErrorState, EmptyState } from '@/components/ui'
import { useApiError } from '@/hooks/useApiError'

const ARCHIVE_SORT_OPTIONS: { value: ArchiveListSort; label: string }[] = [
  { value: 'manual', label: '我的顺序（可拖拽）' },
  { value: 'default', label: '置顶优先 · 最近更新' },
  { value: 'name', label: '置顶优先 · 名称' },
  { value: 'memory', label: '置顶优先 · 记忆条数' },
]

/** 单行档案（列表展示用） */
export type ArchiveRow = {
  id: number
  name: string
  description?: string | null
  archive_type: string
  member_count: number
  memory_count: number
  is_pinned: boolean
  heritage_origin_preview?: string | null
}

function SortableArchiveRow(props: {
  row: ArchiveRow
  enableHandle: boolean
  pinBusy: boolean
  onTogglePin: () => void
  onRename: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.row.id,
  })
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} className="min-h-0 flex h-full touch-manipulation">
      <ArchiveCard
        className="w-full"
        id={props.row.id}
        name={props.row.name}
        description={props.row.description ?? ''}
        archive_type={props.row.archive_type}
        member_count={props.row.member_count}
        memory_count={props.row.memory_count}
        heritageOriginPreview={props.row.heritage_origin_preview ?? undefined}
        isPinned={props.row.is_pinned}
        pinBusy={props.pinBusy}
        onTogglePin={props.onTogglePin}
        onRename={props.onRename}
        onDelete={props.onDelete}
        showDragHandle={props.enableHandle}
        dragHandleListeners={listeners as unknown as HTMLAttributes<HTMLElement>}
        dragHandleAttributes={attributes}
        isDragging={isDragging}
      />
    </div>
  )
}

export default function ArchiveListPage() {
  const queryClient = useQueryClient()
  const { show } = useApiError()
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string>('')
  const [listSort, setListSort] = useState<ArchiveListSort>('manual')
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [archiveToDelete, setArchiveToDelete] = useState<{ id: number; name: string } | null>(null)
  const [archiveToRename, setArchiveToRename] = useState<{ id: number; name: string } | null>(null)
  const [renameName, setRenameName] = useState('')
  const [newArchive, setNewArchive] = useState({
    name: '',
    description: '',
    archive_type: 'family',
  })
  /** 拖拽模式下的本地 id 序列 */
  const [orderedIds, setOrderedIds] = useState<number[]>([])
  const snapshotIdsRef = useRef<number[]>([])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const { data: archives = [], isLoading, error, refetch } = useQuery({
    queryKey: ['archives', filterType, listSort],
    queryFn: () => archiveApi.list(filterType || undefined, listSort) as any,
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

  const renameArchiveMutation = useMutation({
    mutationFn: ({ id: aid, name: nextName }: { id: number; name: string }) =>
      archiveApi.update(aid, { name: nextName.trim() }) as Promise<unknown>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['archives'] })
      queryClient.invalidateQueries({ queryKey: ['archive'] })
      setArchiveToRename(null)
      setRenameName('')
      toast.success('档案名称已更新')
    },
    onError: (err) => show(err),
  })

  const pinArchiveMutation = useMutation({
    mutationFn: ({ id: aid, next }: { id: number; next: boolean }) =>
      archiveApi.update(aid, { is_pinned: next }) as Promise<unknown>,
    onSuccess: (_data, v) => {
      void queryClient.invalidateQueries({ queryKey: ['archives'] })
      void queryClient.invalidateQueries({ queryKey: ['archive'] })
      toast.success(v.next ? '已置顶' : '已取消置顶')
    },
    onError: (err) => show(err),
  })

  const reorderMutation = useMutation({
    mutationFn: (body: { pinned_ids: number[]; unpinned_ids: number[] }) =>
      archiveApi.reorder(body) as Promise<unknown>,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['archives'] })
      toast.success('顺序已保存')
    },
    onError: (err) => {
      setOrderedIds([...snapshotIdsRef.current])
      show(err)
    },
  })

  const filteredArchives = (archives as any[]).filter((a) =>
    String(a.name).toLowerCase().includes(search.toLowerCase()),
  )

  const rows: ArchiveRow[] = useMemo(
    () =>
      filteredArchives.map((a: any) => ({
        id: Number(a.id),
        name: String(a.name ?? ''),
        description: a.description,
        archive_type: String(a.archive_type ?? 'family'),
        member_count: Number(a.member_count ?? 0),
        memory_count: Number(a.memory_count ?? 0),
        is_pinned: Boolean(a.is_pinned),
        heritage_origin_preview: a.heritage_origin_preview,
      })),
    [filteredArchives],
  )

  const canDragReorder = listSort === 'manual' && search.trim() === '' && filterType === ''

  const rowStableKey = useMemo(() => rows.map((r) => `${r.id}:${r.is_pinned ? 1 : 0}`).join('|'), [rows])

  useEffect(() => {
    if (listSort !== 'manual' || !canDragReorder) return
    setOrderedIds(rows.map((r) => r.id))
  }, [rowStableKey, listSort, canDragReorder, rows])

  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows])

  const displayRows: ArchiveRow[] = useMemo(() => {
    if (listSort === 'manual' && canDragReorder && orderedIds.length > 0) {
      const out = orderedIds.map((id) => byId.get(id)).filter((x): x is ArchiveRow => x != null)
      if (out.length === rows.length) return out
    }
    return rows
  }, [rows, orderedIds, byId, listSort, canDragReorder])

  const handleDragStart = (_e: DragStartEvent) => {
    snapshotIdsRef.current = [...orderedIds]
  }

  const handleDragCancel = () => {
    setOrderedIds([...snapshotIdsRef.current])
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const a = Number(active.id)
    const o = Number(over.id)
    if (!Number.isInteger(a) || !Number.isInteger(o)) return

    const oldIndex = orderedIds.indexOf(a)
    const newIndex = orderedIds.indexOf(o)
    if (oldIndex < 0 || newIndex < 0) return

    const pin = new Map(rows.map((r) => [r.id, r.is_pinned]))
    const next = arrayMove(orderedIds, oldIndex, newIndex)
    const firstUnpinIdx = next.findIndex((id) => !pin.get(id))
    const pinnedPart = firstUnpinIdx === -1 ? next : next.slice(0, firstUnpinIdx)
    const unpinnedPart = firstUnpinIdx === -1 ? [] : next.slice(firstUnpinIdx)

    if (pinnedPart.some((id) => !pin.get(id))) {
      toast.error('未置顶档案须排在置顶档案之后')
      return
    }
    if (unpinnedPart.some((id) => pin.get(id))) {
      toast.error('置顶档案须排在最前面')
      return
    }

    snapshotIdsRef.current = [...orderedIds]
    setOrderedIds(next)
    reorderMutation.mutate({ pinned_ids: pinnedPart, unpinned_ids: unpinnedPart })
  }

  const renderArchiveCards = () =>
    displayRows.map((archive) => (
      <motion.div key={archive.id} variants={fadeUp} className="min-h-0 flex h-full">
        <ArchiveCard
          className="w-full"
          id={archive.id}
          name={archive.name}
          description={archive.description ?? ''}
          archive_type={archive.archive_type}
          member_count={archive.member_count}
          memory_count={archive.memory_count}
          heritageOriginPreview={archive.heritage_origin_preview ?? undefined}
          isPinned={archive.is_pinned}
          pinBusy={
            pinArchiveMutation.isPending &&
            pinArchiveMutation.variables != null &&
            (pinArchiveMutation.variables as { id: number }).id === archive.id
          }
          onTogglePin={() =>
            pinArchiveMutation.mutate({
              id: archive.id,
              next: !archive.is_pinned,
            })
          }
          onRename={() => {
            setArchiveToRename({ id: archive.id, name: archive.name })
            setRenameName(archive.name)
          }}
          onDelete={() => setArchiveToDelete({ id: archive.id, name: archive.name })}
        />
      </motion.div>
    ))

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
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-ink-primary"
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

      <motion.div variants={fadeUp} className="flex flex-col lg:flex-row gap-4 mb-4 items-stretch lg:items-end">
        <div className="flex-1 min-w-0">
          <Input
            leftIcon={<Search size={18} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索档案..."
            fullWidth
          />
        </div>
        <Select
          label="列表排序"
          value={listSort}
          onValueChange={(v) => setListSort(v as ArchiveListSort)}
          options={ARCHIVE_SORT_OPTIONS}
          fullWidth
          className="lg:w-[min(100%,20rem)]"
        />
      </motion.div>

      {listSort === 'manual' && !canDragReorder ? (
        <p className="text-caption text-ink-muted mb-3">
          已筛选类型或正在搜索：无法拖拽排序。请切换到「全部」类型并清空搜索框后，可按住手柄拖动卡片。
        </p>
      ) : listSort === 'manual' && canDragReorder ? (
        <p className="text-caption text-ink-muted mb-3">按住卡片左侧手柄拖动排序；置顶卡片须始终排在最前。</p>
      ) : null}

      <motion.div variants={fadeUp} className="flex gap-2 flex-wrap mb-6">
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
      ) : listSort === 'manual' && canDragReorder && orderedIds.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragCancel={handleDragCancel}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={orderedIds} strategy={rectSortingStrategy}>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch">
              {displayRows.map((archive) => (
                <SortableArchiveRow
                  key={archive.id}
                  row={archive}
                  enableHandle
                  pinBusy={
                    pinArchiveMutation.isPending &&
                    pinArchiveMutation.variables != null &&
                    (pinArchiveMutation.variables as { id: number }).id === archive.id
                  }
                  onTogglePin={() =>
                    pinArchiveMutation.mutate({
                      id: archive.id,
                      next: !archive.is_pinned,
                    })
                  }
                  onRename={() => {
                    setArchiveToRename({ id: archive.id, name: archive.name })
                    setRenameName(archive.name)
                  }}
                  onDelete={() => setArchiveToDelete({ id: archive.id, name: archive.name })}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <motion.div
          variants={staggerContainer()}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch"
        >
          {renderArchiveCards()}
        </motion.div>
      )}

      <Modal
        open={archiveToRename != null}
        onClose={() => {
          setArchiveToRename(null)
          setRenameName('')
        }}
        title="重命名档案"
      >
        {archiveToRename ? (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              const t = renameName.trim()
              if (!t) {
                toast.error('名称不能为空')
                return
              }
              if (t === archiveToRename.name.trim()) {
                setArchiveToRename(null)
                setRenameName('')
                return
              }
              renameArchiveMutation.mutate({ id: archiveToRename.id, name: t })
            }}
          >
            <Input
              label="档案名称"
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              placeholder="新的档案名称"
              fullWidth
              required
              autoFocus
            />
            <div className="flex gap-3 pt-2">
              <Button
                variant="ghost"
                type="button"
                fullWidth
                onClick={() => {
                  setArchiveToRename(null)
                  setRenameName('')
                }}
              >
                取消
              </Button>
              <Button type="submit" variant="primary" fullWidth loading={renameArchiveMutation.isPending}>
                保存
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>

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
                variant="danger"
                type="button"
                fullWidth
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
          {newArchive.archive_type === 'nation' ? (
            <p className="text-caption text-ink-muted">
              「国家记忆」可收录非遗、历史人物、馆藏文献等多种主题；创建后请在各「记忆实体」上分别填写著录与说明，同一档案可容纳多个并列实体。
            </p>
          ) : null}
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
            <Button type="submit" variant="primary" loading={createMutation.isPending} fullWidth>
              创建
            </Button>
          </div>
        </form>
      </Modal>
    </motion.section>
  )
}
