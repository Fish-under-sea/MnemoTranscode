// frontend/src/pages/DialoguePage.tsx
import { useRef, useEffect, KeyboardEvent, useState, type CSSProperties } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'motion/react'
import { Trash2, Send, ChevronRight, BookmarkPlus } from 'lucide-react'
import { archiveApi, memoryApi } from '@/services/api'
import { Button } from '@/components/ui/Button'
import PageTransition from '@/components/ui/PageTransition'
import MemberStatusBadge from '@/components/member/MemberStatusBadge'
import { LoadingState } from '@/components/ui/state'
import ChatBubble from '@/components/dialogue/ChatBubble'
import { useDialogue } from '@/hooks/useDialogue'
import { fadeUp, staggerContainer } from '@/lib/motion'
import { cn } from '@/lib/utils'
import Avatar from '@/components/ui/Avatar'
import toast from 'react-hot-toast'
import { useApiError } from '@/hooks/useApiError'
import { useAuthStore } from '@/hooks/useAuthStore'
import { rememberDialogueRoute } from '@/lib/dialogueStorage'

const STARTER_PROMPTS = [
  '你最难忘的一件事是什么？',
  '你年轻时有什么梦想？',
  '你想对我说什么？',
]

/**
 * 输入区辅助文案：仅「上半行」相对「下半行（复选框+说明）」的水平微调。
 * 单位 px；数值越大，上半行整体越往左移（translateX 负向），用于与下行视觉右缘对齐。
 * 仅影响位移，不改 `text-caption` / 颜色等样式类。
 *
 * ←—— 在此处改数字微调 ——→
 */
const DIALOGUE_INPUT_META_SHORTCUT_NUDGE_LEFT_PX = 8.25

/**
 * 输入条圆角白底容器：右侧内边距（Tailwind padding class）。
 * 原 `px-3` 左右对称时，「发送」会比下方 `self-end` 的辅助文案更靠左一截；略减右侧即可与整栏右缘视觉统一。
 * 微调示例：`pr-2` → `pr-1.5` / `pr-1` / `pr-0`（更贴边）。
 */
const DIALOGUE_INPUT_COMPOSER_INNER_PR = 'pr-2'

