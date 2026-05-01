/**
 * 跨路由传递聊天记录导入参数：localStorage + URL ?job=uuid（同页 navigate 与刷新均可读）。
 */
import type { ClientLlmPayload } from '@/lib/buildClientLlmPayload'

export const CHAT_IMPORT_JOB_QUERY = 'job'

const LS_JOB_PREFIX = 'mtc-chat-import-job:'

export type PendingChatImportPayload = {
  member_id: number
  archive_id: number
  raw_text: string
  source: 'auto' | 'wechat' | 'plain'
  build_graph: boolean
  ai_refine: boolean
  /** 与对话页一致：来自「模型设置」localStorage */
  client_llm?: ClientLlmPayload
}

/** 写入本地并返回 jobId，供进度页 URL ?job= 使用 */
export function savePendingChatImport(payload: PendingChatImportPayload): { jobId: string } {
  const jobId = crypto.randomUUID()
  try {
    localStorage.setItem(LS_JOB_PREFIX + jobId, JSON.stringify(payload))
  } catch {
    throw new Error('本地存储失败：文本可能过大，请删减后重试')
  }
  return { jobId }
}

function _parseClientLlm(raw: unknown): ClientLlmPayload | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const base_url = typeof o.base_url === 'string' ? o.base_url : ''
  const model = typeof o.model === 'string' ? o.model : ''
  if (base_url.length < 10 || !model.trim()) return undefined
  let api_key: string | null = null
  if ('api_key' in o) {
    const ak = o.api_key
    if (ak !== null && typeof ak !== 'string') return undefined
    api_key = ak
  }
  return { base_url, api_key, model }
}

function _parsePayload(raw: string | null): PendingChatImportPayload | null {
  if (!raw) return null
  try {
    const o = JSON.parse(raw) as PendingChatImportPayload
    if (
      typeof o.member_id !== 'number' ||
      typeof o.archive_id !== 'number' ||
      typeof o.raw_text !== 'string' ||
      !o.raw_text.trim()
    ) {
      return null
    }
    const client_llm = _parseClientLlm(o.client_llm)
    return {
      member_id: o.member_id,
      archive_id: o.archive_id,
      raw_text: o.raw_text,
      source: o.source ?? 'auto',
      build_graph: o.build_graph !== false,
      ai_refine: o.ai_refine !== false,
      ...(client_llm ? { client_llm } : {}),
    }
  } catch {
    return null
  }
}

/** 只读：不因 React StrictMode / effect 重跑而删除 job（避免首屏 abort 后无法二次读取） */
export function peekPendingChatImportByJob(jobId: string | null | undefined): PendingChatImportPayload | null {
  if (!jobId || typeof jobId !== 'string' || !jobId.trim()) return null
  const key = LS_JOB_PREFIX + jobId.trim()
  return _parsePayload(localStorage.getItem(key))
}

export function clearPendingChatImportByJob(jobId: string | null | undefined): void {
  if (!jobId || typeof jobId !== 'string' || !jobId.trim()) return
  localStorage.removeItem(LS_JOB_PREFIX + jobId.trim())
}

/** 读取并删除（仅需一次性消费时用） */
export function consumePendingChatImportByJob(jobId: string | null | undefined): PendingChatImportPayload | null {
  const p = peekPendingChatImportByJob(jobId)
  if (p) clearPendingChatImportByJob(jobId)
  return p
}
