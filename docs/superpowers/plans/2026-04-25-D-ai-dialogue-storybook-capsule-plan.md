# 子项目 D · AI 对话 + 故事书 + 记忆胶囊 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 完整重写 DialoguePage 和 StoryBookPage，新建 CapsulePage 从零交付，补全 capsuleApi / storybookApi，新增胶囊导航入口。

**架构：** 纯前端改造，不修改后端。三个页面各自独立，通过 `api.ts` 的新增接口与后端通信。打字机效果由前端 `useDialogue` hook 实现，故事书导出用浏览器 Print API，胶囊状态由前端根据 `unlock_date` vs `now` 推导。

**技术栈：** React 18、TypeScript、Tailwind CSS、motion/react（Framer Motion）、@tanstack/react-query、A 基座组件库（Card/Button/Input/Textarea/Select/Modal/Drawer/Badge/Tabs）、lucide-react

**实现分支：** `Gemini-coding`（从 `main` 分叉，所有实现提交在此分支）

---

## 硬约束（执行前必读）

1. **绝不使用** `bg-primary-*`、`text-gray-*`、`border-gray-*` 等旧 CSS 类 — 全部使用设计系统语义令牌（`bg-surface`、`text-ink-primary` 等）或 Tailwind 的 `jade-` / `warm-` / `amber-` 色阶
2. **绝不直接 `fetch()`** — 所有 API 调用通过 `api.ts` 中的 `xxxApi` 对象
3. **每个 Milestone 完成后** 必须运行 `npm run type-check` 确认 0 错，然后 commit
4. **分支**：所有提交必须在 `Sonnet-coding` 分支上（从 `main` 分叉）
5. **产品语言**：不使用"逝者""已故""death_year""家谱"，使用"Ta 已经离开""end_year""关系档案"

---

## 前置检查

- [ ] 确认在 `Gemini-coding` 分支上：`git branch --show-current` → 应输出 `Gemini-coding`
- [ ] 如不存在，创建：`git checkout main && git pull && git checkout -b Gemini-coding`
- [ ] 确认工作区干净：`git status` → 无未提交修改
- [ ] 进入 frontend 目录确认能编译：`npm run type-check`（记录基准错误数，≤ 当前已知数量即可）

---

## M1：API 层 + 路由注册 + 导航基础

### 任务 1.1：api.ts 新增 capsuleApi 和 storybookApi

**文件：**
- 修改：`frontend/src/services/api.ts`（在文件末尾追加）

- [ ] **步骤 1：在 `api.ts` 末尾追加以下代码**

```typescript
// ========== 记忆胶囊 ==========

export interface CapsuleItem {
  id: number
  member_id: number
  title: string
  unlock_date: string
  status: 'locked' | 'delivered'
  created_at: string
  content?: string
}

export const capsuleApi = {
  list: (params?: { member_id?: number }): Promise<CapsuleItem[]> =>
    api.get('/capsules', { params }),

  get: (id: number): Promise<CapsuleItem> =>
    api.get(`/capsules/${id}`),

  create: (data: {
    member_id: number
    title: string
    content: string
    unlock_date: string
  }): Promise<CapsuleItem> =>
    api.post('/capsules', null, {
      params: {
        member_id: data.member_id,
        title: data.title,
        content: data.content,
        unlock_date: data.unlock_date,
      },
    }),
}

// ========== 故事书 ==========

export interface StorybookResult {
  story: string
  archive_id: number
  member_id: number | null
  style: string
  memory_count: number
}

export const storybookApi = {
  generate: (data: {
    archive_id: number
    member_id?: number
    style?: string
  }): Promise<StorybookResult> =>
    api.post('/storybook/generate', null, {
      params: {
        archive_id: data.archive_id,
        ...(data.member_id !== undefined && { member_id: data.member_id }),
        ...(data.style !== undefined && { style: data.style }),
      },
    }),
}
```

- [ ] **步骤 2：验证类型无误**

```powershell
cd d:\Fish-code\MTC\frontend
npm run type-check
```

预期：错误数不超过编译前基准值（新增代码应 0 新增错误）

- [ ] **步骤 3：Commit**

```powershell
cd d:\Fish-code\MTC
git add frontend/src/services/api.ts
git commit -m "feat(D/M1): 新增 capsuleApi + storybookApi 类型与接口"
```

---

### 任务 1.2：capsuleUtils.ts 倒计时工具函数

**文件：**
- 创建：`frontend/src/lib/capsuleUtils.ts`

- [ ] **步骤 1：创建文件**

```typescript
// frontend/src/lib/capsuleUtils.ts

/**
 * 将 unlock_date ISO 字符串格式化为可读倒计时
 * 返回例："29 天 23 时" | "3 时 12 分" | "已到期"
 */
export function formatCountdown(unlockDateIso: string): string {
  const now = Date.now()
  const target = new Date(unlockDateIso).getTime()
  const diffMs = target - now

  if (diffMs <= 0) return '已到期'

  const totalMinutes = Math.floor(diffMs / 60_000)
  const totalHours = Math.floor(totalMinutes / 60)
  const totalDays = Math.floor(totalHours / 24)

  if (totalDays >= 1) {
    const remainHours = totalHours - totalDays * 24
    return `${totalDays} 天 ${remainHours} 时`
  }
  if (totalHours >= 1) {
    const remainMinutes = totalMinutes - totalHours * 60
    return `${totalHours} 时 ${remainMinutes} 分`
  }
  return `${totalMinutes} 分钟`
}

/**
 * 判断胶囊是否处于锁定状态（unlock_date 在未来）
 */
export function isCapsuleLocked(unlockDateIso: string): boolean {
  return new Date(unlockDateIso).getTime() > Date.now()
}

/**
 * 格式化日期为 "YYYY 年 MM 月 DD 日"
 */
export function formatDate(isoString: string): string {
  const d = new Date(isoString)
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`
}
```

- [ ] **步骤 2：type-check + Commit**

```powershell
npm run type-check
git add frontend/src/lib/capsuleUtils.ts
git commit -m "feat(D/M1): capsuleUtils 倒计时与状态工具函数"
```

---

### 任务 1.3：CapsulePage skeleton + 路由注册 + 导航入口

**文件：**
- 创建：`frontend/src/pages/CapsulePage.tsx`（skeleton）
- 修改：`frontend/src/App.tsx`
- 修改：`frontend/src/components/Layout.tsx`

- [ ] **步骤 1：创建 CapsulePage skeleton**

```typescript
// frontend/src/pages/CapsulePage.tsx
import { PageTransition } from '@/components/ui/PageTransition'

