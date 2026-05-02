/**
 * 将「语音合成 · TTS」页配置转为后端识别的 client_tts（OpenAI 兼容 /audio/speech）
 */
import type { TtsUserConfig } from '@/hooks/useTtsUserConfig'
import { getTtsPresetById } from '@/lib/ttsPresets'

export type ClientTtsPayload = {
  base_url: string
  api_key: string | null
  model: string
}

export function buildClientTtsPayload(c: TtsUserConfig): ClientTtsPayload | null {
  if (c.mode === 'preset') {
    const p = getTtsPresetById(c.presetId)
    if (!p) return null
    const base_url = p.baseUrl.trim().replace(/\/+$/, '')
    const model = (c.ttsModel || '').trim() || p.defaultModel
    if (!base_url || !model) return null
    const key = (c.presetApiKey || '').trim()
    return { base_url, api_key: key.length > 0 ? key : null, model }
  }
  let base_url = (c.customBaseUrl || '').trim().replace(/\/+$/, '')
  const model = (c.ttsModel || '').trim()
  if (!base_url || !model) return null
  const key = (c.customApiKey || '').trim()
  return { base_url, api_key: key.length > 0 ? key : null, model }
}
