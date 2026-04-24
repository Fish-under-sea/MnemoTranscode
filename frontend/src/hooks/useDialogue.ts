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
