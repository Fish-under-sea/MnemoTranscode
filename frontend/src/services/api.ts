/**
 * API 服务层
 */
import axios, { type AxiosError } from 'axios'
import { useAuthStore } from '@/hooks/useAuthStore'
import type { ClientLlmPayload } from '@/lib/buildClientLlmPayload'
import { inferFromStatus, isApiError, type ApiError } from './errors'

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

// 请求拦截器：从 localStorage 直接读取 token；FormData 必须去掉默认 JSON Content-Type 以便带上 multipart boundary
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('mtc-token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  if (config.data instanceof FormData) {
    config.headers.delete('Content-Type')
  }
  return config
})

// 响应拦截器：1) 解包 data；2) 标准化错误；3) 401 清本地登录态
api.interceptors.response.use(
  (response) => response.data,
  (error: AxiosError) => {
    const status = error.response?.status ?? 0
    const body = (error.response?.data ?? {}) as Record<string, unknown>

    // FastAPI 默认 422 为 { detail: [ { loc, msg, type }, ... ] }，无 message/fields
    let fromDetail: { fields: string[]; firstMsg: string } | null = null
    if (status === 422 && Array.isArray(body.detail)) {
      const fields = new Set<string>()
      const lines: string[] = []
      for (const part of body.detail) {
        if (part && typeof part === 'object' && 'loc' in (part as object)) {
          const loc = (part as { loc: unknown; msg?: string }).loc
          const msg = (part as { msg?: string }).msg
          if (Array.isArray(loc) && loc.length > 0) {
            fields.add(String(loc[loc.length - 1]))
          }
          if (typeof msg === 'string' && msg) lines.push(msg)
        }
      }
      if (fields.size > 0 || lines.length > 0) {
        fromDetail = { fields: [...fields].sort(), firstMsg: lines[0] ?? '请求参数校验失败' }
      }
    }

    const message =
      (typeof body.message === 'string' && body.message) ||
      (typeof body.detail === 'string' && body.detail) ||
      (fromDetail?.firstMsg && `请求参数校验失败：${fromDetail.firstMsg}`) ||
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
      fields: Array.isArray(body.fields)
        ? (body.fields as string[])
        : fromDetail?.fields
          ? fromDetail.fields
          : undefined,
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

  updateMe: (data: {
    username?: string
    subscription_tier?: 'free' | 'pro' | 'enterprise'
  }) => api.patch('/auth/me', data),

  uploadAvatar: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post('/auth/avatar', form, { timeout: 120_000 })
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
      /**
       * 关系状态。优先传后端原语 active / passed / other…；
       * 旧枚举 alive / deceased / unknown 由后端也支持归一化。
       */
      status?: 'active' | 'passed' | 'distant' | 'pet' | 'other' | 'alive' | 'deceased' | 'unknown'
      end_year?: number
      bio?: string
    },
  ) => {
    const n = Math.trunc(Number(archiveId))
    if (!Number.isInteger(n) || n < 1) {
      return Promise.reject(
        new Error('INVALID_ARCHIVE_ID_IN_PATH: 请从档案库重新进入当前档案页面'),
      )
    }
    return api.post(`/archives/${n}/members`, data)
  },

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

  uploadMemberAvatar: (archiveId: number, memberId: number, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post<
      Record<string, unknown>,
      Record<string, unknown>
    >(`/archives/${archiveId}/members/${memberId}/avatar`, form, { timeout: 120_000 })
  },

  deleteMemberAvatar: (archiveId: number, memberId: number) =>
    api.delete<
      Record<string, unknown>,
      Record<string, unknown>
    >(`/archives/${archiveId}/members/${memberId}/avatar`),
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

  importChat: (data: {
    member_id: number
    raw_text: string
    source?: 'auto' | 'wechat' | 'plain'
    build_graph?: boolean
  }) =>
    api.post<
      { created_count: number; memory_ids: number[]; graph_temporal_edges: number; graph_llm_edges: number },
      { created_count: number; memory_ids: number[]; graph_temporal_edges: number; graph_llm_edges: number }
    >('/memories/import-chat', data),

  extractFromConversation: (data: {
    member_id: number
    messages: { role: string; content: string }[]
    build_graph?: boolean
  }) =>
    api.post<
      { created_count: number; memory_ids: number[]; graph_temporal_edges: number; graph_llm_edges: number },
      { created_count: number; memory_ids: number[]; graph_temporal_edges: number; graph_llm_edges: number }
    >('/memories/extract-from-conversation', data),

  mnemoGraph: (memberId: number) =>
    api.get<
      { member_id: number; nodes: unknown[]; edges: unknown[] },
      { member_id: number; nodes: unknown[]; edges: unknown[] }
    >('/memories/mnemo-graph', {
      params: { member_id: memberId },
    }),
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
    /** 与模型设置对齐；提供则服务端优先于其 LLM_* 环境变量 */
    client_llm?: ClientLlmPayload | null
    /** 本轮对话结束后提炼记忆并写入链式图 */
    extract_memories_after?: boolean
  }) =>
    api.post<{
      reply: string
      mnemo_mode?: boolean
      session_id?: string
      memories_created?: number
    }>('/dialogue/chat', data, {
      timeout: 90_000,
    }),

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

