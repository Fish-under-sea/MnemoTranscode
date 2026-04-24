# 子项目 C · 核心记忆流 · 设计文档 v1.0

**起草人**：Claude 4.7 Opus（A 轨）
**日期**：2026-04-24
**范围**：档案库 / 档案详情 / 成员详情 / 记忆 CRUD / 媒体上传 / 时间线
**依赖**：
- 子项目 A：设计系统 + 动效基座（16 UI 组件 + motionPresets + ScrollReveal）
- 子项目 B：`services/errors.ts` + `useApiError` + `components/ui/state/*` 三件套 + `useDashboardStats` 聚合范式
- 子项目 E：`members.status/end_year` 字段 + 错误 envelope + MinIO 两阶段上传骨架

---

## 一、引言与范围

### 1.1 本子项目要解决的问题

子项目 B 把"门面层"（落地页 / 登录 / 仪表盘）重做完毕，但进入 app 之后的**核心记忆流**仍然停留在重构前的状态：

- 档案库、档案详情、成员详情 **未迁入 A 基座**（用原生 `<input>`/`<button>`、旧 `primary-*` token、裸空/载状态、无动效）
- MemoryCard 只显示文字（无媒体预览、无点击详情）
- TimelinePage 近乎空白（53 行，无筛选 / 无分组 / 无视觉叙事）
- **§五.1 产品语言决议**在这三个页面里是"未兑现承诺"：`member.is_alive === false` 硬判断"已故"、表单 placeholder "如已故"、字段名仍是 `death_year` / `is_alive`——直接违反用户 2026-04-24 的明确决议
- **媒体上传能力**虽然后端已落地两阶段接口骨架（E · M5），前端**根本没有 `mediaApi` 定义**，无法使用

C 的任务就是把这一切落地：让用户在 MTC 真正"守护记忆"——不止是文字，而是文字 + 照片 + 视频 + 音频的多模态叙事；不止是平铺列表，而是可检索、可按时间回溯的时间线；不止是"纪念逝者"的单一场景，而是"**任何一段值得珍藏的关系**"都能被妥善对待。

### 1.2 范围边界（硬划）

**在 C 范围内**：

- ✅ ArchiveListPage / ArchiveDetailPage / MemberDetailPage 全量迁 A 基座 + §五.1 产品语言全量兑现
- ✅ MemoryCard 重做（A 基座 + 媒体预览 + 点击详情）
- ✅ MemoryDetailDrawer 新建（Drawer 抽屉展开单条记忆，**不增加路由**）
- ✅ MediaUploader 组件（对接 E 两阶段 API）+ MediaGallery 组件（相册视图）
- ✅ 成员相册（MemberDetailPage 新增"相册"区块）
- ✅ TimelinePage 重写（年份分组 + 情感色节点 + 筛选 + 动效）
- ✅ `mediaApi` 扩展到 `services/api.ts`
- ✅ `lib/memberStatus.ts` 状态文案映射
- ✅ 全页 `useApiError` / state 三件套接入核查

**不在 C 范围内（明确排除）**：

- ❌ DialoguePage（归 D 子项目）
- ❌ StoryBookPage（归 D 子项目）
- ❌ PersonalCenterPage / SettingsPage（另算工单，非核心记忆流）
- ❌ `status` 从 3 值扩展到 5 值（`distant/pet/other`）——**送回 E backlog**，C 接受当前 3 值，用文案层模拟"柔和感"
- ❌ Memory ↔ Media 强绑定（需 E 加 `MemoryMediaAsset` 关联表）——**送回 E backlog**，C 采用"按成员聚合"的弱绑定策略
- ❌ 媒体断点续传 / 秒传 / 拖拽上传——**送独立工单**，C 做 MVP 级（单文件 init→PUT→complete，顺序上传多文件，失败重试 1 次）
- ❌ 视频压缩 / 图片压缩 / 缩略图生成 —— 直接使用原始文件（压缩由后续独立工单）
- ❌ 记忆的"评论 / 关联人 / 关联记忆"等延展关系——C 专注核心 CRUD

---

## 二、核心架构决策

### 决策 1：status 枚举 — 前端文案映射而非扩枚举

**背景**：§五.1 产品语言决议规划了 5 值枚举 `active/passed/distant/pet/other`，但 E 实际实现的是 3 值 `alive/deceased/unknown`。让 E 重新做一次 Alembic 迁移会阻塞 C 至少一天。

**决策**：C 不要求 E 扩枚举，而是**在前端做文案映射**。UI 层永不出现 `alive`/`deceased`/`unknown` 这三个技术字面量。

**状态文案映射**（集中在 `frontend/src/lib/memberStatus.ts`）：

| `status` 值 | UI 文案 | 徽章色调（Badge tone） | 图标（lucide-react） |
|---|---|---|---|
| `alive` | "Ta 现在还在" | `jade`（温润绿） | `Sun` |
| `deceased` | "Ta 已经离开" | `amber`（暖琥珀，含纪念感） | `Sunset` |
| `unknown` | "未说明" | `neutral`（中性灰） | `HelpCircle` |
| *（字段为 null 或字符串 `''`，兼容老数据）* | "未说明" | `neutral` | `HelpCircle` |

