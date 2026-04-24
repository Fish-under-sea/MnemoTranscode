import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'mtc-llm-user-config'

export type LlmConfigMode = 'preset' | 'custom' | 'ollama'

export type LlmUserConfig = {
  mode: LlmConfigMode
  /** 厂商模板 id，对应 lib/llmPresets */
  presetId: string | null
  /** ① 厂商模板 */
  presetApiKey: string
  presetModel: string
  /** 阿里云 国际 intl / 国内 cn */
  aliyunEndpoint: 'intl' | 'cn'
  /** ② 自定义 */
  customBaseUrl: string
  customApiKey: string
  customModel: string
  /** ③ 本地 Ollama（无 /v1，根地址即可） */
  ollamaBaseUrl: string
  ollamaModel: string
  /** 最近一次「检测并拉取模型」的摘要，仅作 UI 展示 */
  lastProbe: {
    ok: boolean
    latencyMs: number | null
    at: string
    error: string | null
    modelCount: number
  } | null
}

const defaultConfig: LlmUserConfig = {
  mode: 'preset',
  presetId: 'openai',
  presetApiKey: '',
  presetModel: 'gpt-5.5',
  aliyunEndpoint: 'cn',
  customBaseUrl: 'https://api.openai.com/v1',
  customApiKey: '',
  customModel: 'gpt-4o',
  ollamaBaseUrl: 'http://127.0.0.1:11434',
  ollamaModel: 'llama3.2',
  lastProbe: null,
}

function readStored(): LlmUserConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...defaultConfig }
    const p = JSON.parse(raw) as Partial<LlmUserConfig>
    return {
      ...defaultConfig,
      ...p,
      presetId: p.presetId ?? defaultConfig.presetId,
      presetApiKey: p.presetApiKey ?? defaultConfig.presetApiKey,
      presetModel: p.presetModel ?? defaultConfig.presetModel,
      aliyunEndpoint: p.aliyunEndpoint === 'intl' || p.aliyunEndpoint === 'cn' ? p.aliyunEndpoint : defaultConfig.aliyunEndpoint,
      customBaseUrl: p.customBaseUrl ?? defaultConfig.customBaseUrl,
      customApiKey: p.customApiKey ?? defaultConfig.customApiKey,
      customModel: p.customModel ?? defaultConfig.customModel,
      ollamaBaseUrl: p.ollamaBaseUrl ?? defaultConfig.ollamaBaseUrl,
      ollamaModel: p.ollamaModel ?? defaultConfig.ollamaModel,
      lastProbe: p.lastProbe ?? null,
    }
  } catch {
    return { ...defaultConfig }
  }
}

export function useLlmUserConfig() {
  const [config, setConfig] = useState<LlmUserConfig>(readStored)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
    } catch {
      // ignore
    }
  }, [config])

  const update = useCallback((patch: Partial<LlmUserConfig>) => {
    setConfig((c) => ({ ...c, ...patch }))
  }, [])

  const reset = useCallback(() => {
    setConfig({ ...defaultConfig })
  }, [])

  return { config, setConfig, update, reset }
}
