# 子项目 D · AI 对话 + 故事书 + 记忆胶囊 · 设计规格

> **版本**：v1.1  
> **日期**：2026-04-25  
> **设计分支**：`Sonnet-coding`（Claude Sonnet 4.6）  
> **实现分支**：`Gemini-coding`（Gemini）  
> **依赖**：子项目 A（设计系统）、E（后端）、C（核心记忆流组件与 hooks）已完成

---

## 一、问题陈述

子项目 C 已打通了档案 / 成员 / 记忆三条主干数据流，D 子项目负责在此基础上完成三条"高价值体验"支线：

1. **AI 对话**：现有 `DialoguePage` 功能可用但视觉落后，无打字机效果，无成员语境侧边栏，不符合 A 基座设计语言。
2. **故事书**：现有 `StoryBookPage` 直接裸 `fetch()`，无正确的成员选择，无生成进度体验，无 PDF 导出，无 A 基座迁移。
3. **记忆胶囊**：后端 CRUD 已就绪，前端**从零开始**，路由未注册，导航无入口，`capsuleApi` 未添加。

---

## 二、范围边界

### 本轮包含

- `DialoguePage` 完整重写（A 基座 + 打字机 + 成员侧边栏 + 引导问句）
- `StoryBookPage` 完整重写（A 基座 + 成员选择 + 进度文案循环 + StoryPreview + 打印导出）
- `CapsulePage` 从零构建（列表 / 创建 / 查看详情）
- `api.ts` 新增 `capsuleApi`、`storybookApi`（规范化）
- `Layout.tsx` 导航新增胶囊入口
- `App.tsx` 注册 `/capsules` 路由

### 本轮不包含

- 后端改动（后端 capsule / dialogue / storybook API 已可用，不修改）
- 真实 SSE/WebSocket 流式对话（技术债，留下一轮）
- 胶囊定时推送后台任务（Celery 任务，属 E 子项目范畴）
- 语音播放/TTS 集成（E 子项目范畴）

---

## 三、核心架构决策

### D1：对话流式效果 — 前端打字机模拟

**选择**：B — 前端逐字符揭示，不修改后端。

- 后端 `/dialogue/chat` 返回完整 `reply` 字符串
- 前端收到后启动 `useTypewriter` hook，按 18ms/字符间隔揭示
- 伴随三点跳动 `TypingIndicator` 在 AI 回复时显示
- **理由**：零后端风险；用户体验与真流式体验差距小；18ms 节奏在 200 字回复约 3.6s，符合"思考感"

### D2：故事书导出 — 浏览器 Print API

**选择**：B — `window.print()` + `@media print` CSS。

- `StoryPreview` 组件外层加 `id="story-print-root"`
- `frontend/src/styles/print.css`（或内联 `<style>` tag in component）提供 print 样式
- `StoryActions` 中"导出 PDF"按钮调用 `window.print()`
- **理由**：零新依赖；字体渲染最优；A4 分页自然；维护成本低

### D3：胶囊时间选择 — 原生 datetime-local

**选择**：`<input type="datetime-local">` 包进 A 基座 `Input` 组件。

- **理由**：无需日历库；移动端 native picker；符合东方简洁设计哲学

### D4：对话成员侧边栏 — 可收叠

- 桌面端（`md+`）：左侧固定宽 240px 成员信息栏
- 移动端：默认隐藏，顶部 header 中添加"成员信息"折叠触发按钮
- 成员信息内容：头像占位 + 姓名 + `MemberStatusBadge` + 关系类型 + bio 前 80 字
- 引导问句 3 条（硬编码），点击自动填入 textarea

### D5：胶囊状态映射

| `status` 值 | 前端显示 | 卡片变体 |
|-------------|---------|---------|
| `locked`（`unlock_date > now`）| 🔒 锁定中 + 倒计时 | `glass`，内容 `blur-sm` |
| `locked`（`unlock_date ≤ now`）| ⏰ 到期未解封 | `glass`，amber 提示 |
| `delivered` / 已解封 | ✅ 已解封 + 时间 | `accent`，内容可见 |

> **注**：后端 `GET /capsules/{id}` 当 `unlock_date ≤ now` 时自动返回 content；前端判断 `status === 'locked' && unlock_date > now` 来决定是否模糊。

---

## 四、页面详细设计

