# 子项目 C · 核心记忆流 · 实现计划 v1.0

**起草人**：Claude 4.7 Opus（A 轨）
**主 spec**：[`docs/superpowers/specs/2026-04-24-C-core-memory-flow-design.md`](../specs/2026-04-24-C-core-memory-flow-design.md)
**执行人（B 轨）**：Composer 2
**分支**：`Opus-coding`（**严禁独立开分支**）
**估时**：~4 天（**28** task，5 milestone）
**合入用 PR**：[docs(C): 子项目 C 设计 + 实现计划 · 核心记忆流 — PR #15](https://github.com/Fish-under-sea/MnemoTranscode/pull/15)

---

## 0. 读本计划前必读

### 0.1 你是谁 · 你要做什么

你是 Composer 2，负责把本计划里的 **28** 个 task 转化为代码。每个 task 都对齐到设计文档里的具体章节——**不要擅自发挥，有设计偏差先问 Opus**。

**启动顺序**：从 **M1 · T1.1** 起；M1 全部 task + T1.7 DoD 完成后，**向 Opus 报告并等待 grep 核查与放行**，再进 M2。

### 0.2 工作模式（B 阶段教训固化 · 硬约束）

**三条红线（与下述 1–5 细项一一对应，已写入本节）：**

1. **禁止新开分支** — 第一件事 `git branch --show-current` 必须是 `Opus-coding`；不是就切过去。不要创建 `Composer-coding` / `ComposerC-coding`。**归属用 git notes 标记执行模型，不靠分支名。**
2. **一 task 一 commit** — 每完成一个 task 独立 commit，禁止把多个 task 合成一笔。
3. **每 milestone 完成后暂停** — 跑完 `type-check` + **附录 A** 对应 M 的 grep 自检 + `push` 后，回来报告 **「M? 完成」**，等 Opus 放行再开下一 M。禁止一口气做完 5 个 M 再汇报。

**⚠️ 以下 5 条是硬约束，违反会被要求回退。**

1. **🚫 禁止创建新分支**。你的第一件事：`git branch --show-current`，输出必须是 `Opus-coding`。不是则 `git checkout Opus-coding`；若本地没有，`git fetch origin && git checkout -b Opus-coding origin/Opus-coding`。**不要**创建 `Composer-coding` / `ComposerC-coding` 或任何其他分支。

2. **⚛️ 一 task 一 commit**。每完成一个 task：
   ```bash
   git add -p               # 按 hunk 分批 stage
   git commit -m "..."      # 按下方 commit 信息模板
   git log --oneline -3     # 核验 commit 数，应为 task 数
   ```
   推荐在每一笔实现 commit 后附加归属注记（不替代分支要求）：
   ```bash
   git notes add -m "actual-model: composer-2" HEAD
   ```
   不要把 5 个 task 合成 1 个 commit。Milestone 内部可以合并同一文件的小修补（比如 T1.5 发现 T1.4 有遗漏，这两个可以合并），但**不同 task 原则上不合 commit**。

3. **⏸ 每 milestone 完成后暂停**。不要一口气做完 5 个 milestone 再汇报。每完成一个 M（比如 M1）：
   - 跑 `npm run type-check` 必须 0 错误
   - 跑 `npm run build`（M1 在 T1.7 已写）
   - 跑 §附录 A 的 M? 自检 grep 清单
   - `git push origin Opus-coding`
   - 回复 Opus："**M? 完成**，已 push，自检通过/失败：..."
   - **等 Opus 放行再继续 M?+1**

4. **🔍 每 task 结束的 3 件事**：
   - `npm run type-check`（必过）
   - 手工跑一次冒烟（见 task 的"冒烟清单"）
   - commit（**milestone 结束必须含** `type-check` + 附录 A + `git push`；单 task 是否中间 push 由你决定，但**禁止**在里程碑边界漏 push）

5. **🚫 禁止扩范围**。如果在实现某 task 时发现 spec 里没写到的相关 bug（比如顺手想修个跟你 task 无关的动画 bug），**不要当场修**——记到 M5 的 T5.6（新增 backlog 记录），由 Opus 在 M5 决定修或扔。

### 0.3 Commit 信息模板

```
<type>(C/M?/T?.?): <动宾短语>

<可选的 1-3 句说明，解释"为什么"而非"做了什么">
```

- `type` ∈ `feat` / `refactor` / `fix` / `style` / `chore` / `docs`
- 例：
  - `feat(C/M1/T1.1): 新增 memberStatus.ts 集中状态文案映射`
  - `refactor(C/M1/T1.5): ArchiveDetailPage 接入 A 基座 + §5.1 字段迁移`
  - `fix(C/M2/T2.1): MemoryCard 情感色 dot 在 dark 模式对比度不足`

### 0.4 测试策略

**沿用 B 阶段的工作模式：不引入前端测试框架**（Vitest/Jest/RTL 都不装）。靠：

- **类型检查**：`cd frontend && npm run type-check`，每 task 必跑
- **构建**：`cd frontend && npm run build`，每 milestone 结束必跑
- **手工冒烟**：每 task 附"冒烟清单"，照单测试
- **grep 硬约束**：M1 / M5 的 DoD 有 `rg` 指令必须零匹配

### 0.5 commit push 节奏

- Task 内：可以不 push（快速迭代）
- Milestone 结束：**必须 push**（路线图 §六 硬约束）
- 发现卡壳、拿不准、有疑问：**立即 push 当前进度** + 开 issue 或回复 Opus 等裁决

---

## 1. Milestone 总览

| M | 主题 | Task 数 | 估时 | 依赖 | 关键 DoD |
|---|---|---|---|---|---|
| M1 | 产品语言迁移 + CRUD 三页迁 A 基座 | 7 | 1 天 | — | `rg 'is_alive\|death_year' frontend/src` = 0 |
| M2 | MemoryCard + MemoryDetailDrawer + CreateMemoryModal 增强 | 4 | 0.5 天 | M1 | MemoryCard 点击可开 Drawer |
| M3 | MediaUploader + MediaGallery + mediaApi + 成员相册 | 7 | 1.5 天 | M1 + **E 补 GET /media 列表接口** | 成功上传 3 类媒体 |
| M4 | TimelinePage 重写 | 5 | 1 天 | M2 | 年份分组 + 三筛选器联动 |
| M5 | 收尾（核查 + 文档 + tag + PR） | 5 | 0.5 天 | M1-M4 | 路线图 v1.7 + 4 个 tag + PR 开 |
| **小计** | | **28** | **~4 天** | | |

**执行顺序**：`M1 → M2 → M3 → M4 → M5`（线性）

**E 未就绪时的两条路（与 spec §五 风险 1 一致）**：

- **选项 A**：先在 **E** 上补 `GET /api/v1/media?member_id=&purpose=`（小改动，照 `archive.py` / `memory.py` 的 list pattern），然后按 **M1 → M2 → M3 → M4 → M5** 线性执行。
- **选项 B**：Composer 2 先做 **M1 → M2 → M4**，**跳过 M3**；等 E 补完列表端点后，**回头做 M3**。启动 M3 前必须跑 **§M3 T3.0** 的 curl 判定；不通则**停止 M3 并报告 Opus**，不要硬写假数据绕路。

**如 T3.0 的 E 接口尚未就绪**：必须选 B 并**向 Opus 报备**；禁止在未确认的情况下自作主张合 commit 或合 milestone。

---

## M1 · 产品语言迁移 + CRUD 三页迁 A 基座

**目标**：§五.1 C 部分 100% 兑现；ArchiveListPage / ArchiveDetailPage / MemberDetailPage 三页完成 A 基座迁移（Input/Button/Badge/Card/Select + state 三件套 + motion stagger）。

### T1.1 · 新建 `frontend/src/lib/memberStatus.ts`

**目的**：集中管理 status 枚举的 UI 层映射（label、tone、icon、生命周期文案），后续所有页面消费这份单一真源。

**交付文件**：`frontend/src/lib/memberStatus.ts`

**骨架**（照抄即可）：

```ts
import type { LucideIcon } from 'lucide-react'
import { Sun, Sunset, HelpCircle } from 'lucide-react'

export type MemberStatus = 'alive' | 'deceased' | 'unknown'
export type BadgeTone = 'jade' | 'amber' | 'neutral'

interface StatusMeta {
  label: string
  tone: BadgeTone
  icon: LucideIcon
  /** 当需要展示 end_year 时的 label（alive 状态永不展示 end_year） */
  endYearLabel: string | null
  /** 该 status 下 end_year 是否显示（false = 输入框隐藏） */
  showEndYear: boolean
}

export const STATUS_META: Record<MemberStatus, StatusMeta> = {
  alive: {
    label: 'Ta 现在还在',
    tone: 'jade',
    icon: Sun,
    endYearLabel: null,
    showEndYear: false,
  },
  deceased: {
    label: 'Ta 已经离开',
    tone: 'amber',
    icon: Sunset,
    endYearLabel: '辞世年（可选）',
    showEndYear: true,
  },
  unknown: {
    label: '未说明',
    tone: 'neutral',
    icon: HelpCircle,
    endYearLabel: '最后一次有音讯的年份（可选）',
    showEndYear: true,
  },
}

/** 容错读：字段缺失 / null / 空字符串 / 未知字符串 → 都归为 unknown */
export function normalizeStatus(raw: unknown): MemberStatus {
  if (raw === 'alive' || raw === 'deceased' || raw === 'unknown') return raw
  return 'unknown'
}

/** 给 Select 组件使用的 option 数组（值恒定） */
export const STATUS_OPTIONS = (Object.keys(STATUS_META) as MemberStatus[]).map((key) => ({
  value: key,
  label: STATUS_META[key].label,
}))

/**
 * 生成一条人类可读的年份行。
 * - alive：1960（或空）
 * - deceased + endYear：1960 – 2023（或 辞世于 2023 年）
 * - deceased：辞世年未填，只显示 birth
 * - unknown + endYear：最后音讯：2023 年
 */
export function formatMemberLifespan(birthYear?: number | null, endYear?: number | null, status?: MemberStatus): string | null {
  const s = normalizeStatus(status)
  if (s === 'alive') {
    return birthYear ? `${birthYear} 年出生` : null
  }
  if (s === 'deceased') {
    if (birthYear && endYear) return `${birthYear} – ${endYear}`
    if (endYear) return `辞世于 ${endYear} 年`
    if (birthYear) return `${birthYear} 年出生`
    return null
  }
  // unknown
  if (endYear) return `最后音讯：${endYear} 年`
  if (birthYear) return `${birthYear} 年出生`
  return null
}
```

**冒烟**：`npm run type-check`

**commit**：`feat(C/M1/T1.1): 新增 memberStatus.ts 集中状态文案映射`

---

### T1.2 · 新建 `MemberStatusBadge.tsx`

**目的**：把"徽章 + 年份行"的展示封装成复用组件，避免 ArchiveDetailPage / MemberDetailPage / MemoryCard 三处重复。

**交付文件**：`frontend/src/components/member/MemberStatusBadge.tsx`

**骨架**：

```tsx
import Badge from '@/components/ui/Badge'
import { STATUS_META, normalizeStatus, formatMemberLifespan, type MemberStatus } from '@/lib/memberStatus'

export interface MemberStatusBadgeProps {
  status?: MemberStatus | string | null
  birthYear?: number | null
  endYear?: number | null
  /** 是否同时展示生命周期文本（默认 true） */
  showLifespan?: boolean
  size?: 'sm' | 'md'
}

export default function MemberStatusBadge({
  status,
  birthYear,
  endYear,
  showLifespan = true,
  size = 'sm',
}: MemberStatusBadgeProps) {
  const normalized: MemberStatus = normalizeStatus(status)
  const meta = STATUS_META[normalized]
  const Icon = meta.icon
  const lifespan = showLifespan ? formatMemberLifespan(birthYear, endYear, normalized) : null

  return (
    <div className="inline-flex items-center gap-2 flex-wrap">
      <Badge tone={meta.tone} size={size} icon={<Icon size={12} />}>
        {meta.label}
      </Badge>
      {lifespan && <span className="text-caption text-ink-muted">{lifespan}</span>}
    </div>
  )
}
```

**冒烟**：`npm run type-check`

**commit**：`feat(C/M1/T1.2): 新增 MemberStatusBadge 复用组件`

---

### T1.3 · 新建 `MemberStatusInput.tsx`

**目的**：把"status Select + 条件 end_year 输入"封装为表单组件，供 ArchiveDetailPage 的创建/编辑成员 Modal 使用。

**交付文件**：`frontend/src/components/member/MemberStatusInput.tsx`

**骨架**：

```tsx
import Select from '@/components/ui/Select'
import Input from '@/components/ui/Input'
import { STATUS_OPTIONS, STATUS_META, type MemberStatus } from '@/lib/memberStatus'

export interface MemberStatusInputProps {
  status: MemberStatus
  endYear?: number
  onStatusChange: (next: MemberStatus) => void
  onEndYearChange: (next?: number) => void
}

export default function MemberStatusInput({
  status,
  endYear,
  onStatusChange,
  onEndYearChange,
}: MemberStatusInputProps) {
  const meta = STATUS_META[status]

  return (
    <div className="flex flex-col gap-3">
      <Select
        label="Ta 现在的状态"
        options={STATUS_OPTIONS}
        value={status}
        onValueChange={(v) => {
          const next = v as MemberStatus
          onStatusChange(next)
          // 切到 alive 时清空 endYear（alive 不展示）
          if (next === 'alive') onEndYearChange(undefined)
        }}
        fullWidth
      />
      {meta.showEndYear && meta.endYearLabel && (
        <Input
          type="number"
          label={meta.endYearLabel}
          value={endYear ?? ''}
          onChange={(e) => {
            const v = e.target.value
            onEndYearChange(v ? Number(v) : undefined)
          }}
          placeholder={status === 'deceased' ? '例如：2023' : '如：不清楚也没关系'}
          fullWidth
        />
      )}
    </div>
  )
}
```

**冒烟**：`npm run type-check`

**commit**：`feat(C/M1/T1.3): 新增 MemberStatusInput 条件渲染表单组件`

---

### T1.4 · 重写 `ArchiveListPage.tsx`

**目标**：A 基座全接管（`<Input>` 替代原生 input，`<Button>` 替代原生 button，Badge chips 替代 chips，state 三件套接管空错载，stagger 动效），`useApiError` 替代硬编码 toast。

**关键变更点**：

1. 原生 `<input type="text">` 搜索框 → `<Input leftIcon={<Search />} placeholder="搜索档案..." fullWidth />`
2. 类型筛选 chips → `<button>` 包 `<Badge tone={active ? 'jade' : 'neutral'} size="md">`
3. 空状态 → `<EmptyState icon={FolderOpen} ... />`（两种文案：搜索无果 / 空库首次）
4. 加载状态 → `<LoadingState label="正在取出你的档案库..." />`
5. 错误状态 → `<ErrorState error={error} onRetry={refetch} />`（需要 `useQuery` 返回 `error` + `refetch`）
6. 列表外包 `<motion.div variants={staggerContainer} initial="hidden" animate="visible">`，ArchiveCard 单项包 `<motion.div variants={fadeUp}>`
7. `createMutation.onError` → `const { show } = useApiError(); ... onError: (err) => show(err)`（不是 `toast.error('创建失败')`）
8. Modal 内：`<Input label="档案名称" />` / `<Textarea label="描述" />` / 类型选择用 Card hoverable
9. 成功 toast 仍可用 `toast.success('档案创建成功')`（这是成功态，不走 useApiError）
10. 最终 `rg 'primary-[0-9]' frontend/src/pages/ArchiveListPage.tsx` = 0

**伪代码结构**（省略完整文件，以 diff 语义呈现关键段）：

```tsx
// 顶部 import（加）
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'
import Textarea from '@/components/ui/Textarea'
import { motion } from 'motion/react'
import { staggerContainer, fadeUp } from '@/lib/motion'
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/state'
import { useApiError } from '@/hooks/useApiError'
import { Plus, Search, FolderOpen } from 'lucide-react'

// Component
export default function ArchiveListPage() {
  const { show } = useApiError()
  const { data: archives = [], isLoading, error, refetch } = useQuery({ ... })

  const createMutation = useMutation({
    mutationFn: (data: typeof newArchive) => archiveApi.create(data) as any,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['archives'] })
      setCreateModalOpen(false)
      setNewArchive({ name: '', description: '', archive_type: 'family' })
      toast.success('档案创建成功')
    },
    onError: (err) => show(err),
  })

  // 三态提前返回 or 渲染
  if (isLoading) return <LoadingState label="正在取出你的档案库..." />
  if (error) return <ErrorState error={error} onRetry={refetch} />

  const filteredArchives = archives.filter((a: any) =>
    a.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <motion.section
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"
    >
      {/* 标题区 */}
      <motion.div variants={fadeUp} className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display text-ink-primary">档案库</h1>
          <p className="text-body text-ink-secondary mt-1">管理你的所有记忆档案</p>
        </div>
        <Button leftIcon={<Plus size={18} />} onClick={() => setCreateModalOpen(true)}>
          新建档案
        </Button>
      </motion.div>

      {/* 搜索/筛选 */}
      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 mb-6">
        <Input
          leftIcon={<Search size={18} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索档案..."
          fullWidth
        />
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setFilterType('')}>
            <Badge tone={filterType === '' ? 'jade' : 'neutral'} size="md">全部</Badge>
          </button>
          {ARCHIVE_TYPE_OPTIONS.map((type) => (
            <button key={type.value} onClick={() => setFilterType(type.value)}>
              <Badge tone={filterType === type.value ? 'jade' : 'neutral'} size="md">
                {type.icon} {type.label}
              </Badge>
            </button>
          ))}
        </div>
      </motion.div>

      {/* 列表 */}
      {filteredArchives.length === 0 ? (
        search ? (
          <EmptyState icon={Search} title="没有找到匹配的档案" description="换个关键词试试？" />
        ) : (
          <EmptyState
            icon={FolderOpen}
            title="还没有任何档案"
            description="每一段值得珍藏的关系都从一个档案开始"
            action={
              <Button leftIcon={<Plus size={18} />} onClick={() => setCreateModalOpen(true)}>
                创建第一个档案
              </Button>
            }
          />
        )
      ) : (
        <motion.div
          variants={staggerContainer}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          {filteredArchives.map((archive: any) => (
            <motion.div key={archive.id} variants={fadeUp}>
              <ArchiveCard {...archive} />
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* 新建 Modal */}
      <Modal open={createModalOpen} onClose={() => setCreateModalOpen(false)} title="新建档案">
        <form onSubmit={...} className="space-y-4">
          <Input label="档案名称" value={newArchive.name} onChange={...} placeholder="例如：李家族谱、致青春" fullWidth required />
          <div>
            <label className="text-body-sm font-medium text-ink-secondary">档案类型</label>
            <div className="grid grid-cols-2 gap-2 mt-1.5">
              {ARCHIVE_TYPE_OPTIONS.map((type) => {
                const active = newArchive.archive_type === type.value
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setNewArchive({ ...newArchive, archive_type: type.value })}
                    className="text-left"
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
          />
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" onClick={() => setCreateModalOpen(false)} fullWidth>
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
```

**说明**：如果 A 基座的 `Button` 没有 `loading` / `fullWidth` prop，用 `disabled={isPending}` 和 `className="w-full"` 代替（先打开 `frontend/src/components/ui/Button.tsx` 核对 API）。

**冒烟**：
- `npm run type-check` 0 错
- 手工访问 `/archives`：
  1. 列表加载中 → 看到 LoadingState
  2. 列表成功 → 看到 ArchiveCard stagger 入场
  3. 搜索无结果 → 看到 EmptyState "没有找到匹配的档案"
  4. 新建档案流程走完，toast 成功
  5. 模拟网络错误（DevTools Network 改 Offline）→ 看到 ErrorState + 重试按钮

**commit**：`refactor(C/M1/T1.4): ArchiveListPage 迁 A 基座 + state 三件套 + motion stagger`

---

### T1.5 · 重写 `ArchiveDetailPage.tsx`

**目标**：A 基座接管；§五.1 字段消费方全量迁移；MemberStatusBadge / MemberStatusInput 接入；删除 `death_year` / `is_alive` 所有引用。

**关键变更**：

1. `newMember` state：用 `status: MemberStatus` + `end_year?: number` 替换 `death_year`
   ```ts
   const [newMember, setNewMember] = useState<{
     name: string
     relationship: string
     birth_year?: number
     status: MemberStatus
     end_year?: number
     bio: string
   }>({
     name: '',
     relationship: '',
     birth_year: undefined,
     status: 'alive',
     end_year: undefined,
     bio: '',
   })
   ```
2. `createMemberMutation.mutationFn` 直接传 state：
   ```ts
   mutationFn: (data: typeof newMember) => archiveApi.createMember(Number(id), {
     name: data.name,
     relationship_type: data.relationship,
     birth_year: data.birth_year,
     status: data.status,
     end_year: data.status === 'alive' ? undefined : data.end_year,
     bio: data.bio,
   }),
   ```
3. 成员卡内文字 `{member.birth_year} 年出生` + `— {member.death_year} 年` + `已故` → 替换为 `<MemberStatusBadge status={member.status} birthYear={member.birth_year} endYear={member.end_year} />`
4. 成员卡外层：原生 `<div>` → `<Link to={...}>` 包 `<Card hoverable>`
5. 创建成员 Modal：原生 input/textarea → `<Input>` / `<Textarea>`；"去世年份（可选）" 输入框整个删除；新增 `<MemberStatusInput status={newMember.status} endYear={newMember.end_year} onStatusChange={...} onEndYearChange={...} />`
6. 档案头：裸 `<div>` → `<Card variant="plain">`
7. 4 宫格统计：文字按钮 → `<Link>` 包 `<Card hoverable variant="accent">`；统计数字加 `font-serif tabular-nums` 类
8. 加载 / 错误 / 空状态：三件套接入
9. `createMemberMutation.onError` → `show(err)`

**字段删除对照**（grep 核验，完成后 `rg 'is_alive|death_year' frontend/src/pages/ArchiveDetailPage.tsx` 必须 = 0）：

| 原代码行 | 删除/替换 |
|---|---|
| `death_year: undefined as number \| undefined,` | 删除 |
| `const { death_year, ...rest } = data` | 删除 |
| `...(death_year != null ? ...)` | 整段替换为 T1.5 上方的新 mutationFn |
| `{member.birth_year && <span>...</span>}` | 整行删除，改用 MemberStatusBadge |
| `{member.death_year && <span>...</span>}` | 整行删除 |
| `{member.is_alive === false && ...}` | 整行删除 |
| 输入框 label "去世年份（可选）" + placeholder "如已故" | 整个 `<div>` 块删除，改用 MemberStatusInput |

**冒烟**：
- `npm run type-check` 0 错
- 手工访问 `/archives/:id`：
  1. 档案头 Card 正常渲染
  2. 4 宫格可点击（对话 / 时间线）
  3. 成员列表显示：3 种 status 各至少一条（需自己在数据库或新建时造数据）
     - `alive` 显示 "Ta 现在还在" + 出生年
     - `deceased` + endYear 显示 "Ta 已经离开" + "1960 – 2023"
     - `unknown` 显示 "未说明"
  4. 点击成员卡跳转到 MemberDetail
  5. 新建成员流程：先选 alive → end_year 隐藏；切到 deceased → end_year 显示 "辞世年"；切到 unknown → end_year 显示 "最后音讯年"
  6. 新建成功后列表刷新
- `rg 'is_alive|death_year|已故' frontend/src/pages/ArchiveDetailPage.tsx` = 0

**commit**：`refactor(C/M1/T1.5): ArchiveDetailPage 迁 A 基座 + §5.1 字段消费方全量替换`

---

### T1.6 · 重写 `MemberDetailPage.tsx`

**目标**：A 基座接管；§五.1 字段迁移；封装 `MemberProfile` 展示组件。

**关键变更**：

1. 新建 `frontend/src/components/member/MemberProfile.tsx`（内嵌，不单独算 task，作为 T1.6 的一部分）：
   ```tsx
   // 输入 Member 对象，输出：头像占位 + 姓名 + 关系 + MemberStatusBadge + bio
   interface MemberProfileProps { member: Member }
   ```
2. 面包屑：原生 `<div>` + Link → 保留原结构（A 基座无 Breadcrumb 组件），但视觉用 `text-caption text-ink-muted`
3. 成员信息卡：整块替换为 `<Card variant="plain"> <MemberProfile member={member} /> <div className="mt-4 flex gap-2"> <Button as={Link} to={`/dialogue/...`}>与 Ta 对话</Button> ... </div></Card>`
4. 记忆列表：
   - 空状态 → `<EmptyState icon={FileText} title="还没有记忆条目" description="讲述你们的故事吧" action={<Button>添加记忆</Button>} />`
   - 加载/错误 → 三件套
5. 创建记忆 Modal（M1 先只做 A 基座替换，emotion Select 留到 M2 · T2.4）：
   - 原生 input/textarea → `<Input>` / `<Textarea>`
   - `<Input type="datetime-local" label="发生时间" />`（A 基座 Input 支持 type 透传）
6. `!member.is_alive && member.death_year === null && <span>已故</span>` → MemberStatusBadge 接管

**冒烟**：
- 手工访问 `/archives/:a/members/:m`：
  1. 成员卡显示 MemberProfile（含 status 徽章）
  2. "与 Ta 对话" 按钮跳转到 `/dialogue/...`
  3. 记忆列表三态正常
  4. 创建记忆流程走完
- `rg 'is_alive|death_year|已故' frontend/src/pages/MemberDetailPage.tsx` = 0

**commit**：`refactor(C/M1/T1.6): MemberDetailPage 迁 A 基座 + MemberProfile 封装 + §5.1 替换`

---

### T1.7 · M1 DoD 自检

**不写代码，只跑验证命令**（如果不通过，回去修对应 task，修完再走 T1.7）。

```bash
cd frontend

# 1. 类型检查
npm run type-check

# 2. 构建（catch 更严格的错误）
npm run build

# 3. §5.1 硬约束
cd ..
rg 'is_alive' frontend/src
rg 'death_year' frontend/src
rg '已故' frontend/src

# 期望：以上 3 条 grep 在 pages / components 里零匹配
# （services/api.ts 的 createMember / updateMember 的签名里可能仍有 status enum 引用，这是合法的；但 is_alive / death_year 字面量必须全被清除）

# 4. 旧 token 核查
rg 'primary-[0-9]+' frontend/src/pages/ArchiveListPage.tsx
rg 'primary-[0-9]+' frontend/src/pages/ArchiveDetailPage.tsx
rg 'primary-[0-9]+' frontend/src/pages/MemberDetailPage.tsx
# 期望：三个文件零匹配

# 5. B 教训核查（不应再引入 animate-on-scroll）
rg 'animate-on-scroll|useScrollReveal' frontend/src/pages/Archive*
rg 'animate-on-scroll|useScrollReveal' frontend/src/pages/MemberDetailPage.tsx
# 期望：零匹配
```

**全部通过后**：
```bash
git push origin Opus-coding
```

**然后回复 Opus**："C M1 完成，已 push。自检清单全部通过：[贴 rg 输出]。"

**等 Opus 放行再进 M2。**

---

## M2 · MemoryCard + MemoryDetailDrawer + CreateMemoryModal 增强

### T2.1 · 重写 `MemoryCard.tsx`

**目标**：A 基座 + 情感色 dot + hover 动效 + 点击回调（支持可选 mediaPreview）。

**关键变更**：

1. Props 扩展（添加 `onClick`, `mediaPreview`, `variant`）
2. 外层：`<button type="button" onClick={onClick} className="block w-full text-left">` 包 `<Card hoverable>`
3. 字体：标题 `font-display text-lg text-ink-primary`；正文 `text-body text-ink-secondary line-clamp-2`（grid） / `line-clamp-3`（list）
4. Meta 栏：
   ```tsx
   {emotion_label && emotionInfo && (
     <div className="inline-flex items-center gap-1.5">
       <span style={{
         backgroundColor: emotionInfo.color,
         width: 6, height: 6, borderRadius: '50%',
         display: 'inline-block',
       }} />
       <span className="text-caption text-ink-muted">{emotionInfo.label}</span>
     </div>
   )}
   ```
5. 动效：外层加 `<motion.div whileHover={{ y: -2 }} transition={motionPresets.confident}>`
6. mediaPreview（可选）：如果 prop 有，渲染 1-3 个 aspect-video 缩略图 grid（CSS grid-cols-2 / grid-cols-3）；**M2 此 prop 暂不使用**（由 M3 的 MemberDetailPage 传入），T2.1 只要预留 UI 即可

**冒烟**：
- `npm run type-check`
- 访问 ArchiveDetail + MemberDetail 的记忆列表：卡片 hover 上浮、情感色 dot 显示、点击触发 onClick（console.log 验证）

**commit**：`refactor(C/M2/T2.1): MemoryCard 重做 · A 基座 + 情感色 dot + hover 动效`

---

### T2.2 · 新建 `MemoryDetailDrawer.tsx`

**目标**：右侧抽屉展示单条记忆详情，支持编辑/删除占位。

**交付文件**：`frontend/src/components/memory/MemoryDetailDrawer.tsx`

**骨架**：

```tsx
import Drawer from '@/components/ui/Drawer'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { Edit, Trash, MapPin, Calendar } from 'lucide-react'
import { formatDate, EMOTION_LABELS } from '@/lib/utils'
import type { Memory } from '@/services/api'  // 假设 memoryApi 返回 Memory 类型，若无则自己定义一下

export interface MemoryDetailDrawerProps {
  memory: Memory | null
  memberName: string
  onClose: () => void
  onEdit?: () => void
  onDelete?: () => void
}

export default function MemoryDetailDrawer({
  memory,
  memberName,
  onClose,
  onEdit,
  onDelete,
}: MemoryDetailDrawerProps) {
  if (!memory) return null
  const emotionInfo = EMOTION_LABELS.find((e) => e.value === memory.emotion_label)

  return (
    <Drawer open={!!memory} onClose={onClose} title={memory.title} side="right" size="md">
      {/* Meta 栏 */}
      <div className="flex flex-wrap items-center gap-3 text-caption text-ink-muted mb-4">
        {memory.timestamp && (
          <span className="inline-flex items-center gap-1">
            <Calendar size={12} />
            {formatDate(memory.timestamp)}
          </span>
        )}
        {memory.location && (
          <span className="inline-flex items-center gap-1">
            <MapPin size={12} />
            {memory.location}
          </span>
        )}
        {emotionInfo && (
          <span className="inline-flex items-center gap-1">
            <span style={{ backgroundColor: emotionInfo.color, width: 6, height: 6, borderRadius: '50%' }} />
            {emotionInfo.label}
          </span>
        )}
        <span className="ml-auto">隶属于 {memberName}</span>
      </div>

      {/* 正文（保留换行） */}
      <div className="prose prose-sm max-w-none whitespace-pre-wrap text-ink-primary">
        {memory.content_text}
      </div>

      {/* 相关媒体（M3 填） */}
      <div className="mt-6 pt-6 border-t border-border-default">
        <h3 className="text-body-lg font-medium text-ink-primary mb-3">关联媒体</h3>
        <div className="text-body-sm text-ink-muted">M3 实现后这里会展示 Ta 的最近媒体。</div>
      </div>

      {/* 操作区 */}
      {(onEdit || onDelete) && (
        <div className="mt-6 pt-6 border-t border-border-default flex gap-2">
          {onEdit && <Button variant="ghost" leftIcon={<Edit size={16} />} onClick={onEdit}>编辑</Button>}
          {onDelete && <Button variant="danger" leftIcon={<Trash size={16} />} onClick={onDelete}>删除</Button>}
        </div>
      )}
    </Drawer>
  )
}
```

**说明**：
- 核对 `@/components/ui/Drawer` 的 API（`open` / `onClose` / `title` / `side` / `size`），按实际签名调整
- `Button` 的 `variant="danger"` 如果不存在，用 `className="text-rose-600 border-rose-200"` 兜底
- `Memory` 类型导入：检查 `frontend/src/services/api.ts` 是否导出 Memory；没有的话你就在本文件内 `interface Memory { ... }` 定义一下（与 memoryApi 返回对齐）

**冒烟**：
- `npm run type-check`
- 单独放一个"打开 Drawer"按钮在 ArchiveDetailPage 里临时测试（后续 T2.4 正式接入）

**commit**：`feat(C/M2/T2.2): 新增 MemoryDetailDrawer 抽屉式记忆详情`

---

### T2.3 · 新建 `hooks/useMemory.ts`

**目的**：封装单记忆查询（暂时是简单包一层，为 M3 的 media 关联留接口）。

**骨架**：

```ts
import { useQuery } from '@tanstack/react-query'
import { memoryApi } from '@/services/api'

export function useMemory(memoryId: number | null) {
  return useQuery({
    queryKey: ['memory', memoryId],
    queryFn: () => memoryApi.get(memoryId!) as any,
    enabled: !!memoryId,
    staleTime: 60 * 1000,
  })
}
```

**commit**：`feat(C/M2/T2.3): 新增 useMemory hook`

---

### T2.4 · 接入 Drawer + CreateMemoryModal emotion Select

**目标**：
1. ArchiveDetailPage / MemberDetailPage 把"点击 MemoryCard 打开 Drawer"接通
2. CreateMemoryModal 加 emotion Select

**变更点**：

**ArchiveDetailPage / MemberDetailPage（两处相同改动）**：

```tsx
// state
const [activeMemory, setActiveMemory] = useState<Memory | null>(null)

// MemoryCard 传 onClick
<MemoryCard
  memory={memory}
  onClick={() => setActiveMemory(memory)}
  ...
/>

// 页面底部挂 Drawer
<MemoryDetailDrawer
  memory={activeMemory}
  memberName={activeMemory ? (members.find(m => m.id === activeMemory.member_id)?.name ?? '') : ''}
  onClose={() => setActiveMemory(null)}
  onDelete={() => {
    // 调 memoryApi.delete + invalidateQueries + close
  }}
/>
```

**CreateMemoryModal（在 MemberDetailPage 内联）**：

```tsx
// 先定义 EMOTION_OPTIONS（放 lib/utils.ts 或本文件顶部）
const EMOTION_OPTIONS = [
  { value: '', label: '（无）' },
  ...EMOTION_LABELS.map((e) => ({ value: e.value, label: `● ${e.label}` })),
]

// 表单内加
<Select
  label="情感基调（可选）"
  options={EMOTION_OPTIONS}
  value={newMemory.emotion_label}
  onValueChange={(v) => setNewMemory({ ...newMemory, emotion_label: v })}
  fullWidth
/>
```

**冒烟**：
- 手工：ArchiveDetail 记忆列表点卡 → Drawer 从右侧滑入；ESC 关闭；Drawer 显示正文完整
- 新建记忆可选情感基调，创建后卡片显示色 dot

**commit**：`feat(C/M2/T2.4): ArchiveDetail/MemberDetail 接入 MemoryDetailDrawer + emotion Select`

---

### M2 DoD

- `npm run type-check` 0 错
- `npm run build` 成功
- 手工：记忆卡可开 Drawer；Drawer 显示正文 / meta / 占位媒体区
- `git push origin Opus-coding`
- 等 Opus 放行

---

## M3 · MediaUploader + MediaGallery + mediaApi + 成员相册

**⚠️ T3.0 前置（判定命令 · Composer 启动 M3 时必跑）**：**启动 M3 之前确认 E 是否已补 `GET /api/v1/media` 列表**（`member_id` / `archive_id` / `purpose`  query，见设计文档风险 1）。**未就绪** → 不要实现 MediaGallery 拉全量列表；**暂停 M3，改走 M1→M2→M4，或等选项 A 的 E 补丁后再线性做 M3**。

```bash
curl -X GET "http://localhost:8000/api/v1/media?member_id=1" -H "Authorization: Bearer <token>"
# 有 purpose 筛选时自行追加 &purpose=archive_photo 等
```

- 返回 **200** 且 body 为 **JSON 数组**（可空 `[]`）→ M3 可启动
- 返回 **404 / 405** 或明确无 list 路由 → **向 Opus 报告**；切 **选项 B** 先做 M4，或等 E 合入后再回到 M3

### T3.1 · 扩展 `services/api.ts` 加 `mediaApi`

**骨架**：

```ts
// ========== 媒体相关 ==========

export type MediaPurpose = 'archive_photo' | 'archive_video' | 'archive_audio' | 'avatar' | 'voice_sample' | 'other'

export interface MediaAsset {
  id: number
  object_key: string
  bucket: string
  content_type: string
  size: number
  purpose: MediaPurpose
  archive_id?: number | null
  member_id?: number | null
  created_at: string
}

export interface UploadInitRequest {
  filename: string
  content_type: string
  size: number
  purpose: MediaPurpose
  archive_id?: number
  member_id?: number
}

export interface UploadInitResponse {
  upload_id: string
  object_key: string
  put_url: string
  expires_in: number
  required_headers: Record<string, string>
}

export interface UploadCompleteRequest {
  upload_id: string
  object_key: string
  size?: number
  etag?: string
}

export interface UploadCompleteResponse {
  media_id: number | null
  object_key: string
  status: 'uploaded' | 'expired' | 'initiated'
}

export const mediaApi = {
  initUpload: (data: UploadInitRequest): Promise<UploadInitResponse> =>
    api.post('/media/uploads/init', data),

  completeUpload: (data: UploadCompleteRequest): Promise<UploadCompleteResponse> =>
    api.post('/media/uploads/complete', data),

  getDownloadUrl: (mediaId: number): Promise<{ get_url: string; expires_in: number }> =>
    api.get(`/media/${mediaId}/download-url`),

  /** 需 E 已补 GET /media 列表接口 */
  list: (params: { archive_id?: number; member_id?: number; purpose?: MediaPurpose }): Promise<MediaAsset[]> =>
    api.get('/media', { params }),
}

/** PUT 到 presigned URL（不经过 api 拦截器，走原生 axios） */
export async function uploadToPresignedUrl(
  putUrl: string,
  file: File,
  contentType: string,
  onProgress?: (percent: number) => void,
): Promise<void> {
  await axios.put(putUrl, file, {
    headers: { 'Content-Type': contentType },
    onUploadProgress: (e) => {
      if (e.total && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    },
  })
}
```

**commit**：`feat(C/M3/T3.1): services/api.ts 扩展 mediaApi + 两阶段上传辅助函数`

---

### T3.2 · 新建 `hooks/useMemberMedia.ts` + `useMediaUrl.ts`

**骨架 1**（`useMemberMedia.ts`）：

```ts
import { useQuery } from '@tanstack/react-query'
import { mediaApi, type MediaPurpose } from '@/services/api'

export function useMemberMedia(
  memberId: number | null,
  purpose?: MediaPurpose,
) {
  return useQuery({
    queryKey: ['member-media', memberId, purpose],
    queryFn: () => mediaApi.list({ member_id: memberId!, purpose }),
    enabled: !!memberId,
    staleTime: 30 * 1000,
  })
}
```

**骨架 2**（`useMediaUrl.ts`）：

```ts
import { useQuery } from '@tanstack/react-query'
import { mediaApi } from '@/services/api'

export function useMediaUrl(mediaId: number | null) {
  return useQuery({
    queryKey: ['media-url', mediaId],
    queryFn: () => mediaApi.getDownloadUrl(mediaId!),
    enabled: !!mediaId,
    staleTime: 5 * 60 * 1000,
  })
}
```

**commit**：`feat(C/M3/T3.2): 新增 useMemberMedia / useMediaUrl hooks`

---

### T3.3 · 新建 `MediaUploader.tsx`（核心）

**完整实现见 spec §4.6**；这里再给出关键骨架：

```tsx
import { useState, useRef } from 'react'
import { nanoid } from 'nanoid'  // 如项目无，用 Math.random().toString(36) 兜底
import { mediaApi, uploadToPresignedUrl, type MediaPurpose, type MediaAsset } from '@/services/api'
import Button from '@/components/ui/Button'
import { useApiError } from '@/hooks/useApiError'
import { Upload, CheckCircle, XCircle, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

interface UploadItem {
  id: string
  file: File
  status: 'pending' | 'init' | 'putting' | 'completing' | 'done' | 'failed'
  progress: number
  error?: string
  result?: { media_id: number; object_key: string }
  retryCount: number
}

interface MediaUploaderProps {
  archiveId?: number
  memberId?: number
  purpose: Extract<MediaPurpose, 'archive_photo' | 'archive_video' | 'archive_audio'>
  onComplete?: (assets: MediaAsset[]) => void
  multiple?: boolean
}

const PURPOSE_ACCEPT: Record<MediaUploaderProps['purpose'], string> = {
  archive_photo: 'image/jpeg,image/png,image/webp,image/heic',
  archive_video: 'video/mp4,video/webm,video/quicktime',
  archive_audio: 'audio/mpeg,audio/wav,audio/ogg,audio/mp3,audio/mp4,audio/webm',
}

const PURPOSE_MAX_SIZE: Record<MediaUploaderProps['purpose'], number> = {
  archive_photo: 20 * 1024 * 1024,
  archive_video: 500 * 1024 * 1024,
  archive_audio: 100 * 1024 * 1024,
}

const PURPOSE_LABEL: Record<MediaUploaderProps['purpose'], string> = {
  archive_photo: '照片',
  archive_video: '视频',
  archive_audio: '音频',
}

export default function MediaUploader({
  archiveId, memberId, purpose, onComplete, multiple = true,
}: MediaUploaderProps) {
  const { show } = useApiError()
  const inputRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<UploadItem[]>([])

  async function uploadOne(item: UploadItem): Promise<UploadItem> {
    try {
      // 前端校验
      if (item.file.size > PURPOSE_MAX_SIZE[purpose]) {
        return { ...item, status: 'failed', error: `文件过大（> ${PURPOSE_MAX_SIZE[purpose] / 1024 / 1024}MB）` }
      }

      // Step 1: init
      const initRes = await mediaApi.initUpload({
        filename: item.file.name,
        content_type: item.file.type || 'application/octet-stream',
        size: item.file.size,
        purpose,
        archive_id: archiveId,
        member_id: memberId,
      })
      const updated1 = { ...item, status: 'putting' as const, progress: 0 }
      setItems(prev => prev.map(p => p.id === item.id ? updated1 : p))

      // Step 2: PUT
      await uploadToPresignedUrl(
        initRes.put_url,
        item.file,
        item.file.type || 'application/octet-stream',
        (percent) => {
          setItems(prev => prev.map(p => p.id === item.id ? { ...p, progress: percent } : p))
        },
      )

      // Step 3: complete
      setItems(prev => prev.map(p => p.id === item.id ? { ...p, status: 'completing', progress: 100 } : p))
      const completeRes = await mediaApi.completeUpload({
        upload_id: initRes.upload_id,
        object_key: initRes.object_key,
        size: item.file.size,
      })
      if (completeRes.media_id == null) {
        return { ...item, status: 'failed', error: '服务器未返回 media_id' }
      }

      return {
        ...item,
        status: 'done',
        progress: 100,
        result: { media_id: completeRes.media_id, object_key: completeRes.object_key },
      }
    } catch (err: any) {
      return { ...item, status: 'failed', error: err?.message ?? '上传失败' }
    }
  }

  async function runQueue(initialItems: UploadItem[]) {
    const uploaded: MediaAsset[] = []
    let current = [...initialItems]

    for (let i = 0; i < current.length; i++) {
      let item = current[i]
      setItems(prev => prev.map(p => p.id === item.id ? { ...p, status: 'init' } : p))
      let result = await uploadOne(item)

      // 失败自动重试 1 次
      if (result.status === 'failed' && result.retryCount < 1) {
        setItems(prev => prev.map(p => p.id === item.id ? { ...p, status: 'init', retryCount: 1 } : p))
        result = await uploadOne({ ...result, retryCount: 1, status: 'pending' })
      }

      setItems(prev => prev.map(p => p.id === item.id ? result : p))

      if (result.status === 'done' && result.result) {
        uploaded.push({
          id: result.result.media_id,
          object_key: result.result.object_key,
          bucket: '', content_type: item.file.type, size: item.file.size,
          purpose, archive_id: archiveId ?? null, member_id: memberId ?? null,
          created_at: new Date().toISOString(),
        })
      }
    }

    const successCount = uploaded.length
    const failCount = initialItems.length - successCount
    toast.success(`上传完成：成功 ${successCount} 个${failCount > 0 ? `，失败 ${failCount} 个` : ''}`)
    onComplete?.(uploaded)
  }

  function handleFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return
    const newItems: UploadItem[] = Array.from(files).map((file) => ({
      id: nanoid(),
      file,
      status: 'pending',
      progress: 0,
      retryCount: 0,
    }))
    setItems(newItems)
    void runQueue(newItems)
  }

  async function retryItem(item: UploadItem) {
    const retried = await uploadOne({ ...item, status: 'pending' })
    setItems(prev => prev.map(p => p.id === item.id ? retried : p))
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={inputRef}
        type="file"
        accept={PURPOSE_ACCEPT[purpose]}
        multiple={multiple}
        onChange={(e) => handleFilesSelected(e.target.files)}
        className="hidden"
      />
      <Button
        variant="ghost"
        leftIcon={<Upload size={18} />}
        onClick={() => inputRef.current?.click()}
      >
        选择{PURPOSE_LABEL[purpose]}
      </Button>

      {items.length > 0 && (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl bg-subtle">
              <div className="flex-1 min-w-0">
                <div className="text-body-sm text-ink-primary truncate">{item.file.name}</div>
                <div className="text-caption text-ink-muted">
                  {(item.file.size / 1024 / 1024).toFixed(1)} MB · {item.status}
                </div>
                {item.status === 'putting' && (
                  <div className="mt-1 h-1 bg-border-default rounded-full overflow-hidden">
                    <div className="h-full bg-jade-500" style={{ width: `${item.progress}%` }} />
                  </div>
                )}
                {item.error && <div className="text-caption text-rose-600 mt-1">{item.error}</div>}
              </div>
              {item.status === 'done' && <CheckCircle size={18} className="text-jade-500" />}
              {item.status === 'failed' && (
                <>
                  <Button size="sm" variant="ghost" leftIcon={<RefreshCw size={14} />} onClick={() => retryItem(item)}>
                    重试
                  </Button>
                  <XCircle size={18} className="text-rose-500" />
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

**commit**：`feat(C/M3/T3.3): 新增 MediaUploader · 单文件两阶段上传 + 进度 + 一次重试`

---

### T3.4 · 新建 `MediaGallery.tsx`

**骨架**：

```tsx
import { useState } from 'react'
import Tabs from '@/components/ui/Tabs'  // 若 A 基座 Tabs API 不一样，自己包装
import { useMemberMedia } from '@/hooks/useMemberMedia'
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/state'
import type { MediaAsset } from '@/services/api'
import { Image as ImageIcon, Video, Music } from 'lucide-react'
import MediaLightbox from './MediaLightbox'  // T3.5
import MediaItem from './MediaItem'          // 在本文件内联定义

interface MediaGalleryProps {
  memberId: number
  memberName?: string
}

export default function MediaGallery({ memberId, memberName }: MediaGalleryProps) {
  const { data: photos, isLoading: p1, error: e1 } = useMemberMedia(memberId, 'archive_photo')
  const { data: videos, isLoading: p2, error: e2 } = useMemberMedia(memberId, 'archive_video')
  const { data: audios, isLoading: p3, error: e3 } = useMemberMedia(memberId, 'archive_audio')

  const [lightbox, setLightbox] = useState<MediaAsset | null>(null)

  if (p1 && p2 && p3) return <LoadingState label="正在取出 Ta 的媒体..." />
  if (e1 && e2 && e3) return <ErrorState error={e1} />

  return (
    <>
      <Tabs defaultValue="photos">
        <Tabs.List>
          <Tabs.Trigger value="photos"><ImageIcon size={14} /> 照片 {photos && `(${photos.length})`}</Tabs.Trigger>
          <Tabs.Trigger value="videos"><Video size={14} /> 视频 {videos && `(${videos.length})`}</Tabs.Trigger>
          <Tabs.Trigger value="audios"><Music size={14} /> 音频 {audios && `(${audios.length})`}</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="photos">
          {photos && photos.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {photos.map((p) => (
                <MediaItem key={p.id} media={p} onClick={() => setLightbox(p)} />
              ))}
            </div>
          ) : (
            <EmptyState icon={ImageIcon} title="还没有照片" description={`为 ${memberName ?? 'Ta'} 上传第一张`} />
          )}
        </Tabs.Content>
        <Tabs.Content value="videos">
          {videos && videos.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {videos.map((v) => (
                <MediaItem key={v.id} media={v} />
              ))}
            </div>
          ) : (
            <EmptyState icon={Video} title="还没有视频" />
          )}
        </Tabs.Content>
        <Tabs.Content value="audios">
          {audios && audios.length > 0 ? (
            <div className="flex flex-col gap-2">
              {audios.map((a) => (
                <MediaItem key={a.id} media={a} />
              ))}
            </div>
          ) : (
            <EmptyState icon={Music} title="还没有音频" />
          )}
        </Tabs.Content>
      </Tabs>

      {lightbox && <MediaLightbox media={lightbox} onClose={() => setLightbox(null)} />}
    </>
  )
}
```

**MediaItem 内联**（新建 `components/media/MediaItem.tsx`）：渲染单个 MediaAsset，内部用 `useMediaUrl` 拿 presigned URL，按 purpose 选择渲染方式：
- `archive_photo`：`<img src={url}>` aspect-square cover
- `archive_video`：`<video controls src={url} poster={...}>` aspect-video
- `archive_audio`：`<audio controls src={url}>` 紧凑条

**commit**：`feat(C/M3/T3.4): 新增 MediaGallery · Tabs 分组 + MediaItem 按 purpose 渲染`

---

### T3.5 · 新建 `MediaLightbox.tsx`

**骨架**（简化版，Modal 包大图）：

```tsx
import Modal from '@/components/ui/Modal'
import { useMediaUrl } from '@/hooks/useMediaUrl'
import type { MediaAsset } from '@/services/api'