**好处**：
- 零后端改动，C 可立即开工
- 文案柔和化（不出现"已故"这类单向词）
- 即使未来 E 扩 5 值，前端只需补映射表，不影响其他代码

**代价**：
- "宠物 / 久未联络 / 其他关系"这些更细分的语义暂无法区分 —— 全归到 `unknown` 或让用户自己在 bio 里描述
- 送回 E backlog：未来扩枚举时再补映射表 key

### 决策 2：end_year 输入 — 跟随 status 条件显示

**背景**：ArchiveDetailPage 当前有"去世年份（可选）" + placeholder "如已故"，违反 §五.1。

**决策**：
- 创建/编辑成员表单中，**"结束年份"输入框的 label 和可见性随 status 变化**：
  - `status=alive` → **隐藏**（设为 `alive` 意味着"这段关系/这个人仍在延续"，填结束年无意义）
  - `status=deceased` → 显示，label="辞世年（可选）"，placeholder="例如：2023"
  - `status=unknown` → 显示，label="最后一次有音讯的年份（可选）"，placeholder="如：不清楚也没关系"
- 详情页展示：
  - `status=alive` → 只展示出生年份（如有）
  - `status=deceased` → "1945 – 2023"（有起止）或 "辞世于 2023 年"（只有结束）
  - `status=unknown` → "最后音讯：2023 年"（如有 end_year）或只展示出生年份（如有）

**实现位置**：`components/member/MemberStatusSection.tsx`（封装成纯组件，复用于 Detail 页和 Modal 表单）

### 决策 3：MemoryDetail — 用 Drawer 而非独立路由

**背景**：当前路由没有 `memories/:id`，加独立路由会让层级过深 `/archives/:a/members/:m/memories/:id`，且"查看记忆详情"通常在列表上下文中发生，硬跳转会丢失滚动位置与筛选状态。

**决策**：**右侧 Drawer 抽屉**（用 A 基座的 `<Drawer>` 组件），从 MemoryCard 点击触发。
- URL 不变，但 query string 加 `?memory=<id>` 用于刷新时恢复 Drawer 状态（可选）
- Drawer 内容：标题 / 时间地点情感 / 正文（全文 scroll） / 关联媒体（拉取该成员的最近媒体） / 编辑入口 / 删除按钮
- Drawer 关闭后列表保留原滚动位置

**好处**：不新增路由、保留列表上下文、移动端体验更好（下拉关闭）

**代价**：深链分享"某条记忆"能力弱（靠 query string 兜底）；不支持 SEO（但这是 auth-protected 页面，本来也不 SEO）

### 决策 4：Memory ↔ Media — "按成员聚合"的弱绑定

**背景**：后端 Memory 模型不含 media 关联字段；MediaAsset 只有 `archive_id` / `member_id`。

**决策**：C 范围内**不追加后端绑定关系**。采用三条展示策略：

1. **成员相册**（MemberDetailPage 新增区块）：展示 `MediaAsset.member_id === 当前成员` 的全部媒体，按 `purpose` 分组（照片 / 视频 / 音频），作为"这个人的媒体集合"
2. **记忆详情 Drawer**：展示"这个成员的最近 6 个媒体"作为氛围，不声称这些媒体"属于"这条记忆
3. **记忆创建表单**：**不集成媒体上传入口**，避免用户误以为媒体"绑定"到某条记忆。媒体上传入口统一放在**成员相册区块**，由用户主动上传到成员

**好处**：
- 后端零改动
- 避免"弱关联但 UI 暗示强绑定"的误导
- 未来如果 E 加了 `MemoryMediaAsset` 关联表，只需在 Drawer 里改展示源

**代价**：用户如果"想把这张照片绑到这条记忆"，C 阶段做不到 —— 可以先在记忆正文里引用"（见相册 2024 年春照片）"兜底

### 决策 5：TimelinePage 形式 — 垂直 + 年份分组 + 情感色节点 + 筛选

**备选方案**：
- A：升级版垂直时间线（本选项）—— 延续现有 Timeline 组件的视觉 DNA
- B：水平时间线（缩放 + 拖动）—— 适合数据密集，但移动端差
- C：画廊网格按年份分组 —— 偏相册感，弱时间感
- D：双视图切换 —— 工程量高

**决策**：**A · 垂直时间线** + 三个增强：
1. **年份分组**：`2024` `2023` 这样的大锚点分隔（sticky 左侧柱状年份标记）
2. **情感色节点**：时间轴圆点颜色用 `EMOTION_LABELS.color`（已有），无情感默认 `jade-400`
3. **筛选器**（页面顶部吸附栏）：
   - 按成员（Select，默认"全部"）
   - 按情感（Select，默认"全部"，带彩色预览点）
   - 按时间范围（`<Input type="date">` 起止，可选）
4. **动效**：stagger children 入场（`motionPresets.gentle` 80ms delay per item）；首次进入年份块加 ScrollReveal

**选 A 的理由**：垂直时间线 = 纪念册翻页的视觉隐喻，与 MTC 的"庄重"基调契合。水平时间线更工具化、更工程化，偏离气质。