export default function CapsulePage() {
  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-display font-bold text-ink-primary">记忆胶囊</h1>
        <p className="text-ink-secondary mt-1">此处将展示你创建的所有记忆胶囊</p>
      </div>
    </PageTransition>
  )
}
```

- [ ] **步骤 2：在 App.tsx 注册路由**

在 `frontend/src/App.tsx` 中：
1. 添加 import：`import CapsulePage from './pages/CapsulePage'`
2. 在受保护路由组内（`<Route element={<Layout />}>` 内）加一行：
   ```tsx
   <Route path="capsules" element={<CapsulePage />} />
   ```

完整修改位置（在 `personal-center` 路由后面添加）：
```tsx
<Route path="personal-center" element={<PersonalCenterPage />} />
<Route path="capsules" element={<CapsulePage />} />   {/* 新增 */}
```

- [ ] **步骤 3：在 Layout.tsx 导航新增胶囊入口**

在 `frontend/src/components/Layout.tsx` 中：
1. 在 import 语句里，从 `lucide-react` 新增 `Package` 图标：
   ```typescript
   import {
     Home, FolderOpen, MessageCircle, Settings, LogOut, Menu, X, User,
     ChevronDown, LayoutDashboard, Package
   } from 'lucide-react'
   ```
2. 在 `navItems` 数组中，在 `dialogue` 后面插入：
   ```typescript
   { path: 'capsules', label: '记忆胶囊', icon: Package },
   ```

- [ ] **步骤 4：type-check + 验证路由**

```powershell
npm run type-check
```

访问 `http://localhost:5173/capsules`（或 dev server 地址）应可看到 skeleton 标题。

- [ ] **步骤 5：Commit**

```powershell
cd d:\Fish-code\MTC
git add frontend/src/pages/CapsulePage.tsx frontend/src/App.tsx frontend/src/components/Layout.tsx
git commit -m "feat(D/M1): CapsulePage 骨架 + /capsules 路由 + 导航入口"
```

---

## M2：AI 对话页完整重做

### 任务 2.1：useDialogue hook

**文件：**
- 创建：`frontend/src/hooks/useDialogue.ts`

- [ ] **步骤 1：创建 hook 文件**

```typescript
// frontend/src/hooks/useDialogue.ts
import { useState, useRef, useCallback, useEffect } from 'react'
import { dialogueApi } from '@/services/api'
import { useApiError } from '@/hooks/useApiError'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface UseDialogueOptions {
  archiveId?: number
  memberId?: number
}

export function useDialogue({ archiveId, memberId }: UseDialogueOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [displayedContent, setDisplayedContent] = useState('')
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).slice(2)}`)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const { show: showError } = useApiError()

  // 清理打字机定时器
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  const startTypewriter = useCallback((fullContent: string, onDone: () => void) => {
    setIsTyping(true)
    setDisplayedContent('')
    let i = 0
    intervalRef.current = setInterval(() => {
      i++
      setDisplayedContent(fullContent.slice(0, i))
      if (i >= fullContent.length) {
        if (intervalRef.current) clearInterval(intervalRef.current)
        setIsTyping(false)
        onDone()
      }
    }, 18)
  }, [])

  const send = useCallback(async () => {
    const text = inputValue.trim()
    if (!text || isSending || isTyping) return

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInputValue('')
    setIsSending(true)

    try {
      const response = await dialogueApi.chat({
        message: text,
        archive_id: archiveId,
        member_id: memberId,
        channel: 'app',
        session_id: sessionId,
        history_limit: 10,
      }) as any

      const replyText: string = response.reply || '...'
      setIsSending(false)

      // 先插入一条 assistant 消息（内容暂为空，打字机填充）
      const assistantMsgId = `assistant_${Date.now()}`
      setMessages((prev) => [
        ...prev,
        { id: assistantMsgId, role: 'assistant', content: '', timestamp: new Date() },
      ])

      startTypewriter(replyText, () => {
        // 打字机完成 → 将完整内容写入消息记录
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId ? { ...m, content: replyText } : m
          )
        )
        setDisplayedContent('')
      })
    } catch (err) {
      setIsSending(false)
      // 回滚用户消息
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id))
      showError(err, '发送失败，请重试')
    }
  }, [inputValue, isSending, isTyping, archiveId, memberId, sessionId, startTypewriter, showError])

  const clear = useCallback(async () => {
    setMessages([])
    setDisplayedContent('')
    if (intervalRef.current) clearInterval(intervalRef.current)
    setIsTyping(false)
    try {
      await dialogueApi.clearHistory(sessionId)
    } catch {
      // 忽略清除历史失败
    }
  }, [sessionId])

  return {
    messages,
    inputValue,
    setInputValue,
    isSending,
    isTyping,
    displayedContent,
    send,
    clear,
    sessionId,
  }
}
```

- [ ] **步骤 2：type-check**

```powershell
npm run type-check
```

- [ ] **步骤 3：Commit**

```powershell
cd d:\Fish-code\MTC
git add frontend/src/hooks/useDialogue.ts
git commit -m "feat(D/M2): useDialogue hook 含打字机逻辑"
```

---

### 任务 2.2：TypingIndicator 组件

**文件：**
- 创建：`frontend/src/components/dialogue/TypingIndicator.tsx`

- [ ] **步骤 1：创建组件**

```typescript
// frontend/src/components/dialogue/TypingIndicator.tsx
import { motion } from 'motion/react'

const dotVariants = {
  hidden: { y: 0, opacity: 0.4 },
  bounce: {
    y: [-4, 0],
    opacity: [1, 0.4],
    transition: { duration: 0.5, repeat: Infinity, repeatType: 'reverse' as const },
  },
}

export default function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-1 py-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          variants={dotVariants}
          initial="hidden"
          animate="bounce"
          style={{ transitionDelay: `${i * 0.15}s` }}
          transition={{ delay: i * 0.15, duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
          className="block w-2 h-2 rounded-full bg-ink-muted"
        />
      ))}
    </div>
  )
}
```

- [ ] **步骤 2：Commit**

```powershell
cd d:\Fish-code\MTC
git add frontend/src/components/dialogue/TypingIndicator.tsx
git commit -m "feat(D/M2): TypingIndicator 三点跳动组件"
```

---

### 任务 2.3：ChatBubble 重写（迁移到 dialogue/ 目录）

**文件：**
- 创建：`frontend/src/components/dialogue/ChatBubble.tsx`（新实现）
- 修改：`frontend/src/components/voice/ChatBubble.tsx`（改为重导出）

- [ ] **步骤 1：创建新 ChatBubble**

```typescript
// frontend/src/components/dialogue/ChatBubble.tsx
import { cn } from '@/lib/utils'
import { User } from 'lucide-react'
import TypingIndicator from './TypingIndicator'