### 4.1 DialoguePage（重写）

#### 路由
- `/dialogue`（无成员）
- `/dialogue/:archiveId/:memberId`（带成员上下文）

#### 布局结构

```
<PageTransition>
  <div class="flex h-[calc(100vh-56px)]">      ← 56px = header 高度
    <MemberSidebar />                           ← md: w-60, 小屏隐藏
    <div class="flex-1 flex flex-col min-w-0">
      <DialogueHeader />                        ← 成员名 + 清空按钮
      <MessageList />                           ← flex-1 overflow-y-auto
      <MessageInput />                          ← 底部固定
    </div>
  </div>
</PageTransition>
```

#### MemberSidebar

- 仅在有 `memberId` 时渲染内容，否则显示"选择一个成员开始对话"占位
- `useQuery` 拉取成员详情（复用 `archiveApi.getMember`）
- 使用 C 子项目产出的 `MemberProfile` 组件 + `MemberStatusBadge`
- 引导问句区：
  ```
  const STARTER_PROMPTS = [
    '你最难忘的一件事是什么？',
    '你年轻时有什么梦想？',
    '你想对我说什么？',
  ]
  ```
  每条渲染为小 `Button` `variant="ghost"` `size="sm"`，点击 `setMessage(prompt)`

#### MessageList

- 空态：居中图标 + 文案，底部显示 3 个引导问句（与侧边栏同步）
- 有消息时：`motion.div` stagger 容器，每条消息 `fadeUp` 揭入
- AI 消息在打字机进行中时：先渲染 `TypingIndicator`，打字完成后替换为消息气泡

#### ChatBubble（重写）

- 用 A 基座颜色变量，移除所有 `bg-primary-*` `text-gray-*`
- 用户气泡：`bg-brand text-white rounded-2xl rounded-tr-sm`
- AI 气泡：`bg-surface border border-border-default rounded-2xl rounded-tl-sm`
- AI 气泡支持 `isTyping` prop：内容区渲染 `TypingIndicator`

#### TypingIndicator

3 个圆点，用 `motion.span` 依次 `y: [0, -4, 0]` bounce，`staggerChildren: 0.15`

#### MessageInput

- A 基座 `Textarea` 组件（`rows={1}`，`maxRows={4}`，auto-grow）+ `Button` 发送
- Enter 发送 / Shift+Enter 换行
- 发送时 disable textarea 和按钮

#### useDialogue hook

```typescript
interface UseDialogueReturn {
  messages: ChatMessage[]
  inputValue: string
  setInputValue: (v: string) => void
  isSending: boolean           // 等待后端响应
  isTyping: boolean            // 打字机进行中
  displayedContent: string     // 打字机当前内容（最后一条 AI 消息）
  send: () => Promise<void>
  clear: () => Promise<void>
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}
```

打字机实现：
```typescript
// send() 收到 response.reply 后：
const finalContent = response.reply
setIsTyping(true)
let i = 0
const interval = setInterval(() => {
  setDisplayedContent(finalContent.slice(0, i + 1))
  i++
  if (i >= finalContent.length) {
    clearInterval(interval)
    setIsTyping(false)
    // 将完整消息推入 messages
  }
}, 18)
```

---

### 4.2 StoryBookPage（重写）

#### 路由
- `/storybook/:archiveId`

#### 布局（双栏，移动端竖排）

```
<PageTransition>
  <div class="max-w-6xl mx-auto px-4 py-8">
    <div class="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
      <StoryConfigPanel />
      <StoryPreviewPanel />
    </div>
  </div>
</PageTransition>
```

#### StoryConfigPanel

- 标题：档案名 + "故事书"
- 成员选择：`Select` 组件（选项来自 `archiveApi.listMembers`，显示"全部成员"+ 各成员名）
- 故事风格：4 张 `Card` 按钮（`hoverable`），选中时 `outline outline-2 outline-brand`
  ```
  风格卡内容：
  - icon（emoji）: '📸' '✍️' '📄' '💬'
  - label: '怀旧温情' '文学风格' '简洁平实' '对话为主'
  - desc: 副标题说明文字
  ```
- 数据概览（`Card variant="accent" padding="sm"`）：成员数 + 记忆数（`Badge tone="jade"`）
- 生成按钮：`Button variant="primary" fullWidth`，loading 状态下 `leftIcon={<Loader2 className="animate-spin"/>}`

