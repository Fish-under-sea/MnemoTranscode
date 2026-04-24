import { useCallback } from 'react'
import toast from 'react-hot-toast'
import { isApiError, mapErrorToMessage, type ApiError } from '@/services/errors'

interface UseApiErrorReturn {
  /**
   * 弹 toast 提示错误。
   * @param err 错误对象（通常是 catch 到的 ApiError 或 unknown）
   * @param fallback 非 ApiError 时的默认消息
   */
  show: (err: unknown, fallback?: string) => void

  /**
   * 判断指定字段是否在 error.fields 数组中（用于表单错误高亮）。
   */
  hasFieldError: (err: unknown, field: string) => boolean

  /**
   * 获取 ApiError（若 err 是 ApiError 则返回，否则 null）。
   */
  asApiError: (err: unknown) => ApiError | null
}

export function useApiError(): UseApiErrorReturn {
  const show = useCallback((err: unknown, fallback = '操作失败') => {
    if (isApiError(err)) {
      toast.error(mapErrorToMessage(err))
      if (err.request_id && import.meta.env.DEV) {
        console.warn('[api-error]', err.error_code, err.request_id, err.message)
      }
      return
    }
    if (err instanceof Error && err.message) {
      toast.error(err.message)
      return
    }
    toast.error(fallback)
  }, [])

  const hasFieldError = useCallback((err: unknown, field: string) => {
    if (!isApiError(err)) return false
    return Array.isArray(err.fields) && err.fields.includes(field)
  }, [])

  const asApiError = useCallback((err: unknown) => (isApiError(err) ? err : null), [])

  return { show, hasFieldError, asApiError }
}