// ========== LLM 端点探测（连通性 + 模型列表，需登录）==========

export const llmProbeApi = {
  check: (body: {
    mode: 'openai' | 'ollama' | 'google' | 'anthropic' | 'zhipu'
    base_url: string
    api_key?: string | null
  }) =>
    api.post('/llm-probe/check', body) as Promise<{
      ok: boolean
      latency_ms: number | null
      error: string | null
      models: string[]
    }>,
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
    app_background_url?: string | null
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

  /**
   * 切换方案。部分环境对 /api/v1/auth/subscription 的 POST/PATCH/PUT 整段 405，但 GET 仍可用。
   * 故优先：PATCH /auth/me 写 subscription_tier → 再 GET /auth/subscription 拉齐用量；
   * 回退：POST /auth/billing/apply-tier（路径不含 subscription）；再旧链路与 /usage/…。
   */
  updateTier: async (tier: 'free' | 'pro' | 'enterprise') => {
    const body = { tier }
    const afterPatchMe = async () => {
      await api.patch('/auth/me', { subscription_tier: tier })
      return api.get('/auth/subscription') as Promise<Record<string, unknown>>
    }
    const attempts = [
      afterPatchMe,
      () => api.post('/auth/billing/apply-tier', body),
      () => api.post('/auth/subscription', body),
      () => api.post('/usage/subscription-tier', body),
      () => api.patch('/auth/subscription', body),
      () => api.put('/auth/subscription', body),
    ]
    let last: unknown
    for (const run of attempts) {
      try {
        return await run()
      } catch (e: unknown) {
        last = e
        if (isApiError(e) && (e.http_status === 404 || e.http_status === 405)) continue
        throw e
      }
    }
    throw last
  },
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

export interface UploadDirectResponse {
  media_id: number
  object_key: string
  upload_id: string
  status: string
}

export const mediaApi = {
  initUpload: (data: UploadInitRequest): Promise<UploadInitResponse> =>
    api.post('/media/uploads/init', data),

  completeUpload: (data: UploadCompleteRequest): Promise<UploadCompleteResponse> =>
    api.post('/media/uploads/complete', data),

  /** 经 API 一次 multipart 上传到 MinIO（相册/媒体，避免浏览器直连预签名 URL） */
  uploadDirect: (
    data: {
      file: File
      purpose: MediaPurpose
      archive_id?: number
      member_id?: number
    },
    onProgress?: (percent: number) => void,
  ): Promise<UploadDirectResponse> => {
    const form = new FormData()
    form.append('file', data.file)
    form.append('purpose', data.purpose)
    if (data.archive_id != null) form.append('archive_id', String(data.archive_id))
    if (data.member_id != null) form.append('member_id', String(data.member_id))
    return api.post<UploadDirectResponse, UploadDirectResponse>('/media/uploads/direct', form, {
      timeout: 300_000,
      onUploadProgress: (e) => {
        if (e.total && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100))
        }
      },
    })
  },

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
    timeout: 300_000,
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
  member_id?: number
  title: string
  unlock_date: string
  status: 'locked' | 'delivered'
  created_at?: string
  content?: string
  message?: string
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

  /** 使用当前账号登录密码未到时间也能解封 */
  forceUnlock: (id: number, password: string): Promise<CapsuleItem> =>
    api.post(`/capsules/${id}/force-unlock`, { password }),
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
    client_llm?: ClientLlmPayload | null
  }): Promise<StorybookResult> =>
    api.post('/storybook/generate', data, {
      timeout: 120_000,
    }),
}

export type { Memory } from './memoryTypes'

export default api
