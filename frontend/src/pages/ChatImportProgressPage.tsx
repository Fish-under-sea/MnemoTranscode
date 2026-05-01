/**
 * 聊天记录导入进度页：由成员页 navigate 至本页，localStorage + ?job=uuid 传入负载
 */
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { LoadingState, ErrorState } from '@/components/ui'
import {
  CHAT_IMPORT_JOB_QUERY,
  peekPendingChatImportByJob,
  clearPendingChatImportByJob,
} from '@/lib/chatImportSession'
import { runChatImportStream, type ChatImportStreamEvent } from '@/lib/chatImportStream'
import { useQueryClient } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { fadeUp } from '@/lib/motion'

export default function ChatImportProgressPage() {
  const { archiveId, memberId } = useParams<{ archiveId: string; memberId: string }>()
  const [searchParams] = useSearchParams()
  const jobId = searchParams.get(CHAT_IMPORT_JOB_QUERY) ?? ''
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [lines, setLines] = useState<string[]>([])
  const [fatal, setFatal] = useState<string | null>(null)
  const [doneResult, setDoneResult] = useState<ChatImportStreamEvent & { type: 'done' } | null>(null)
  const [running, setRunning] = useState(true)

  const append = (s: string) => setLines((prev) => [...prev, s].slice(-400))
  /** Strict Mode 下 effect 可能双启，避免同一句连接日志重复 */
  const appendOnce = (s: string) =>
    setLines((prev) => (prev.includes(s) ? prev : [...prev, s].slice(-400)))

  useEffect(() => {
    let cancelled = false

    if (!jobId.trim()) {
      setFatal(
        '链接缺少 job 参数。请从成员页打开「导入聊天记录」，并点击「跳转 AI 导入进度页」。',
      )
      setRunning(false)
      return
    }

    const payload = peekPendingChatImportByJob(jobId)
    if (!payload || String(payload.member_id) !== memberId || String(payload.archive_id) !== archiveId) {
      clearPendingChatImportByJob(jobId)
      setFatal(
        '未找到待导入数据（job 已失效或与当前成员不匹配）。请返回成员页重新发起「跳转 AI 导入进度页」。',
      )
      setRunning(false)
      return
    }

    const ac = new AbortController()

    ;(async () => {
      try {
        appendOnce('已接收文本，开始连接服务器…')
        const final = await runChatImportStream(
          payload,
          (ev) => {
            if (ev.type === 'stage') append(ev.message || `阶段: ${ev.id ?? ''}`)
            if (ev.type === 'parse_done') append(`解析完成：${ev.segments ?? 0} 个原始片段`)
            if (ev.type === 'llm_batch') append(ev.message || `LLM 批次 ${ev.index}/${ev.total}`)
            if (ev.type === 'batch_done')
              append(`批次 ${ev.batch_index ?? '?'} 完成，本批 ${ev.memories_in_batch ?? 0} 条记忆`)
            if (ev.type === 'persist_progress')
              append(`已写入 ${ev.saved}/${ev.total} 条…`)
            if (ev.type === 'note') append(`※ ${ev.message ?? ''}`)
          },
          ac.signal,
        )
        if (cancelled) return

        clearPendingChatImportByJob(jobId)
        setDoneResult(final)
        const r = final.result
        if (r) {
          append(
            `完成：${r.created_count} 条记忆；时间链 ${r.graph_temporal_edges}，关联边 ${r.graph_llm_edges}` +
              (r.vectors_deferred ? '（已暂缓向量索引）' : ''),
          )
          void queryClient.invalidateQueries({ queryKey: ['memories', 'member', memberId] })
          void queryClient.invalidateQueries({ queryKey: ['mnemo-graph', Number(memberId)] })
        }
      } catch (e: unknown) {
        // React StrictMode 会卸载再挂载：cleanup 会 abort，此处视为静默重跑，不提示「已取消」
        if (cancelled) return

        const msg = e instanceof Error ? e.message : String(e)
        setFatal(msg)
        append(`错误：${msg}`)
        clearPendingChatImportByJob(jobId)
      } finally {
        if (!cancelled) setRunning(false)
      }
    })()

    return () => {
      cancelled = true
      ac.abort()
    }
  }, [archiveId, memberId, queryClient, jobId])

  if (fatal && lines.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <ErrorState error={new Error(fatal)} onRetry={() => window.location.reload()} />
        <div className="mt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate(`/archives/${archiveId}/members/${memberId}`)}
          >
            返回成员页
          </Button>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="mx-auto max-w-3xl px-4 py-8 space-y-6"
    >
      <div>
        <h1 className="font-serif text-display-sm text-ink-primary">聊天记录 AI 导入</h1>
        <p className="text-caption text-ink-muted mt-1">
          本页实时显示解析、多批 LLM 精炼与入库进度。请勿关闭直至显示完成。
        </p>
      </div>

      <Card className="p-4 space-y-3">
        {running && !doneResult && lines.length < 2 ? (
          <LoadingState message="连接处理流水线…" />
        ) : null}
        <div
          className="rounded-lg border border-border-default bg-subtle/40 p-3 max-h-[60vh] overflow-y-auto font-mono text-body-sm text-ink-secondary space-y-1"
          aria-live="polite"
        >
          {lines.map((ln, i) => (
            <div key={`${i}-${ln.slice(0, 24)}`} className="whitespace-pre-wrap break-words">
              {ln}
            </div>
          ))}
        </div>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="primary"
          onClick={() => navigate(`/archives/${archiveId}/members/${memberId}`)}
        >
          返回成员主页
        </Button>
        {!running && fatal ? (
          <Button type="button" variant="ghost" onClick={() => window.location.reload()}>
            重试
          </Button>
        ) : null}
      </div>
    </motion.div>
  )
}