### 决策 6：媒体上传 UX — MVP 档（单文件 + 顺序 + 进度条 + 一次重试）

**备选**：
- 档 A：极简（单文件一次一个，失败重来，无进度）
- 档 B：MVP（多文件顺序 + 进度 + 一次重试） ← **本选项**
- 档 C：豪华（并发 + 断点续传 + 秒传 + 拖拽 + 预览）

**决策**：**档 B · MVP**：

1. **入口**：`<input type="file" multiple accept="...">` （不做拖拽 DnD，移动端也不适用）
2. **多文件策略**：**顺序上传**（不并发，逻辑简单，后端 MinIO 压力可控）
3. **单文件三阶段**：
   - `init`：POST `/media/uploads/init`，拿 `{ upload_id, object_key, put_url, expires_in }`
   - `PUT`：直接 PUT 到 MinIO presigned URL（axios.put，带 `onUploadProgress` 更新进度）
   - `complete`：POST `/media/uploads/complete`，传 `{ upload_id, object_key, size }`（不传 etag，E 会从 minio stat 拿到实际 etag 校验）
4. **进度显示**：Per-file 进度条 + 整体文件数进度（"第 2 / 5 个"）
5. **失败重试**：任一阶段失败自动重试 1 次；仍失败 → 该文件标记"失败"，给"重试/跳过"按钮；不阻塞后续文件
6. **结果汇总**：全部完成（或用户 dismiss）后 toast 提示"成功 N 个，失败 M 个"
7. **MIME 白名单**：前端硬编码 matches 后端 `PURPOSE_CONTENT_TYPES`（`archive_photo` / `archive_video` / `archive_audio`），用户选错类型时前端先行拦截
8. **大小限制**：前端硬编码 matches 后端 `MAX_SIZE_BYTES`（照片 20MB / 音频 100MB / 视频 500MB），超限前端拦截

**送独立工单的**：拖拽 DnD、分块断点续传、秒传（基于 sha256 去重）、视频缩略图生成

### 决策 7：路由层级不变

维持 B/E 交付后的 6 级路由，不新增：

```
/archives                                  ArchiveListPage
/archives/:id                              ArchiveDetailPage
/archives/:archiveId/members/:memberId     MemberDetailPage
/timeline/:archiveId                       TimelinePage
/dialogue/:archiveId/:memberId             (D 子项目)
/storybook/:archiveId                      (D 子项目)
```

记忆详情通过 Drawer 展开，不单独建路由。

### 决策 8：删除旧字段消费点 — 一次性清除，不保留兼容窗口

**背景**：B · M1 已把 `api.ts` 的 `createMember` / `updateMember` 签名切到 `status` / `end_year`，但 `ArchiveDetailPage` / `MemberDetailPage` 内部仍大量消费 `member.is_alive` / `member.death_year`。

**决策**：C · M1 **一次性清除**前端所有对 `is_alive` / `death_year` 的引用，而非保留兼容层。

**理由**：
- B M1 已把 API 层切干净，组件层残留等于半成品
- 这两个字段是"用户看到的文案"源头，留着等于 §五.1 决议未兑现
- 清除后前端完全以 `status` + `end_year` 为真源，跟 E 后端对齐
- 旧数据迁移由 E 的 `members_status_end_year` migration 处理，前端拉到的 member 对象**永远**有 `status` 字段（至少是 `unknown`）

**硬约束**：C · M1 结束时，`rg 'is_alive|death_year' frontend/src` 必须零匹配。

---

## 三、产品语言改写清单（§五.1 C 部分全量兑现）

| 文件 | 行（粗略） | 当前 | 改为 | 决策依据 |
|---|---|---|---|---|
| `ArchiveDetailPage.tsx` | 166-177 | `{member.death_year && <span>— {member.death_year} 年</span>}{member.is_alive === false && <span>已故</span>}` | 使用 `<MemberStatusBadge status={member.status} endYear={member.end_year} birthYear={member.birth_year} />` | 决策 1+2 |
| `ArchiveDetailPage.tsx` | 19-25, 268-275 | `newMember` state 含 `death_year`；输入框 label "去世年份（可选）" + placeholder "如已故" | `newMember` state 含 `status: 'alive' \| 'deceased' \| 'unknown'` + `end_year`；`<MemberStatusInput value={status} onChange={...} />` + 条件渲染 `<EndYearInput status={status} />` | 决策 1+2+8 |
| `ArchiveDetailPage.tsx` | 45-57 | `createMemberMutation` 本地拼装 `{ status, end_year }` | 直接把 state 传给 `archiveApi.createMember`（state 已是 `{status, end_year}` 形态） | 决策 8 |
| `MemberDetailPage.tsx` | 86-91 | `{member.death_year && ...}{!member.is_alive && member.death_year === null && <span>已故</span>}` | `<MemberStatusSection member={member} />`（封装出生年份 + status 徽章 + end_year 条件显示 + bio） | 决策 1+2+8 |
| `lib/utils.ts` 内的 `ARCHIVE_TYPE_OPTIONS` | — | （已存在，保留）| 不改 | 范围外 |
| `lib/utils.ts` 内的 `EMOTION_LABELS` | — | （已存在，含 color）| 不改，但 Timeline / MemoryCard 直接消费其 color 字段 | 决策 5 |

