/**
 * 普卢奇克情绪轮 — Canvas 绘制（对齐经典八瓣参考图）
 */
import {
  EMOTION_BY_VALUE,
  PLUTCHIK_EMOTIONS,
  type EmotionFamily,
  type PlutchikEmotion,
} from '@/lib/plutchikEmotions'

export const SECTOR_FAMILIES: EmotionFamily[] = [
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

/** 内环(强) → 外环(弱) */
const PETAL_FILLS: Record<EmotionFamily, [string, string, string]> = {
  joy: ['#FFC107', '#FFD54F', '#FFF9C4'],
  trust: ['#8BC34A', '#AED581', '#DCEDC8'],
  fear: ['#00897B', '#26A69A', '#B2DFDB'],
  surprise: ['#03A9F4', '#4FC3F7', '#E1F5FE'],
  sadness: ['#1E88E5', '#42A5F5', '#BBDEFB'],
  disgust: ['#8E24AA', '#AB47BC', '#E1BEE7'],
  anger: ['#E53935', '#EF5350', '#FFCDD2'],
  anticipation: ['#FB8C00', '#FFB74D', '#FFE0B2'],
}

const DYAD_FILLS = [
  '#F5F7E8',
  '#EEF5E6',
  '#E4F3F1',
  '#E3F2FD',
  '#E8EAF6',
  '#F3E5F5',
  '#FCE4EC',
  '#FFF8E1',
] as const

const GAP_DEG = 1.85
const RING_GAP = 3
const STROKE = '#ffffff'
const STROKE_W = 2.4
const TEXT = '#3a3a3a'
const FONT =
  '"Source Han Sans SC", "Noto Sans SC", "Microsoft YaHei", "PingFang SC", system-ui, sans-serif'

export type WheelHitRegion = {
  value: string
  emotion: PlutchikEmotion
  path: Path2D
}

export type DrawWheelOptions = {
  cx: number
  cy: number
  radius: number
  selectedValue?: string
  collectHits?: boolean
}

function deg2rad(d: number) {
  return ((d - 90) * Math.PI) / 180
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const a = deg2rad(deg)
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
}

/** 正上方为 0°（喜悦瓣） */
function spokeMid(i: number) {
  return i * 45
}

function intensitiesForFamily(family: EmotionFamily): PlutchikEmotion[] {
  return PLUTCHIK_EMOTIONS.filter((e) => e.family === family && e.tier === 'intensity').sort(
    (a, b) => b.intensity - a.intensity,
  )
}

function parseHex(hex: string) {
  const h = hex.replace('#', '')
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

function mixHex(hex: string, towardWhite: number) {
  const { r, g, b } = parseHex(hex)
  const m = (c: number) => Math.round(c + (255 - c) * towardWhite)
  return `rgb(${m(r)}, ${m(g)}, ${m(b)})`
}

function annulusPath(
  cx: number,
  cy: number,
  rIn: number,
  rOut: number,
  mid: number,
  half: number,
): Path2D {
  const g = GAP_DEG / 2
  const a0 = mid - half + g
  const a1 = mid + half - g
  const p = new Path2D()
  const s = deg2rad(a0)
  const e = deg2rad(a1)
  p.arc(cx, cy, rOut, s, e)
  p.arc(cx, cy, rIn, e, s, true)
  p.closePath()
  return p
}

/** 内环尖楔（内沿小圆孔） */
function innerWedgePath(
  cx: number,
  cy: number,
  mid: number,
  rCent: number,
  r1: number,
  half: number,
): Path2D {
  const g = GAP_DEG / 2
  const a0 = mid - half + g
  const a1 = mid + half - g
  const p = new Path2D()
  const h0 = polar(cx, cy, rCent, a0)
  const o1 = polar(cx, cy, r1, a1)
  p.moveTo(h0.x, h0.y)
  p.arc(cx, cy, rCent, deg2rad(a0), deg2rad(a1))
  p.lineTo(o1.x, o1.y)
  p.arc(cx, cy, r1, deg2rad(a1), deg2rad(a0), true)
  p.closePath()
  return p
}

/** 外环花瓣：外缘微鼓 */
function outerLeafPath(
  cx: number,
  cy: number,
  mid: number,
  rIn: number,
  rOut: number,
  half: number,
): Path2D {
  const g = GAP_DEG / 2
  const a0 = mid - half + g
  const a1 = mid + half - g
  const i0 = polar(cx, cy, rIn, a0)
  const i1 = polar(cx, cy, rIn, a1)
  const o0 = polar(cx, cy, rOut, a0)
  const o1 = polar(cx, cy, rOut, a1)
  const tip = polar(cx, cy, rOut * 1.04, mid)
  const p = new Path2D()
  p.moveTo(i0.x, i0.y)
  p.lineTo(o0.x, o0.y)
  p.quadraticCurveTo(tip.x, tip.y, o1.x, o1.y)
  p.lineTo(i1.x, i1.y)
  p.arc(cx, cy, rIn, deg2rad(a1), deg2rad(a0), true)
  p.closePath()
  return p
}

/** 瓣间复合情绪（八角外廓三角） */
function dyadWedgePath(
  cx: number,
  cy: number,
  rBase: number,
  rOut: number,
  afterSpoke: number,
  outerHalf: number,
): Path2D {
  const mid = spokeMid(afterSpoke)
  const midNext = spokeMid(afterSpoke + 1)
  const bisect = mid + 22.5
  const tip = polar(cx, cy, rOut, bisect)
  const left = polar(cx, cy, rBase, mid + outerHalf + GAP_DEG * 0.6)
  const right = polar(cx, cy, rBase, midNext - outerHalf - GAP_DEG * 0.6)
  const p = new Path2D()
  p.moveTo(tip.x, tip.y)
  p.lineTo(left.x, left.y)
  p.lineTo(right.x, right.y)
  p.closePath()
  return p
}

function fillSegment(
  ctx: CanvasRenderingContext2D,
  path: Path2D,
  color: string,
  cx: number,
  cy: number,
  maxR: number,
  selected: boolean,
) {
  const grad = ctx.createRadialGradient(cx, cy, maxR * 0.08, cx, cy, maxR)
  grad.addColorStop(0, mixHex(color, -0.06))
  grad.addColorStop(0.65, color)
  grad.addColorStop(1, mixHex(color, 0.14))
  ctx.fillStyle = grad
  ctx.fill(path)
  ctx.strokeStyle = selected ? '#0d9488' : STROKE
  ctx.lineWidth = selected ? 3 : STROKE_W
  ctx.lineJoin = 'round'
  ctx.stroke(path)
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  midDeg: number,
  r: number,
  fontSize: number,
  bold: boolean,
) {
  const rad = (midDeg * Math.PI) / 180
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(rad)
  ctx.translate(r, 0)
  ctx.rotate(Math.PI / 2)
  if (Math.cos(rad) < 0) ctx.rotate(Math.PI)
  ctx.fillStyle = TEXT
  ctx.font = `${bold ? 600 : 500} ${fontSize}px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 0, 0)
  ctx.restore()
}

export function drawPlutchikWheel(
  ctx: CanvasRenderingContext2D,
  opts: DrawWheelOptions,
): WheelHitRegion[] {
  const { cx, cy, radius, selectedValue = '', collectHits = false } = opts
  const hits: WheelHitRegion[] = []

  const rCent = radius * 0.07
  const r1 = radius * 0.24
  const r2 = radius * 0.5
  const r3 = radius * 0.74
  const rOut = radius * 0.98
  const r1in = r1 + RING_GAP
  const r2in = r2 + RING_GAP

  const innerHalf = 5.8
  const midHalf = 10.4
  const outerHalf = 14.8

  const w = cx * 2
  const h = cy * 2
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)

  ctx.save()
  ctx.shadowColor = 'rgba(26, 18, 11, 0.1)'
  ctx.shadowBlur = 14
  ctx.shadowOffsetY = 4

  // 复合情绪垫底
  DYAD_VALUES.forEach((value, i) => {
    const emo = EMOTION_BY_VALUE[value]
    const path = dyadWedgePath(cx, cy, r3 - 1, rOut, i, outerHalf)
    const sel = selectedValue === value
    fillSegment(ctx, path, DYAD_FILLS[i], cx, cy, radius, sel)
    if (collectHits) hits.push({ value, emotion: emo, path })
  })

  SECTOR_FAMILIES.forEach((family, i) => {
    const mid = spokeMid(i)
    const levels = intensitiesForFamily(family)
    const fills = PETAL_FILLS[family]

    const rings: { path: Path2D; labelR: number; fontSize: number }[] = [
      {
        path: innerWedgePath(cx, cy, mid, rCent, r1, innerHalf),
        labelR: (rCent + r1) * 0.55,
        fontSize: 10,
      },
      { path: annulusPath(cx, cy, r1in, r2, mid, midHalf), labelR: (r1in + r2) * 0.5, fontSize: 11 },
      {
        path: outerLeafPath(cx, cy, mid, r2in, r3, outerHalf),
        labelR: (r2in + r3) * 0.5,
        fontSize: 12,
      },
    ]

    levels.forEach((emo, ring) => {
      const sel = selectedValue === emo.value
      const { path } = rings[ring]
      fillSegment(ctx, path, fills[ring], cx, cy, radius, sel)
      if (collectHits) hits.push({ value: emo.value, emotion: emo, path })
    })

    levels.forEach((emo, ring) => {
      const { labelR, fontSize } = rings[ring]
      drawLabel(ctx, emo.label, cx, cy, mid, labelR, fontSize, selectedValue === emo.value)
    })
  })

  ctx.restore()

  DYAD_VALUES.forEach((value, i) => {
    const emo = EMOTION_BY_VALUE[value]
    const bisect = spokeMid(i) + 22.5
    drawLabel(ctx, emo.label, cx, cy, bisect, rOut * 0.9, 11, selectedValue === value)
  })

  // 中心白圆（参考图内圈汇合处）
  ctx.beginPath()
  ctx.arc(cx, cy, rCent, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.strokeStyle = STROKE
  ctx.lineWidth = STROKE_W
  ctx.stroke()

  return hits
}

export function hitTestWheel(
  ctx: CanvasRenderingContext2D,
  regions: WheelHitRegion[],
  x: number,
  y: number,
): PlutchikEmotion | null {
  for (let i = regions.length - 1; i >= 0; i--) {
    if (ctx.isPointInPath(regions[i].path, x, y)) return regions[i].emotion
  }
  return null
}