interface MediaLightboxProps {
  media: MediaAsset
  onClose: () => void
}

export default function MediaLightbox({ media, onClose }: MediaLightboxProps) {
  const { data: url } = useMediaUrl(media.id)
  return (
    <Modal open onClose={onClose} title="" size="xl">
      {url ? (
        <img src={url.get_url} alt="" className="max-w-full max-h-[80vh] object-contain mx-auto" />
      ) : (
        <div className="text-center py-12 text-ink-muted">加载中...</div>
      )}
    </Modal>
  )
}
```

**commit**：`feat(C/M3/T3.5): 新增 MediaLightbox · 照片放大查看`

---

### T3.6 · MemberDetailPage 集成相册区块

**关键**：在 MemberDetailPage 的"记忆列表"上方插入一段：

```tsx
<Card variant="plain" className="mb-6">
  <div className="flex items-center justify-between mb-4">
    <h2 className="text-body-lg font-medium text-ink-primary">相册</h2>
    <MediaUploader
      memberId={Number(memberId)}
      purpose="archive_photo"
      onComplete={() => queryClient.invalidateQueries({ queryKey: ['member-media', Number(memberId)] })}
    />
  </div>
  <MediaGallery memberId={Number(memberId)} memberName={member.name} />
</Card>
```

> 注：上面 MediaUploader 只放了照片上传；实际可以用 Tabs 或三个 Uploader 按钮按类型分：照片/视频/音频——**简化起见，M3 MVP 只集成照片上传**，视频/音频 Uploader 留一个"更多类型…"按钮兜底（下拉选 purpose 再传）。

**commit**：`feat(C/M3/T3.6): MemberDetailPage 集成相册区块`

---

### T3.7 · MemoryDetailDrawer 接入 MediaGallery

**变更**：把 T2.2 里的占位 "M3 实现后..." 改为：

```tsx
<MediaGallery memberId={memory.member_id} />
```

**commit**：`feat(C/M3/T3.7): MemoryDetailDrawer 接入 MediaGallery 展示成员媒体`

---

### M3 DoD

- `npm run type-check` + `npm run build` 通过
- 手工：上传 1 张 JPG（成功）+ 1 张超限 JPG（前端拦截）+ 1 个 MP4 + 1 个 WAV
- 相册 Tabs 切换正常，照片点击可放大
- `git push origin Opus-coding`
- 等 Opus 放行

---

## M4 · TimelinePage 重写

### T4.1 · 新建 `lib/timelineUtils.ts`

```ts
import type { Memory } from '@/services/api'

