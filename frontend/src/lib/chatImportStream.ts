import type { PendingChatImportPayload } from '@/lib/chatImportSession'
import { buildClientLlmPayload } from '@/lib/buildClientLlmPayload'
import { readStoredLlmUserConfig } from '@/hooks/useLlmUserConfig'

export type ChatImportStreamEvent =
  | { type: 'stage'; id?: string; message?: string }
  | { type: 'parse_done'; segments?: number }
  | { type: 'llm_batch'; index?: number; total?: number; message?: string }
  | { type: 'batch_done'; batch_index?: number; memories_in_batch?: number }
  | { type: 'persist_progress'; saved?: number; total?: number }
  | { type: 'note'; message?: string }
  | {
      type: 'done'
      result?: {
        created_count: number
        graph_temporal_edges: number
        graph_llm_edges: number
        vectors_deferred?: boolean
      }
    }
  | { type: 'error'; message?: string }

function parseSseChunk(buffer: string): { events: ChatImportStreamEvent[]; rest: string } {
  const events: ChatImportStreamEvent[] = []
  const parts = buffer.split('\n\n')
  const rest = parts.pop() ?? ''
  for (const block of parts) {
    const line = block
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.startsWith('data:'))
    if (!line) continue
    const json = line.slice(5).trim()
    try {
      events.push(JSON.parse(json) as ChatImportStreamEvent)
    } catch {
      /* ignore malformed */
    }
  }
  return { events, rest }
}

/**
 * POST /memories/import-chat/stream（与 /chat-import/stream 等价），消费 SSE（data: JSON）
 */
export async function runChatImportStream(
  payload: PendingChatImportPayload,
  onEvent: (ev: ChatImportStreamEvent) => void,
  signal?: AbortSignal,
): Promise<ChatImportStreamEvent & { type: 'done' }> {
  const token = localStorage.getItem('mtc-token')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  }
  if (token) headers.Authorization = `Bearer ${token}`

  // 发起请求时重新读取「模型设置」：避免 job 快照早于用户保存密钥，或未写入 client_llm 时仅能走服务端空密钥
  const clientLlm =
    payload.ai_refine !== false
      ? buildClientLlmPayload(readStoredLlmUserConfig()) ?? payload.client_llm
      : undefined

  const body = JSON.stringify({
    member_id: payload.member_id,
    raw_text: payload.raw_text,
    source: payload.source,
    build_graph: payload.build_graph,
    ai_refine: payload.ai_refine,
    ...(clientLlm ? { client_llm: clientLlm } : {}),
  })

  const paths = ['/api/v1/memories/import-chat/stream', '/api/v1/memories/chat-import/stream'] as const
  let res: Response | undefined
  let lastStatus = 0
  for (const path of paths) {
    res = await fetch(path, { method: 'POST', headers, body, signal })
    if (res.ok) break
    lastStatus = res.status
    if (res.status === 404) continue
    // 非 404：消费错误体后抛出
    let msg = `HTTP ${res.status}`
    try {
      const errBody = (await res.json()) as { message?: string }
      if (errBody?.message) msg = errBody.message
    } catch {
      try {
        const t = await res.text()
        if (t) msg = t.slice(0, 200)
      } catch {
        /* noop */
      }
    }
    throw new Error(msg)
  }

  if (!res?.ok) {
    throw new Error(
      lastStatus === 404
        ? '流式导入接口返回 404（可能后端尚未更新）。请重建并启动 backend 容器，例如：docker compose build backend && docker compose up -d backend'
        : `HTTP ${lastStatus}`,
    )
  }

  const reader = res.body?.getReader()
  if (!reader) throw new Error('无法读取响应流')

  const decoder = new TextDecoder()
  let carry = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    carry += decoder.decode(value, { stream: true })
    const parsed = parseSseChunk(carry)
    carry = parsed.rest
    for (const ev of parsed.events) {
      onEvent(ev)
      if (ev.type === 'error') {
        throw new Error(ev.message || '导入失败')
      }
      if (ev.type === 'done') {
        return ev as ChatImportStreamEvent & { type: 'done' }
      }
    }
  }

  if (carry.trim()) {
    const parsed = parseSseChunk(carry + '\n\n')
    for (const ev of parsed.events) {
      onEvent(ev)
      if (ev.type === 'done') return ev as ChatImportStreamEvent & { type: 'done' }
    }
  }

  throw new Error('流结束但未收到完成事件')
}