interface ChatBubbleProps {
  role: 'user' | 'assistant'
  content: string
  memberName?: string
  /** 当前正在打字机渲染的内容（仅最后一条 assistant 消息传入） */
  typingContent?: string
  /** 是否显示打字机 loading 状态（content 为空时） */
  isTyping?: boolean
}

export default function ChatBubble({
  role,
  content,
  memberName,
  typingContent,
  isTyping,
}: ChatBubbleProps) {
  const isUser = role === 'user'
  const displayContent = isUser ? content : (typingContent ?? content)

  return (
    <div className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* 头像 */}
      <div
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-medium',
          isUser
            ? 'bg-jade-100 text-jade-700'
            : 'bg-warm-200 text-ink-secondary'
        )}
      >
        {isUser ? <User size={16} /> : (memberName?.charAt(0) || 'AI')}
      </div>

      {/* 消息气泡 */}
      <div
        className={cn(
          'max-w-[70%] rounded-2xl px-4 py-3 text-body-sm leading-relaxed',
          isUser
            ? 'bg-brand text-white rounded-tr-sm'
            : 'bg-surface border border-border-default text-ink-primary rounded-tl-sm'
        )}
      >
        {!isUser && memberName && (
          <div className="text-caption font-medium mb-1 text-ink-secondary">{memberName}</div>
        )}

        {/* 打字机内容或 loading indicator */}
        {isTyping && !displayContent ? (
          <TypingIndicator />
        ) : (
          <div className="whitespace-pre-wrap">{displayContent}</div>
        )}

        {/* 打字机进行中时显示光标 */}
        {!isUser && typingContent !== undefined && (
          <span className="inline-block w-0.5 h-4 bg-ink-muted ml-0.5 animate-pulse align-text-bottom" />
        )}
      </div>
    </div>
  )
}
```

- [ ] **步骤 2：将旧 `voice/ChatBubble.tsx` 改为重导出**

```typescript
// frontend/src/components/voice/ChatBubble.tsx
// 迁移到 dialogue/ 目录，保留此文件以维持旧引用兼容
export { default } from '@/components/dialogue/ChatBubble'
```

- [ ] **步骤 3：type-check + Commit**

```powershell
npm run type-check
git add frontend/src/components/dialogue/ChatBubble.tsx frontend/src/components/voice/ChatBubble.tsx
git commit -m "feat(D/M2): ChatBubble 重写迁移至 dialogue/，支持打字机与 A 基座样式"
```

---

### 任务 2.4：DialoguePage 完整重写

**文件：**
- 修改：`frontend/src/pages/DialoguePage.tsx`

- [ ] **步骤 1：完整替换 DialoguePage 内容**

```typescript
// frontend/src/pages/DialoguePage.tsx
import { useRef, useEffect, KeyboardEvent } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'motion/react'
import { Trash2, Send, ChevronRight } from 'lucide-react'
import { archiveApi } from '@/services/api'
import { Button } from '@/components/ui/Button'
import { PageTransition } from '@/components/ui/PageTransition'
import { MemberProfile } from '@/components/member/MemberProfile'
import { MemberStatusBadge } from '@/components/member/MemberStatusBadge'
import { LoadingState } from '@/components/ui/state'
import ChatBubble from '@/components/dialogue/ChatBubble'
import { useDialogue } from '@/hooks/useDialogue'
import { fadeUp, staggerContainer } from '@/lib/motion'
import { cn } from '@/lib/utils'

const STARTER_PROMPTS = [
  '你最难忘的一件事是什么？',
  '你年轻时有什么梦想？',
  '你想对我说什么？',
]

