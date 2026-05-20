/**
 * 普卢奇克轮 SVG 路径（扁平填色 + 白缝，对齐经典参考图轮廓）
 */
import {
  PLUTCHIK_CLASSIC_CX as CX,
  PLUTCHIK_CLASSIC_CY as CY,
  PLUTCHIK_CLASSIC_SPEC as S,
} from '@/lib/plutchikWheelClassicSpec'

export const WHEEL_STROKE_WHITE = '#ffffff'
export const WHEEL_STROKE_WIDTH = 2.5

function polar(r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) }
}

/** 正上为喜悦瓣（index 0） */
export function spokeMid(index: number) {
  return index * 45
}

function fmt(n: number) {
  return n.toFixed(2)
}

export function annulusSectorPath(rInner: number, rOuter: number, mid: number, half: number) {
  const gap = S.petalGapDeg / 2
  const a0 = mid - half + gap
  const a1 = mid + half - gap
  const large = a1 - a0 > 180 ? 1 : 0
  const o0 = polar(rOuter, a0)
  const o1 = polar(rOuter, a1)
  const i1 = polar(rInner, a1)
  const i0 = polar(rInner, a0)
  return [
    `M ${fmt(o0.x)} ${fmt(o0.y)}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${fmt(o1.x)} ${fmt(o1.y)}`,
    `L ${fmt(i1.x)} ${fmt(i1.y)}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${fmt(i0.x)} ${fmt(i0.y)}`,
    'Z',
  ].join(' ')
}

export function innerWedgePath(mid: number) {
  const gap = S.petalGapDeg / 2
  const a0 = mid - S.innerHalf + gap
  const a1 = mid + S.innerHalf - gap
  const large = a1 - a0 > 180 ? 1 : 0
  const h0 = polar(S.rHole, a0)
  const h1 = polar(S.rHole, a1)
  const o1 = polar(S.r1, a1)
  const o0 = polar(S.r1, a0)
  return [
    `M ${fmt(h0.x)} ${fmt(h0.y)}`,
    `A ${S.rHole} ${S.rHole} 0 ${large} 1 ${fmt(h1.x)} ${fmt(h1.y)}`,
    `L ${fmt(o1.x)} ${fmt(o1.y)}`,
    `A ${S.r1} ${S.r1} 0 ${large} 0 ${fmt(o0.x)} ${fmt(o0.y)}`,
    'Z',
  ].join(' ')
}

/** 外环花瓣：外缘贝塞尔鼓出（参考图叶尖） */
export function outerLeafPath(mid: number) {
  const gap = S.petalGapDeg / 2
  const half = S.outerHalf
  const rIn = S.r2 + S.ringSlit
  const rOut = S.r3
  const a0 = mid - half + gap
  const a1 = mid + half - gap
  const i0 = polar(rIn, a0)
  const i1 = polar(rIn, a1)
  const o0 = polar(rOut, a0)
  const o1 = polar(rOut, a1)
  const tip = polar(rOut * S.outerBulge, mid)
  return [
    `M ${fmt(i0.x)} ${fmt(i0.y)}`,
    `L ${fmt(o0.x)} ${fmt(o0.y)}`,
    `Q ${fmt(tip.x)} ${fmt(tip.y)} ${fmt(o1.x)} ${fmt(o1.y)}`,
    `L ${fmt(i1.x)} ${fmt(i1.y)}`,
    `A ${rIn} ${rIn} 0 0 0 ${fmt(i0.x)} ${fmt(i0.y)}`,
    'Z',
  ].join(' ')
}

/** 瓣间复合情绪（八角外廓三角） */
export function dyadWedgePath(afterSpokeIndex: number) {
  const mid = spokeMid(afterSpokeIndex)
  const midNext = spokeMid(afterSpokeIndex + 1)
  const bisect = mid + 22.5
  const tip = polar(S.rTip, bisect)
  const left = polar(S.r3 - 1, mid + S.outerHalf + S.petalGapDeg * 0.5)
  const right = polar(S.r3 - 1, midNext - S.outerHalf - S.petalGapDeg * 0.5)
  return `M ${fmt(tip.x)} ${fmt(tip.y)} L ${fmt(left.x)} ${fmt(left.y)} L ${fmt(right.x)} ${fmt(right.y)} Z`
}

export function buildClassicSegmentPaths(): {
  intensity: { familyIndex: number; ring: 0 | 1 | 2; d: string }[]
  dyad: { index: number; d: string }[]
} {
  const rMidIn = S.r1 + S.ringSlit
  const intensity: { familyIndex: number; ring: 0 | 1 | 2; d: string }[] = []
  for (let i = 0; i < 8; i++) {
    const mid = spokeMid(i)
    intensity.push({ familyIndex: i, ring: 0, d: innerWedgePath(mid) })
    intensity.push({ familyIndex: i, ring: 1, d: annulusSectorPath(rMidIn, S.r2, mid, S.midHalf) })
    intensity.push({ familyIndex: i, ring: 2, d: outerLeafPath(mid) })
  }
  const dyad: { index: number; d: string }[] = []
  for (let i = 0; i < 8; i++) {
    dyad.push({ index: i, d: dyadWedgePath(i) })
  }
  return { intensity, dyad }
}

export function labelPosition(mid: number, r: number) {
  return polar(r, mid)
}