#### 生成进度文案（仅在 `generating===true` 时在右侧预览区展示）

```typescript
const PROGRESS_TEXTS = [
  '正在整理记忆碎片…',
  '正在编织故事线索…',
  '正在润色语言…',
  '即将完成…',
]
```

使用 `useEffect` + `setInterval(1500)` 循环 index，配合 `AnimatePresence` + `fadeIn` 交叉淡入淡出。

#### StoryPreview 组件

```typescript
interface StoryPreviewProps {
  story: string
  archiveName: string
  memberName: string
  style: string
  memoryCount: number
}
```

- 外层：`Card variant="plain" padding="lg"`，加 `id="story-print-root"`
- 内层 header：档案名 + 成员名 + 风格 `Badge` + 记忆数
- 正文：`font-display`（宋体）+ `leading-[1.9]` + `text-ink-primary` + `whitespace-pre-wrap`
- Actions 行：`Button variant="ghost" size="sm"` 复制 + `Button variant="ghost" size="sm"` 打印/导出 PDF
- Print CSS（内联 `<style>` in component）：
  ```css
  @media print {
    body > * { display: none !important; }
    #story-print-root { display: block !important; }
    #story-print-root .no-print { display: none !important; }
  }
  ```

#### storybookApi（规范化）

旧的 `StoryBookPage` 直接 `fetch('/api/v1/storybook/generate', {...})`，改为：
```typescript
export const storybookApi = {
  generate: (data: {
    archive_id: number
    member_id?: number
    style?: string
  }) => api.post('/storybook/generate', null, { params: data }),
}
```
> **注**：后端 `/storybook/generate` 接受 query params，不是 JSON body，因此用 `params`。

---

### 4.3 CapsulePage（全新）

#### 路由
- `/capsules`（全局胶囊列表，跨档案/成员）

#### capsuleApi

```typescript
export const capsuleApi = {
  list: (params?: { member_id?: number }) =>
    api.get('/capsules', { params }),

  get: (id: number) =>
    api.get(`/capsules/${id}`),

  create: (data: {
    member_id: number
    title: string
    content: string
    unlock_date: string   // ISO datetime string
    recipients?: number[]
  }) => api.post('/capsules', null, {
    params: {
      member_id: data.member_id,
      title: data.title,
      content: data.content,
      unlock_date: data.unlock_date,
    }
  }),
}
```

> **注**：后端 `POST /capsules` 所有字段均为 query parameter（FastAPI 未声明 Pydantic Body model）。

#### 页面结构

```
<PageTransition>
  <div class="max-w-4xl mx-auto px-4 py-8">
    <CapsulePageHeader />      ← 标题 + "创建胶囊"按钮
    <CapsuleFilterTabs />      ← 全部 / 锁定中 / 已解封（pill variant Tabs）
    <CapsuleGrid />            ← grid-cols-1 sm:grid-cols-2
  </div>
  <CreateCapsuleModal />
  <CapsuleDetailDrawer />      ← 点击已解封胶囊查看全文
</PageTransition>
```

#### CapsuleCard 组件

```typescript
interface CapsuleCardProps {
  capsule: CapsuleItem
  onClick: () => void
}

interface CapsuleItem {
  id: number
  member_id: number
  title: string
  unlock_date: string       // ISO string
  status: 'locked' | 'delivered'
  created_at: string
  content?: string          // 仅解封后有值
}
```

**锁定卡片**（`status === 'locked' && new Date(unlock_date) > new Date()`）：
- `Card variant="glass" hoverable`
- 顶部：🔒 图标 + `Badge tone="neutral"` "锁定中"
- 中部：标题（正常显示）+ 内容区 `blur-sm select-none pointer-events-none` 显示"████ 此胶囊尚未解锁 ████"占位
- 底部：大字倒计时（`formatCountdown` 工具函数：`X 天 X 时`）+ 解封日期

**到期锁定卡片**（`status === 'locked' && new Date(unlock_date) <= new Date()`）：
- `Card variant="glass" hoverable`  
- `Badge tone="amber"` "已到期·待解封"（后端下次访问会自动解封）
- 提示文案："再次访问此胶囊以解封内容"

