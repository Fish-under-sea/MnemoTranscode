/**
 * 普卢奇克情绪轮 SVG — 中心留白、环间/瓣间白缝、瓣尖小三角复合情绪（对齐参考图）
 */
import { useId, useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  EMOTION_BY_VALUE,
  PLUTCHIK_EMOTIONS,
  type EmotionFamily,
  type PlutchikEmotion,
} from '@/lib/plutchikEmotions'

const SECTOR_FAMILIES: EmotionFamily[] = [
  'joy',
  'trust',
  'fear',
  'surprise',
  'sadness',
  'disgust',
  'anger',
  'anticipation',
]

const DYAD_VALUES = [
  'dyad_love',
  'dyad_submission',
  'dyad_awe',
  'dyad_disapproval',
  'dyad_remorse',
  'dyad_contempt',
  'dyad_aggression',
  'dyad_optimism',
] as const

/** 内(强) → 外(弱) */
const PETAL_FILLS: Record<EmotionFamily, [string, string, string]> = {
  joy: ['#FFC107', '#FFE082', '#FFF9C4'],
  trust: ['#7CB342', '#AED581', '#DCEDC8'],
  fear: ['#00897B', '#4DB6AC', '#B2DFDB'],
  surprise: ['#29B6F6', '#81D4FA', '#E1F5FE'],
  sadness: ['#1565C0', '#64B5F6', '#BBDEFB'],
  disgust: ['#8E24AA', '#BA68C8', '#E1BEE7'],
  anger: ['#E53935', '#EF9A9A', '#FFCDD2'],
  anticipation: ['#FB8C00', '#FFCC80', '#FFE0B2'],
}

const DYAD_FILLS = [
  '#F5F8E8',
  '#EFF6E8',
  '#E8F6F4',
  '#E8F4FC',
  '#ECEEF8',
  '#F5EDF8',
  '#FDECF0',
  '#FFF9E8',
] as const

const VIEW = 500
const CX = VIEW / 2
const CY = VIEW / 2

/** 中心圆孔（内瓣在内沿汇合，不挤成一点） */
const R_HOLE = 24
const RING_SLIT = 3.5
const R1 = 62
const R2 = 122
const R3 = 176
const R_TIP = 198

const INNER_HALF = 5.4
const MID_HALF = 10.2
const OUTER_HALF = 13.6
/** 瓣与瓣之间的角向缝隙（度） */
const PETAL_GAP = 2.4
/** 描边 = 视觉上的白缝 */
const STROKE = '#ffffff'
const STROKE_W = 3.2
const TEXT = '#3d3d3d'

function polar(r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) }
}

function spokeMid(index: number) {
  return -90 + index * 45
}

function intensitiesForFamily(family: EmotionFamily): PlutchikEmotion[] {
  return PLUTCHIK_EMOTIONS.filter((e) => e.family === family && e.tier === 'intensity').sort(
    (a, b) => b.intensity - a.intensity,
  )
}

/** 环扇形：内外弧 + 两侧直边 */
function annulusSector(rInner: number, rOuter: number, mid: number, half: number) {
  const gap = PETAL_GAP / 2
  const a0 = mid - half + gap
  const a1 = mid + half - gap
  const large = a1 - a0 > 180 ? 1 : 0
  const o0 = polar(rOuter, a0)
  const o1 = polar(rOuter, a1)
  const i1 = polar(rInner, a1)
  const i0 = polar(rInner, a0)
  return [
    `M ${o0.x} ${o0.y}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${o1.x} ${o1.y}`,
    `L ${i1.x} ${i1.y}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${i0.x} ${i0.y}`,
    'Z',
  ].join(' ')
}

/** 内环：尖楔，内沿为圆孔弧 */
function innerWedgePath(mid: number) {
  const gap = PETAL_GAP / 2
  const a0 = mid - INNER_HALF + gap
  const a1 = mid + INNER_HALF - gap
  const large = a1 - a0 > 180 ? 1 : 0
  const h0 = polar(R_HOLE, a0)
  const h1 = polar(R_HOLE, a1)
  const o1 = polar(R1, a1)
  const o0 = polar(R1, a0)
  return [
    `M ${h0.x} ${h0.y}`,
    `A ${R_HOLE} ${R_HOLE} 0 ${large} 1 ${h1.x} ${h1.y}`,
    `L ${o1.x} ${o1.y}`,
    `A ${R1} ${R1} 0 ${large} 0 ${o0.x} ${o0.y}`,
    'Z',
  ].join(' ')
}

/** 瓣尖小三角（复合情绪），非大块八角填角 */
function dyadCapPath(afterSpokeIndex: number) {
  const bisect = spokeMid(afterSpokeIndex) + 22.5
  const capHalf = 4.8
  const tip = polar(R_TIP, bisect)
  const b0 = polar(R3 - 2, bisect - capHalf)
  const b1 = polar(R3 - 2, bisect + capHalf)
  return `M ${tip.x} ${tip.y} L ${b0.x} ${b0.y} L ${b1.x} ${b1.y} Z`
}

type WheelRegion = {
  key: string
  d: string
  fill: string
  label: string
  emotion: PlutchikEmotion
  labelMid: number
  labelR: number
  labelMode: 'upright' | 'radial'
  fontSize: number
}

