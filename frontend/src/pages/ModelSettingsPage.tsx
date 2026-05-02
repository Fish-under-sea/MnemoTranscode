/**
 * 模型设置 — 语言模型：① 厂商模板 ② 自定义 API ③ 本地 Ollama；④ 语音合成（TTS）偏好独立保存
 */
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  Bot,
  Key,
  Building2,
  Wrench,
  HardDrive,
  Volume2,
  Activity,
  ListChecks,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  filterPresetsByRegion,
  getEffectivePresetBaseUrl,
  getPresetById,
  type RegionFilter,
} from '@/lib/llmPresets'
import { getTtsPresetById, TTS_PRESETS } from '@/lib/ttsPresets'
import { useLlmUserConfig, type LlmConfigMode } from '@/hooks/useLlmUserConfig'
import { useTtsUserConfig } from '@/hooks/useTtsUserConfig'
import { llmProbeApi } from '@/services/api'
import { Button } from '@/components/ui'
import { panelClassFromCardStyle, useThemeAppliedSnapshot } from '@/lib/theme'

type ModelSettingsTab = LlmConfigMode | 'tts'

const SETTINGS_TABS: {
  id: ModelSettingsTab
  label: string
  icon: typeof Building2
  hint: string
}[] = [
  { id: 'preset', label: '厂商模板', icon: Building2, hint: '对话 / 记忆用 LLM：已填好 Base，只需 API Key' },
  { id: 'custom', label: '自定义 API', icon: Wrench, hint: '对话 / 记忆用 LLM：任意 OpenAI 兼容服务地址' },
  { id: 'ollama', label: '本地 Ollama', icon: HardDrive, hint: '对话 / 记忆用 LLM：本机或局域网 Ollama 根地址' },
  { id: 'tts', label: '语音合成 · TTS', icon: Volume2, hint: '朗读与音色相关：独立于上方 LLM；当前为本地偏好，服务端对接后可统一下发' },
]

const REGION_TABS: { id: RegionFilter; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'overseas', label: '国外' },
  { id: 'domestic', label: '国内' },
]

/** 模型设置表单控件统一样式：subtle 底随 tokens，主色 DIY 落在 focus-ring / border-brand */
const MTC_MODEL_FIELD_CN =
  'w-full px-3 py-2.5 rounded-xl border border-default bg-subtle text-sm text-ink-primary outline-none focus:ring-2 focus:ring-brand/40'

