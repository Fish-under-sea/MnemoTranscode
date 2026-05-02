import { useCallback, useEffect, useState } from 'react'
import { getTtsPresetById } from '@/lib/ttsPresets'

export const TTS_USER_CONFIG_STORAGE_KEY = 'mtc-tts-user-config'

export type TtsConfigMode = 'preset' | 'custom'

export type TtsUserConfig = {
  mode: TtsConfigMode
  /** 对应 lib/ttsPresets */
  presetId: string | null
  presetApiKey: string
  customBaseUrl: string
  customApiKey: string
  /** OpenAI-style model 字段传入值，或服务商标识的实际 model id */
  ttsModel: string
}

const defaultConfig: TtsUserConfig = {
  mode: 'preset',
  presetId: 'xiaomi-mimo-tts-token-cn',
  presetApiKey: '',
  customBaseUrl: 'https://api.example.com/v1',
  customApiKey: '',
  ttsModel: 'MiMo-V2.5-TTS',
}

export function readStoredTtsUserConfig(): TtsUserConfig {
  try {
    const raw = localStorage.getItem(TTS_USER_CONFIG_STORAGE_KEY)
    if (!raw) return { ...defaultConfig }
    const p = JSON.parse(raw) as Partial<TtsUserConfig>
    const presetId = p.presetId ?? defaultConfig.presetId
    const pr = getTtsPresetById(presetId)
    const ttsModel = p.ttsModel ?? pr?.defaultModel ?? defaultConfig.ttsModel
    return {
      ...defaultConfig,
      ...p,
      presetId,
      presetApiKey: p.presetApiKey ?? defaultConfig.presetApiKey,
      customBaseUrl: p.customBaseUrl ?? defaultConfig.customBaseUrl,
      customApiKey: p.customApiKey ?? defaultConfig.customApiKey,
      ttsModel,
      mode: p.mode === 'custom' ? 'custom' : 'preset',
    }
  } catch {
    return { ...defaultConfig }
  }
}

export function useTtsUserConfig() {
  const [config, setConfig] = useState<TtsUserConfig>(readStoredTtsUserConfig)

  useEffect(() => {
    try {
      localStorage.setItem(TTS_USER_CONFIG_STORAGE_KEY, JSON.stringify(config))
    } catch {
      // ignore
    }
  }, [config])

  const update = useCallback((patch: Partial<TtsUserConfig>) => {
    setConfig((c) => ({ ...c, ...patch }))
  }, [])

  const reset = useCallback(() => {
    setConfig({ ...defaultConfig })
  }, [])

  return { config, setConfig, update, reset }
}