**硬约束**：C · M1 完成后 `rg -t tsx -t ts 'is_alive\|death_year\|已故' frontend/src` 必须零匹配（注释除外）。

---

## 四、页面与组件详细设计

### 4.1 ArchiveListPage

**改造要点**：

1. **容器**：最外层不动，内部 `<motion.section variants={staggerContainer}>` 包裹
2. **标题区**：保留 h1 + 副标题，加 `<ScrollReveal>` 首帧入场；"新建档案" 按钮改为 `<Button leftIcon={<Plus />}>`
3. **搜索/筛选栏**：
   - `<Input leftIcon={<Search />} placeholder="搜索档案..." />`（取代原生 input）
   - 类型筛选 chips 改为 `<button onClick={...}><Badge tone={active ? 'jade' : 'neutral'} size="md">{label}</Badge></button>` 集合（A 基座 Badge 不含 `interactive` prop，交互性由外层 button 提供），active 态用 jade tone
4. **列表**：`<motion.div variants={staggerContainer}>` 包 `<motion.div variants={fadeUp}>` 的 ArchiveCard 列表；每个 ArchiveCard 入场 stagger 80ms
5. **状态态**：
   - `isLoading` → `<LoadingState label="正在取出你的档案库..." />`
   - `error` → `<ErrorState error={error} onRetry={refetch} />`
   - `filteredArchives.length === 0` + 有搜索 → `<EmptyState icon={Search} title="没有找到匹配的档案" description="换个关键词试试？" />`
   - 空库（首次使用）→ `<EmptyState icon={FolderOpen} title="还没有任何档案" description="每一段值得珍藏的关系都从一个档案开始" action={<Button>创建第一个档案</Button>} />`
6. **Modal**：`<Modal open={...} title="新建档案">` 保留，但内部表单：
   - `<Input label="档案名称" placeholder="例如：李家族谱、致青春" />` 替代原生 input
   - 类型选择改为 Card 按钮组：外层 `<button type="button" onClick={...}>` 包裹 `<Card hoverable variant={active ? 'accent' : 'plain'} padding="sm">`（注：A 基座 Card 用 `hoverable` prop，不支持 `interactive`；要交互性需在外层 button/Link）
   - `<Textarea label="描述" />` 替代原生 textarea
   - 按钮用 `<Button variant="ghost">` / `<Button variant="primary">`
7. **错误处理**：`createMutation.onError` 接 `useApiError().show(err)`（替换 `toast.error('创建失败')` 硬字符串）

### 4.2 ArchiveDetailPage

**改造要点**：

1. **布局骨架不变**（面包屑 / 档案头 / 统计 / 成员 / 记忆 四段）
2. **档案头**：`<Card variant="plain">` 替换裸 `<div>`，加 `<PageTransition>` 入场
3. **统计卡片（4 宫格）**：
   - 成员 / 记忆 / 对话 / 时间线 四个格子
   - 可跳转的两个（对话 / 时间线）：外层 `<Link to={...}>` + 内层 `<Card hoverable variant="accent">`（不可跳转的用 `variant="plain"`）
   - 统计数字用 `font-serif tabular-nums`（思源宋体 + 等宽数字）
4. **成员区块**：
   - 标题 + "添加成员" 按钮行保留
   - 成员卡片改为 `<motion.div>` grid，每个用 `<Link to="/archives/:a/members/:m">` 包 `<Card hoverable>`
   - **成员状态信息**：用新组件 `<MemberStatusLine member={member} size="sm" />`（显示 birth_year + 状态徽章 + end_year 条件）
5. **记忆区块**：
   - `<MemoryCard>` 传入 member 元信息以便 Drawer 展示
   - 列表用 `<motion.div variants={staggerContainer}>`
   - "生成故事书" 按钮改 `<Button variant="ghost" leftIcon={<BookOpen />}>`
6. **添加成员 Modal**：
   - `<Input label="姓名" />` / `<Input label="关系" />`
   - **决策 2**：新增 `<Select label="Ta 现在的状态" options={STATUS_OPTIONS} value={status} onValueChange={...} />`（`STATUS_OPTIONS` 来自 `memberStatus.ts`，每个 option 的 `label` 是"Ta 现在还在 / Ta 已经离开 / 未说明"，`value` 是 `alive / deceased / unknown`）
   - **决策 2**：`end_year` 输入条件显示（`status === 'alive'` 隐藏；`status === 'deceased'` label="辞世年（可选）"；`status === 'unknown'` label="最后一次有音讯的年份（可选）"）
   - birth_year 保留，用 `<Input type="number" label="出生年份（可选）" />`
   - `<Textarea label="简介（可选）" />`
7. **空/错/载态**：列表区块全部接 state 三件套

### 4.3 MemberDetailPage

**改造要点**：

1. **布局**：保留 面包屑 / 成员信息卡 / 记忆列表 三段 + **新增**：相册区块（M3）
2. **面包屑**：用 `<Breadcrumb>` A 基座组件（若不存在则新建 `components/ui/Breadcrumb.tsx`）
3. **成员信息卡**：用 `<MemberProfile member={member} />` 封装组件（M1 新建）
   - 头像占位（Avatar）
   - 姓名 / 关系
   - `<MemberStatusBadge />`
   - bio（若有）
   - `<Button>` 与 Ta 对话 / 查看相册 / 查看所有记忆 三个入口
