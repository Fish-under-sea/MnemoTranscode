/**
 * API 服务层
 */
import axios, { type AxiosError } from 'axios'
import { useAuthStore } from '@/hooks/useAuthStore'
import { inferFromStatus, type ApiError } from './errors'

// ========== 认证响应类型（供 useAuthForm / 页面使用）==========

export interface AuthUser {
  id: number
  email: string
  username: string
  is_active?: boolean
  avatar_url?: string | null
  created_at: string
  last_active_at?: string | null
}

export interface AuthResponse {
  access_token: string
  token_type: 'bearer'
  user: AuthUser
}

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

// 响应拦截器：1) 解包 data；2) 标准化错误；3) 401 清本地登录态
api.interceptors.response.use(
  (response) => response.data,
  (error: AxiosError) => {
    const status = error.response?.status ?? 0
    const body = (error.response?.data ?? {}) as Record<string, unknown>

    const message =
      (typeof body.message === 'string' && body.message) ||
      (typeof body.detail === 'string' && body.detail) ||
      error.message ||
      '网络异常'

    const baseCode =
      (typeof body.error_code === 'string' && body.error_code) || inferFromStatus(status)

    const reqId =
      (typeof body.request_id === 'string' && body.request_id) ||
      (error.response?.headers['x-request-id'] as string | undefined)

    const apiError: ApiError = {
      error_code: baseCode,
      message,
      fields: Array.isArray(body.fields) ? (body.fields as string[]) : undefined,
      request_id: reqId,
      http_status: status,
      detail: (typeof body.detail === 'string' && body.detail) || message,
    }

    if (status === 401) {
      const store = useAuthStore.getState()
      store.clearAuth()
      const path = window.location.pathname
      const isWhitelisted = path === '/' || path.includes('/login') || path.includes('/register')
      if (!isWhitelisted) {
        window.location.href = '/'
      }
    }

    return Promise.reject(apiError)
  },
)

// ========== 认证相关 ==========

export const authApi = {
  register: (data: { email: string; username: string; password: string }): Promise<AuthResponse> =>
    api.post('/auth/register', data),

  login: (email: string, password: string): Promise<AuthResponse> =>
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

  createMember: (
    archiveId: number,
    data: {
      name: string
      relationship_type: string
      birth_year?: number
      /** 关系状态：alive=健在 / deceased=已离开 / unknown=未明示。 */
      status?: 'alive' | 'deceased' | 'unknown'
      /** 结束年份（status=deceased 时为辞世年；status=alive 时可空；对组织/关系可表示终止年） */
      end_year?: number
      bio?: string
    },
  ) => api.post(`/archives/${archiveId}/members`, data),

  listMembers: (archiveId: number) => api.get(`/archives/${archiveId}/members`),

  getMember: (archiveId: number, memberId: number) =>
    api.get(`/archives/${archiveId}/members/${memberId}`),

  updateMember: (
    archiveId: number,
    memberId: number,
    data: {
      name?: string
      relationship_type?: string
      birth_year?: number
      status?: 'alive' | 'deceased' | 'unknown'
      end_year?: number
      bio?: string
    },
  ) => api.patch(`/archives/${archiveId}/members/${memberId}`, data),

  deleteMember: (archiveId: number, memberId: number) =>
    api.delete(`/archives/${archiveId}/members/${memberId}`),
}

// ========== 记忆相关 ==========

export const memoryApi = {
  create: (data: {
    member_id: number
    title: string
    content_text: string
    timestamp?: string
    location?: string
    emotion_label?: string
  }) => api.post('/memories', data),

  list: (params?: {
    archive_id?: number
    member_id?: number
    emotion_label?: string
    skip?: number
    limit?: number
  }) => api.get('/memories', { params }),

  get: (id: number) => api.get(`/memories/${id}`),

  update: (id: number, data: object) => api.patch(`/memories/${id}`, data),

  delete: (id: number) => api.delete(`/memories/${id}`),

  search: (query: string, params?: { archive_id?: number; member_id?: number; limit?: number }) =>
    api.post('/memories/search', { query, ...params }),
}

// ========== AI 对话相关 ==========

