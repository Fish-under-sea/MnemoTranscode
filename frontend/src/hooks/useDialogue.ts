// frontend/src/hooks/useDialogue.ts
import { useState, useRef, useCallback, useEffect } from 'react'
import toast from 'react-hot-toast'
import { useQueryClient } from '@tanstack/react-query'
import { dialogueApi } from '@/services/api'
import { useApiError } from '@/hooks/useApiError'
import { buildClientLlmPayload } from '@/lib/buildClientLlmPayload'
import { readStoredLlmUserConfig } from '@/hooks/useLlmUserConfig'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface UseDialogueOptions {
  archiveId?: number
  memberId?: number
  /** 每轮对话结束后由 LLM 提炼记忆并写入链式图（更慢） */
  extractMemoriesAfter?: boolean
}

export function useDialogue({
  archiveId,
  memberId,
  extractMemoriesAfter = false,
}: UseDialogueOptions = {}) {
  const queryClient = useQueryClient()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [displayedContent, setDisplayedContent] = useState('')
  /** 最近一轮是否走了后端 Mnemo（图记忆 + 扩散激活）；用于页面上「看得见的效果」 */
  const [graphMemoryActive, setGraphMemoryActive] = useState(false)
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
      const snapshot = buildClientLlmPayload(readStoredLlmUserConfig())
      const response = await dialogueApi.chat({
        message: text,
        archive_id: archiveId,
        member_id: memberId,
        channel: 'app',
        session_id: sessionId,
        history_limit: 10,
        ...(snapshot ? { client_llm: snapshot } : {}),
        ...(extractMemoriesAfter ? { extract_memories_after: true } : {}),
      }) as any

      const replyText: string = response.reply || '...'
      setGraphMemoryActive(Boolean(response.mnemo_mode))
      if (response.memories_created && response.memories_created > 0) {
        toast.success(`已提炼 ${response.memories_created} 条记忆并入关系网`)
        void queryClient.invalidateQueries({ queryKey: ['memories', 'member'] })
        void queryClient.invalidateQueries({ queryKey: ['mnemo-graph'] })
      }
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
  }, [
    inputValue,
    isSending,
    isTyping,
    archiveId,
    memberId,
    sessionId,
    startTypewriter,
    showError,
    extractMemoriesAfter,
    queryClient,
  ])

  const clear = useCallback(async () => {
    setMessages([])
    setDisplayedContent('')
    setGraphMemoryActive(false)
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
    graphMemoryActive,
    send,
    clear,
    sessionId,
  }
}
