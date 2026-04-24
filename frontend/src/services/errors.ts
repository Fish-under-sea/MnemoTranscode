/**
 * 后端错误响应的标准信封（对齐 E middleware/exception_handlers）。
 *
 * E 产出的结构：
 *   {
 *     error_code: "AUTH_UNAUTHORIZED" | "VALIDATION_FAILED" | "HTTP_400" | ...,
 *     message: string,          // 后端中文可读消息
 *     fields?: string[],        // 出错字段名数组（VALIDATION_FAILED 时）
 *     request_id?: string       // 排障用
 *   }
 *
 * B 侧扩展 http_status 便于前端分类。
 */
export interface ApiError {
  error_code: string
  message: string
  fields?: string[]
  request_id?: string
  http_status: number
  /** @deprecated 仅为兼容旧代码；新代码请用 message。将在子项目 D 移除。 */
  detail?: string
}

export function isApiError(value: unknown): value is ApiError {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.error_code === 'string' &&
    typeof v.message === 'string' &&
    typeof v.http_status === 'number'
  )
}

// 对齐 E 的 STATUS_TO_CODE_FALLBACK（backend/app/api/middleware/exception_handlers.py）
const STATUS_TO_CODE_FALLBACK: Record<number, string> = {
  400: 'HTTP_400',
  401: 'AUTH_UNAUTHORIZED',
  403: 'AUTH_FORBIDDEN',
  404: 'RESOURCE_NOT_FOUND',
  405: 'VALIDATION_METHOD_NOT_ALLOWED',
  409: 'RESOURCE_CONFLICT',
  422: 'VALIDATION_FAILED',
  429: 'RATE_LIMIT_EXCEEDED',
  500: 'INTERNAL_SERVER_ERROR',
  503: 'SERVICE_UNAVAILABLE',
}

export function inferFromStatus(status: number | undefined): string {
  if (status === undefined || status === 0) return 'NETWORK_ERROR'
  return STATUS_TO_CODE_FALLBACK[status] ?? `HTTP_${status}`
}

const WHITELIST_FALLBACK: Record<string, string> = {
  AUTH_UNAUTHORIZED: '请先登录',
  AUTH_FORBIDDEN: '无权限执行此操作',
  RESOURCE_NOT_FOUND: '资源不存在',
  RESOURCE_CONFLICT: '资源冲突，请刷新后重试',
  VALIDATION_METHOD_NOT_ALLOWED: '请求方式不被允许',
  RATE_LIMIT_EXCEEDED: '请求过于频繁，请稍后再试',
  INTERNAL_SERVER_ERROR: '服务暂时不可用，请稍后再试',
  SERVICE_UNAVAILABLE: '服务暂时不可用，请稍后再试',
  NETWORK_ERROR: '网络连接异常，请检查网络',
}

const FORCE_FALLBACK_CODES = new Set(['INTERNAL_SERVER_ERROR', 'SERVICE_UNAVAILABLE', 'NETWORK_ERROR'])

export function mapErrorToMessage(err: ApiError): string {
  if (err.error_code === 'VALIDATION_FAILED' && err.fields && err.fields.length > 0) {
    return `「${err.fields.join('、')}」字段校验失败`
  }

  if (FORCE_FALLBACK_CODES.has(err.error_code)) {
    return WHITELIST_FALLBACK[err.error_code] ?? '操作失败'
  }

  if (err.message && !isLowQualityMessage(err.message)) {
    return err.message
  }

  return WHITELIST_FALLBACK[err.error_code] ?? err.message ?? '操作失败'
}

function isLowQualityMessage(msg: string): boolean {
  const techPatterns = [
    /^(Unprocessable|Internal|Bad|Not Found|Unauthorized|Forbidden|Conflict)/i,
    /^Exception:/i,
    /Traceback/i,
    /^\{.*\}$/,
  ]
  return techPatterns.some((p) => p.test(msg.trim()))
}
