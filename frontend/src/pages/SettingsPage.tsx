/**
 * 设置页面
 */
import { useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import toast from 'react-hot-toast'
import { User, Key, Bell, Palette } from 'lucide-react'

export default function SettingsPage() {
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState('profile')

  const tabs = [
    { id: 'profile', label: '个人资料', icon: User },
    { id: 'api', label: 'API 设置', icon: Key },
    { id: 'notifications', label: '通知', icon: Bell },
    { id: 'appearance', label: '外观', icon: Palette },
  ]

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">设置</h1>

      <div className="flex gap-8">
        {/* 侧边导航 */}
        <div className="w-48 flex-shrink-0">
          <nav className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-base text-left ${
                    activeTab === tab.id
                      ? 'bg-primary-50 text-primary-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>

        {/* 设置内容 */}
        <div className="flex-1 bg-white rounded-2xl border border-gray-200 p-6">
          {activeTab === 'profile' && (
            <div>
              <h2 className="font-medium text-gray-900 mb-4">个人资料</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
                  <input
                    type="text"
                    defaultValue={user?.username}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
                  <input
                    type="email"
                    defaultValue={user?.email}
                    disabled
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
                  />
                </div>
                <button
                  onClick={() => toast.success('资料已保存')}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-base"
                >
                  保存修改
                </button>
              </div>
            </div>
          )}

          {activeTab === 'api' && (
            <div>
              <h2 className="font-medium text-gray-900 mb-4">API 设置</h2>
              <p className="text-sm text-gray-500 mb-4">
                配置 AI 模型和向量数据库等服务的 API 密钥
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">LLM API Key</label>
                  <input
                    type="password"
                    placeholder="sk-..."
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">API Base URL</label>
                  <input
                    type="text"
                    placeholder="https://api.openai.com/v1"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
                <button
                  onClick={() => toast.success('API 设置已保存')}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-base"
                >
                  保存
                </button>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div>
              <h2 className="font-medium text-gray-900 mb-4">通知设置</h2>
              <p className="text-sm text-gray-500">通知功能开发中...</p>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div>
              <h2 className="font-medium text-gray-900 mb-4">外观设置</h2>
              <p className="text-sm text-gray-500">主题功能开发中...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