**已解封卡片**（`status === 'delivered'` 或后端返回了 `content`）：
- `Card variant="accent" hoverable`
- `Badge tone="jade"` "已解封"
- 内容前 60 字预览 + "…阅读全文"
- 底部：解封时间（`created_at` 作为 fallback）

#### CreateCapsuleModal 组件

`Modal` 组件包裹，`title="创建记忆胶囊"`。

字段：
1. **选择成员**：`Select`，选项来自 `archiveApi.list()` + 对每个档案 `archiveApi.listMembers()`，异步加载，格式："[档案名] · 成员名"
2. **胶囊标题**：`Input` `label="胶囊标题"` `placeholder="给这封信起个名字"`
3. **信的内容**：`Textarea` `label="内容"` `rows={6}` `placeholder="写下你想说的话…"`
4. **解封时间**：`Input type="datetime-local"` `label="解封时间"` `min={今天+1天}`
5. 底部按钮：`Button variant="ghost"` 取消 + `Button variant="primary"` 创建

#### CapsuleDetailDrawer 组件

- `Drawer side="right" size="md"`
- title：胶囊标题
- 内容：`Badge` 已解封 + 成员名 + 创建时间 + 解封时间 + 正文（`font-display leading-[1.9]`）

#### useCapsules hook

```typescript
// hooks/useCapsules.ts
export function useCapsuleList(memberId?: number) {
  return useQuery({
    queryKey: ['capsules', memberId],
    queryFn: () => capsuleApi.list(memberId ? { member_id: memberId } : undefined),
  })
}

export function useCapsuleDetail(id: number | null) {
  return useQuery({
    queryKey: ['capsule', id],
    queryFn: () => capsuleApi.get(id!),
    enabled: id !== null,
  })
}

export function useCreateCapsule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: capsuleApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['capsules'] })
      toast.success('胶囊已创建，将于指定时间解封')
    },
  })
}
```

---

## 五、导航更新

### Layout.tsx

在 `navItems` 数组中新增：

```typescript
import { Package } from 'lucide-react'   // 胶囊图标

const navItems = [
  { path: 'dashboard', label: '首页', icon: Home },
  { path: 'archives', label: '档案库', icon: FolderOpen },
  { path: 'dialogue', label: 'AI 对话', icon: MessageCircle },
  { path: 'capsules', label: '记忆胶囊', icon: Package },   // 新增
  { path: 'settings', label: '设置', icon: Settings },
]
```

### App.tsx

在受保护路由组内新增：

```tsx
import CapsulePage from './pages/CapsulePage'
// ...
<Route path="capsules" element={<CapsulePage />} />
```

---

## 六、文件清单

### 新建文件

| 路径 | 职责 |
|------|------|
| `frontend/src/hooks/useDialogue.ts` | 对话状态 + 打字机逻辑 |
| `frontend/src/hooks/useCapsules.ts` | 胶囊 CRUD hooks |
| `frontend/src/components/dialogue/ChatBubble.tsx` | 重写（原在 voice/ 目录，迁移） |
| `frontend/src/components/dialogue/TypingIndicator.tsx` | 三点跳动 loading |
| `frontend/src/components/storybook/StoryPreview.tsx` | 故事预览 + print 样式 |
| `frontend/src/components/capsule/CapsuleCard.tsx` | 胶囊卡片（双态） |
| `frontend/src/components/capsule/CreateCapsuleModal.tsx` | 创建胶囊弹窗 |
| `frontend/src/components/capsule/CapsuleDetailDrawer.tsx` | 已解封详情抽屉 |
| `frontend/src/pages/CapsulePage.tsx` | 胶囊列表页（全新） |
| `frontend/src/lib/capsuleUtils.ts` | `formatCountdown` 工具函数 |

### 修改文件

| 路径 | 修改内容 |
|------|---------|
| `frontend/src/pages/DialoguePage.tsx` | 完整重写 |
| `frontend/src/pages/StoryBookPage.tsx` | 完整重写 |
| `frontend/src/services/api.ts` | 新增 `capsuleApi`、`storybookApi` |
| `frontend/src/components/Layout.tsx` | 导航加胶囊入口 |
| `frontend/src/App.tsx` | 注册 `/capsules` 路由 |
| `frontend/src/components/voice/ChatBubble.tsx` | 保留原文件（以防其他引用）但内容重写指向新位置，或直接删除 |

