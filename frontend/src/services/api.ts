/**
 * API 服务层
 * 封装所有后端 API 调用
 */
import axios from 'axios'
import { useAuthStore } from '@/stores/authStore'

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求拦截器：自动附加 Token
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截器：统一错误处理
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    return Promise.reject(error.response?.data || error)
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

  // 成员管理
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

export default api