4. **相册区块（M3 新建）**：见 4.7
5. **记忆列表**：
   - 筛选器：按时间 / 按情感（可选）
   - 列表用 stagger 入场
   - 点击记忆 → 打开 `<MemoryDetailDrawer>`
   - "添加记忆" `<Button>` 触发 CreateMemoryModal
6. **CreateMemoryModal**：
   - `<Input label="记忆标题" />`
   - `<Textarea label="记忆内容" rows={8} />`
   - `<Input type="datetime-local" label="发生时间" />`（A 基座 Input 通过 `...rest` 透传 type 属性，已验证支持）
   - `<Input label="地点" />`
   - **新增** `<Select label="情感基调（可选）" options={EMOTION_OPTIONS} />`——因 A 基座 Select.option 不支持自定义 icon/color，`EMOTION_OPTIONS` 的 label 直接在字符串前加 unicode 色点，如 `"● 喜悦"`（色点颜色靠 label 左侧的小圆点 emoji 近似表达，或在 Modal 内并列显示一组 `<Badge tone="neutral" dot>` chips 作为替代 UI——由实现方按可读性决定）
   - 决策 4：**不含媒体上传**入口
7. **空/错/载态**：全部接 state 三件套

### 4.4 MemoryCard（重做）

**新 Props**：

```ts
interface MemoryCardProps {
  memory: Memory              // 完整对象
  memberName?: string         // 可选，Drawer 里展示
  onClick?: () => void        // 点击回调（打开 Drawer）
  mediaPreview?: MediaAsset[] // 可选，最多 3 个缩略图（决策 4：来自该 member，非绑定）
  variant?: 'grid' | 'list'   // 列表形态（ArchiveDetail grid / MemberDetail list）
}
```

**视觉**：

- 外层 `<button type="button" onClick={onClick} className="block w-full text-left">` 包裹 `<Card hoverable>`（A 基座 Card 不支持 `interactive` prop，交互性由外层 button 提供）
- 标题：`font-display text-lg text-slate-900`
- 正文截断：`line-clamp-2` (grid) / `line-clamp-3` (list)
- Meta 栏：
  - 时间 / 地点：纯文字 + lucide 小图标
  - 情感徽章：`<Badge tone="neutral" dot>` 外加一个 `<span style={{ backgroundColor: emotionColor, width: 6, height: 6, borderRadius: '50%' }} />` 作为色点（`emotionColor` 来自 `EMOTION_LABELS.find(e => e.value === emotion_label)?.color`；这属于"数据驱动色"，不违反设计系统零硬编码原则）
  - 文字走 neutral tone 的 Badge
- **媒体预览**（若 `mediaPreview` 非空）：
  - 1 个：单图缩略图（aspect-video）
  - 2-3 个：并排缩略图网格
  - 视频标识图标叠加在缩略图右下角
  - 音频标识：播放图标 + 波形占位
- 动效：`whileHover={{ y: -2 }}` + shadow 变化（走 motionPresets.confident）

### 4.5 MemoryDetailDrawer（新建）

**位置**：`frontend/src/components/memory/MemoryDetailDrawer.tsx`

**Props**：

```ts
interface MemoryDetailDrawerProps {
  memory: Memory | null           // null 时关闭
  memberName: string
  onClose: () => void
  onEdit?: () => void
  onDelete?: () => void
}
```

**内容区**：

- 顶部：`<Drawer title={memory.title} onClose={onClose}>` （A 基座 Drawer，右侧滑出，宽度 sm:560px）
- Meta 栏：时间 + 地点 + 情感 + "隶属于 <memberName>"
- 正文：全文 scroll `prose prose-sm`（保持可读）
- 相关媒体：`<MediaGallery mediaFilter={{ member_id: memory.member_id }} limit={6} />`（M3 产出）
- 操作区（底部固定）：
  - `<Button variant="ghost" leftIcon={<Edit />}>` 编辑（M5 或独立工单，C 内占位即可）
  - `<Button variant="danger" leftIcon={<Trash />}>` 删除（调 `memoryApi.delete` + 确认对话框）

**键盘**：ESC 关闭（Drawer 组件内置）

### 4.6 MediaUploader（新建，M3 核心）

**位置**：`frontend/src/components/media/MediaUploader.tsx`

**Props**：

```ts
interface MediaUploaderProps {
  archiveId?: number
  memberId?: number
  purpose: 'archive_photo' | 'archive_video' | 'archive_audio'  // 对齐 E
  onComplete?: (assets: MediaAsset[]) => void
  accept?: string   // override MIME (默认按 purpose 推断)
  multiple?: boolean  // 默认 true
}
```

**内部状态**：

```ts
interface UploadItem {
  id: string           // nanoid
  file: File
  status: 'pending' | 'init' | 'putting' | 'completing' | 'done' | 'failed'
  progress: number     // 0-100
  error?: string
  result?: { media_id: number; object_key: string }
  retryCount: number
}
```

