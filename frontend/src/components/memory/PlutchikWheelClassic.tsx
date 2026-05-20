/**
 * 普卢奇克情绪轮 — 使用 public/emotion-wheel.png 贴图 + 标定热区高亮
 */
import { useCallback, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { PlutchikEmotion } from '@/lib/plutchikEmotions'
import {
  PLUTCHIK_CLASSIC_VIEW_H,
  PLUTCHIK_CLASSIC_VIEW_W,
  PLUTCHIK_WHEEL_IMAGE_SRC,
} from '@/lib/plutchikWheelClassicSpec'
import { buildPlutchikWheelRegions } from '@/lib/plutchikWheelRegions'
import { clientToWheel, hitTestPlutchikWheel } from '@/lib/plutchikWheelHitTest'

export interface PlutchikWheelClassicProps {
  size?: number
  className?: string
  selectedValue?: string
  onSelect?: (emotion: PlutchikEmotion) => void
  interactive?: boolean
}

export default function PlutchikWheelClassic({
  size = 480,
  className,
  selectedValue = '',
  onSelect,
  interactive = false,
}: PlutchikWheelClassicProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const regions = useMemo(() => buildPlutchikWheelRegions(), [])
  const activeValue = selectedValue || hovered || ''
  const displayH = Math.round(size * (PLUTCHIK_CLASSIC_VIEW_H / PLUTCHIK_CLASSIC_VIEW_W))

  const pickAt = useCallback(
    (clientX: number, clientY: number) => {
      if (!interactive || !svgRef.current) return
      const rect = svgRef.current.getBoundingClientRect()
      const pt = clientToWheel(clientX, clientY, rect, PLUTCHIK_CLASSIC_VIEW_W, PLUTCHIK_CLASSIC_VIEW_H)
      const hit = hitTestPlutchikWheel(pt.x, pt.y)
      if (hit) onSelect?.(hit)
    },
    [interactive, onSelect],
  )

  const hoverAt = useCallback(
    (clientX: number, clientY: number) => {
      if (!interactive || !svgRef.current) return
      const rect = svgRef.current.getBoundingClientRect()
      const pt = clientToWheel(clientX, clientY, rect, PLUTCHIK_CLASSIC_VIEW_W, PLUTCHIK_CLASSIC_VIEW_H)
      const hit = hitTestPlutchikWheel(pt.x, pt.y)
      setHovered(hit?.value ?? null)
    },
    [interactive],
  )

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${PLUTCHIK_CLASSIC_VIEW_W} ${PLUTCHIK_CLASSIC_VIEW_H}`}
      width={size}
      height={displayH}
      className={cn(
        'mx-auto block max-w-full select-none',
        interactive && 'cursor-pointer touch-none',
        className,
      )}
      role="img"
      aria-label="普卢奇克情绪轮"
      data-mtc-wheel="image"
      onClick={(e) => pickAt(e.clientX, e.clientY)}
      onMouseMove={(e) => hoverAt(e.clientX, e.clientY)}
      onMouseLeave={() => setHovered(null)}
    >
      <image
        href={PLUTCHIK_WHEEL_IMAGE_SRC}
        x={0}
        y={0}
        width={PLUTCHIK_CLASSIC_VIEW_W}
        height={PLUTCHIK_CLASSIC_VIEW_H}
        preserveAspectRatio="xMidYMid meet"
      />

      {interactive && activeValue
        ? regions
            .filter((reg) => reg.value === activeValue)
            .map((reg) => (
              <path
                key={reg.value}
                d={reg.d}
                fill="rgba(13, 148, 136, 0.36)"
                stroke="#0d9488"
                strokeWidth={3}
                strokeLinejoin="round"
                pointerEvents="none"
              />
            ))
        : null}
    </svg>
  )
}
