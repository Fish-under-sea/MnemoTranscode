/**
 * 国家记忆条线 · 可操作白边药丸（与液态玻璃底板视觉分离）
 */
import { Layers } from 'lucide-react'
import {
  nationalCapsuleControlButtonClass,
  nationalCapsuleToolbarButtonClass,
  nationalCapsuleLayersSizeControl,
} from '@/lib/nationalMemoryCapsuleClasses'
import { cn } from '@/lib/utils'
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

export interface NationalMemoryCapsuleButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean
  /** 不传则 Layers；需在 density=toolbar 时自行给 Lucide icon 设置 size≈14 */
  icon?: ReactNode
  density?: 'control' | 'toolbar'
}

const NationalMemoryCapsuleButton = forwardRef<HTMLButtonElement, NationalMemoryCapsuleButtonProps>(
  function NationalMemoryCapsuleButton(
    { className, children, loading, disabled, type = 'button', icon, density = 'control', ...rest },
    ref,
  ) {
    const isToolbar = density === 'toolbar'
    const layersPx = nationalCapsuleLayersSizeControl()

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={cn(
          isToolbar ? nationalCapsuleToolbarButtonClass() : nationalCapsuleControlButtonClass(),
          className,
        )}
        {...rest}
      >
        {loading ?
          <span
            className="inline-block h-4 w-4 shrink-0 rounded-full border-2 border-current border-t-transparent animate-spin opacity-90"
            aria-hidden
          />
        : icon ?
          icon
        : <Layers size={isToolbar ? 14 : layersPx} className="shrink-0 opacity-90" aria-hidden />}
        <span>{children}</span>
      </button>
    )
  },
)

NationalMemoryCapsuleButton.displayName = 'NationalMemoryCapsuleButton'

export default NationalMemoryCapsuleButton
