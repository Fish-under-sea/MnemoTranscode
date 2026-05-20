/**
 * 普卢奇克轮极坐标命中（与矢量几何一致）
 */
import {
  EMOTION_BY_VALUE,
  PLUTCHIK_EMOTIONS,
  type EmotionFamily,
  type PlutchikEmotion,
} from '@/lib/plutchikEmotions'
import { PLUTCHIK_CLASSIC_SPEC as S } from '@/lib/plutchikWheelClassicSpec'
import { spokeMid } from '@/lib/plutchikWheelGeometry'

const FAMILIES: EmotionFamily[] = [
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

const CX = S.center[0]
const CY = S.center[1]

export function clientToWheel(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  viewWidth: number,
  viewHeight: number,
): { x: number; y: number } {
  const scaleX = viewWidth / rect.width
  const scaleY = viewHeight / rect.height
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  }
}

export function toPolar(x: number, y: number): { r: number; deg: number } {
  const dx = x - CX
  const dy = y - CY
  const r = Math.hypot(dx, dy)
  let deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90
  if (deg < 0) deg += 360
  if (deg >= 360) deg -= 360
  return { r, deg }
}

function normDelta(a: number, b: number): number {
  let d = Math.abs(a - b) % 360
  if (d > 180) d = 360 - d
  return d
}

function inAngularSlot(deg: number, mid: number, half: number): boolean {
  return normDelta(deg, mid) <= half - S.petalGapDeg / 2
}

function intensitiesForFamily(family: EmotionFamily): PlutchikEmotion[] {
  return PLUTCHIK_EMOTIONS.filter((e) => e.family === family && e.tier === 'intensity').sort(
    (a, b) => b.intensity - a.intensity,
  )
}

export function hitTestPlutchikWheel(x: number, y: number): PlutchikEmotion | null {
  const { r, deg } = toPolar(x, y)
  if (r < S.rHole || r > S.rTip) return null

  if (r >= S.r3 - 5) {
    for (let i = 0; i < 8; i++) {
      const bisect = spokeMid(i) + 22.5
      if (normDelta(deg, bisect) <= 18.5) {
        return EMOTION_BY_VALUE[DYAD_VALUES[i]]
      }
    }
  }

  for (let i = 0; i < 8; i++) {
    const mid = spokeMid(i)
    const levels = intensitiesForFamily(FAMILIES[i])
    if (r <= S.r1 && inAngularSlot(deg, mid, S.innerHalf)) return levels[0]
    if (r <= S.r2 && inAngularSlot(deg, mid, S.midHalf)) return levels[1]
    if (r <= S.r3 && inAngularSlot(deg, mid, S.outerHalf)) return levels[2]
  }

  return null
}