export const dialogueApi = {
  chat: (data: {
    message: string
    archive_id?: number
    member_id?: number
    channel?: 'app' | 'wechat' | 'qq'
    session_id?: string
    history_limit?: number
  }) => api.post('/dialogue/chat', data),

  getHistory: (sessionId: string, params?: { archive_id?: number; member_id?: number; limit?: number }) =>
    api.post('/dialogue/history', { session_id: sessionId, ...params }),

  clearHistory: (sessionId: string) => api.delete(`/dialogue/history/${sessionId}`),
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
    theme?: string
    primary_color?: string
    card_style?: string
    font_size?: string
    dashboard_layout?: string
    custom_css?: string
    ai_memory_sync?: string
  }) => api.put('/preferences', data),
}

// ========== AI 记忆同步 ==========

export const aiMemoryApi = {
  get: () => api.get('/ai-memory'),

  update: (context: { summaries: object[]; last_updated?: string }) => api.put('/ai-memory', { context }),

  clear: () => api.delete('/ai-memory'),
}

// ========== 订阅相关 ==========

export const subscriptionApi = {
  get: () => api.get('/auth/subscription'),

  updateTier: (tier: 'free' | 'pro' | 'enterprise') =>
    api.patch('/auth/subscription', { tier }),
}

// ========== 媒体两阶段上传（C · M3）==========

export type MediaPurpose =
  | 'archive_photo'
  | 'archive_video'
  | 'archive_audio'
  | 'avatar'
  | 'voice_sample'
  | 'other'

export interface MediaAsset {
  id: number
  object_key: string
  bucket: string
  content_type: string
  size: number
  purpose: MediaPurpose | string
  archive_id?: number | null
  member_id?: number | null
  created_at: string
}

export interface UploadInitRequest {
  filename: string
  content_type: string
  size: number
  purpose: MediaPurpose
  archive_id?: number
  member_id?: number
}

export interface UploadInitResponse {
  upload_id: string
  object_key: string
  put_url: string
  expires_in: number
  required_headers: Record<string, string>
}

export interface UploadCompleteRequest {
  upload_id: string
  object_key: string
  size?: number
  etag?: string
}

export interface UploadCompleteResponse {
  media_id: number | null
  object_key: string
  status: string
}

export const mediaApi = {
  initUpload: (data: UploadInitRequest): Promise<UploadInitResponse> =>
    api.post('/media/uploads/init', data),

  completeUpload: (data: UploadCompleteRequest): Promise<UploadCompleteResponse> =>
    api.post('/media/uploads/complete', data),

  getDownloadUrl: (mediaId: number): Promise<{ get_url: string; expires_in: number }> =>
    api.get(`/media/${mediaId}/download-url`),

  list: (params: { archive_id?: number; member_id?: number; purpose?: MediaPurpose }): Promise<MediaAsset[]> =>
    api.get('/media/', { params }),
}

/**
 * 向 MinIO 预签 PUT URL 直传，不走 api 的 baseURL / 解包，避免 CORS/拦截器副作用。
 */
export async function uploadToPresignedUrl(
  putUrl: string,
  file: File,
  contentType: string,
  onProgress?: (percent: number) => void,
): Promise<void> {
  await axios.put(putUrl, file, {
    headers: { 'Content-Type': contentType },
    onUploadProgress: (e) => {
      if (e.total && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    },
  })
}

// ========== 记忆胶囊 ==========

export interface CapsuleItem {
  id: number
  member_id: number
  title: string
  unlock_date: string
  status: 'locked' | 'delivered'
  created_at: string
  content?: string
}

export const capsuleApi = {
  list: (params?: { member_id?: number }): Promise<CapsuleItem[]> =>
    api.get('/capsules', { params }),

  get: (id: number): Promise<CapsuleItem> =>
    api.get(`/capsules/${id}`),

  create: (data: {
    member_id: number
    title: string
    content: string
    unlock_date: string
  }): Promise<CapsuleItem> =>
    api.post('/capsules', null, {
      params: {
        member_id: data.member_id,
        title: data.title,
        content: data.content,
        unlock_date: data.unlock_date,
      },
    }),
}

// ========== 故事书 ==========

export interface StorybookResult {
  story: string
  archive_id: number
  member_id: number | null
  style: string
  memory_count: number
}

export const storybookApi = {
  generate: (data: {
    archive_id: number
    member_id?: number
    style?: string
  }): Promise<StorybookResult> =>
    api.post('/storybook/generate', null, {
      params: {
        archive_id: data.archive_id,
        ...(data.member_id !== undefined && { member_id: data.member_id }),
        ...(data.style !== undefined && { style: data.style }),
      },
    }),
}

export type { Memory } from './memoryTypes'

export default api
