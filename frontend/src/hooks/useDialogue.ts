// frontend/src/hooks/useDialogue.ts
import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import { useQueryClient } from '@tanstack/react-query'
import { dialogueApi } from '@/services/api'
import { useApiError } from '@/hooks/useApiError'
import { buildClientLlmPayload } from '@/lib/buildClientLlmPayload'
import { readStoredLlmUserConfig } from '@/hooks/useLlmUserConfig'
import { dialogueStorageKey, stableDialogueSessionId } from '@/lib/dialogueStorage'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

/** 上一轮 LLM 遥测（展示用） */
export interface DialogueInferenceMeta {
  model: string
  latencyMs: number
  completionTokens: number | null
  promptTokens: number | null
  /** 来自 API usage.completion_tokens / 耗时的粗估 */
  tokensPerSec: number | null
  /** 输出字符 / 耗时，网关无 usage 时作参考 */
  charsPerSec: number | null
}

/** axios 拦截器已解包 data，此处断言供 TS 识别 */
type DialogueChatResult = {
  reply: string
  mnemo_mode?: boolean
  session_id?: string
  memories_created?: number
  model_used?: string | null
  prompt_tokens?: number | null
  completion_tokens?: number | null
  latency_ms?: number | null
  output_chars?: number | null
}

interface UseDialogueOptions {
  archiveId?: number
  memberId?: number
  /** 每轮对话结束后由 LLM 提炼记忆并写入链式图（更慢） */
  extractMemoriesAfter?: boolean
}

function parseStoredMessages(raw: string): ChatMessage[] {
  const arr = JSON.parse(raw) as Array<{
    id: string
    role: string
    content: string
    timestamp: string
  }>
  if (!Array.isArray(arr)) return []
  return arr
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant'))
    .map((m) => ({
      id: String(m.id),
      role: m.role as 'user' | 'assistant',
      content: String(m.content ?? ''),
      timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
    }))
}

export function useDialogue({
  archiveId,
  memberId,
  extractMemoriesAfter = false,
}: UseDialogueOptions = {}) {
  const queryClient = useQueryClient()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [displayedContent, setDisplayedContent] = useState('')
  /** 最近一轮是否走了后端 Mnemo（图记忆 + 扩散激活）；用于页面上「看得见的效果」 */
  const [graphMemoryActive, setGraphMemoryActive] = useState(false)
  const [lastInference, setLastInference] = useState<DialogueInferenceMeta | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const { show: showError } = useApiError()

  const persistContext = Boolean(
    archiveId && memberId && Number(archiveId) > 0 && Number(memberId) > 0,
  )
  const storageKey = useMemo(() => {
    if (!persistContext || archiveId === undefined || memberId === undefined) return null
    return dialogueStorageKey(archiveId, memberId)
  }, [archiveId, memberId, persistContext])

  const sessionId = useMemo(() => {
    if (!persistContext || archiveId === undefined || memberId === undefined) {
      return `session_${Date.now()}_${Math.random().toString(36).slice(2)}`
    }
    return stableDialogueSessionId(archiveId, memberId)
  }, [archiveId, memberId, persistContext])

  // 切换成员时按 key 重新加载
  useEffect(() => {
    if (!storageKey) {
      setMessages([])
      setHydrated(true)
      return
    }
    setHydrated(false)
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const loaded = parseStoredMessages(raw)
        setMessages(loaded.length > 0 ? loaded : [])
      } else {
        setMessages([])
      }
    } catch {
      setMessages([])
    } finally {
      setHydrated(true)
    }
  }, [storageKey])

  // 持久化（打字机未完成时不写，避免半截助手消息）
  useEffect(() => {
    if (!hydrated || !storageKey) return
    if (isTyping || isSending) return
    try {
      if (messages.length === 0) {
        localStorage.removeItem(storageKey)
        return
      }
      localStorage.setItem(
        storageKey,
        JSON.stringify(
          messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: m.timestamp.toISOString(),
          })),
        ),
      )
    } catch {
      // ignore quota
    }
  }, [messages, storageKey, hydrated, isTyping, isSending])

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

    const priorForApi = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }))

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
      const response = (await dialogueApi.chat({
        message: text,
        archive_id: archiveId,
        member_id: memberId,
        channel: 'app',
        session_id: sessionId,
        history_limit: 24,
        ...(priorForApi.length > 0 ? { client_history: priorForApi } : {}),
        ...(snapshot ? { client_llm: snapshot } : {}),
        ...(extractMemoriesAfter ? { extract_memories_after: true } : {}),
      })) as unknown as DialogueChatResult

      const replyText: string = response.reply || '...'
      setGraphMemoryActive(Boolean(response.mnemo_mode))

      const lat = Math.max(1, response.latency_ms ?? 0)
      const ct = response.completion_tokens
      const oc = response.output_chars ?? replyText.length
      const tokPs =
        typeof ct === 'number' && ct > 0 && lat > 0 ? ct / (lat / 1000) : null
      const chPs = lat > 0 ? oc / (lat / 1000) : null
      setLastInference({
        model:
          (response.model_used && String(response.model_used)) ||
          snapshot?.model ||
          '服务端默认',
        latencyMs: lat,
        completionTokens: typeof ct === 'number' ? ct : null,
        promptTokens:
          typeof response.prompt_tokens === 'number' ? response.prompt_tokens : null,
        tokensPerSec: tokPs,
        charsPerSec: chPs,
      })

      if (response.memories_created && response.memories_created > 0) {
        toast.success(`已提炼 ${response.memories_created} 条记忆并入关系网`)
        void queryClient.invalidateQueries({ queryKey: ['memories', 'member'] })
        void queryClient.invalidateQueries({ queryKey: ['mnemo-graph'] })
      }
      setIsSending(false)

      const assistantMsgId = `assistant_${Date.now()}`
      setMessages((prev) => [
        ...prev,
        { id: assistantMsgId, role: 'assistant', content: '', timestamp: new Date() },
      ])

      startTypewriter(replyText, () => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId ? { ...m, content: replyText } : m,
          ),
        )
        setDisplayedContent('')
      })
    } catch (err) {
      setIsSending(false)
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id))
      showError(err, '发送失败，请重试')
    }
  }, [
    inputValue,
    isSending,
    isTyping,
    messages,
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
    setLastInference(null)
    if (intervalRef.current) clearInterval(intervalRef.current)
    setIsTyping(false)
    if (storageKey) {
      try {
        localStorage.removeItem(storageKey)
      } catch {
        // ignore
      }
    }
    try {
      await dialogueApi.clearHistory(sessionId)
    } catch {
      // 忽略清除历史失败
    }
  }, [sessionId, storageKey])

  /** 模型设置里当前选用的模型名（用于尚未收到本轮响应时的展示） */
  const configuredModelLabel = useMemo(() => {
    const p = buildClientLlmPayload(readStoredLlmUserConfig())
    return p?.model ?? null
  }, [])

  return {
    messages,
    inputValue,
    setInputValue,
    isSending,
    isTyping,
    displayedContent,
    graphMemoryActive,
    lastInference,
    configuredModelLabel,
    send,
    clear,
    sessionId,
  }
}