export default function ModelSettingsPage() {
  const themeApplied = useThemeAppliedSnapshot()
  const { config, update } = useLlmUserConfig()
  const { config: ttsConfig, update: updateTts } = useTtsUserConfig()
  const [activeTab, setActiveTab] = useState<ModelSettingsTab>(() => config.mode)

  const lastProbe = config.lastProbe

  const [regionFilter, setRegionFilter] = useState<RegionFilter>('all')
  const visiblePresets = useMemo(() => filterPresetsByRegion(regionFilter), [regionFilter])

  const [fetchedModels, setFetchedModels] = useState<string[]>([])
  const [probing, setProbing] = useState(false)

  // 拉取到列表后，若当前模型不在返回列表中则默认选第一项
  useEffect(() => {
    if (fetchedModels.length === 0) return
    const first = fetchedModels[0]!
    if (activeTab === 'preset' && !fetchedModels.includes(config.presetModel)) {
      update({ presetModel: first })
    } else if (activeTab === 'custom' && !fetchedModels.includes(config.customModel)) {
      update({ customModel: first })
    } else if (activeTab === 'ollama' && !fetchedModels.includes(config.ollamaModel)) {
      update({ ollamaModel: first })
    }
  }, [fetchedModels, activeTab, config.presetModel, config.customModel, config.ollamaModel, update])

  // 切换 国外/国内/全部 时，当前选中的厂商若不在可见列表中则落到第一项
  useEffect(() => {
    if (activeTab !== 'preset') return
    const current = getPresetById(config.presetId)
    if (current && visiblePresets.some((v) => v.id === current.id)) return
    const first = visiblePresets[0]
    if (first) update({ presetId: first.id, presetModel: first.defaultModel })
  }, [regionFilter, activeTab, visiblePresets, update, config.presetId])

  const selectTab = (t: ModelSettingsTab) => {
    setActiveTab(t)
    if (t === 'tts') return
    setFetchedModels([])
    update({ mode: t, lastProbe: null })
  }

  const onSelectPreset = (id: string) => {
    const p = getPresetById(id)
    update({
      presetId: id,
      presetModel: p?.defaultModel ?? config.presetModel,
    })
  }

  const runProbe = async () => {
    setProbing(true)
    setFetchedModels([])
    try {
      if (activeTab === 'tts') {
        toast(
          '语音合成网关与对话 LLM 的 /v1/models 不尽相同，暂不自动拉取。请在下文选择厂商推荐型号或查阅 Xiaomi MiMo《语音合成 v2.5》文档手填。',
          { icon: 'ℹ️' },
        )
        return
      }
      if (activeTab === 'preset') {
        const p = getPresetById(config.presetId)
        if (!p) {
          toast.error('请选择厂商')
          return
        }
        if (p.listProbe === 'off') {
          toast('该厂商未开放自动拉表，请使用下方推荐或手填', { icon: 'ℹ️' })
          return
        }
        const baseUrl = getEffectivePresetBaseUrl(p, config.aliyunEndpoint)
        const res = await llmProbeApi.check({
          mode: p.listProbe,
          base_url: baseUrl,
          api_key: config.presetApiKey || null,
        })
        finishProbe(res)
        return
      }
      if (activeTab === 'custom') {
        if (!config.customBaseUrl.trim()) {
          toast.error('请填写 API Base URL')
          return
        }
        const res = await llmProbeApi.check({
          mode: 'openai',
          base_url: config.customBaseUrl.trim(),
          api_key: config.customApiKey || null,
        })
        finishProbe(res)
        return
      }
      if (!config.ollamaBaseUrl.trim()) {
        toast.error('请填写 Ollama 根地址')
        return
      }
      const res = await llmProbeApi.check({
        mode: 'ollama',
        base_url: config.ollamaBaseUrl.trim(),
        api_key: null,
      })
      finishProbe(res)
    } catch (e) {
      toast.error('请求失败，请确认已登录且网络正常')
      update({
        lastProbe: {
          ok: false,
          latencyMs: null,
          at: new Date().toISOString(),
          error: e instanceof Error ? e.message : '未知错误',
          modelCount: 0,
        },
      })
    } finally {
      setProbing(false)
    }
  }

  const finishProbe = (res: {
    ok: boolean
    latency_ms: number | null
    error: string | null
    models: string[]
  }) => {
    setFetchedModels(res.models)
    update({
      lastProbe: {
        ok: res.ok,
        latencyMs: res.latency_ms,
        at: new Date().toISOString(),
        error: res.error,
        modelCount: res.models.length,
      },
    })
    if (res.ok) {
      toast.success(
        res.models.length
          ? `已连接，${res.models.length} 个模型（${res.latency_ms ?? '?'} ms）`
          : `端点可用（${res.latency_ms ?? '?'} ms），未返回模型列表`,
      )
    } else {
      toast.error(res.error || '端点不可达')
    }
  }

  const handleSave = () => {
    if (activeTab === 'tts') {
      toast.success(
        '已保存语音合成偏好到本机（mtc-tts-user-config）。后续朗读 / 音色能力接入后端后即可读取此处的模型与密钥。',
      )
    } else {
      toast.success(
        '已保存到本机。AI 对话与故事书在发送时会自动带上 LLM 配置（OpenAI 兼容端）；未填完整时回退服务端环境变量。',
      )
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-ink-primary min-h-[min(70vh,800px)]">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-brand/15 flex items-center justify-center text-brand">
          <Bot size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-display text-ink-primary">模型设置</h1>
          <p className="text-body-sm text-ink-secondary mt-0.5">
            语言模型页签用于<strong className="font-medium text-ink-primary">对话、记忆归类等文本推理</strong>
            （支持探测拉表）；末尾「语音合成」页签单独保存
            <strong className="font-medium text-ink-primary"> TTS 模型偏好</strong>
            ，例如小米 MiMo-V2.5-TTS / VoiceDesign / VoiceClone。
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2 p-1 bg-muted/55 dark:bg-muted/40 rounded-2xl border border-default">
        {SETTINGS_TABS.map((t) => {
          const Icon = t.icon
          const active = activeTab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => selectTab(t.id)}
              className={cn(
                'flex-1 min-w-[132px] flex flex-col sm:flex-row items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-medium transition-all cursor-pointer',
                active
                  ? 'bg-surface text-ink-primary shadow-e1 border border-brand/40'
                  : 'text-ink-secondary hover:bg-surface/70',
              )}
            >
              <Icon size={18} className={active ? 'text-brand' : 'text-ink-muted'} />
              <span className="text-center leading-tight">{t.label}</span>
            </button>
          )
        })}
      </div>
      <p className="text-xs text-ink-muted mt-2 mb-6">
        {SETTINGS_TABS.find((t) => t.id === activeTab)?.hint}
      </p>

      <div className={cn(panelClassFromCardStyle(themeApplied.cardStyle), 'rounded-2xl p-6')}>
        <h2 className="font-semibold text-ink-primary mb-1 flex items-center gap-2">
          {activeTab === 'tts' ? (
            <>
              <Volume2 size={18} className="text-brand" aria-hidden />
              语音合成（TTS）
            </>
          ) : (
            <>
              <Key size={18} className="text-brand" />
              对话 / 推理 · 连接与模型
            </>
          )}
        </h2>
        <p className="text-sm text-ink-muted mb-4">
          {activeTab === 'tts'
            ? '以下为朗读与音色链路预留配置，与上文 LLM 分开存储。网关 URL、路径与请求体以各厂商开放平台为准。'
            : '检测由服务端代发，避免浏览器跨域。密钥仅用于本次/后续连接请求，请勿在公共设备保存。'}
        </p>

        {activeTab === 'tts' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 p-1 bg-muted/55 dark:bg-muted/40 rounded-xl border border-default w-fit">
              <button
                type="button"
                onClick={() => {
                  const pr = getTtsPresetById(ttsConfig.presetId) ?? getTtsPresetById('xiaomi-mimo-tts-token-cn')
                  updateTts({
                    mode: 'preset',
                    ttsModel: pr?.defaultModel ?? ttsConfig.ttsModel,
                  })
                }}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer',
                  ttsConfig.mode === 'preset'
                    ? 'bg-surface text-ink-primary shadow-e1 border border-brand/40'
                    : 'text-ink-secondary hover:bg-surface/80',
                )}
              >
                厂商模板
              </button>
              <button
                type="button"
                onClick={() => updateTts({ mode: 'custom' })}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer',
                  ttsConfig.mode === 'custom'
                    ? 'bg-surface text-ink-primary shadow-e1 border border-brand/40'
                    : 'text-ink-secondary hover:bg-surface/80',
                )}
              >
                自定义语音 API
              </button>
            </div>

            {ttsConfig.mode === 'preset' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-ink-secondary mb-1.5">厂商</label>
                  <select
                    aria-label="选择 TTS 厂商"
                    value={
                      getTtsPresetById(ttsConfig.presetId)
                        ? (ttsConfig.presetId ?? 'xiaomi-mimo-tts-token-cn')
                        : 'xiaomi-mimo-tts-token-cn'
                    }
                    onChange={(e) => {
                      const id = e.target.value
                      const pr = getTtsPresetById(id)
                      updateTts({
                        presetId: id,
                        ttsModel: pr?.defaultModel ?? 'MiMo-V2.5-TTS',
                      })
                    }}
                    className={MTC_MODEL_FIELD_CN}
                  >
                    {TTS_PRESETS.map((op) => (
                      <option key={op.id} value={op.id}>
                        {op.name}
                      </option>
                    ))}
                  </select>
                </div>
                {(() => {
                  const p = getTtsPresetById(ttsConfig.presetId)
                  if (!p) return null
                  return (
                    <div className="space-y-2">
                      <div className="text-sm text-ink-secondary bg-subtle rounded-xl px-3 py-2 border border-default">
                        <span className="text-ink-muted">参考 Base URL </span>
                        <code className="text-ink-primary break-all">{p.baseUrl}</code>
                      </div>
                      {p.description ? <p className="text-xs text-ink-muted">{p.description}</p> : null}
                    </div>
                  )
                })()}
                <div>
                  <label className="block text-sm font-medium text-ink-secondary mb-1.5">API Key</label>
                  <input
                    type="password"
                    value={ttsConfig.presetApiKey}
                    onChange={(e) => updateTts({ presetApiKey: e.target.value })}
                    placeholder="可与对话共用的 tp- Token Plan 密钥"
                    autoComplete="off"
                    className={MTC_MODEL_FIELD_CN}
                  />
                </div>
                <TtsModelSelectRow
                  value={ttsConfig.ttsModel}
                  onChange={(v) => updateTts({ ttsModel: v })}
                  recommendedModels={getTtsPresetById(ttsConfig.presetId)?.recommendedModels}
                />
              </>
            )}

            {ttsConfig.mode === 'custom' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-ink-secondary mb-1.5">语音 API Base URL</label>
                  <input
                    type="text"
                    value={ttsConfig.customBaseUrl}
                    onChange={(e) => updateTts({ customBaseUrl: e.target.value })}
                    placeholder="https://你的网关/v1"
                    className={MTC_MODEL_FIELD_CN}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-secondary mb-1.5">API Key</label>
                  <input
                    type="password"
                    value={ttsConfig.customApiKey}
                    onChange={(e) => updateTts({ customApiKey: e.target.value })}
                    placeholder="可留空（若网关无需密钥）"
                    autoComplete="off"
                    className={MTC_MODEL_FIELD_CN}
                  />
                </div>
                <TtsModelSelectRow value={ttsConfig.ttsModel} onChange={(v) => updateTts({ ttsModel: v })} />
              </div>
            )}

            <p className="text-xs text-ink-muted flex items-center gap-1">
              <Activity size={12} aria-hidden />
              语音网关的连通性探测将在服务端代理就绪后补齐；请先保存密钥与模型 ID。
            </p>
          </div>
        )}

        {activeTab !== 'tts' && activeTab === 'preset' && (
          <div className="space-y-4">
            <div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-2">
                <label className="text-sm font-medium text-ink-secondary">厂商</label>
                <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="快捷分类">
                  {REGION_TABS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      role="tab"
                      onClick={() => setRegionFilter(t.id)}
                      className={cn(
                        'px-3 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer',
                        regionFilter === t.id
                          ? 'bg-brand/15 border-brand/45 text-ink-primary'
                          : 'bg-subtle/90 border-default text-ink-secondary hover:border-brand/40',
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs rounded-lg px-2.5 py-2 mb-3 border border-amber-500/30 bg-amber-500/[0.1] text-amber-950 dark:bg-amber-500/14 dark:border-amber-400/28 dark:text-amber-50">
                小 Tips：部分国外模型需要「魔法」网络环境才能稳定访问。
              </p>
              <select
                aria-label="选择厂商"
                value={visiblePresets.some((v) => v.id === config.presetId) ? (config.presetId ?? 'openai') : (visiblePresets[0]?.id ?? 'openai')}
                onChange={(e) => onSelectPreset(e.target.value)}
                className={MTC_MODEL_FIELD_CN}
              >
                {visiblePresets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.index}. {p.name} · {p.modelSeries}
                  </option>
                ))}
              </select>
            </div>
            {(() => {
              const p = getPresetById(config.presetId)
              if (!p) return null
              return (
                <div className="space-y-2">
                  {p.id === 'aliyun' && p.baseUrlChoices && p.baseUrlChoices.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {p.baseUrlChoices.map((c) => (
                        <button
                          key={c.key}
                          type="button"
                          onClick={() => update({ aliyunEndpoint: c.key === 'intl' ? 'intl' : 'cn' })}
                          className={cn(
                            'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer',
                            (c.key === 'intl' ? config.aliyunEndpoint === 'intl' : config.aliyunEndpoint === 'cn')
                              ? 'bg-brand/15 border-brand/45 text-ink-primary'
                              : 'bg-surface border-default text-ink-secondary hover:border-brand/40',
                          )}
                        >
                          阿里云 {c.label} 端
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="text-sm text-ink-secondary bg-subtle rounded-xl px-3 py-2 border border-default">
                    <span className="text-ink-muted">Base URL </span>
                    <code className="text-ink-primary break-all">
                      {getEffectivePresetBaseUrl(p, config.aliyunEndpoint)}
                    </code>
                  </div>
                  {p.description ? <p className="text-xs text-ink-muted">{p.description}</p> : null}
                </div>
              )
            })()}
            <div>
              <label className="block text-sm font-medium text-ink-secondary mb-1.5">API Key</label>
              <input
                type="password"
                value={config.presetApiKey}
                onChange={(e) => update({ presetApiKey: e.target.value })}
                placeholder="从厂商控制台获取"
                autoComplete="off"
                className={MTC_MODEL_FIELD_CN}
              />
            </div>
            <ModelSelectRow
              value={config.presetModel}
              onChange={(v) => update({ presetModel: v })}
              fetchedModels={fetchedModels}
              recommendedModels={getPresetById(config.presetId)?.recommendedModels}
            />
          </div>
        )}

        {activeTab !== 'tts' && activeTab === 'custom' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink-secondary mb-1.5">API Base URL</label>
              <input
                type="text"
                value={config.customBaseUrl}
                onChange={(e) => update({ customBaseUrl: e.target.value })}
                placeholder="https://你的网关/v1"
                className={MTC_MODEL_FIELD_CN}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-secondary mb-1.5">API Key</label>
              <input
                type="password"
                value={config.customApiKey}
                onChange={(e) => update({ customApiKey: e.target.value })}
                placeholder="可留空（若服务无需密钥）"
                autoComplete="off"
                className={MTC_MODEL_FIELD_CN}
              />
            </div>
            <ModelSelectRow
              value={config.customModel}
              onChange={(v) => update({ customModel: v })}
              fetchedModels={fetchedModels}
            />
          </div>
        )}

        {activeTab !== 'tts' && activeTab === 'ollama' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink-secondary mb-1.5">Ollama 根地址</label>
              <input
                type="text"
                value={config.ollamaBaseUrl}
                onChange={(e) => update({ ollamaBaseUrl: e.target.value })}
                placeholder="http://127.0.0.1:11434"
                className={MTC_MODEL_FIELD_CN}
              />
              <p className="text-xs text-ink-muted mt-1.5">
                不要加 <code className="bg-brand/12 px-1 rounded text-brand">/v1</code>；需保证部署 MTC
                后端的机器能访问该地址（如 Docker 下可用 host 网关 IP）。
              </p>
            </div>
            <ModelSelectRow
              value={config.ollamaModel}
              onChange={(v) => update({ ollamaModel: v })}
              fetchedModels={fetchedModels}
            />
          </div>
        )}

        {activeTab !== 'tts' && <ProbeStatus lastProbe={lastProbe} />}

        <div className="flex flex-wrap gap-3 mt-6 items-center">
          {activeTab !== 'tts' && (
            <Button
              type="button"
              variant="secondary"
              size="md"
              disabled={probing}
              loading={probing}
              leftIcon={probing ? undefined : <Activity size={16} />}
              onClick={() => void runProbe()}
            >
              {probing ? '检测中...' : '检测连通并拉取模型'}
            </Button>
          )}
          <Button type="button" variant="primary" size="md" leftIcon={<ListChecks size={16} />} onClick={handleSave}>
            保存配置
          </Button>
        </div>
      </div>
    </div>
  )
}

