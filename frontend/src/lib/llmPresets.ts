/**
 * 与 docs/LLM.txt 表一致，顺序不可改（1–12）
 * 推荐/默认与表「系列」一一对应；listProbe 与后端 /llm-probe/check 的 mode 对齐
 */
import type { LlmListProbe } from './llmProbeMode'

export type { LlmListProbe } from './llmProbeMode'

export type LlmRegion = 'overseas' | 'domestic' | 'both'

export type LlmBaseChoice = { key: string; label: string; value: string }

export type LlmPreset = {
  index: number
  id: string
  name: string
  modelSeries: string
  baseUrl: string
  defaultModel: string
  recommendedModels: string[]
  region: LlmRegion
  description?: string
  /** 拉取模型列表时走后端何种子协议（与官方 document 一致则开启） */
  listProbe: LlmListProbe
  baseUrlChoices?: LlmBaseChoice[]
}

export const LLM_PRESETS: LlmPreset[] = [
  {
    index: 1,
    id: 'google',
    name: 'Google',
    modelSeries: 'Gemini 3.1 pro 等',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-3.1-pro-preview',
    recommendedModels: [
      'gemini-3.1-pro-preview',
      'gemini-3-flash-preview',
      'gemini-3.1-flash-lite-preview',
    ],
    region: 'overseas',
    listProbe: 'google',
  },
  {
    index: 2,
    id: 'openai',
    name: 'OpenAI',
    modelSeries: 'GPT 5.5 等',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-5.5',
    recommendedModels: ['gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini', 'o3'],
    region: 'overseas',
    listProbe: 'openai',
  },
  {
    index: 3,
    id: 'anthropic',
    name: 'Anthropic',
    modelSeries: 'Claude Opus4.7 等',
    baseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-opus-4-7',
    recommendedModels: [
      'claude-opus-4-7',
      'claude-sonnet-4-6',
      'claude-haiku-4-5-20251001',
    ],
    region: 'overseas',
    listProbe: 'anthropic',
  },
  {
    index: 4,
    id: 'xai',
    name: 'xAI',
    modelSeries: 'Grok 4.20 等',
    baseUrl: 'https://api.x.ai/v1',
    defaultModel: 'grok-4.20-reasoning',
    recommendedModels: ['grok-4.20-reasoning', 'grok-4'],
    region: 'overseas',
    listProbe: 'openai',
  },
  {
    index: 5,
    id: 'meta-llama',
    name: 'Meta',
    modelSeries: 'Llama 4 等',
    baseUrl: 'https://api.llama.com/v1',
    defaultModel: 'Llama-4-Maverick-17B-128E-Instruct-FP8',
    recommendedModels: [
      'Llama-4-Maverick-17B-128E-Instruct-FP8',
      'Llama-4-Scout-17B-16E-Instruct-FP8',
    ],
    region: 'overseas',
    listProbe: 'openai',
  },
  {
    index: 6,
    id: 'deepseek',
    name: 'DeepSeek',
    modelSeries: 'DeepSeek V4 等',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-v4-pro',
    recommendedModels: ['deepseek-v4-pro', 'deepseek-v4-flash'],
    region: 'domestic',
    listProbe: 'openai',
  },
  {
    index: 7,
    id: 'aliyun',
    name: '阿里云',
    modelSeries: 'Qwen3.6 等',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen3-max',
    recommendedModels: ['qwen3-max', 'qwen3.6-plus', 'qwen3.6-flash'],
    region: 'both',
    listProbe: 'openai',
    baseUrlChoices: [
      { key: 'intl', label: '国际', value: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1' },
      { key: 'cn', label: '国内', value: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
    ],
  },
  {
    index: 8,
    id: 'bytedance-doubao',
    name: '字节跳动',
    modelSeries: 'Doubao Seed 2.0 等',
    baseUrl: 'https://api.doubao-ai.com/v1',
    defaultModel: 'doubao-seed-2-0-pro-260215',
    recommendedModels: [
      'doubao-seed-2-0-pro-260215',
      'doubao-seed-2-0-lite-260215',
      'doubao-seed-2-0-mini-260215',
      'doubao-seed-2-0-code-preview-260215',
    ],
    region: 'domestic',
    listProbe: 'openai',
  },
  {
    index: 9,
    id: 'zhipu',
    name: '智谱AI',
    modelSeries: 'GLM 5.1 等',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-5.1',
    recommendedModels: ['glm-5.1', 'glm-5', 'glm-4.5-air'],
    region: 'domestic',
    listProbe: 'zhipu',
  },
  {
    index: 10,
    id: 'moonshot',
    name: '月之暗面 (Moonshot)',
    modelSeries: 'Kimi 2.6 等',
    baseUrl: 'https://api.moonshot.cn/v1',
    defaultModel: 'kimi-k2.6',
    recommendedModels: ['kimi-k2.6'],
    region: 'domestic',
    listProbe: 'openai',
  },
  {
    index: 11,
    id: 'minimax',
    name: 'MiniMax',
    modelSeries: 'MiniMax M2.7 等',
    baseUrl: 'https://api.minimaxi.com/v1',
    defaultModel: 'MiniMax-M2.7',
    recommendedModels: ['MiniMax-M2.7'],
    region: 'domestic',
    listProbe: 'openai',
    description: 'M2.7 若与控制台实际模型 ID 不同，以控制台为准',
  },
  {
    index: 12,
    id: 'siliconflow',
    name: '硅基流动',
    modelSeries: '平台聚合 (DeepSeek, Qwen, GLM 等)',
    baseUrl: 'https://api.siliconflow.cn/v1',
    defaultModel: 'Pro/zai-org/GLM-5',
    recommendedModels: [
      'Pro/zai-org/GLM-5',
      'Qwen/Qwen3.5-397B-A17B',
      'Pro/deepseek-ai/DeepSeek-V3.2',
    ],
    region: 'domestic',
    listProbe: 'openai',
  },
]

export type RegionFilter = 'all' | 'overseas' | 'domestic'

export function filterPresetsByRegion(
  filter: RegionFilter,
): LlmPreset[] {
  if (filter === 'all') return LLM_PRESETS
  if (filter === 'overseas') {
    return LLM_PRESETS.filter((p) => p.region === 'overseas' || p.region === 'both')
  }
  return LLM_PRESETS.filter((p) => p.region === 'domestic' || p.region === 'both')
}

export function getPresetById(id: string | null | undefined): LlmPreset | undefined {
  if (!id) return undefined
  return LLM_PRESETS.find((p) => p.id === id)
}

export function getEffectivePresetBaseUrl(
  preset: LlmPreset | undefined,
  aliyunEndpoint: 'intl' | 'cn',
): string {
  if (!preset) return ''
  if (preset.id === 'aliyun' && preset.baseUrlChoices?.length) {
    const hit = preset.baseUrlChoices.find((c) => c.key === aliyunEndpoint)
    return (hit ?? preset.baseUrlChoices.find((c) => c.key === 'cn') ?? preset.baseUrlChoices[0])!.value
  }
  return preset.baseUrl
}
