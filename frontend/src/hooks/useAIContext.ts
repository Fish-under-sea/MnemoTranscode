/**
 * AI 上下文管理 — 跨会话对话记忆同步
 * 管理当前会话的 AI 对话上下文摘要，
 * 自动与后端同步，支持开启/关闭
 */
import { useState, useEffect, useCallback } from 'react'
import { aiMemoryApi, preferencesApi } from '@/services/api'

export interface DialogueSummary {
  id: string
  date: string
  memberName?: string
  summary: string
  emotionTags: string[]
  tokenCount: number
}

export interface AIContext {
  summaries: DialogueSummary[]
  lastUpdated: string | null
  syncEnabled: boolean
  loading: boolean
  syncing: boolean
}

const MAX_SUMMARIES = 10

export function useAIContext() {
  const [context, setContext] = useState<AIContext>({
    summaries: [],
    lastUpdated: null,
    syncEnabled: true,
    loading: true,
    syncing: false,
  })

  // 加载初始上下文
  const loadContext = useCallback(async () => {
    try {
      const [memoryAxios, prefsAxios] = await Promise.all([
        aiMemoryApi.get(),
        preferencesApi.get(),
      ])
      const memoryRes = memoryAxios.data as {
        summaries: DialogueSummary[]
        last_updated: string | null
      }
      const prefsRes = prefsAxios.data as { ai_memory_sync: string }

      setContext({
        summaries: memoryRes.summaries || [],
        lastUpdated: memoryRes.last_updated || null,
        syncEnabled: prefsRes.ai_memory_sync !== 'off',
        loading: false,
        syncing: false,
      })
    } catch {
      setContext(prev => ({ ...prev, loading: false, syncing: false }))
    }
  }, [])

  useEffect(() => {
    loadContext()
  }, [loadContext])

  // 添加对话摘要
  const addSummary = useCallback(async (summary: Omit<DialogueSummary, 'id'>) => {
    if (!context.syncEnabled) return

    const newSummary: DialogueSummary = {
      ...summary,
      id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    }

    // 本地乐观更新
    setContext(prev => {
      const updated = [...prev.summaries, newSummary]
      if (updated.length > MAX_SUMMARIES) {
        updated.shift()
      }
      return { ...prev, syncing: true }
    })

    // 同步到后端
    try {
      const updated = [...context.summaries, newSummary]
      if (updated.length > MAX_SUMMARIES) {
        updated.shift()
      }

      await aiMemoryApi.update({
        summaries: updated,
        last_updated: new Date().toISOString(),
      })

      setContext(prev => ({
        ...prev,
        summaries: updated,
        lastUpdated: new Date().toISOString(),
        syncing: false,
      }))
    } catch {
      // 同步失败时回滚
      setContext(prev => ({
        ...prev,
        summaries: prev.summaries.filter(s => s.id !== newSummary.id),
        syncing: false,
      }))
    }
  }, [context.syncEnabled, context.summaries])

  // 切换同步开关
  const toggleSync = useCallback(async (enabled: boolean) => {
    setContext(prev => ({ ...prev, syncEnabled: enabled }))
    try {
      await preferencesApi.update({ ai_memory_sync: enabled ? 'on' : 'off' })
    } catch {
      setContext(prev => ({ ...prev, syncEnabled: !enabled }))
    }
  }, [])

  // 手动同步
  const forceSync = useCallback(async () => {
    setContext(prev => ({ ...prev, syncing: true }))
    await loadContext()
  }, [loadContext])

  // 清除记忆
  const clearMemory = useCallback(async () => {
    setContext(prev => ({ ...prev, syncing: true }))
    try {
      await aiMemoryApi.clear()
      setContext(prev => ({
        ...prev,
        summaries: [],
        lastUpdated: null,
        syncing: false,
      }))
    } catch {
      setContext(prev => ({ ...prev, syncing: false }))
    }
  }, [])

  // 生成 System Prompt 上下文片段
  const getContextForPrompt = useCallback((): string => {
    if (!context.syncEnabled || context.summaries.length === 0) {
      return ''
    }

    const recent = context.summaries.slice(-5)
    const lines = ['【跨会话记忆摘要】']
    for (const s of recent) {
      const date = new Date(s.date).toLocaleDateString('zh-CN')
      lines.push(`- ${date}（${s.memberName || '通用'}）: ${s.summary}`)
      if (s.emotionTags.length > 0) {
        lines.push(`  情感: ${s.emotionTags.join('、')}`)
      }
    }
    return lines.join('\n')
  }, [context.syncEnabled, context.summaries])

  return {
    ...context,
    addSummary,
    toggleSync,
    forceSync,
    clearMemory,
    getContextForPrompt,
  }
}
