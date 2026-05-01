/**
 * 将「模型设置」中的配置转为后端识别的 OpenAI 兼容 client_llm
 * 不完整时返回 null，后端改用环境变量 LLM_*
 */
import type { LlmUserConfig } from '@/hooks/useLlmUserConfig'
import { getEffectivePresetBaseUrl, getPresetById } from '@/lib/llmPresets'

export type ClientLlmPayload = {
  base_url: string
  api_key: string | null
  model: string
}

function normalizeOllamaCompatBase(root: string): string {
  const s = root.trim().replace(/\/+$/, '')
  if (!s) return s
  return s.endsWith('/v1') ? s : `${s}/v1`
}

export function buildClientLlmPayload(c: LlmUserConfig): ClientLlmPayload | null {
  if (c.mode === 'preset') {
    const p = getPresetById(c.presetId)
    if (!p) return null
    const base_url = getEffectivePresetBaseUrl(p, c.aliyunEndpoint).trim().replace(/\/+$/, '')
    const model = (c.presetModel || '').trim()
    if (!base_url || !model) return null
    const key = (c.presetApiKey || '').trim()
    return {
      base_url,
      api_key: key.length > 0 ? key : null,
      model,
    }
  }

  if (c.mode === 'custom') {
    let base_url = (c.customBaseUrl || '').trim().replace(/\/+$/, '')
    const model = (c.customModel || '').trim()
    if (!base_url || !model) return null
    const key = (c.customApiKey || '').trim()
    return {
      base_url,
      api_key: key.length > 0 ? key : null,
      model,
    }
  }

  // Ollama：根路径自动补 /v1 以对齐 chat/completions
  const rawRoot = (c.ollamaBaseUrl || '').trim()
  const model = (c.ollamaModel || '').trim()
  if (!rawRoot || !model) return null
  return {
    base_url: normalizeOllamaCompatBase(rawRoot),
    api_key: null,
    model,
  }
}
