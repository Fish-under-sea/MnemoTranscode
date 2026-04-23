/**
 * KouriChat 启动弹窗组件
 *
 * 提供两种使用方式：
 * 1. 在浏览器中直接启动 Web 配置界面（iframe 嵌入）
 * 2. 复制本地运行命令
 */
import { useState, useEffect, useCallback } from 'react'
import { MessageCircle, X, ExternalLink, Terminal, RefreshCw, Play, Square, Copy, CheckCircle, AlertCircle } from 'lucide-react'
import { kourichatApi } from '@/services/api'

type Status = 'stopped' | 'starting' | 'running'
type Tab = 'web' | 'desktop'

interface StatusInfo {
  status: Status
  url: string | null
  port: number
  pid: number | null
}

interface StartResponse {
  status: string
  url: string
  port: number
  message: string
}

interface ApiStatusResponse {
  status: string
  url: string | null
  port: number
  pid: number | null
}

export default function KouriChatLaunchModal({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<Tab>('web')
  const [status, setStatus] = useState<StatusInfo>({ status: 'stopped', url: null, port: 8502, pid: null })
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [iframeKey, setIframeKey] = useState(0)

  // 轮询状态
  const pollStatus = useCallback(async () => {
    try {
      const res = await kourichatApi.getStatus() as unknown as ApiStatusResponse
      setStatus({ status: res.status as Status, url: res.url, port: res.port, pid: res.pid })
      setError(null)
    } catch {
      // 忽略轮询错误
    }
  }, [])

  // 启动 Web 界面
  const handleStart = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await kourichatApi.start() as unknown as StartResponse
      setStatus({ status: res.status as Status, url: res.url, port: res.port, pid: null })
    } catch (err: any) {
      setError(err?.detail || '启动失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  // 停止 Web 界面
  const handleStop = async () => {
    setLoading(true)
    try {
      await kourichatApi.stop()
      setStatus({ status: 'stopped', url: null, port: 8502, pid: null })
    } catch {
      setError('停止失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  // 复制命令
  const handleCopy = () => {
    navigator.clipboard.writeText('cd kourichat && python run.py')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // 刷新 iframe
  const handleRefresh = () => {
    setIframeKey(k => k + 1)
  }

  // Web 模式下自动轮询状态
  useEffect(() => {
    if (activeTab !== 'web') return
    pollStatus()
    const interval = setInterval(pollStatus, 3000)
    return () => clearInterval(interval)
  }, [activeTab, pollStatus])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 遮罩 */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* 弹窗 */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
              <MessageCircle size={22} className="text-green-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">KouriChat</h2>
              <p className="text-xs text-gray-500">微信 AI 助手</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Tab 切换 */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setActiveTab('web')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'web'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Web 配置界面
          </button>
          <button
            onClick={() => setActiveTab('desktop')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'desktop'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            桌面机器人
          </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto">
          {/* ===== Web 界面 Tab ===== */}
          {activeTab === 'web' && (
            <div className="p-6">
              <p className="text-sm text-gray-500 mb-5 leading-relaxed">
                在浏览器中运行 KouriChat Web 配置界面。
                可管理机器人配置、查看实时日志、设置人设和定时任务。
              </p>

              {/* 状态指示 */}
              <div className="flex items-center gap-2 mb-5">
                <div className={`w-2.5 h-2.5 rounded-full ${
                  status.status === 'running' ? 'bg-green-500 animate-pulse' :
                  status.status === 'starting' ? 'bg-yellow-500 animate-pulse' :
                  'bg-gray-300'
                }`} />
                <span className="text-sm font-medium text-gray-700">
                  {status.status === 'running' ? '运行中' :
                   status.status === 'starting' ? '启动中...' :
                   '已停止'}
                </span>
                {status.status === 'running' && status.url && (
                  <span className="text-xs text-gray-400 ml-1">{status.url}</span>
                )}
              </div>

              {/* 错误提示 */}
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl mb-5">
                  <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              {/* iframe 展示区 */}
              {status.status === 'running' && status.url ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500">Web 界面</span>
                    <div className="flex items-center gap-2">
                      <a
                        href={status.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
                      >
                        <ExternalLink size={12} />
                        新窗口打开
                      </a>
                      <button
                        onClick={handleRefresh}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                      >
                        <RefreshCw size={12} />
                        刷新
                      </button>
                    </div>
                  </div>
                  <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50" style={{ height: '400px' }}>
                    <iframe
                      key={iframeKey}
                      src={status.url}
                      className="w-full h-full"
                      title="KouriChat Web"
                      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                    />
                  </div>
                  <button
                    onClick={handleStop}
                    disabled={loading}
                    className="w-full py-2.5 px-4 bg-red-50 text-red-600 rounded-xl font-medium text-sm hover:bg-red-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Square size={14} />
                    停止服务
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <button
                    onClick={handleStart}
                    disabled={loading}
                    className="w-full py-3 px-4 bg-primary-600 text-white rounded-xl font-semibold text-sm hover:bg-primary-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        启动中...
                      </>
                    ) : (
                      <>
                        <Play size={16} />
                        启动 Web 配置界面
                      </>
                    )}
                  </button>
                  <p className="text-xs text-center text-gray-400">
                    启动后将在下方自动加载 Web 界面
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ===== 桌面机器人 Tab ===== */}
          {activeTab === 'desktop' && (
            <div className="p-6">
              <p className="text-sm text-gray-500 mb-5 leading-relaxed">
                在本地 Windows 电脑上运行 KouriChat 桌面机器人。
                需要已安装 Python 3.10+ 和微信电脑版。
              </p>

              {/* 前置条件 */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
                <h4 className="text-sm font-semibold text-amber-800 mb-2">前置要求</h4>
                <ul className="text-xs text-amber-700 space-y-1">
                  <li>1. Windows 10/11 系统</li>
                  <li>2. Python 3.10 或更高版本</li>
                  <li>3. 微信电脑版已登录</li>
                  <li>4. 在 KouriChat 目录中运行过 pip install -r requirements.txt</li>
                </ul>
              </div>

              {/* 命令展示 */}
              <div className="bg-gray-900 rounded-xl p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Terminal size={14} className="text-gray-400" />
                    <span className="text-xs text-gray-500">终端命令</span>
                  </div>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors"
                  >
                    {copied ? <CheckCircle size={12} className="text-green-400" /> : <Copy size={12} />}
                    {copied ? '已复制' : '复制'}
                  </button>
                </div>
                <pre className="text-sm text-green-400 font-mono select-all">
                  cd kourichat{'\n'}python run.py
                </pre>
              </div>

              {/* Web 方式快捷入口 */}
              <div className="border border-gray-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <MessageCircle size={16} className="text-gray-500" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-gray-900 mb-1">不想用命令行？</h4>
                    <p className="text-xs text-gray-500 mb-3">
                      试试 Web 配置界面，在浏览器中点点鼠标就能管理机器人。
                    </p>
                    <button
                      onClick={() => setActiveTab('web')}
                      className="text-xs text-primary-600 font-medium hover:text-primary-700"
                    >
                      切换到 Web 配置界面 →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
