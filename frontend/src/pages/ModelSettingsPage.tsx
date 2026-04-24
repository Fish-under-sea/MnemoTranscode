/**
 * 模型设置 — LLM / API 等与 AI 推理相关的配置（个人资料见个人中心）
 */
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Bot, Key } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function ModelSettingsPage() {
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [modelName, setModelName] = useState('')

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-jade-100 flex items-center justify-center text-jade-700">
          <Bot size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-display text-ink-primary">模型设置</h1>
          <p className="text-body-sm text-ink-secondary mt-0.5">
            配置对话与向量等能力使用的模型与密钥（账号与头像请在个人中心管理）
          </p>
        </div>
      </div>

      <div className="mt-8 bg-white rounded-2xl border border-warm-200 p-6 shadow-sm">
        <h2 className="font-semibold text-slate-900 mb-1 flex items-center gap-2">
          <Key size={18} className="text-jade-600" />
          API 与模型
        </h2>
        <p className="text-sm text-slate-500 mb-6">
          当前为本地演示表单；后续可对接服务端安全存储，请勿在公共环境粘贴真实密钥。
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">LLM API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              autoComplete="off"
              className="w-full px-3 py-2.5 border border-warm-200 rounded-xl focus:ring-2 focus:ring-jade-400 focus:border-jade-400 outline-none bg-warm-50 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">API Base URL</label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.openai.com/v1"
              className="w-full px-3 py-2.5 border border-warm-200 rounded-xl focus:ring-2 focus:ring-jade-400 focus:border-jade-400 outline-none bg-warm-50 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">模型名称（可选）</label>
            <input
              type="text"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="例如 gpt-4o"
              className="w-full px-3 py-2.5 border border-warm-200 rounded-xl focus:ring-2 focus:ring-jade-400 focus:border-jade-400 outline-none bg-warm-50 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => toast.success('已保存（演示）')}
            className={cn(
              'px-5 py-2.5 bg-jade-500 text-white rounded-xl font-medium text-sm',
              'hover:bg-jade-600 shadow-jade transition-colors cursor-pointer',
            )}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