**流程**（见决策 6）：

```
用户点击"选择文件" → 文件列表填入 UploadItem[]
  ↓ 前置校验（MIME / size）失败 → UploadItem.status='failed'
  ↓ 通过
循环（顺序）：
  POST /media/uploads/init → { upload_id, object_key, put_url }
    ↓ 失败 → retry 1 次 → 仍失败 → UploadItem.status='failed'
  PUT put_url (axios，onUploadProgress 更新 progress)
    ↓ 失败 → retry 1 次
  POST /media/uploads/complete → { media_id, object_key, status: 'uploaded' }
    ↓ 失败 → retry 1 次
  UploadItem.status='done'
全部完成 → onComplete(assets) + toast 汇总
```

**UI 形态**：

- 未选文件：`<Button variant="ghost" leftIcon={<Upload />}>选择 {purpose 的文字}...</Button>`
- 已选文件列表（上传中/已完成/失败）：每行
  - 文件名 + MIME icon
  - 进度条（done 显示对勾）
  - 失败态："重试" / "跳过" 按钮
- 底部：当前第 N / M 个总文件计数

**错误处理**：所有错误走 `useApiError`；特殊处理 `MEDIA_UPLOAD_INIT_INVALID_TYPE` / `MEDIA_UPLOAD_INIT_FILE_TOO_LARGE`（给用户更友好的"格式不支持/太大了"文案）

### 4.7 MediaGallery（新建，M3 核心）

**位置**：`frontend/src/components/media/MediaGallery.tsx`

**Props**：

```ts
interface MediaGalleryProps {
  mediaFilter: { archive_id?: number; member_id?: number; purpose?: MediaPurpose }
  limit?: number              // 默认无限
  onUpload?: () => void       // 触发 MediaUploader（由父组件控制）
  layout?: 'grid' | 'list'    // 默认 grid
}
```

**职责**：

1. 通过 `useMemberMedia` / `useArchiveMedia` hook 拉取 MediaAsset 列表（新 hook 待建，见 4.8）
2. 按 `purpose` 自动分 Tab：照片 / 视频 / 音频（用 A 基座 `<Tabs>`）
3. 每种类型渲染：
   - **照片**：CSS Grid 3-4 列缩略图，点击放大（用 Modal 或新增 Lightbox 组件 —— **C 选 Modal 简化**）
   - **视频**：原生 `<video controls>` 播放器，每个 aspect-video 缩略
   - **音频**：`<audio controls>` 紧凑播放器 + 文件名 + 上传时间
4. 空状态：`<EmptyState icon={ImagePlus} title="还没有照片" description="为 {memberName} 上传第一张..." action={onUpload ? <Button>上传</Button> : undefined} />`
5. 图片/视频 URL 动态获取：调用 `mediaApi.getDownloadUrl(media_id)` 得到 presigned GET URL（1h 有效），前端缓存 5min 避免每次刷新都 re-sign

**Note**：presigned URL 缓存策略由 `useQuery` 的 `staleTime: 5 * 60 * 1000` 保证

### 4.8 新增 hooks

- `hooks/useMemberMedia.ts`：按 `member_id` 拉取 MediaAsset（**注意**：E 当前没有 GET `/media?member_id=X` 列表接口，仅有 GET `/media/{id}/download-url`。**C 范围内 M3 Task 1 的第一步需要先确认：是补后端 list 接口还是前端现状直接绕过？**——见 §五风险1）
- `hooks/useMemory.ts`：单记忆查询（复用 `memoryApi.get`）
- `hooks/useMediaUrl.ts`：接受 media_id，返回 presigned URL（缓存 5min）

### 4.9 TimelinePage（重写）

**数据源**：`memoryApi.list({ archive_id, limit: 500 })` —— E 当前 max limit=100，C 需要看是否需要把 limit 上限放宽或分页拉取。**见 §五风险2**

**布局**：

```
┌────────────────────────────────────────┐
│ 面包屑                                   │
│ H1: {archiveName} — 记忆时间线           │
│ 副标题: {memoryCount} 条记忆             │
├────────────────────────────────────────┤
│ 筛选栏（sticky top-0 z-10）              │
│ [成员 Select] [情感 Select] [时间区间]    │
├────────────────────────────────────────┤
│ 年份锚点侧栏（desktop sticky left）        │
│  2024 ─┤●── 记忆卡                      │
│         ├── 记忆卡                      │
│  2023 ─┤●── 记忆卡                      │
│         └── 记忆卡                      │
│  （未标注时间的记忆归为"未标注时间"组，列末）│
└────────────────────────────────────────┘
```

**动效**：

- 年份锚点：ScrollReveal（出现在视窗时淡入）
- 记忆卡：`motion.div variants={fadeUp}`，stagger 60ms（motionPresets.gentle）
- 筛选栏切换：内容 `AnimatePresence` 过渡

**交互**：

- 点击记忆卡 → 打开 `<MemoryDetailDrawer>`
- 筛选联动：改变 filter → re-fetch / re-group / 重新 stagger
- 年份点击（锚点）：scrollTo 对应年份块

**空/错/载态**：三件套全上