export default function DialoguePage() {
  const { archiveId, memberId } = useParams<{ archiveId?: string; memberId?: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { show: showError } = useApiError()
  const { user: authUser } = useAuthStore()
  const archiveParsed = archiveId ? Number(archiveId) : NaN
  const memberParsed = memberId ? Number(memberId) : NaN
  const hasChatContext =
    Number.isFinite(archiveParsed) &&
    archiveParsed > 0 &&
    Number.isFinite(memberParsed) &&
    memberParsed > 0
  const archiveIdNum = hasChatContext ? archiveParsed : undefined
  const memberIdNum = hasChatContext ? memberParsed : undefined

  const [extractMemoriesAfter, setExtractMemoriesAfter] = useState(false)

  const needsMemberPicker = !hasChatContext

  const { data: archivesForPicker = [], isLoading: loadingArchives } = useQuery({
    queryKey: ['archives', 'dialogue-picker'],
    queryFn: () => archiveApi.list() as any,
    enabled: needsMemberPicker,
  })

  const memberQueries = useQueries({
    queries: (archivesForPicker as { id: number; name?: string }[]).map((a) => ({
      queryKey: ['members', a.id, 'dialogue-picker'],
      queryFn: () => archiveApi.listMembers(Number(a.id)) as any,
      enabled: needsMemberPicker && archivesForPicker.length > 0,
    })),
  })

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
    graphMemoryActive,
    send,
    clear,
    lastInference,
    configuredModelLabel,
    dialogueHydrated,
  } = useDialogue({
    archiveId: archiveIdNum,
    memberId: memberIdNum,
    extractMemoriesAfter,
  })

  const extractMutation = useMutation({
    mutationFn: () => {
      const lines = messages
        .filter((m) => m.content.trim().length > 0)
        .slice(-60)
        .map((m) => ({ role: m.role, content: m.content }))
      return memoryApi.extractFromConversation({
        member_id: memberIdNum!,
        messages: lines,
        build_graph: true,
      })
    },
    onSuccess: (data) => {
      toast.success(
        `已写入 ${data.created_count} 条记忆（时间链 ${data.graph_temporal_edges}，关联边 ${data.graph_llm_edges}）`,
      )
      void queryClient.invalidateQueries({ queryKey: ['memories'] })
      void queryClient.invalidateQueries({ queryKey: ['mnemo-graph'] })
    },
    onError: (e) => showError(e),
  })

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, displayedContent])

  useEffect(() => {
    if (!hasChatContext || !archiveIdNum || !memberIdNum) return
    rememberDialogueRoute(`/dialogue/${archiveIdNum}/${memberIdNum}`)
  }, [hasChatContext, archiveIdNum, memberIdNum])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const memberName = (member as any)?.name || (archive as any)?.name || 'AI 助手'
  const memberAvatarUrl = (member as { avatar_url?: string | null } | undefined)?.avatar_url ?? undefined
  const userAvatarUrl = authUser?.avatar_url?.trim() || undefined
  const userBubbleName = authUser?.username?.trim() || authUser?.email?.trim() || '我'

  /** 侧边栏（及移动端）：从档案加载的可选对话成员 */
  const pickerBody = (
    <div className="space-y-4">
      {loadingArchives ? (
        <div className="py-6">
          <LoadingState message="正在加载档案与成员…" />
        </div>
      ) : archivesForPicker.length === 0 ? (
        <div className="text-caption text-ink-muted space-y-2">
          <p>暂无档案。</p>
          <Link to="/archives" className="text-brand hover:underline font-medium">
            前往档案库创建档案并添加成员 →
          </Link>
        </div>
      ) : (
        (archivesForPicker as { id: number; name?: string }[]).map((a, idx) => {
          const mq = memberQueries[idx]
          const members = (mq?.data ?? []) as { id: number; name?: string; avatar_url?: string | null }[]
          const loadingMembers = mq?.isLoading ?? true
          return (
            <div key={a.id} className="space-y-1.5">
              <div className="text-caption font-semibold text-ink-secondary truncate">{a.name ?? `档案 ${a.id}`}</div>
              {loadingMembers ? (
                <div className="text-caption text-ink-muted py-2">载入成员…</div>
              ) : members.length === 0 ? (
                <div className="text-caption text-ink-muted py-1 pl-1">
                  暂无成员，{' '}
                  <Link to={`/archives/${a.id}`} className="text-brand hover:underline">
                    去档案里添加
                  </Link>
                </div>
              ) : (
                <ul className="space-y-1">
                  {members.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => void navigate(`/dialogue/${a.id}/${m.id}`)}
                        className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-body-sm text-ink-primary hover:bg-jade-50 hover:text-jade-800 border border-transparent hover:border-jade-200 transition-colors"
                      >
                        <Avatar
                          src={m.avatar_url ?? undefined}
                          name={m.name ?? `成员 ${m.id}`}
                          size={28}
                          className="shrink-0 ring-1 ring-border-default"
                        />
                        <span className="truncate">{m.name ?? `成员 ${m.id}`}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })
      )}
    </div>
  )

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

          <div className="p-4 flex-1 overflow-y-auto min-h-0">
            {needsMemberPicker ? (
              <>
                <p className="text-caption text-ink-muted mb-3">
                  从档案库中选择一位成员开启对话：
                </p>
                {pickerBody}
              </>
            ) : !member ? (
              <LoadingState variant="skeleton-list" count={3} />
            ) : (
              <div className="space-y-4">
                {/* 成员信息 */}
                <div className="space-y-2">
                  <Avatar
                    src={memberAvatarUrl}
                    name={memberName}
                    size={48}
                    className="ring-2 ring-border-default"
                  />
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
          {needsMemberPicker && (
            <div className="md:hidden shrink-0 max-h-[38vh] overflow-y-auto border-b border-border-default bg-subtle p-4">
              <p className="text-caption text-ink-muted mb-3">选择要对话的成员</p>
              {pickerBody}
            </div>
          )}
          {/* Header：标题与操作，模型信息在输入区下方展示 */}
          <div className="shrink-0 border-b border-border-default bg-surface/80 backdrop-blur-sm px-4 py-3 space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h1 className="text-body font-semibold text-ink-primary">
                  与 {memberName} 对话
                </h1>
                {(member as any)?.relationship_type && (
                  <p className="text-caption text-ink-muted">{(member as any).relationship_type}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-end sm:justify-end">
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<BookmarkPlus size={14} />}
                  loading={extractMutation.isPending}
                  disabled={
                    !hasChatContext || !messages.some((m) => m.content.trim().length > 0)
                  }
                  onClick={() => extractMutation.mutate()}
                  title="将当前对话窗口中的内容提炼为记忆并入关系网"
                >
                  写入记忆
                </Button>
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
            </div>
          </div>

          {hasChatContext && graphMemoryActive && (
            <div
              className="px-4 py-2.5 bg-jade-50/95 border-b border-jade-100/80 text-caption text-jade-900 flex items-center gap-2 shrink-0"
              role="status"
            >
              <span
                className="inline-flex h-2 w-2 rounded-full bg-jade-500 shrink-0"
                aria-hidden
              />
              <span>
                图记忆已参与本轮对话：扩散激活 + 意识流上下文已由后端注入（MnemoTranscode）
              </span>
            </div>
          )}

          {/* 消息列表：hydrate 完成前不渲染空态，避免误判无历史 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {hasChatContext && !dialogueHydrated ? (
              <div className="h-full min-h-[280px] flex items-center justify-center">
                <LoadingState message="载入对话记录…" />
              </div>
            ) : (
              <>
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
                    {hasChatContext
                      ? `和 ${memberName} 开始对话吧，Ta 记得你们的故事`
                      : '先选择对话成员'}
                  </p>
                  {hasChatContext && (
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
                          assistantAvatarSrc={
                            msg.role === 'assistant' ? memberAvatarUrl : undefined
                          }
                          userAvatarSrc={userAvatarUrl}
                          userName={userBubbleName}
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
              </>
            )}
          </div>

          {/* 输入区：与消息列表同为 px-4，避免横向「出格」 */}
          <div className="flex-shrink-0 border-t border-border-default bg-surface px-4 pb-4 pt-3">
            <div
              className={cn(
                'flex gap-2 items-center rounded-xl border border-border-default bg-canvas pl-3 py-1.5 shadow-e1',
                DIALOGUE_INPUT_COMPOSER_INNER_PR,
                (!hasChatContext || isSending || isTyping) && 'opacity-60',
              )}
            >
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  hasChatContext ? `对 ${memberName} 说些什么…` : '请先在上方或左侧列表中选择成员'
                }
                rows={1}
                disabled={!hasChatContext || isSending || isTyping}
                className={cn(
                  'flex-1 min-w-0 min-h-9 max-h-32 resize-none outline-none text-body-sm',
                  'text-ink-primary placeholder:text-ink-muted',
                  // 对称内边距 + 略收紧行高，单行时文字相对框体更居中；多行仍由上往下排
                  'px-1.5 py-1.5 leading-snug bg-transparent border-0',
                )}
                style={{ fieldSizing: 'content' } as CSSProperties}
              />
              <Button
                variant="primary"
                size="sm"
                className="shrink-0 h-9 px-4"
                rightIcon={<Send size={14} />}
                onClick={send}
                disabled={
                  !hasChatContext || !inputValue.trim() || isSending || isTyping
                }
              >
                发送
              </Button>
            </div>

            {/* 与消息区同宽；左状态 / 右辅助，贴齐主内容左右沿 */}
            {hasChatContext ? (
              <div className="mt-3 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
                <div
                  className="min-w-0 rounded-xl border border-border-default bg-subtle/70 dark:bg-subtle/60 px-3.5 py-2.5 shadow-e1 sm:max-w-xl"
                  aria-live="polite"
                >
                  <p className="text-body-sm leading-snug">
                    <span className="text-ink-secondary font-medium">当前模型</span>{' '}
                    <span
                      className="font-medium text-ink-primary truncate align-bottom max-sm:max-w-[11rem] max-sm:inline-block max-sm:truncate"
                      title={lastInference?.model ?? configuredModelLabel ?? ''}
                    >
                      {lastInference?.model ?? configuredModelLabel ?? '服务端默认'}
                    </span>
                  </p>
                  {lastInference ? (
                    <p className="text-caption text-ink-muted mt-1.5 leading-relaxed">
                      {lastInference.tokensPerSec != null ? (
                        <>本轮推演约 {lastInference.tokensPerSec.toFixed(1)} token/s</>
                      ) : (
                        <>本轮推演约 {lastInference.charsPerSec?.toFixed(0) ?? '—'} 字/s</>
                      )}
                      <span className="text-ink-muted/90"> · {lastInference.latencyMs} ms</span>
                      {lastInference.completionTokens != null ? (
                        <span className="text-ink-muted/90"> · 输出 {lastInference.completionTokens} tok</span>
                      ) : null}
                    </p>
                  ) : (
                    <p className="text-caption text-ink-muted mt-1.5 leading-relaxed">
                      发送一条消息后，将显示本轮实际调用模型与速度
                    </p>
                  )}
                </div>

                {/* items-end：子项不要 stretch，否则 label 被拉满行而内部仍左排，「换行」会较「）」更靠右；收窄为内容宽后两行右缘同一垂线 */}
                <div className="flex w-fit max-w-full min-w-0 shrink-0 flex-col items-end gap-2 self-end sm:self-auto">
                  <p
                    className="text-caption text-ink-muted leading-snug whitespace-nowrap"
                    style={
                      {
                        transform: `translateX(-${DIALOGUE_INPUT_META_SHORTCUT_NUDGE_LEFT_PX}px)`,
                      } satisfies CSSProperties
                    }
                  >
                    Enter 发送 · Shift + Enter 换行
                  </p>
                  <label className="inline-flex max-w-full min-w-0 flex-nowrap items-center gap-2.5 cursor-pointer select-none overflow-x-auto overscroll-x-contain">
                    <input
                      type="checkbox"
                      checked={extractMemoriesAfter}
                      onChange={(e) => setExtractMemoriesAfter(e.target.checked)}
                      className="size-4 shrink-0 rounded border-border-default text-jade-600 focus:ring-jade-500"
                    />
                    <span className="text-caption text-ink-secondary whitespace-nowrap">
                      发送后提炼记忆并入关系网（需可用的 LLM，略慢）
                    </span>
                  </label>
                </div>
              </div>
            ) : (
              <p className="text-caption text-ink-muted mt-3 text-right">Enter 发送 · Shift + Enter 换行</p>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  )
}
