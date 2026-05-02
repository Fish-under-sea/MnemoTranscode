/**
 * 语音合成（TTS）厂商模板 — 与 LLM 的 llmPresets 分离，避免混用 Base/模型 ID
 * 小米 MiMo V2.5 TTS 系列命名参考：mimo.xiaomi.com 与开放平台文档
 */

export type TtsPreset = {
  id: string
  name: string
  /** 语音 API 根路径（展示用；实际 path 以厂商文档为准） */
  baseUrl: string
  defaultModel: string
  recommendedModels: string[]
  description?: string
}

export const TTS_PRESETS: TtsPreset[] = [
  {
    id: 'xiaomi-mimo-tts-token-cn',
    name: '小米 MiMo（国内 Token Plan · 语音合成 v2.5）',
    baseUrl: 'https://token-plan-cn.xiaomimimo.com/v1',
    defaultModel: 'MiMo-V2.5-TTS',
    recommendedModels: [
      'MiMo-V2.5-TTS',
      'MiMo-V2.5-TTS-VoiceDesign',
      'MiMo-V2.5-TTS-VoiceClone',
    ],
    description:
      '系列含三款：MiMo-V2.5-TTS（精品音色、开箱即用）、MiMo-V2.5-TTS-VoiceDesign（自然语言描述生成新音色）、MiMo-V2.5-TTS-VoiceClone（短参考音频克隆音色）。密钥多在 platform.xiaomimimo.com「Token Plan」创建，常与对话用的 tp- 密钥相同；REST 路径与字段请以官方文档为准：https://platform.xiaomimimo.com/docs/zh-CN/usage-guide/speech-synthesis-v2.5',
  },
]

export function getTtsPresetById(id: string | null | undefined): TtsPreset | undefined {
  if (!id) return undefined
  return TTS_PRESETS.find((p) => p.id === id)
}