export interface TimelineGroup {
  year: number | null // null = 未标注时间
  items: Memory[]
}

export function groupMemoriesByYear(memories: Memory[]): TimelineGroup[] {
  const map = new Map<number | null, Memory[]>()
  for (const m of memories) {
    const year = m.timestamp ? new Date(m.timestamp).getFullYear() : null
    const bucket = map.get(year) ?? []
    bucket.push(m)
    map.set(year, bucket)
  }
  const groups: TimelineGroup[] = []
  const years = Array.from(map.keys()).filter((y): y is number => y !== null).sort((a, b) => b - a)
  for (const y of years) {
    const items = map.get(y)!.sort((a, b) =>
      new Date(b.timestamp!).getTime() - new Date(a.timestamp!).getTime(),
    )
    groups.push({ year: y, items })
  }
  if (map.has(null)) {
    groups.push({ year: null, items: map.get(null)! })
  }
  return groups
}
```

**commit**：`feat(C/M4/T4.1): 新增 timelineUtils · 记忆按年份分组排序`

---

### T4.2 · 重写 `Timeline.tsx`

**目标**：年份锚点 + 情感色节点 + ScrollReveal + stagger。

**骨架**（关键结构）：

```tsx
import { motion } from 'motion/react'
import { staggerContainer, fadeUp, motionPresets } from '@/lib/motion'
import ScrollReveal from '@/components/ui/ScrollReveal'
import { EMOTION_LABELS } from '@/lib/utils'
import type { TimelineGroup } from '@/lib/timelineUtils'
import type { Memory } from '@/services/api'

