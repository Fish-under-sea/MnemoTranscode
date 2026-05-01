/**
 * 模型设置 — 三种方式：① 厂商模板 ② 自定义 API ③ 本地 Ollama；支持探测连通性与拉取模型列表
 */
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  Bot,
  Key,
  Building2,
  Wrench,
  HardDrive,
  Activity,
  ListChecks,
  Loader2,
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
import { useLlmUserConfig, type LlmConfigMode } from '@/hooks/useLlmUserConfig'
import { llmProbeApi } from '@/services/api'

const MODE_TABS: { id: LlmConfigMode; label: string; icon: typeof Building2; hint: string }[] = [
  { id: 'preset', label: '厂商模板', icon: Building2, hint: '已填好 Base，只需 API Key' },
  { id: 'custom', label: '自定义 API', icon: Wrench, hint: '任意 OpenAI 兼容服务地址' },
  { id: 'ollama', label: '本地 Ollama', icon: HardDrive, hint: '本机 / 局域网 Ollama 根地址' },
]

const REGION_TABS: { id: RegionFilter; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'overseas', label: '国外' },
  { id: 'domestic', label: '国内' },
]

export default function ModelSettingsPage() {
  const { config, update } = useLlmUserConfig()
  const { mode, lastProbe } = config

  const [regionFilter, setRegionFilter] = useState<RegionFilter>('all')
  const visiblePresets = useMemo(() => filterPresetsByRegion(regionFilter), [regionFilter])

  const [fetchedModels, setFetchedModels] = useState<string[]>([])
  const [probing, setProbing] = useState(false)

  // 拉取到列表后，若当前模型不在返回列表中则默认选第一项
  useEffect(() => {
    if (fetchedModels.length === 0) return
    const first = fetchedModels[0]!
    if (mode === 'preset' && !fetchedModels.includes(config.presetModel)) {
      update({ presetModel: first })
    } else if (mode === 'custom' && !fetchedModels.includes(config.customModel)) {
      update({ customModel: first })
    } else if (mode === 'ollama' && !fetchedModels.includes(config.ollamaModel)) {
      update({ ollamaModel: first })
    }
  }, [fetchedModels, mode, config.presetModel, config.customModel, config.ollamaModel, update])

  // 切换 国外/国内/全部 时，当前选中的厂商若不在可见列表中则落到第一项
  useEffect(() => {
    if (mode !== 'preset') return
    const current = getPresetById(config.presetId)
    if (current && visiblePresets.some((v) => v.id === current.id)) return
    const first = visiblePresets[0]
    if (first) update({ presetId: first.id, presetModel: first.defaultModel })
  }, [regionFilter, mode, visiblePresets, update, config.presetId])

  const setMode = (m: LlmConfigMode) => {
    update({ mode: m, lastProbe: null })
    setFetchedModels([])
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
      if (mode === 'preset') {
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
      if (mode === 'custom') {
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
    toast.success(
      '已保存到本机。AI 对话与故事书在发送时会自动带上此处配置（OpenAI 兼容端）；未填完整时回退服务端环境变量。',
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-jade-100 flex items-center justify-center text-jade-700">
          <Bot size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-display text-ink-primary">模型设置</h1>
          <p className="text-body-sm text-ink-secondary mt-0.5">
            配置对话使用的模型与密钥。支持厂商模板、自定义 OpenAI 兼容服务与本地 Ollama，并可检测端口连通性、拉取可用模型。
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2 p-1 bg-warm-100/80 rounded-2xl border border-warm-200">
        {MODE_TABS.map((t) => {
          const Icon = t.icon
          const active = mode === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setMode(t.id)}
              className={cn(
                'flex-1 min-w-[140px] flex flex-col sm:flex-row items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-medium transition-all cursor-pointer',
                active
                  ? 'bg-white text-jade-800 shadow-sm border border-jade-200'
                  : 'text-slate-600 hover:bg-white/60',
              )}
            >
              <Icon size={18} className={active ? 'text-jade-600' : 'text-slate-500'} />
              <span>{t.label}</span>
            </button>
          )
        })}
      </div>
      <p className="text-xs text-slate-500 mt-2 mb-6">{MODE_TABS.find((t) => t.id === mode)?.hint}</p>

      <div className="bg-white rounded-2xl border border-warm-200 p-6 shadow-sm">
        <h2 className="font-semibold text-slate-900 mb-1 flex items-center gap-2">
          <Key size={18} className="text-jade-600" />
          连接与模型
        </h2>
        <p className="text-sm text-slate-500 mb-4">
          检测由服务端代发，避免浏览器跨域。密钥仅用于本次/后续连接请求，请勿在公共设备保存。
        </p>

        {mode === 'preset' && (
          <div className="space-y-4">
            <div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-2">
                <label className="text-sm font-medium text-slate-700">厂商</label>
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
                          ? 'bg-jade-100 border-jade-300 text-jade-800'
                          : 'bg-warm-50 border-warm-200 text-slate-600 hover:border-jade-200',
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-amber-800/90 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2 mb-3">
                小 Tips：部分国外模型需要「魔法」网络环境才能稳定访问。
              </p>
              <select
                aria-label="选择厂商"
                value={visiblePresets.some((v) => v.id === config.presetId) ? (config.presetId ?? 'openai') : (visiblePresets[0]?.id ?? 'openai')}
                onChange={(e) => onSelectPreset(e.target.value)}
                className="w-full px-3 py-2.5 border border-warm-200 rounded-xl bg-warm-50 text-sm outline-none focus:ring-2 focus:ring-jade-400"
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
                              ? 'bg-jade-100 border-jade-300 text-jade-800'
                              : 'bg-white border-warm-200 text-slate-600 hover:border-jade-200',
                          )}
                        >
                          阿里云 {c.label} 端
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="text-sm text-slate-600 bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
                    <span className="text-slate-500">Base URL </span>
                    <code className="text-slate-800 break-all">
                      {getEffectivePresetBaseUrl(p, config.aliyunEndpoint)}
                    </code>
                  </div>
                  {p.description ? <p className="text-xs text-slate-500">{p.description}</p> : null}
                </div>
              )
            })()}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">API Key</label>
              <input
                type="password"
                value={config.presetApiKey}
                onChange={(e) => update({ presetApiKey: e.target.value })}
                placeholder="从厂商控制台获取"
                autoComplete="off"
                className="w-full px-3 py-2.5 border border-warm-200 rounded-xl focus:ring-2 focus:ring-jade-400 outline-none bg-warm-50 text-sm"
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

        {mode === 'custom' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">API Base URL</label>
              <input
                type="text"
                value={config.customBaseUrl}
                onChange={(e) => update({ customBaseUrl: e.target.value })}
                placeholder="https://你的网关/v1"
                className="w-full px-3 py-2.5 border border-warm-200 rounded-xl focus:ring-2 focus:ring-jade-400 outline-none bg-warm-50 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">API Key</label>
              <input
                type="password"
                value={config.customApiKey}
                onChange={(e) => update({ customApiKey: e.target.value })}
                placeholder="可留空（若服务无需密钥）"
                autoComplete="off"
                className="w-full px-3 py-2.5 border border-warm-200 rounded-xl focus:ring-2 focus:ring-jade-400 outline-none bg-warm-50 text-sm"
              />
            </div>
            <ModelSelectRow
              value={config.customModel}
              onChange={(v) => update({ customModel: v })}
              fetchedModels={fetchedModels}
            />
          </div>
        )}

        {mode === 'ollama' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Ollama 根地址</label>
              <input
                type="text"
                value={config.ollamaBaseUrl}
                onChange={(e) => update({ ollamaBaseUrl: e.target.value })}
                placeholder="http://127.0.0.1:11434"
                className="w-full px-3 py-2.5 border border-warm-200 rounded-xl focus:ring-2 focus:ring-jade-400 outline-none bg-warm-50 text-sm"
              />
              <p className="text-xs text-slate-500 mt-1.5">
                不要加 <code className="bg-warm-100 px-1 rounded">/v1</code>；需保证部署 MTC
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

        <ProbeStatus lastProbe={lastProbe} />

        <div className="flex flex-wrap gap-3 mt-6">
          <button
            type="button"
            onClick={runProbe}
            disabled={probing}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium',
              'bg-slate-100 text-slate-800 border border-slate-200 hover:bg-slate-200',
              'disabled:opacity-50 cursor-pointer',
            )}
          >
            {probing ? <Loader2 size={16} className="animate-spin" /> : <Activity size={16} />}
            {probing ? '检测中...' : '检测连通并拉取模型'}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className={cn(
              'inline-flex items-center gap-2 px-5 py-2.5 bg-jade-500 text-white rounded-xl font-medium text-sm',
              'hover:bg-jade-600 shadow-jade transition-colors cursor-pointer',
            )}
          >
            <ListChecks size={16} />
            保存配置
          </button>
        </div>
      </div>
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
      <label className="block text-sm font-medium text-slate-700 mb-1.5">模型</label>
      {fetchedModels.length > 0 ? (
        <select
          value={fetchedModels.includes(value) ? value : fetchedModels[0]}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2.5 border border-warm-200 rounded-xl bg-warm-50 text-sm outline-none focus:ring-2 focus:ring-jade-400"
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
          className="w-full px-3 py-2.5 border border-warm-200 rounded-xl focus:ring-2 focus:ring-jade-400 outline-none bg-warm-50 text-sm"
        />
      )}
      {recommendedModels && recommendedModels.length > 0 && (
        <div className="mt-2">
          <p className="text-xs text-slate-500 mb-1.5">推荐模型（以厂商控制台为准）：</p>
          <div className="flex flex-wrap gap-1.5">
            {recommendedModels.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onChange(m)}
                className={cn(
                  'px-2 py-0.5 rounded-md text-xs border transition-colors max-w-full truncate cursor-pointer',
                  value === m
                    ? 'bg-jade-100 border-jade-300 text-jade-800'
                    : 'bg-white border-warm-200 text-slate-600 hover:border-jade-200',
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
      <p className="text-xs text-slate-400 mt-4 flex items-center gap-1">
        <Activity size={12} />
        尚未执行检测；可点击「检测连通并拉取模型」验证端口与 /v1/models 或 Ollama /api/tags
      </p>
    )
  }
  return (
    <div
      className={cn(
        'mt-4 rounded-xl border px-3 py-2.5 text-sm flex flex-wrap items-center gap-2',
        lastProbe.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900',
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