---

## 五、已识别风险与决策分支

### 风险 1：E 未提供按 member_id 列出 MediaAsset 的接口

**现状**：`backend/app/api/v1/media.py` 只有：
- `POST /media/uploads/init`
- `POST /media/uploads/complete`
- `GET /media/{media_id}/download-url`
- `POST /media/upload`（旧接口）
- `GET /media/{object_name:path}`

**C 需要**：按 `member_id` 或 `archive_id` 列出所有 MediaAsset（MediaGallery 依赖）

**分支**：

- **方案 A**（推荐）：C · M3 启动前，**对 E 补一个 GET `/media` 路由**，支持 `?archive_id=X` / `?member_id=X` / `?purpose=X` 三参，返回 MediaAsset 列表（带 download_url 字段或不带）
  - 工作量：E 新增 30 行路由 + 1 条集成测试
  - 归属：**E 补丁 PR**，由 Opus/Sonnet 在 C 启动前驱动补上（可能走 Codex 快速打补丁）
  - 阻塞 C · M3，不阻塞 M1/M2
- **方案 B**：前端绕过，直接查 `memoryApi.list({ member_id })` 拿记忆列表，从中**提取** media 关联——但当前 memory 响应不含媒体，死路
- **方案 C**：先在前端只展示"最近上传的媒体"（用 complete 返回的 asset 暂存 local state），页面刷新后丢失——用户体验差

**决策**：**方案 A** —— C M3 Task 1 的前置条件是"E 已补 GET /media 列表接口"。若 M3 启动时该接口尚未就绪，Composer 2 应**暂停 M3**，转做 M4（Timeline）或通知 Opus 驱动 E 补丁。

### 风险 2：TimelinePage 数据量超 100

**现状**：`memoryApi.list` 的 `limit` 后端硬上限 `100`（`Query(default=20, ge=1, le=100)`）。

**影响**：档案记忆数超 100 时 Timeline 不完整。

**决策**：
- C 阶段 MVP：`memoryApi.list({ archive_id, limit: 100 })` 足够（大多数用户档案 < 100 条）
- 超 100 的 edge case 在 Timeline 顶部显示提示 "展示最近 100 条，共 N 条" + "加载更多" 按钮，分页拉取
- 长期方案：E 加游标分页（独立工单）

### 风险 3：Composer 2 继续违反规则的风险

**背景**：B 阶段 Composer 2 独立开了 `Composer-coding` 分支、合成了 milestone-level commit、遗漏了 M3 修复点。

**C 的应对**（在交接文本中硬化）：

1. **分支纪律**：交接文本**首行用粗体警告**"**禁止创建新分支，必须在 `Opus-coding` 上直接 commit**"，并列出核验命令：`git branch --show-current` 应输出 `Opus-coding`；若是其他分支 → 立即停止
2. **颗粒度纪律**：每个 task 完成后**必须**：`git add -p` 分批 stage + `git commit` + `git log --oneline -3` 核验；task 之间不合并 commit
3. **自检纪律**：每个 milestone 完成后**必须暂停**，等 A 轨验收再进入下一 milestone；不要一口气做完才汇报
4. **grep 自检清单**（交接文本附）：
   - `rg 'is_alive|death_year|已故' frontend/src` → 零匹配（M1 DoD）
   - `rg 'primary-[0-9]|bg-white\b.+border-gray' frontend/src/pages/Archive*` → 零匹配（M1 DoD）
   - `rg '加载中\\.\\.\\.\|还没有' frontend/src/pages` → 只应出现在旧页面（M5 DoD）
   - `rg 'animate-on-scroll|useScrollReveal' frontend/src` → 零匹配（B 教训，C 承接）
5. **每 milestone push**：完成一个 M 就 `git push origin Opus-coding` 一次，符合 §六 推送节奏

### 风险 4：前端包体压力

**现状**：A 阶段已经把 CSS 做到 ~150KB（`@fontsource` 字体）。C 加 MediaUploader + MediaGallery + Timeline 逻辑，JS bundle 增量预计 +15~20 KB gzip。

**决策**：
- 接受 C 阶段的 JS 增量（功能性必需，无优化空间）
- M5 跑 `npm run build` 对比 bundle size，若单 chunk > 500KB 再拆 lazy import

---

## 六、Milestone 拆分（5 个）

| Milestone | 主题 | 估时 | 依赖 | DoD 核验命令 |
|---|---|---|---|---|
| **M1** | §五.1 产品语言全量迁移 + CRUD 三页迁 A 基座 | 1 天 | B 已合并 | `rg 'is_alive\|death_year' frontend/src` = 0；`npm run type-check`；`npm run build` |
| **M2** | MemoryCard 重做 + MemoryDetailDrawer + CreateMemoryModal 增强 | 0.5 天 | M1 | MemoryCard 点击打开 Drawer；创建记忆含情感选择 |
| **M3** | MediaUploader + MediaGallery + 成员相册区块 + mediaApi | 1.5 天 | M1 + **E 补 GET /media 列表接口** | 手工上传 3 张图通过；相册能展示；Drawer 显示关联媒体 |
| **M4** | TimelinePage 重写（分组 + 筛选 + 动效） | 1 天 | M2 | 时间线按年分组；筛选生效；点击卡打开 Drawer |
| **M5** | 收尾（全页 useApiError 核查 / state 三件套核查 / 路线图 v1.7 / tags）| 0.5 天 | M1-M4 | `rg "toast.error\\(\\'" frontend/src/pages` 零匹配；`rg '加载中\\.\\.\\.' frontend/src/pages` 零匹配 |

