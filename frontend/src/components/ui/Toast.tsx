/**
 * Toast · 统一品牌样式的通知
 * 对应 docs/design-system.md §6.3
 * - 包一层 react-hot-toast（已装）
 * - 在应用根挂载 <ToastHost />
 * - 使用：import { toast } from '@/components/ui/Toast'
 */
import { Toaster, toast as hotToast, type ToastOptions } from 'react-hot-toast'
import { CheckCircle2, XCircle, Info, AlertTriangle } from 'lucide-react'
import type { ReactNode } from 'react'

const baseStyle: ToastOptions = {
  duration: 3200,
  style: {
    borderRadius: '14px',
    padding: '12px 16px',
    fontSize: '14px',
    fontFamily: '"Noto Sans SC", system-ui, sans-serif',
    background: 'var(--bg-surface)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-default)',
    boxShadow: '0 12px 32px rgba(var(--shadow-color), 0.12)',
  },
}

export const toast = {
  success: (msg: ReactNode) =>
    hotToast.success(String(msg), {
      ...baseStyle,
      icon: <CheckCircle2 size={18} className="text-emerald-500" />,
    }),
  error: (msg: ReactNode) =>
    hotToast.error(String(msg), {
      ...baseStyle,
      icon: <XCircle size={18} className="text-rose-500" />,
    }),
  info: (msg: ReactNode) =>
    hotToast(String(msg), { ...baseStyle, icon: <Info size={18} className="text-sky-500" /> }),
  warning: (msg: ReactNode) =>
    hotToast(String(msg), {
      ...baseStyle,
      icon: <AlertTriangle size={18} className="text-amber-500" />,
    }),
  loading: (msg: ReactNode) => hotToast.loading(String(msg), baseStyle),
  dismiss: (id?: string) => hotToast.dismiss(id),
}

export function ToastHost() {
  return <Toaster position="top-center" gutter={8} />
}
