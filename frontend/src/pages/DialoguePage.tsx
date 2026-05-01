// frontend/src/pages/DialoguePage.tsx
import { useRef, useEffect, KeyboardEvent } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueries } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'motion/react'
import { Trash2, Send, ChevronRight, MessageCircle } from 'lucide-react'
import { archiveApi } from '@/services/api'
import { Button } from '@/components/ui/Button'
import PageTransition from '@/components/ui/PageTransition'
import MemberStatusBadge from '@/components/member/MemberStatusBadge'
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
  const navigate = useNavigate()
  const archiveParsed = archiveId ? Number(archiveId) : NaN
  const memberParsed = memberId ? Number(memberId) : NaN
  const hasChatContext =
    Number.isFinite(archiveParsed) &&
    archiveParsed > 0 &&
    Number.isFinite(memberParsed) &&
    memberParsed > 0
  const archiveIdNum = hasChatContext ? archiveParsed : undefined
  const memberIdNum = hasChatContext ? memberParsed : undefined

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
          const members = (mq?.data ?? []) as { id: number; name?: string }[]
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
                        <MessageCircle size={16} className="text-jade-600 shrink-0" />
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
          {needsMemberPicker && (
            <div className="md:hidden shrink-0 max-h-[38vh] overflow-y-auto border-b border-border-default bg-subtle p-4">
              <p className="text-caption text-ink-muted mb-3">选择要对话的成员</p>
              {pickerBody}
            </div>
          )}
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
                placeholder={
                  hasChatContext ? `对 ${memberName} 说些什么…` : '请先在上方或左侧列表中选择成员'
                }
                rows={1}
                disabled={!hasChatContext || isSending || isTyping}
                className={cn(
                  'flex-1 resize-none outline-none text-body-sm bg-transparent',
                  'text-ink-primary placeholder:text-ink-muted',
                  'max-h-32 leading-relaxed',
                  (!hasChatContext || isSending || isTyping) && 'opacity-50',
                )}
                style={{ fieldSizing: 'content' } as React.CSSProperties}
              />
              <Button
                variant="primary"
                size="sm"
                rightIcon={<Send size={14} />}
                onClick={send}
                disabled={
                  !hasChatContext || !inputValue.trim() || isSending || isTyping
                }
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
