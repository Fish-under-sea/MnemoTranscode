/**
 * API 服务层
 */
import axios from 'axios'
import { useAuthStore } from '@/hooks/useAuthStore'

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求拦截器：从 localStorage 直接读取 token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('mtc-token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截器：401 时清除本地登录状态并跳转首页
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      const store = useAuthStore.getState()
      store.clearAuth()
      // 401 时返回首页（落地页），而非强制跳转登录页
      if (window.location.pathname !== '/' && !window.location.pathname.includes('/login') && !window.location.pathname.includes('/register')) {
        window.location.href = '/'
      }
    }
    if (error.response?.data?.detail) {
      error.detail = error.response.data.detail
    }
    return Promise.reject(error)
  }
)

// ========== 认证相关 ==========

export const authApi = {
  register: (data: { email: string; username: string; password: string }) =>
    api.post('/auth/register', data),

  login: (email: string, password: string) =>
    api.post('/auth/login', new URLSearchParams({ username: email, password }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }),

  getMe: () => api.get('/auth/me'),

  updateMe: (data: { username?: string }) => api.patch('/auth/me', data),

  uploadAvatar: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post('/auth/avatar', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  deleteAvatar: () => api.delete('/auth/avatar'),
}

// ========== 档案相关 ==========

export const archiveApi = {
  list: (archiveType?: string) =>
    api.get('/archives', { params: archiveType ? { archive_type: archiveType } : {} }),

  get: (id: number) => api.get(`/archives/${id}`),

  create: (data: { name: string; description?: string; archive_type: string }) =>
    api.post('/archives', data),

  update: (id: number, data: { name?: string; description?: string }) =>
    api.patch(`/archives/${id}`, data),

  delete: (id: number) => api.delete(`/archives/${id}`),

  createMember: (archiveId: number, data: {
    name: string; relationship_type: string; birth_year?: number; death_year?: number; bio?: string
  }) => api.post(`/archives/${archiveId}/members`, data),

  listMembers: (archiveId: number) =>
    api.get(`/archives/${archiveId}/members`),

  getMember: (archiveId: number, memberId: number) =>
    api.get(`/archives/${archiveId}/members/${memberId}`),

  updateMember: (archiveId: number, memberId: number, data: object) =>
    api.patch(`/archives/${archiveId}/members/${memberId}`, data),

  deleteMember: (archiveId: number, memberId: number) =>
    api.delete(`/archives/${archiveId}/members/${memberId}`),
}

// ========== 记忆相关 ==========

export const memoryApi = {
  create: (data: {
    member_id: number; title: string; content_text: string;
    timestamp?: string; location?: string; emotion_label?: string
  }) => api.post('/memories', data),

  list: (params?: {
    archive_id?: number; member_id?: number; emotion_label?: string; skip?: number; limit?: number
  }) => api.get('/memories', { params }),

  get: (id: number) => api.get(`/memories/${id}`),

  update: (id: number, data: object) => api.patch(`/memories/${id}`, data),

  delete: (id: number) => api.delete(`/memories/${id}`),

  search: (query: string, params?: {
    archive_id?: number; member_id?: number; limit?: number
  }) => api.post('/memories/search', { query, ...params }),
}

// ========== AI 对话相关 ==========

export const dialogueApi = {
  chat: (data: {
    message: string; archive_id?: number; member_id?: number;
    channel?: 'app' | 'wechat' | 'qq'; session_id?: string; history_limit?: number
  }) => api.post('/dialogue/chat', data),

  getHistory: (sessionId: string, params?: { archive_id?: number; member_id?: number; limit?: number }) =>
    api.post('/dialogue/history', { session_id: sessionId, ...params }),

  clearHistory: (sessionId: string) =>
    api.delete(`/dialogue/history/${sessionId}`),
}

// ========== KouriChat 相关 ==========

export const kourichatApi = {
  start: () => api.post('/kourichat/start'),

  stop: () => api.post('/kourichat/stop'),

  getStatus: () => api.get('/kourichat/status'),
}

// ========== 用量统计 ==========

export const usageApi = {
  getStats: () => api.get('/usage/stats'),

  getHistory: (params?: { page?: number; page_size?: number; action_type?: string }) =>
    api.get('/usage/history', { params }),

  getQuota: () => api.get('/usage/quota'),
}

// ========== 用户偏好 ==========

export const preferencesApi = {
  get: () => api.get('/preferences'),

  update: (data: {
    theme?: string; primary_color?: string; card_style?: string;
    font_size?: string; dashboard_layout?: string; custom_css?: string;
    ai_memory_sync?: string;
  }) => api.put('/preferences', data),
}

// ========== AI 记忆同步 ==========

export const aiMemoryApi = {
  get: () => api.get('/ai-memory'),

  update: (context: { summaries: object[]; last_updated?: string }) =>
    api.put('/ai-memory', { context }),

  clear: () => api.delete('/ai-memory'),
}

// ========== 订阅相关 ==========

export const subscriptionApi = {
  get: () => api.get('/auth/subscription'),
}

export default api
