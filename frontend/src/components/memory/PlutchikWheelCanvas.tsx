/**
 * 普卢奇克情绪轮 — HTML Canvas 高精度渲染（devicePixelRatio）
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { PlutchikEmotion } from '@/lib/plutchikEmotions'
import {
  drawPlutchikWheel,
  hitTestWheel,
  type WheelHitRegion,
} from '@/lib/plutchikWheelCanvas'

export interface PlutchikWheelCanvasProps {
  size?: number
  className?: string
  selectedValue?: string
  onSelect?: (emotion: PlutchikEmotion) => void
  interactive?: boolean
}

export default function PlutchikWheelCanvas({
  size = 480,
  className,
  selectedValue = '',
  onSelect,
  interactive = false,
}: PlutchikWheelCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const regionsRef = useRef<WheelHitRegion[]>([])
  const [hovered, setHovered] = useState<string | null>(null)

  const paint = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = Math.min(window.devicePixelRatio || 1, 3)
    const logical = size
    canvas.width = Math.round(logical * dpr)
    canvas.height = Math.round(logical * dpr)
    canvas.style.width = `${logical}px`
    canvas.style.height = `${logical}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'

    const cx = logical / 2
    const cy = logical / 2
    const radius = logical * 0.46

    regionsRef.current = drawPlutchikWheel(ctx, {
      cx,
      cy,
      radius,
      selectedValue: selectedValue || hovered || '',
      collectHits: interactive,
    })
  }, [size, selectedValue, hovered, interactive])

  useEffect(() => {
    paint()
  }, [paint])

  const mapClientToLocal = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current
      if (!canvas) return null
      const rect = canvas.getBoundingClientRect()
      const scaleX = size / rect.width
      const scaleY = size / rect.height
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      }
    },
    [size],
  )

  const handlePointer = useCallback(
    (clientX: number, clientY: number) => {
      if (!interactive) return
      const pt = mapClientToLocal(clientX, clientY)
      if (!pt) return
      const ctx = canvasRef.current?.getContext('2d')
      if (!ctx) return
      const hit = hitTestWheel(ctx, regionsRef.current, pt.x, pt.y)
      if (hit) onSelect?.(hit)
    },
    [interactive, mapClientToLocal, onSelect],
  )

  return (
    <canvas
      ref={canvasRef}
      className={cn(
        'mx-auto block max-w-full touch-none',
        interactive && 'cursor-pointer',
        className,
      )}
      width={size}
      height={size}
      role="img"
      aria-label="普卢奇克情绪轮"
      data-mtc-wheel="canvas"
      onClick={(e) => handlePointer(e.clientX, e.clientY)}
      onMouseMove={(e) => {
        if (!interactive) return
        const pt = mapClientToLocal(e.clientX, e.clientY)
        if (!pt) return
        const ctx = canvasRef.current?.getContext('2d')
        const hit = ctx ? hitTestWheel(ctx, regionsRef.current, pt.x, pt.y) : null
        setHovered(hit?.value ?? null)
      }}
      onMouseLeave={() => setHovered(null)}
    />
  )
}