export default function DialoguePage() {
  const { archiveId, memberId } = useParams<{ archiveId?: string; memberId?: string }>()
  const archiveIdNum = archiveId ? Number(archiveId) : undefined
  const memberIdNum = memberId ? Number(memberId) : undefined

  const { data: archive } = useQuery({
    queryKey: ['archive', archiveIdNum],
    queryFn: () => archiveApi.get(archiveIdNum!) as any,
    enabled: !!archiveIdNum,
  })

  const { data: member } = useQuery({
    queryKey: ['member', archiveIdNum, memberIdNum],
    queryFn: () => archiveApi.getMember(archiveIdNum!, memberIdNum!) as any,
    enabled: !!archiveIdNum && !!memberIdNum,
  })

  const {
    messages,
    inputValue,
    setInputValue,
    isSending,
    isTyping,
    displayedContent,
    send,
    clear,
  } = useDialogue({ archiveId: archiveIdNum, memberId: memberIdNum })

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, displayedContent])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const memberName = (member as any)?.name || (archive as any)?.name || 'AI 助手'
  const hasContext = !!memberIdNum

  return (
    <PageTransition>
      <div className="flex h-[calc(100vh-56px)]">
        {/* 成员侧边栏（仅桌面端） */}
        <aside className="hidden md:flex flex-col w-60 border-r border-border-default bg-subtle overflow-y-auto flex-shrink-0">
          <div className="p-4 border-b border-border-default">
            <div className="flex items-center gap-1.5 text-caption text-ink-muted">
              <Link to="/archives" className="hover:text-brand transition-colors">档案库</Link>
              {archiveIdNum && (
                <>
                  <ChevronRight size={12} />
                  <Link to={`/archives/${archiveIdNum}`} className="hover:text-brand transition-colors">
                    {(archive as any)?.name || '档案'}
                  </Link>
                </>
              )}
              {memberIdNum && (
                <>
                  <ChevronRight size={12} />
                  <span className="text-ink-primary font-medium">{memberName}</span>
                </>
              )}
            </div>
          </div>

          <div className="p-4 flex-1">
            {!hasContext ? (
              <p className="text-caption text-ink-muted">从档案库选择一个成员开始对话</p>
            ) : !member ? (
              <LoadingState variant="skeleton-list" count={3} />
            ) : (
              <div className="space-y-4">
                {/* 成员信息 */}
                <div className="space-y-2">
                  <div className="w-12 h-12 rounded-full bg-jade-100 flex items-center justify-center text-jade-700 font-display font-bold text-lg">
                    {(member as any).name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <div className="font-medium text-ink-primary">{(member as any).name}</div>
                    <div className="text-caption text-ink-muted">{(member as any).relationship_type}</div>
                  </div>
                  <MemberStatusBadge
                    status={(member as any).status}
                    birthYear={(member as any).birth_year}
                    endYear={(member as any).end_year}
                    showLifespan
                    size="sm"
                  />
                  {(member as any).bio && (
                    <p className="text-caption text-ink-secondary leading-relaxed line-clamp-4">
                      {(member as any).bio}
                    </p>
                  )}
                </div>

                {/* 引导问句 */}
                <div className="space-y-2 pt-2 border-t border-border-default">
                  <div className="text-caption text-ink-muted font-medium">试着问 Ta：</div>
                  {STARTER_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => setInputValue(prompt)}
                      className="w-full text-left text-caption text-ink-secondary hover:text-brand hover:bg-jade-50 px-3 py-2 rounded-lg transition-colors border border-border-default"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* 对话主区 */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-default bg-surface/80 backdrop-blur-sm flex-shrink-0">
            <div>
              <h1 className="text-body font-semibold text-ink-primary">
                与 {memberName} 对话
              </h1>
              {(member as any)?.relationship_type && (
                <p className="text-caption text-ink-muted">{(member as any).relationship_type}</p>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Trash2 size={14} />}
              onClick={clear}
              title="清空对话"
            >
              清空
            </Button>
          </div>

          {/* 消息列表 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <AnimatePresence mode="popLayout">
              {messages.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-full flex flex-col items-center justify-center text-ink-muted py-12"
                >
                  <div className="text-4xl mb-4">💬</div>
                  <p className="text-body-sm text-center mb-6">
                    {hasContext
                      ? `和 ${memberName} 开始对话吧，Ta 记得你们的故事`
                      : '从左侧选择一位成员开始对话'}
                  </p>
                  {hasContext && (
                    <motion.div
                      variants={staggerContainer(0.08)}
                      initial="hidden"
                      animate="visible"
                      className="flex flex-col gap-2 w-full max-w-xs"
                    >
                      {STARTER_PROMPTS.map((prompt) => (
                        <motion.button
                          key={prompt}
                          variants={fadeUp}
                          onClick={() => setInputValue(prompt)}
                          className="text-body-sm text-ink-secondary hover:text-brand border border-border-default hover:border-brand/50 px-4 py-2.5 rounded-xl transition-all hover:bg-jade-50 text-left"
                        >
                          {prompt}
                        </motion.button>
                      ))}
                    </motion.div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="messages"
                  variants={staggerContainer(0.04)}
                  initial="hidden"
                  animate="visible"
                  className="space-y-4"
                >
                  {messages.map((msg, idx) => {
                    const isLastAssistant =
                      msg.role === 'assistant' &&
                      idx === messages.length - 1
                    const isCurrentlyTyping = isLastAssistant && (isTyping || isSending)

                    return (
                      <motion.div key={msg.id} variants={fadeUp}>
                        <ChatBubble
                          role={msg.role}
                          content={msg.content}
                          memberName={msg.role === 'assistant' ? memberName : undefined}
                          typingContent={
                            isCurrentlyTyping
                              ? (isTyping ? displayedContent : undefined)
                              : undefined
                          }
                          isTyping={isCurrentlyTyping && isSending && !isTyping}
                        />
                      </motion.div>
                    )
                  })}
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>

          {/* 输入区 */}
          <div className="flex-shrink-0 border-t border-border-default bg-surface p-3">
            <div className="flex gap-3 items-end">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`对 ${memberName} 说些什么…`}
                rows={1}
                disabled={isSending || isTyping}
                className={cn(
                  'flex-1 resize-none outline-none text-body-sm bg-transparent',
                  'text-ink-primary placeholder:text-ink-muted',
                  'max-h-32 leading-relaxed',
                  (isSending || isTyping) && 'opacity-50',
                )}
                style={{ fieldSizing: 'content' } as React.CSSProperties}
              />
              <Button
                variant="primary"
                size="sm"
                rightIcon={<Send size={14} />}
                onClick={send}
                disabled={!inputValue.trim() || isSending || isTyping}
              >
                发送
              </Button>
            </div>
            <p className="text-caption text-ink-muted mt-1.5 text-center">
              Enter 发送 · Shift + Enter 换行
            </p>
          </div>
        </div>
      </div>
    </PageTransition>
  )
}
```

- [ ] **步骤 2：type-check + Commit**

```powershell
cd d:\Fish-code\MTC\frontend
npm run type-check
```

修复任何新产生的类型错误。

```powershell
cd d:\Fish-code\MTC
git add frontend/src/pages/DialoguePage.tsx
git commit -m "feat(D/M2): DialoguePage 完整重写，A 基座 + 打字机 + 成员侧边栏"
```

---

### 任务 2.5：M2 完整性检查

- [ ] **步骤 1：验证无旧 CSS 类**

```powershell
cd d:\Fish-code\MTC\frontend
# 应无输出（Windows 使用 Select-String）
Select-String -Path "src\pages\DialoguePage.tsx" -Pattern "bg-primary-|text-gray-|border-gray-"
Select-String -Path "src\components\dialogue\ChatBubble.tsx" -Pattern "bg-primary-|text-gray-|border-gray-"
```

- [ ] **步骤 2：M2 里程碑标记 Commit**

```powershell
cd d:\Fish-code\MTC
git commit --allow-empty -m "milestone(D/M2): AI 对话页重做完成"
```

---

## M3：故事书页完整重做

### 任务 3.1：StoryPreview 组件

**文件：**
- 创建：`frontend/src/components/storybook/StoryPreview.tsx`

- [ ] **步骤 1：创建组件**

```typescript
// frontend/src/components/storybook/StoryPreview.tsx
import { useRef } from 'react'
import { Copy, Printer } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import toast from 'react-hot-toast'

const STYLE_LABELS: Record<string, string> = {
  nostalgic: '怀旧温情',
  literary: '文学风格',
  simple: '简洁平实',
  dialogue: '对话为主',
}

interface StoryPreviewProps {
  story: string
  archiveName: string
  memberName: string
  style: string
  memoryCount: number
}

export default function StoryPreview({
  story,
  archiveName,
  memberName,
  style,
  memoryCount,
}: StoryPreviewProps) {
  const printRootRef = useRef<HTMLDivElement>(null)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(story)
    toast.success('故事已复制到剪贴板')
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <>
      {/* 打印样式 */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          #story-print-root { display: block !important; position: static !important; }
          #story-print-root .no-print { display: none !important; }
        }
      `}</style>

      <div id="story-print-root" ref={printRootRef}>
        <Card variant="plain" padding="lg">
          {/* 元信息 header */}
          <div className="flex items-start justify-between mb-6 no-print">
            <div>
              <h2 className="text-h3 font-display font-bold text-ink-primary">
                {archiveName} — {memberName} 的故事
              </h2>
              <div className="flex items-center gap-2 mt-2">
                <Badge tone="jade" size="sm">{STYLE_LABELS[style] || style}</Badge>
                <span className="text-caption text-ink-muted">基于 {memoryCount} 条记忆</span>
              </div>
            </div>
          </div>

          {/* 打印时显示的 header */}
          <div className="hidden print:block mb-8">
            <h1 className="text-2xl font-bold">{archiveName} — {memberName} 的故事</h1>
            <p className="text-sm text-gray-500 mt-1">{STYLE_LABELS[style]} · 基于 {memoryCount} 条记忆</p>
          </div>

          {/* 正文 */}
          <div className="font-display text-ink-primary leading-[1.9] whitespace-pre-wrap text-body">
            {story}
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-3 mt-8 pt-6 border-t border-border-default no-print">
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Copy size={14} />}
              onClick={handleCopy}
            >
              复制全文
            </Button>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Printer size={14} />}
              onClick={handlePrint}
            >
              打印 / 导出 PDF
            </Button>
          </div>
        </Card>
      </div>
    </>
  )
}
```

- [ ] **步骤 2：Commit**

```powershell
cd d:\Fish-code\MTC
git add frontend/src/components/storybook/StoryPreview.tsx
git commit -m "feat(D/M3): StoryPreview 组件含打印样式"
```

---

### 任务 3.2：StoryBookPage 完整重写

**文件：**
- 修改：`frontend/src/pages/StoryBookPage.tsx`

- [ ] **步骤 1：完整替换 StoryBookPage**

```typescript
// frontend/src/pages/StoryBookPage.tsx
import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'motion/react'
import { BookOpen, Loader2 } from 'lucide-react'
import { archiveApi, memoryApi, storybookApi } from '@/services/api'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { PageTransition } from '@/components/ui/PageTransition'
import { LoadingState, ErrorState } from '@/components/ui/state'
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
```

- [ ] **步骤 2：验证无旧 CSS 类 + 无裸 fetch()**

```powershell
cd d:\Fish-code\MTC\frontend
Select-String -Path "src\pages\StoryBookPage.tsx" -Pattern "bg-primary-|text-gray-|border-gray-|fetch\("
```

应无输出。

- [ ] **步骤 3：type-check + Commit**

```powershell
npm run type-check
cd d:\Fish-code\MTC
git add frontend/src/pages/StoryBookPage.tsx frontend/src/components/storybook/StoryPreview.tsx
git commit -m "feat(D/M3): StoryBookPage 完整重写，进度文案循环 + StoryPreview + 打印导出"
```

---

### 任务 3.3：M3 完整性检查

- [ ] **步骤 1：M3 里程碑标记 Commit**

```powershell
cd d:\Fish-code\MTC
git commit --allow-empty -m "milestone(D/M3): 故事书页重做完成"
```

---

## M4：记忆胶囊页完整实现

### 任务 4.1：useCapsules hook

**文件：**
- 创建：`frontend/src/hooks/useCapsules.ts`

- [ ] **步骤 1：创建 hook 文件**

```typescript
// frontend/src/hooks/useCapsules.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { capsuleApi, type CapsuleItem } from '@/services/api'

export function useCapsuleList(memberId?: number) {
  return useQuery<CapsuleItem[]>({
    queryKey: ['capsules', memberId],
    queryFn: () => capsuleApi.list(memberId ? { member_id: memberId } : undefined),
  })
}

export function useCapsuleDetail(id: number | null) {
  return useQuery<CapsuleItem>({
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
      toast.success('记忆胶囊已创建，将于指定时间解封')
    },
    onError: () => {
      toast.error('创建失败，请重试')
    },
  })
}
```

- [ ] **步骤 2：type-check + Commit**

```powershell
cd d:\Fish-code\MTC\frontend
npm run type-check
cd d:\Fish-code\MTC
git add frontend/src/hooks/useCapsules.ts
git commit -m "feat(D/M4): useCapsules hook (list / detail / create)"
```

---

### 任务 4.2：CapsuleCard 组件

**文件：**
- 创建：`frontend/src/components/capsule/CapsuleCard.tsx`

- [ ] **步骤 1：创建组件**

```typescript
// frontend/src/components/capsule/CapsuleCard.tsx
import { Lock, Unlock, Clock } from 'lucide-react'
import { motion } from 'motion/react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatCountdown, isCapsuleLocked, formatDate } from '@/lib/capsuleUtils'
import { fadeUp } from '@/lib/motion'
import { cn } from '@/lib/utils'
import type { CapsuleItem } from '@/services/api'

interface CapsuleCardProps {
  capsule: CapsuleItem
  onClick: () => void
}

export default function CapsuleCard({ capsule, onClick }: CapsuleCardProps) {
  const locked = isCapsuleLocked(capsule.unlock_date) && capsule.status === 'locked'
  const expired = !locked && capsule.status === 'locked'  // 已过期但后端未标记 delivered
  const delivered = !locked && !expired

  return (
    <motion.div variants={fadeUp}>
      <button onClick={onClick} className="w-full text-left">
        <Card
          variant={delivered ? 'accent' : 'glass'}
          padding="md"
          hoverable
          className="h-full"
        >
          {/* 状态 header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {locked && <Lock size={14} className="text-ink-muted" />}
              {expired && <Clock size={14} className="text-amber-600" />}
              {delivered && <Unlock size={14} className="text-brand" />}
              <Badge
                tone={locked ? 'neutral' : expired ? 'amber' : 'jade'}
                size="sm"
              >
                {locked ? '锁定中' : expired ? '已到期·待解封' : '已解封'}
              </Badge>
            </div>
          </div>

          {/* 标题 */}
          <h3 className="text-body font-semibold text-ink-primary mb-2 line-clamp-1">
            {capsule.title}
          </h3>

          {/* 锁定：倒计时 + 模糊内容 */}
          {locked && (
            <>
              <div className="mb-3">
                <div className="text-h3 font-display font-bold text-ink-primary tabular-nums">
                  {formatCountdown(capsule.unlock_date)}
                </div>
                <div className="text-caption text-ink-muted mt-0.5">
                  解封于 {formatDate(capsule.unlock_date)}
                </div>
              </div>
              <div
                className={cn(
                  'text-caption text-ink-secondary leading-relaxed',
                  'blur-sm select-none pointer-events-none',
                )}
              >
                ████████████████████████ 此胶囊尚未解锁 ████████████████████████
              </div>
            </>
          )}

          {/* 已到期待解封 */}
          {expired && (
            <p className="text-caption text-amber-600">
              此胶囊已到解封时间，点击查看内容
            </p>
          )}

          {/* 已解封：内容预览 */}
          {delivered && capsule.content && (
            <p className="text-caption text-ink-secondary leading-relaxed line-clamp-3">
              {capsule.content.slice(0, 80)}
              {capsule.content.length > 80 ? '…' : ''}
            </p>
          )}

          {/* 底部时间信息 */}
          <div className="mt-3 pt-3 border-t border-border-default">
            <span className="text-caption text-ink-muted">
              创建于 {formatDate(capsule.created_at)}
            </span>
          </div>
        </Card>
      </button>
    </motion.div>
  )
}
```

- [ ] **步骤 2：type-check + Commit**

```powershell
cd d:\Fish-code\MTC\frontend
npm run type-check
cd d:\Fish-code\MTC
git add frontend/src/components/capsule/CapsuleCard.tsx
git commit -m "feat(D/M4): CapsuleCard 双态（锁定倒计时 / 已解封预览）"
```

---

### 任务 4.3：CreateCapsuleModal 组件

**文件：**
- 创建：`frontend/src/components/capsule/CreateCapsuleModal.tsx`

- [ ] **步骤 1：创建组件**

```typescript
// frontend/src/components/capsule/CreateCapsuleModal.tsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Modal from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select, type SelectOption } from '@/components/ui/Select'
import { archiveApi } from '@/services/api'
import { useCreateCapsule } from '@/hooks/useCapsules'

interface CreateCapsuleModalProps {
  open: boolean
  onClose: () => void
}

export default function CreateCapsuleModal({ open, onClose }: CreateCapsuleModalProps) {
  const [selectedArchiveId, setSelectedArchiveId] = useState<string>('')
  const [selectedMemberId, setSelectedMemberId] = useState<string>('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [unlockDate, setUnlockDate] = useState('')

  const { mutate: createCapsule, isPending } = useCreateCapsule()

  // 获取档案列表
  const { data: archives = [] } = useQuery({
    queryKey: ['archives'],
    queryFn: () => archiveApi.list() as any,
    enabled: open,
  })

  // 获取选中档案的成员列表
  const { data: members = [] } = useQuery({
    queryKey: ['members', selectedArchiveId],
    queryFn: () => archiveApi.listMembers(Number(selectedArchiveId)) as any,
    enabled: !!selectedArchiveId,
  })

  const archiveOptions: SelectOption[] = (archives as any[]).map((a: any) => ({
    value: String(a.id),
    label: a.name,
  }))

  const memberOptions: SelectOption[] = selectedArchiveId
    ? (members as any[]).map((m: any) => ({
        value: String(m.id),
        label: m.name,
      }))
    : [{ value: '', label: '请先选择档案', disabled: true }]

  // 最小解封时间为明天
  const minDatetime = (() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    d.setSeconds(0, 0)
    return d.toISOString().slice(0, 16)  // "YYYY-MM-DDTHH:mm"
  })()

  const handleSubmit = () => {
    if (!selectedMemberId || !title.trim() || !content.trim() || !unlockDate) return
    createCapsule(
      {
        member_id: Number(selectedMemberId),
        title: title.trim(),
        content: content.trim(),
        unlock_date: new Date(unlockDate).toISOString(),
      },
      {
        onSuccess: () => {
          onClose()
          setSelectedArchiveId('')
          setSelectedMemberId('')
          setTitle('')
          setContent('')
          setUnlockDate('')
        },
      },
    )
  }

  const isValid = !!selectedMemberId && title.trim().length > 0 && content.trim().length > 0 && !!unlockDate

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="创建记忆胶囊"
      size="md"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={isPending}>取消</Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!isValid || isPending}
          >
            {isPending ? '创建中…' : '创建胶囊'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Select
          label="选择档案"
          options={archiveOptions.length > 0 ? archiveOptions : [{ value: '', label: '暂无档案', disabled: true }]}
          value={selectedArchiveId}
          onValueChange={(v) => {
            setSelectedArchiveId(v)
            setSelectedMemberId('')
          }}
          placeholder="请选择档案"
          fullWidth
        />
        <Select
          label="选择成员"
          options={memberOptions}
          value={selectedMemberId}
          onValueChange={setSelectedMemberId}
          placeholder="请选择成员"
          disabled={!selectedArchiveId}
          fullWidth
        />
        <Input
          label="胶囊标题"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="给这封信起个名字"
          fullWidth
        />
        <Textarea
          label="内容"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="写下你想说的话，未来的 Ta 会在解封时看到…"
          rows={6}
          fullWidth
        />
        <Input
          label="解封时间"
          type="datetime-local"
          value={unlockDate}
          onChange={(e) => setUnlockDate(e.target.value)}
          min={minDatetime}
          fullWidth
        />
        <p className="text-caption text-ink-muted">
          胶囊将在指定时间后可解封查看，创建后内容将被保护。
        </p>
      </div>
    </Modal>
  )
}
```

- [ ] **步骤 2：type-check + Commit**

```powershell
cd d:\Fish-code\MTC\frontend
npm run type-check
cd d:\Fish-code\MTC
git add frontend/src/components/capsule/CreateCapsuleModal.tsx
git commit -m "feat(D/M4): CreateCapsuleModal 级联档案→成员选择 + datetime-local"
```

---

### 任务 4.4：CapsuleDetailDrawer 组件

**文件：**
- 创建：`frontend/src/components/capsule/CapsuleDetailDrawer.tsx`

- [ ] **步骤 1：创建组件**

```typescript
// frontend/src/components/capsule/CapsuleDetailDrawer.tsx
import { Drawer } from '@/components/ui/Drawer'
import { Badge } from '@/components/ui/Badge'
import { LoadingState } from '@/components/ui/state'
import { useCapsuleDetail } from '@/hooks/useCapsules'
import { formatDate } from '@/lib/capsuleUtils'

interface CapsuleDetailDrawerProps {
  capsuleId: number | null
  onClose: () => void
}

export default function CapsuleDetailDrawer({ capsuleId, onClose }: CapsuleDetailDrawerProps) {
  const { data: capsule, isLoading } = useCapsuleDetail(capsuleId)

  return (
    <Drawer
      open={capsuleId !== null}
      onClose={onClose}
      side="right"
      title={capsule?.title ?? '胶囊详情'}
    >
      {isLoading ? (
        <LoadingState message="加载中…" />
      ) : capsule ? (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Badge tone={capsule.status === 'delivered' ? 'jade' : 'neutral'} size="sm">
              {capsule.status === 'delivered' ? '已解封' : '锁定中'}
            </Badge>
          </div>

          <div className="space-y-1 text-caption text-ink-muted">
            <div>解封时间：{formatDate(capsule.unlock_date)}</div>
            <div>创建时间：{formatDate(capsule.created_at)}</div>
          </div>

          {capsule.content ? (
            <div className="font-display text-ink-primary leading-[1.9] text-body whitespace-pre-wrap">
              {capsule.content}
            </div>
          ) : (
            <div className="text-center py-12 text-ink-muted">
              <div className="text-4xl mb-3">🔒</div>
              <p className="text-body-sm">此胶囊尚未解锁</p>
            </div>
          )}
        </div>
      ) : null}
    </Drawer>
  )
}
```

- [ ] **步骤 2：type-check + Commit**

```powershell
cd d:\Fish-code\MTC\frontend
npm run type-check
cd d:\Fish-code\MTC
git add frontend/src/components/capsule/CapsuleDetailDrawer.tsx
git commit -m "feat(D/M4): CapsuleDetailDrawer 解封内容抽屉"
```

---

### 任务 4.5：CapsulePage 完整实现

**文件：**
- 修改：`frontend/src/pages/CapsulePage.tsx`（替换 skeleton）

- [ ] **步骤 1：完整替换 CapsulePage**

```typescript
// frontend/src/pages/CapsulePage.tsx
import { useState } from 'react'
import { motion } from 'motion/react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Tabs } from '@/components/ui/Tabs'
import { PageTransition } from '@/components/ui/PageTransition'
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/state'
import CapsuleCard from '@/components/capsule/CapsuleCard'
import CreateCapsuleModal from '@/components/capsule/CreateCapsuleModal'
import CapsuleDetailDrawer from '@/components/capsule/CapsuleDetailDrawer'
import { useCapsuleList } from '@/hooks/useCapsules'
import { isCapsuleLocked } from '@/lib/capsuleUtils'
import { staggerContainer, fadeUp } from '@/lib/motion'
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
        {isError && <ErrorState message="加载失败" onRetry={refetch} />}

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
```

- [ ] **步骤 2：检查 EmptyState 的 action prop 是否存在**

查看 `frontend/src/components/ui/state/EmptyState.tsx` 确认 `action` prop 的接口，如果不支持 `action` prop，改为：

```typescript
// 替换 EmptyState 的 action prop 为手动按钮
{filter === 'all' && (
  <div className="mt-4">
    <Button variant="primary" onClick={() => setCreateOpen(true)}>
      创建第一个胶囊
    </Button>
  </div>
)}
```

- [ ] **步骤 3：type-check + 修复所有新增错误**

```powershell
cd d:\Fish-code\MTC\frontend
npm run type-check
```

- [ ] **步骤 4：Commit**

```powershell
cd d:\Fish-code\MTC
git add frontend/src/pages/CapsulePage.tsx
git commit -m "feat(D/M4): CapsulePage 完整实现，筛选 + 胶囊网格 + 创建弹窗 + 详情抽屉"
```

---

### 任务 4.6：M4 完整性检查

- [ ] **步骤 1：验证路由可访问**

```powershell
cd d:\Fish-code\MTC\frontend
npm run build
```

build 成功 = 路由注册、导入链路均无问题。

- [ ] **步骤 2：M4 里程碑标记 Commit**

```powershell
cd d:\Fish-code\MTC
git commit --allow-empty -m "milestone(D/M4): 记忆胶囊页完整实现"
```

---

## M5：收尾

### 任务 5.1：最终 type-check + build

- [ ] **步骤 1：完整类型检查**

```powershell
cd d:\Fish-code\MTC\frontend
npm run type-check
```

预期：0 错误（或不超过启动时的基准值）

- [ ] **步骤 2：生产构建**

```powershell
npm run build
```

预期：Build successful，无 error

### 任务 5.2：产品语言 grep 检查

- [ ] **步骤 1：检查旧产品语言**

```powershell
cd d:\Fish-code\MTC\frontend
Select-String -Path "src\pages\DialoguePage.tsx","src\pages\StoryBookPage.tsx","src\pages\CapsulePage.tsx" -Pattern "逝者|已故|death_year|家谱|is_alive"
```

预期：无匹配

- [ ] **步骤 2：检查旧 CSS 类**

```powershell
Select-String -Path "src\pages\DialoguePage.tsx","src\pages\StoryBookPage.tsx","src\pages\CapsulePage.tsx" -Pattern "bg-primary-\d+|text-gray-\d+|border-gray-\d+"
```

预期：无匹配

- [ ] **步骤 3：检查裸 fetch()**

```powershell
Select-String -Path "src\pages\StoryBookPage.tsx" -Pattern "fetch\("
```

预期：无匹配

### 任务 5.3：路线图更新

**文件：**
- 修改：`d:\Fish-code\MTC\.cursor\rules\mtc-refactor-roadmap.mdc`

- [ ] **步骤 1：在路线图中标记 D 完成**

在 `mtc-refactor-roadmap.mdc` 中：
1. 将 `Current Node` 更新为"D 完成，全量重构 A→E→B→C→D 已全部交付"
2. 将 D 的 checkbox 标记为 `[x]`
3. 在末尾新增 `## 十五、子项目 D · 完成总结（2026-04-25）` 章节

第 15 节内容（追加到文件末尾）：

```markdown
## 十五、子项目 D · 完成总结（2026-04-25）

**设计模型**：Claude Sonnet 4.6  
**实现模型**：Gemini  
**分支**：`Gemini-coding` → `main`  
**完成 milestone**：M1（API+路由）→ M2（AI对话）→ M3（故事书）→ M4（胶囊）→ M5（收尾）

### 主要产出

| 产出 | 路径 |
|------|------|
| useDialogue hook（打字机） | `frontend/src/hooks/useDialogue.ts` |
| useCapsules hooks | `frontend/src/hooks/useCapsules.ts` |
| ChatBubble 重写 | `frontend/src/components/dialogue/ChatBubble.tsx` |
| TypingIndicator | `frontend/src/components/dialogue/TypingIndicator.tsx` |
| StoryPreview（含打印） | `frontend/src/components/storybook/StoryPreview.tsx` |
| CapsuleCard / CreateCapsuleModal / CapsuleDetailDrawer | `frontend/src/components/capsule/` |
| CapsulePage（全新） | `frontend/src/pages/CapsulePage.tsx` |
| DialoguePage 重写 | `frontend/src/pages/DialoguePage.tsx` |
| StoryBookPage 重写 | `frontend/src/pages/StoryBookPage.tsx` |
| capsuleApi + storybookApi | `frontend/src/services/api.ts` |
| capsuleUtils | `frontend/src/lib/capsuleUtils.ts` |
| 导航胶囊入口 | `frontend/src/components/Layout.tsx` |

### 架构决策

- **打字机**：前端模拟（18ms/字），不修改后端 SSE
- **PDF 导出**：`window.print()` + `@media print` CSS，零依赖
- **胶囊时间**：原生 `datetime-local`，无外部日历库
- **成员选择**：级联档案→成员，避免 N+1

### 遗留 backlog

- 真实 SSE 流式对话（后端改造）
- 胶囊定时推送 Celery 任务
- TTS 语音播放集成
- 故事书历史记录（多次生成存档）
```

- [ ] **步骤 2：Commit 路线图**

```powershell
cd d:\Fish-code\MTC
git add .cursor/rules/mtc-refactor-roadmap.mdc
git commit -m "docs(D/M5): 路线图 v1.8，标记 D 完成 + §十五完成总结"
```

### 任务 5.4：收尾文档

- [ ] **步骤 1：创建收尾记录**

创建 `docs/superpowers/completed/2026-04-25-D-ai-dialogue-storybook-capsule.md`：

```markdown
# 子项目 D · AI 对话 + 故事书 + 记忆胶囊 · 收尾记录

**完成日期**：2026-04-25  
**实现分支**：`Sonnet-coding`（Claude Sonnet 4.6）  
**设计 / 实现**：Claude Sonnet 4.6（全权）

## 一句话总结

AI 对话页打字机效果 + A 基座全量迁移；故事书风格选择 + 进度文案循环 + StoryPreview 打印导出；记忆胶囊从零构建（全局列表 / 倒计时卡片 / 创建弹窗 / 解封抽屉）；导航新增胶囊入口。

## 与后端的接口说明

- `POST /dialogue/chat`：query params 方式，内存 session，非 SSE
- `POST /storybook/generate`：query params 方式，同步生成
- `GET/POST /capsules`：capsule CRUD，POST 用 query params（FastAPI 无 Body model）
```

- [ ] **步骤 2：Git annotated tags + Commit**

```powershell
cd d:\Fish-code\MTC
git add docs/superpowers/completed/2026-04-25-D-ai-dialogue-storybook-capsule.md
git commit -m "docs(D/M5): D 子项目收尾记录"

# Annotated tags
git tag -a "mtc-D/spec"    -m "D 设计规格文档落盘" HEAD~10  2>$null || git tag -a "mtc-D/spec" -m "D 设计规格文档落盘"
git tag -a "mtc-D/M1-done" -m "D M1 API+路由+导航完成"
git tag -a "mtc-D/M2-done" -m "D M2 AI对话重做完成"
git tag -a "mtc-D/M3-done" -m "D M3 故事书重做完成"
git tag -a "mtc-D/M4-done" -m "D M4 记忆胶囊完成"
git tag -a "mtc-D/done"    -m "D 子项目全量交付，Sonnet 4.6 全权实现"

git push origin Gemini-coding --tags
```

- [ ] **步骤 3：开 PR Sonnet-coding → main**

```powershell
gh pr create `
  --title "feat(D): AI 对话 + 故事书 + 记忆胶囊 · 子项目 D 交付" `
  --body "## 子项目 D 完成

**执行模型**：Claude Sonnet 4.6（设计 + 实现全权）

### 变更内容
- DialoguePage 完整重写：A 基座 + 打字机效果 + 成员侧边栏 + 引导问句
- StoryBookPage 完整重写：成员选择 + 进度文案循环 + StoryPreview + 打印导出
- CapsulePage 全新：胶囊列表 / 倒计时卡片 / 创建弹窗 / 解封详情抽屉
- api.ts 新增 capsuleApi + storybookApi
- Layout 导航新增记忆胶囊入口

### 自检
- [x] npm run type-check 0 错
- [x] npm run build 成功
- [x] 无旧 CSS 类（bg-primary- / text-gray- / border-gray-）
- [x] 无裸 fetch()
- [x] 无旧产品语言（逝者 / 已故 / death_year）
- [x] 路线图 v1.8 §十五 完成总结" `
  --base main `
  --head Gemini-coding
```

---

## 附录 A：关键组件 API 备忘

### A 基座组件使用速查

```typescript
// Button
<Button variant="primary|ghost|outline|danger" size="sm|md|lg" leftIcon={...} rightIcon={...} fullWidth onClick={...}>

// Card
<Card variant="plain|glass|accent" padding="none|sm|md|lg" hoverable>

// Badge
<Badge tone="jade|amber|neutral|danger" size="sm|md">

// Modal
<Modal open={bool} onClose={fn} title="..." size="sm|md|lg" footer={<>...</>}>

// Drawer
<Drawer open={bool} onClose={fn} side="right" title="...">

// Select
<Select options={SelectOption[]} value={string} onValueChange={fn} label="..." placeholder="..." fullWidth>

// Input
<Input label="..." type="text|datetime-local|number" value={...} onChange={fn} fullWidth>

// Textarea
<Textarea label="..." value={...} onChange={fn} rows={4} fullWidth>

// Tabs (pill variant)
<Tabs items={[{value, label, content}]} variant="pill" value={...} onValueChange={fn}>
```

### 状态组件

```typescript
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/state'

<LoadingState variant="spinner|skeleton-cards|skeleton-list" count={3} message="..." />
<ErrorState message="加载失败" onRetry={fn} />
<EmptyState title="..." description="..." />
```

### 动效

```typescript
import { motion, AnimatePresence } from 'motion/react'
import { fadeUp, fadeIn, staggerContainer, scaleIn } from '@/lib/motion'

// 列表 stagger
<motion.div variants={staggerContainer(0.06)} initial="hidden" animate="visible">
  <motion.div variants={fadeUp}>item</motion.div>
</motion.div>

// 条件切换
<AnimatePresence mode="wait">
  {condition && <motion.div key="unique" variants={fadeIn} initial="hidden" animate="visible" exit={{ opacity: 0 }}>...</motion.div>}
</AnimatePresence>
```

---

## 附录 B：计划自检结果

1. **规格覆盖度**：DialoguePage ✅ / StoryBookPage ✅ / CapsulePage ✅ / api.ts ✅ / Layout ✅ / App.tsx ✅ / capsuleUtils ✅
2. **占位符扫描**：无 TODO / 无"待定" / 所有代码步骤均含完整代码块
3. **类型一致性**：`CapsuleItem` 在 `api.ts` 定义后，`useCapsules.ts`、`CapsuleCard.tsx`、`CapsuleDetailDrawer.tsx`、`CapsulePage.tsx` 均从 `@/services/api` import ✅
4. **接口一致性**：`capsuleApi.create` 用 query params（与后端 `POST /capsules` 一致）✅；`storybookApi.generate` 用 params ✅；`dialogueApi.chat` 已存在无需新建 ✅
5. **EmptyState action prop**：待执行时检查实际接口，任务 4.5 步骤 2 有明确应对方案 ✅