interface TimelineProps {
  groups: TimelineGroup[]
  onItemClick?: (m: Memory) => void
}

export default function Timeline({ groups, onItemClick }: TimelineProps) {
  if (groups.length === 0) return null

  return (
    <div className="relative">
      {/* 中轴线 */}
      <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-jade-100" />

      <div className="flex flex-col gap-8">
        {groups.map((group) => (
          <ScrollReveal key={group.year ?? 'no-year'}>
            <div className="relative">
              {/* 年份锚点 */}
              <div className="flex items-center gap-3 mb-4 ml-12">
                <span className="text-display-sm font-serif text-jade-700 tabular-nums">
                  {group.year ?? '未标注时间'}
                </span>
                <span className="text-caption text-ink-muted">
                  {group.items.length} 条记忆
                </span>
              </div>

              <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="flex flex-col gap-4">
                {group.items.map((m) => {
                  const emotion = EMOTION_LABELS.find(e => e.value === m.emotion_label)
                  const nodeColor = emotion?.color ?? '#059669'
                  return (
                    <motion.div
                      key={m.id}
                      variants={fadeUp}
                      className="relative pl-12 cursor-pointer group"
                      onClick={() => onItemClick?.(m)}
                    >
                      {/* 节点圆点 */}
                      <span
                        className="absolute left-3 top-4 w-4 h-4 rounded-full border-2 border-white shadow-e1"
                        style={{ backgroundColor: nodeColor }}
                      />
                      {/* 卡片 */}
                      <div className="rounded-xl bg-surface border border-border-default p-4 group-hover:shadow-e2 transition-shadow duration-200">
                        <h3 className="text-body-lg font-medium text-ink-primary">{m.title}</h3>
                        <p className="text-body-sm text-ink-secondary line-clamp-2 mt-1">{m.content_text}</p>
                        {/* meta */}
                      </div>
                    </motion.div>
                  )
                })}
              </motion.div>
            </div>
          </ScrollReveal>
        ))}
      </div>
    </div>
  )
}
```

**commit**：`feat(C/M4/T4.2): Timeline 重写 · 年份分组 + 情感色节点 + stagger`

---

### T4.3 · 重写 `TimelinePage.tsx`

**关键**：

1. 数据源：`memoryApi.list({ archive_id, limit: 100 })`（M3 升级后可分页，M4 MVP 固定 limit=100）
2. 筛选栏：
   ```tsx
   <Card variant="plain" padding="sm" className="sticky top-0 z-10 mb-4">
     <div className="flex gap-3 flex-wrap">
       <Select label="按成员" options={[{value:'',label:'全部成员'}, ...memberOptions]} value={memberFilter} onValueChange={setMemberFilter} />
       <Select label="按情感" options={[{value:'',label:'全部情感'}, ...emotionOptions]} value={emotionFilter} onValueChange={setEmotionFilter} />
       <Input type="date" label="从" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
       <Input type="date" label="到" value={dateTo} onChange={e => setDateTo(e.target.value)} />
     </div>
   </Card>
   ```
3. 空/错/载态：三件套
4. 超 100 条提示（已在 spec §风险 2 说明）

**commit**：`refactor(C/M4/T4.3): TimelinePage 重写 · 筛选栏 + 三件套 + 数据分组`

---

### T4.4 · 筛选联动

**关键**：filter 变化 → 对 allMemories 做客户端过滤 → re-group → Timeline 重渲染（利用 motion 的 `key` prop 让 stagger 重新播放）。

伪代码：

```ts
const filteredMemories = allMemories.filter(m => {
  if (memberFilter && m.member_id !== Number(memberFilter)) return false
  if (emotionFilter && m.emotion_label !== emotionFilter) return false
  if (dateFrom && (!m.timestamp || new Date(m.timestamp) < new Date(dateFrom))) return false
  if (dateTo && (!m.timestamp || new Date(m.timestamp) > new Date(dateTo))) return false
  return true
})
const groups = groupMemoriesByYear(filteredMemories)
```

**commit**：`feat(C/M4/T4.4): TimelinePage 筛选联动 + 客户端过滤`

---

### T4.5 · 集成 MemoryDetailDrawer

TimelinePage 添加 `activeMemory` state，Timeline 的 onItemClick 触发 setActiveMemory，页面底部挂 `<MemoryDetailDrawer />`。（与 T2.4 同模式）

**commit**：`feat(C/M4/T4.5): TimelinePage 接入 MemoryDetailDrawer`

---

### M4 DoD

- 手工：Timeline 按年显示，筛选联动生效，点卡打开 Drawer
- type-check + build 通过
- `git push origin Opus-coding`
- 等 Opus 放行

---

## M5 · 收尾

### T5.1 · useApiError 全量核查

```bash
rg "toast\\.error\\('" frontend/src/pages
rg "toast\\.error\\('" frontend/src/components
```

期望输出：**除 B 阶段已标注为"兼容"的少数位置外，C 本阶段改过的页面里应该零匹配**。若有遗漏，改成 `const { show } = useApiError(); ... onError: show`。

**commit**（如有修改）：`refactor(C/M5/T5.1): 收尾 · 统一 useApiError 消费错误`

---

### T5.2 · state 三件套全量核查

```bash
rg '加载中\.\.\.' frontend/src/pages
rg '还没有' frontend/src/pages
```

期望：`加载中...` 只在 D 范围页面（DialoguePage / StoryBookPage / PersonalCenter）出现；`还没有` 零匹配（C 阶段应把它们全部替换为 EmptyState description）。

**commit**（如有修改）：`refactor(C/M5/T5.2): 收尾 · 替换裸 "加载中..."/"还没有"`

---

### T5.3 · 补 `components/ui/index.ts` barrel

**问题**：B 阶段 Composer 2 创建 `components/ui/state/index.ts` 但未加到 `components/ui/index.ts`，导致页面要写深路径 `from '@/components/ui/state'`。

**修正**：在 `frontend/src/components/ui/index.ts` 加一行：

```ts
export * from './state'
```

然后页面里全部改为 `from '@/components/ui'`（grep 扫 `from '@/components/ui/state'` 替换为 `from '@/components/ui'`，但确保此处有 state 的命名导出）。

**commit**：`chore(C/M5/T5.3): components/ui barrel 补全 state 三件套导出`

---

### T5.4 · 写收尾文档

**交付文件**：`docs/superpowers/completed/2026-04-24-C-core-memory-flow.md`

**模板**（参考 E/B 的收尾文档）：

```markdown
# 子项目 C · 核心记忆流 · 收尾记录