function buildRegions(): WheelRegion[] {
  const regions: WheelRegion[] = []
  const rMidIn = R1 + RING_SLIT
  const rOutIn = R2 + RING_SLIT

  SECTOR_FAMILIES.forEach((family, i) => {
    const mid = spokeMid(i)
    const levels = intensitiesForFamily(family)
    const fills = PETAL_FILLS[family]

    const specs: Omit<WheelRegion, 'key' | 'fill' | 'label' | 'emotion'>[] = [
      {
        d: innerWedgePath(mid),
        labelMid: mid,
        labelR: (R_HOLE + R1) / 2,
        labelMode: 'upright',
        fontSize: 10,
      },
      {
        d: annulusSector(rMidIn, R2, mid, MID_HALF),
        labelMid: mid,
        labelR: (rMidIn + R2) / 2,
        labelMode: 'upright',
        fontSize: 11,
      },
      {
        d: annulusSector(rOutIn, R3, mid, OUTER_HALF),
        labelMid: mid,
        labelR: (rOutIn + R3) / 2,
        labelMode: 'radial',
        fontSize: 12,
      },
    ]

    levels.forEach((emo, ring) => {
      regions.push({
        ...specs[ring],
        key: emo.value,
        fill: fills[ring],
        label: emo.label,
        emotion: emo,
      })
    })
  })

  DYAD_VALUES.forEach((value, i) => {
    const emo = EMOTION_BY_VALUE[value]
    const bisect = spokeMid(i) + 22.5
    regions.push({
      key: emo.value,
      d: dyadCapPath(i),
      fill: DYAD_FILLS[i],
      label: emo.label,
      emotion: emo,
      labelMid: bisect,
      labelR: R_TIP - 6,
      labelMode: 'radial',
      fontSize: 11,
    })
  })

  return regions
}

function LabelText({
  mid,
  r,
  mode,
  fontSize,
  children,
  selected,
}: {
  mid: number
  r: number
  mode: 'upright' | 'radial'
  fontSize: number
  children: string
  selected: boolean
}) {
  const rot = mode === 'upright' ? -mid : 90
  return (
    <g transform={`translate(${CX},${CY}) rotate(${mid}) translate(${r},0) rotate(${rot})`}>
      <text
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={fontSize}
        fontWeight={selected ? 600 : 500}
        fill={TEXT}
        fontFamily="'Source Han Sans SC', 'Noto Sans SC', system-ui, sans-serif"
        style={{ pointerEvents: 'none' }}
      >
        {children}
      </text>
    </g>
  )
}

export interface PlutchikWheelDiagramProps {
  size?: number
  className?: string
  selectedValue?: string
  onSelect?: (emotion: PlutchikEmotion) => void
  interactive?: boolean
}

export default function PlutchikWheelDiagram({
  size = 440,
  className,
  selectedValue = '',
  onSelect,
  interactive = false,
}: PlutchikWheelDiagramProps) {
  const shadowId = useId().replace(/:/g, '')
  const regions = useMemo(() => buildRegions(), [])

  const handlePick = (emo: PlutchikEmotion) => {
    if (interactive && onSelect) onSelect(emo)
  }

  return (
    <svg
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      width={size}
      height={size}
      className={cn('mx-auto block max-w-full select-none', className)}
      role="img"
      aria-label="普卢奇克情绪轮"
    >
      <defs>
        <filter id={`pw-shadow-${shadowId}`} x="-12%" y="-12%" width="124%" height="124%">
          <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="#1a120b" floodOpacity="0.1" />
        </filter>
      </defs>

      {/* 底板白圆 */}
      <circle cx={CX} cy={CY} r={R_TIP + 4} fill="#ffffff" />

      <g filter={`url(#pw-shadow-${shadowId})`}>
        {regions.map((reg) => {
          const selected = selectedValue === reg.emotion.value
          const isDyad = reg.emotion.tier === 'dyad'
          return (
            <g
              key={reg.key}
              className={interactive ? 'cursor-pointer' : undefined}
              onClick={interactive ? () => handlePick(reg.emotion) : undefined}
              onKeyDown={
                interactive
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handlePick(reg.emotion)
                      }
                    }
                  : undefined
              }
              role={interactive ? 'button' : undefined}
              tabIndex={interactive ? 0 : undefined}
            >
              <path
                d={reg.d}
                fill={reg.fill}
                stroke={selected ? '#0d9488' : STROKE}
                strokeWidth={selected ? 3.5 : STROKE_W}
                strokeLinejoin="round"
                strokeLinecap="round"
                className={
                  interactive ? 'transition-[filter] hover:brightness-[1.04]' : undefined
                }
              />
              {!isDyad ? (
                <LabelText
                  mid={reg.labelMid}
                  r={reg.labelR}
                  mode={reg.labelMode}
                  fontSize={reg.fontSize}
                  selected={selected}
                >
                  {reg.label}
                </LabelText>
              ) : null}
            </g>
          )
        })}
      </g>

      {/* 复合情绪标签在瓣尖外侧 */}
      {regions
        .filter((r) => r.emotion.tier === 'dyad')
        .map((reg) => (
          <LabelText
            key={`${reg.key}-lbl`}
            mid={reg.labelMid}
            r={reg.labelR}
            mode="radial"
            fontSize={reg.fontSize}
            selected={selectedValue === reg.emotion.value}
          >
            {reg.label}
          </LabelText>
        ))}

      {/* 中心圆孔（盖住内瓣交汇） */}
      <circle cx={CX} cy={CY} r={R_HOLE} fill="#ffffff" stroke={STROKE} strokeWidth={STROKE_W} />
    </svg>
  )
}