**执行顺序**：`M1 → M2 → M3 → M4 → M5`（线性，无跨 milestone 依赖缺口）

**若 E 补 GET /media 尚未就绪时**：`M1 → M2 → M4 → M3 → M5` 机动调整（M4 不依赖 mediaApi）

---

## 七、测试策略

**沿用 B 的工作模式（§0.3 of B plan）**：不引入前端测试框架，靠以下 3 层把关：

1. **类型检查层**：`npm run type-check` 每 task 结束跑，零错误
2. **构建层**：`npm run build` 每 milestone 结束跑，零 error + warning 可接受
3. **手工冒烟清单**（每 milestone 附）：
   - M1：登录 → `/archives` → 新建档案（完整流程）→ 进档案详情 → 新建成员（4 种 status）→ 进成员详情 → 新建记忆（含情感）→ 观察所有 status 显示
   - M2：点 MemoryCard → Drawer 展开 → ESC 关闭 → 编辑/删除按钮可见 → 相册占位可见
   - M3：成员相册 → 上传 1 张图（成功）→ 上传 1 张超大图（前端拦截）→ 上传 1 个 mp4（成功）→ 上传 1 个音频（成功）→ 查看缩略图 / 播放视频 / 播放音频
   - M4：Timeline → 按成员筛选 → 按情感筛选 → 按时间筛选 → 点卡打开 Drawer → 年份锚点可 scrollTo
   - M5：全页巡检（无裸 `toast.error('...')`、无 `加载中...`、无 `还没有`）

**不做单元测试 / 集成测试**（与 B 一致；C 是 UI-heavy，单测 ROI 低）

---

## 八、验收标准（C 完工 DoD）

**功能性**：

1. ✅ ArchiveList / ArchiveDetail / MemberDetail / Timeline 四页面全部迁 A 基座，无旧 `primary-*` 硬编码，无原生 `<input>` / `<button>` 表单
2. ✅ §五.1 字段消费方语言全量兑现：`rg 'is_alive|death_year|已故' frontend/src` 零匹配
3. ✅ 成员表单的 status 下拉 + 条件 end_year 输入生效，5 值映射文案全部显示正确（至少覆盖 3 值）
4. ✅ MemoryCard 点击能打开 MemoryDetailDrawer，Drawer 内容完整
5. ✅ MediaUploader 能完成 3 种类型（照片/视频/音频）的端到端上传（前提：E 补了 GET /media 列表接口）
6. ✅ MediaGallery 能按 member 聚合展示，点照片能放大，视频/音频能播放
7. ✅ TimelinePage 按年份分组，情感色节点生效，3 个筛选器联动工作
8. ✅ 所有列表/详情页面接入 state 三件套（无裸 "加载中..." / "还没有"）
9. ✅ 所有 `mutation.onError` 走 `useApiError`（无裸 `toast.error('创建失败')`）

**工程性**：

10. ✅ `npm run type-check` 零错误
11. ✅ `npm run build` 成功
12. ✅ 每 task 一个 commit（26 task 对应 ≥ 20 commits，允许合并小改动但不允许 5 task 合成 1 commit）
13. ✅ 每 milestone 完成 push 一次
14. ✅ Composer 2 在 `Opus-coding` 分支工作（不自开分支）

**文档性**：

15. ✅ 路线图 v1.7 收尾 + §十四 C 完成总结
16. ✅ `mtc-C/*` 四 tags push（spec-opus / plan-opus / impl-composer2 / done-opus）
17. ✅ `docs/superpowers/completed/2026-04-24-C-core-memory-flow.md` 收尾文档（简短版，坑 + 关键产出）

**非功能性（backlog 记录即可，不阻塞合入）**：

- JS bundle 增量 < 25 KB gzip（若超，记录给独立优化工单）
- Timeline 在 100+ 条记忆下 FPS ≥ 30（若卡顿，记录给 virtualization 独立工单）

---

## 九、打包说明

本 spec 版本：**v1.0**
下一步：
1. 本 spec commit 到 `Opus-coding` 分支，push
2. 进入 **writing-plans** 阶段，把本 spec 的"页面详细设计 + milestone 拆分"展开为 26 个 task，每个 task 含：文件路径 / 伪代码 / 验收命令 / 预估时长
3. plan 文档发给 Composer 2 执行（B 轨），Opus 保留 M5 验收 + 收尾 + tag 权限
4. Composer 2 每完成一个 milestone 回汇报，Opus 交叉核验后放行下一 milestone

---

*末尾保留 1 节变更记录。*

## 变更记录

- **v1.0** (2026-04-24, Opus)：初版。基于现状探索 + E/B 已交付接口契约定稿 8 个核心决策、§五.1 文案改写清单、4 个风险分支、5 个 milestone。