**完成日期**：2026-04-24
**主导分支**：`Opus-coding`
**执行模型**：Composer 2（实现） · Claude 4.7 Opus（设计 + 审验 + 收尾）

---

## 一句话总结

...

## 执行时间线

| Milestone | Commit | 执行模型 | 内容 |
| ... | ... | ... | ... |

## 关键产出

- `lib/memberStatus.ts`
- `components/member/*`
- `components/memory/*`
- `components/media/*`
- `lib/timelineUtils.ts`
- ...

## 发现的问题

...

## 与 D 子项目的接口

...

## 遗留 backlog

- Memory ↔ Media 强绑定 —— 需 E 加关联表
- MediaUploader 拖拽 / 断点续传 / 秒传
- status 扩 5 值（E backlog）
- TimelinePage limit=100 分页
```

**commit**：`docs(C/M5/T5.4): 新增 C 子项目收尾文档`

---

### T5.5 · 路线图 v1.7 + tags + PR

**变更 `.cursor/rules/mtc-refactor-roadmap.mdc`**：

1. 顶部元信息：`v1.7`；子项目 C 标记完成，下一步 D
2. §五 进度 checkbox：C 标记完成
3. §十 接手清单：下一步切到 D
4. §十四新增 · C 完成总结（模仿 §十三 B 总结结构）
5. 版本变更追加 `v1.7 子项目 C 收尾 + §十四`

**tags**（由 Opus 打，Composer 2 不打）：

```bash
git tag -a mtc-C/spec-opus <C-spec-commit> -m "..."
git tag -a mtc-C/plan-opus <C-plan-commit> -m "..."
git tag -a mtc-C/impl-composer2 <M4 last commit> -m "..."
git tag -a mtc-C/done-opus HEAD -m "..."
git push origin 'refs/tags/mtc-C/*'
```

**PR**（由 Opus 开）：标题 `docs(C): 子项目 C 收尾 · 核心记忆流 + 路线图 v1.7 + tags`

**commit**：`docs(rules): 路线图 v1.7 · 子项目 C 收尾 + §十四 C 总结`

---

### M5 DoD

- 所有 grep 核查零匹配
- `npm run build` 通过，bundle size 对比 B 后新增 < 25KB gzip
- 路线图 v1.7 + tags + PR 完成

---

## 附录 A · 自检 grep 清单合集

**M1 完成后**：
```bash
rg 'is_alive' frontend/src          # = 0
rg 'death_year' frontend/src        # = 0（api.ts 注释里可能有历史说明，除外）
rg '已故' frontend/src               # = 0
rg 'primary-[0-9]+' frontend/src/pages/Archive*.tsx frontend/src/pages/MemberDetailPage.tsx  # = 0
rg 'animate-on-scroll' frontend/src  # = 0
```

**M5 完成后**：
```bash
rg "toast\\.error\\('[^']+'\\)" frontend/src/pages   # = 0（全部走 useApiError）
rg '加载中\\.\\.\\.' frontend/src/pages/Archive*.tsx  # = 0
rg '加载中\\.\\.\\.' frontend/src/pages/MemberDetailPage.tsx  # = 0
rg '加载中\\.\\.\\.' frontend/src/pages/TimelinePage.tsx  # = 0
rg '还没有' frontend/src/pages/Archive*.tsx  # = 0（改用 EmptyState description）
```

---

## 附录 B · 快速参考

### A 基座 API 速查

- `<Button variant="primary|ghost|danger" size="sm|md|lg" leftIcon={} rightIcon={} loading={} fullWidth={} disabled={} onClick={} />`（先 `cat frontend/src/components/ui/Button.tsx` 核对）
- `<Input type="..." label="" hint="" error="" leftIcon={} rightIcon={} size="sm|md|lg" fullWidth />`
- `<Textarea label="" rows={} />`
- `<Select label="" options={[{value,label,disabled}]} value onValueChange fullWidth />`
- `<Card variant="plain|glass|accent" padding="none|sm|md|lg" hoverable />`（无 `interactive`，交互靠外层 button/Link）
- `<Badge tone="jade|amber|rose|sky|violet|forest|neutral" size="sm|md" dot icon={} />`
- `<Modal open onClose title size />`
- `<Drawer open onClose title side size />`
- `<Tabs defaultValue><Tabs.List><Tabs.Trigger /></Tabs.List><Tabs.Content /></Tabs>`
- `<EmptyState icon={LucideIcon} title description action={<Button />} />`
- `<ErrorState error={apiErrorOrError} onRetry={} />`
- `<LoadingState label />`
- `useApiError()` → `{ show, hasFieldError, asApiError }`

### 动效速查（`@/lib/motion`）

- Presets：`motionPresets.instant / gentle / confident / cinematic`
- Variants：`fadeUp / fadeScale / staggerContainer / scaleIn / ...`
- `<motion.div variants={staggerContainer} initial="hidden" animate="visible">` 包 `<motion.div variants={fadeUp}>` 子元素

### Lucide-react 常用图标

`Plus / Search / Upload / Image / Video / Music / Edit / Trash / Calendar / MapPin / Tag / User / Users / Clock / MessageCircle / BookOpen / FileText / CheckCircle / XCircle / RefreshCw / Sun / Sunset / HelpCircle / FolderOpen / ChevronDown`

---

## 附录 C · 变更记录

- **v1.0** (2026-04-24, Opus)：初版。28 task 分 5 milestone，对齐主 spec 8 个核心决策；固化 B 阶段硬约束（含三条红线 + git notes 归属）；明确 T3.0 前置与选项 A/B；附 A/B/C 三个速查附录。
- **v1.0.1** (2026-04-24, Opus)：补 PR #15 链接、启动顺序（M1 起 → M1 末等 Opus 核查）、M3 选项 A/B 与 T3.0 curl 判定说明；task 数 29→28 勘误。

---

*本计划是你 1:1 实施的蓝图。有任何拿不准的，问 Opus，不要自己发挥。*