function TtsModelSelectRow({
  value,
  onChange,
  recommendedModels,
}: {
  value: string
  onChange: (v: string) => void
  recommendedModels?: string[]
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-ink-secondary mb-1.5">TTS 模型</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={
          recommendedModels?.length
            ? '可点下方推荐标签，或按控制台实际 ID 手填'
            : '按厂商文档填写 model 字段'
        }
        className={MTC_MODEL_FIELD_CN}
      />
      {recommendedModels && recommendedModels.length > 0 && (
        <div className="mt-2">
          <p className="text-xs text-ink-muted mb-1.5">推荐型号（MiMo-V2.5-TTS 系列）：</p>
          <div className="flex flex-wrap gap-1.5">
            {recommendedModels.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onChange(m)}
                className={cn(
                  'px-2 py-0.5 rounded-md text-xs border transition-colors max-w-full truncate cursor-pointer',
                  value === m
                    ? 'bg-brand/15 border-brand/45 text-ink-primary'
                    : 'bg-surface border-default text-ink-secondary hover:border-brand/40',
                )}
                title={m}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ModelSelectRow({
  value,
  onChange,
  fetchedModels,
  recommendedModels,
}: {
  value: string
  onChange: (v: string) => void
  fetchedModels: string[]
  /** 厂商模板的推荐模型 ID 列表，仅厂商模板会传入 */
  recommendedModels?: string[]
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-ink-secondary mb-1.5">模型</label>
      {fetchedModels.length > 0 ? (
        <select
          value={fetchedModels.includes(value) ? value : fetchedModels[0]}
          onChange={(e) => onChange(e.target.value)}
          className={MTC_MODEL_FIELD_CN}
        >
          {fetchedModels.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            recommendedModels?.length
              ? '可点下方推荐填入，或先「检测拉取」'
              : '先检测拉取列表，或手动输入模型名'
          }
          className={MTC_MODEL_FIELD_CN}
        />
      )}
      {recommendedModels && recommendedModels.length > 0 && (
        <div className="mt-2">
          <p className="text-xs text-ink-muted mb-1.5">推荐模型（以厂商控制台为准）：</p>
          <div className="flex flex-wrap gap-1.5">
            {recommendedModels.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onChange(m)}
                className={cn(
                  'px-2 py-0.5 rounded-md text-xs border transition-colors max-w-full truncate cursor-pointer',
                  value === m
                    ? 'bg-brand/15 border-brand/45 text-ink-primary'
                    : 'bg-surface border-default text-ink-secondary hover:border-brand/40',
                )}
                title={m}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ProbeStatus({
  lastProbe,
}: {
  lastProbe: {
    ok: boolean
    latencyMs: number | null
    at: string
    error: string | null
    modelCount: number
  } | null
}) {
  if (!lastProbe) {
    return (
      <p className="text-xs text-ink-muted mt-4 flex items-center gap-1">
        <Activity size={12} />
        尚未执行检测；可点击「检测连通并拉取模型」验证端口与 /v1/models 或 Ollama /api/tags
      </p>
    )
  }
  return (
    <div
      className={cn(
        'mt-4 rounded-xl border px-3 py-2.5 text-sm flex flex-wrap items-center gap-2',
        lastProbe.ok
          ? 'border-emerald-500/35 bg-emerald-500/[0.1] text-emerald-950 dark:bg-emerald-500/14 dark:border-emerald-400/30 dark:text-emerald-100'
          : 'border-rose-500/35 bg-rose-500/[0.1] text-rose-950 dark:bg-rose-950/40 dark:border-rose-400/30 dark:text-rose-100',
      )}
    >
      {lastProbe.ok ? <CheckCircle2 size={16} className="shrink-0" /> : <XCircle size={16} className="shrink-0" />}
      {lastProbe.ok ? (
        <>
          端口/API 可用 · 延迟 {lastProbe.latencyMs ?? '—'} ms · 模型数 {lastProbe.modelCount} ·
          {new Date(lastProbe.at).toLocaleString('zh-CN')}
        </>
      ) : (
        <>
          不可用：{lastProbe.error || '—'} · {new Date(lastProbe.at).toLocaleString('zh-CN')}
        </>
      )}
    </div>
  )
}
