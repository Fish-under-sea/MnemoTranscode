// frontend/src/hooks/useDialogue.ts
import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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

/** 不写回「尚未打出字的助手占位气泡」，其余均落盘（含发送中助手前的用户消息），避免误判空列表擦掉 localStorage */
function messagesForPersist(list: ChatMessage[]): ChatMessage[] {
  let out = [...list]
  while (out.length > 0) {
    const last = out[out.length - 1]
    if (last.role === 'assistant' && !String(last.content ?? '').trim()) {
      out = out.slice(0, -1)
      continue
    }
    break
  }
  return out
}

function mapServerRowToMessage(m: {
  id: number
  role: string
  content: string
  created_at?: string | null
}): ChatMessage {
  const role = m.role === 'assistant' ? 'assistant' : 'user'
  return {
    id: `dlg_${m.id}`,
    role,
    content: String(m.content ?? ''),
    timestamp: m.created_at ? new Date(m.created_at) : new Date(),
  }
}

/** 兼容拦截器 unwrap 后与偶发双层 data 包裹 */
function normalizeListMessagesPayload(data: unknown): {
  messages: Array<{
    id: number
    role: string
    content: string
    created_at?: string | null
  }>
} {
  if (!data || typeof data !== 'object') return { messages: [] }
  const top = data as Record<string, unknown>
  let rows = top.messages
  if (!Array.isArray(rows)) {
    const inner = top.data
    if (inner && typeof inner === 'object' && Array.isArray((inner as Record<string, unknown>).messages)) {
      rows = (inner as Record<string, unknown>).messages
    }
  }
  return { messages: Array.isArray(rows) ? (rows as never) : [] }
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

  /** 打断打字机动效，避免 listMessages 再次补水时 isTyping 悬挂导致「只显示半截 + 光标」 */
  const stopTypewriter = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setIsTyping(false)
    setDisplayedContent('')
  }, [])

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

  const remoteCtxKey =
    persistContext && archiveId != null && memberId != null
      ? `${archiveId}:${memberId}`
      : ''

  /** 已对当前成员尝试过 bootstrap（避免服务端仍空时的循环请求） */
  const bootstrapAttemptedRef = useRef('')

  useEffect(() => {
    bootstrapAttemptedRef.current = ''
    if (!persistContext) return
    stopTypewriter()
    setHydrated(false)
    setMessages([])
  }, [persistContext, remoteCtxKey, stopTypewriter])

  const messagesQuery = useQuery({
    queryKey: ['dialogue-messages', archiveId, memberId],
    queryFn: async ({ signal }) => {
      const raw = await dialogueApi.listMessages(Number(archiveId), Number(memberId), { signal })
      return normalizeListMessagesPayload(raw)
    },
    enabled: persistContext,
    staleTime: 60_000,
    retry: 1,
    /** 切换回标签页时拉服务端最新（多端/清空后另一端可见） */
    refetchOnWindowFocus: true,
  })

  /** 无前缀会话：仅从 localStorage 补水 / 持久化 */
  useEffect(() => {
    if (persistContext) return
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
  }, [persistContext, storageKey])

  // 账号级：从服务端列表补水；库空则尝试一次 bootstrap（localStorage 迁移）
  useEffect(() => {
    if (!persistContext || archiveId === undefined || memberId === undefined) {
      return
    }

    if (messagesQuery.isError) {
      let fallback: ChatMessage[] = []
      if (storageKey) {
        try {
          const raw = localStorage.getItem(storageKey)
          if (raw) fallback = parseStoredMessages(raw)
        } catch {
          fallback = []
        }
      }
      stopTypewriter()
      setMessages(fallback)
      setHydrated(true)
      return
    }

    if (!messagesQuery.isFetched) return

    let cancelled = false
    const run = async () => {
      const rows = messagesQuery.data?.messages ?? []
      if (rows.length > 0) {
        if (cancelled) return
        stopTypewriter()
        setMessages(rows.map(mapServerRowToMessage))
        setHydrated(true)
        if (storageKey) {
          try {
            localStorage.removeItem(storageKey)
          } catch {
            // ignore quota
          }
        }
        return
      }

      let lsPersisted: ChatMessage[] = []
      if (storageKey) {
        try {
          const raw = localStorage.getItem(storageKey)
          if (raw) lsPersisted = messagesForPersist(parseStoredMessages(raw))
        } catch {
          lsPersisted = []
        }
      }

      if (lsPersisted.length === 0) {
        // bootstrap 后 invalidate 会触发 refetch；在结果回来前勿把「缓存仍为空」当成无历史，否则先结束加载再闪空列表
        if (
          messagesQuery.isFetching &&
          bootstrapAttemptedRef.current === remoteCtxKey
        ) {
          return
        }
        if (!cancelled) {
          stopTypewriter()
          setMessages([])
          setHydrated(true)
        }
        return
      }

      if (bootstrapAttemptedRef.current !== remoteCtxKey) {
        bootstrapAttemptedRef.current = remoteCtxKey

        try {
          await dialogueApi.bootstrapMessages({
            archive_id: archiveId,
            member_id: memberId,
            messages: lsPersisted.map((m) => ({ role: m.role, content: m.content })),
          })
          // 必须执行：StrictMode / 路由切换若在 await 后把本 effect cleanup，旧逻辑会跳过 invalidate，
          // 缓存仍为空且 bootstrapAttempted 已标记 → 永远不拉库中已写入的记录。
          await queryClient.invalidateQueries({ queryKey: ['dialogue-messages', archiveId, memberId] })
        } catch {
          bootstrapAttemptedRef.current = ''
          if (!cancelled) {
            stopTypewriter()
            setMessages(lsPersisted)
            setHydrated(true)
          }
        }
        if (cancelled) return
        return
      }

      if (!cancelled) {
        stopTypewriter()
        setMessages(lsPersisted)
        setHydrated(true)
        try {
          if (storageKey) localStorage.removeItem(storageKey)
        } catch {
          // ignore
        }
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [
    persistContext,
    archiveId,
    memberId,
    storageKey,
    remoteCtxKey,
    messagesQuery.isError,
    messagesQuery.isFetched,
    messagesQuery.isFetching,
    messagesQuery.dataUpdatedAt,
    messagesQuery.data,
    queryClient,
    stopTypewriter,
  ])

  // 无前缀会话：仅存 localStorage
  useEffect(() => {
    if (persistContext) return
    if (!hydrated || !storageKey) return
    if (isTyping) return
    try {
      const list = messagesForPersist(messages)
      localStorage.setItem(
        storageKey,
        JSON.stringify(
          list.map((m) => ({
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
  }, [persistContext, messages, storageKey, hydrated, isTyping])

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [])

  const startTypewriter = useCallback((fullContent: string, onDone: () => void) => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setIsTyping(true)
    setDisplayedContent('')
    const codeUnits = fullContent.length
    let i = 0
    intervalRef.current = setInterval(() => {
      i += 1
      setDisplayedContent(fullContent.slice(0, i))
      if (i >= codeUnits) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
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
        ...(!persistContext && priorForApi.length > 0 ? { client_history: priorForApi } : {}),
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
      void queryClient.invalidateQueries({ queryKey: ['dashboard', 'usage'] })
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
    persistContext,
  ])

  const clear = useCallback(async () => {
    setMessages([])
    setGraphMemoryActive(false)
    setLastInference(null)
    stopTypewriter()
    if (storageKey) {
      try {
        localStorage.removeItem(storageKey)
      } catch {
        // ignore
      }
    }
    try {
      if (persistContext && archiveId != null && memberId != null) {
        await dialogueApi.clearHistoryForMember(archiveId, memberId)
        queryClient.setQueryData(['dialogue-messages', archiveId, memberId], { messages: [] })
        void queryClient.invalidateQueries({ queryKey: ['dialogue-messages', archiveId, memberId] })
      } else if (sessionId) {
        await dialogueApi.clearHistoryLegacy(sessionId)
      }
    } catch {
      // 忽略清除历史失败
    }
  }, [sessionId, storageKey, persistContext, archiveId, memberId, queryClient, stopTypewriter])

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
    /** 未完成从 localStorage 补水前勿渲染空白列表（避免误判「无会话」） */
    dialogueHydrated: hydrated,
  }
}