> `ChatBubble` 迁移策略：将旧 `voice/ChatBubble.tsx` 内容替换为 `export { default } from '@/components/dialogue/ChatBubble'` 的重导出，新实现放在 `dialogue/ChatBubble.tsx`。这样旧引用不会 break。

---

## 七、里程碑（5 个）

### M1：API 层 + 路由注册 + 导航（基础）
- `api.ts` 新增 `capsuleApi` + `storybookApi`
- `App.tsx` 注册 `/capsules` 路由 + import `CapsulePage`（skeleton）
- `Layout.tsx` 导航新增胶囊入口
- 创建 `CapsulePage` skeleton（仅标题文字）
- 创建 `capsuleUtils.ts`（`formatCountdown`）

### M2：AI 对话页完整重做
- `hooks/useDialogue.ts`
- `components/dialogue/TypingIndicator.tsx`
- `components/dialogue/ChatBubble.tsx`（重写）
- `pages/DialoguePage.tsx`（完整重写）
- 旧 `voice/ChatBubble.tsx` 改为重导出

### M3：故事书页完整重做
- `components/storybook/StoryPreview.tsx`（含 print CSS）
- `pages/StoryBookPage.tsx`（完整重写）

### M4：记忆胶囊页
- `hooks/useCapsules.ts`
- `components/capsule/CapsuleCard.tsx`
- `components/capsule/CreateCapsuleModal.tsx`
- `components/capsule/CapsuleDetailDrawer.tsx`
- `pages/CapsulePage.tsx`（完整实现）

### M5：收尾
- 路线图 `mtc-refactor-roadmap.mdc` 更新至 v1.8，新增 §十五 D 完成总结
- `docs/superpowers/completed/2026-04-25-D-ai-dialogue-storybook-capsule.md`
- Git annotated tags：`mtc-D/spec`、`mtc-D/M1`…`mtc-D/done`

---

## 八、测试策略

无前端测试框架，采用手工烟雾测试 + TypeScript 类型检查。

### 每个 Milestone 自检清单

```
□ npm run type-check — 0 错
□ npm run build — 无 warning/error
```

### 功能验收矩阵

| 功能 | 输入 | 预期输出 |
|------|------|---------|
| 打字机效果 | AI 返回 "你好" | 3 字逐一揭示，间隔约 18ms |
| 空态引导问句 | 无历史消息 | 3 个引导按钮，点击填入输入框 |
| 故事书生成 | archive_id=1, style=nostalgic | 右侧渲染 StoryPreview，进度文案循环 |
| 故事书打印 | 点击"导出 PDF" | 触发 window.print()，仅打印预览区 |
| 胶囊倒计时 | unlock_date = 30天后 | 显示"29 天 23 时"或类似 |
| 胶囊锁定模糊 | status=locked, future date | 内容 blur，无法选中文字 |
| 创建胶囊 | 填写所有字段 | 列表刷新，新胶囊出现 |
| 胶囊解封查看 | status=delivered | Drawer 展开，内容可读 |

---

## 九、Definition of Done

- [ ] `npm run type-check` 0 错
- [ ] `npm run build` 成功
- [ ] `grep -r "bg-primary-\|text-gray-\|border-gray-" frontend/src/pages/DialoguePage.tsx` — 无匹配
- [ ] `grep -r "bg-primary-\|text-gray-\|border-gray-" frontend/src/pages/StoryBookPage.tsx` — 无匹配
- [ ] `grep -r "fetch(" frontend/src/pages/StoryBookPage.tsx` — 无匹配（已改用 `storybookApi`）
- [ ] `CapsulePage` 路由可访问，创建/查看功能正常
- [ ] `Layout.tsx` 导航显示胶囊入口
- [ ] 路线图 `mtc-refactor-roadmap.mdc` 更新，Current Node 指向"已完成"

---

## 附录 A · 产品语言规范

沿用 C 子项目确立的语言：

| 避免 | 使用 |
|------|------|
| 逝者、已故 | Ta 已经离开 |
| death_year | end_year / 辞世年 |
| is_alive | status |
| 家谱 | 关系档案 / 生命故事档案 |

---

## 附录 B · 变更记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0 | 2026-04-25 | 初版，Claude Sonnet 4.6 自主设计 |
| v1.1 | 2026-04-25 | 实现分支改为 Gemini-coding（Gemini 执行实现） |
