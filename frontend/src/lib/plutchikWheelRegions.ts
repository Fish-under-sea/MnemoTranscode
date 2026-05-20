/**
 * 32 块情绪区域：路径 + 填色 + 标签布局
 */
import {
  EMOTION_BY_VALUE,
  PLUTCHIK_EMOTIONS,
  type EmotionFamily,
  type PlutchikEmotion,
} from '@/lib/plutchikEmotions'
import { PLUTCHIK_CLASSIC_SPEC as S } from '@/lib/plutchikWheelClassicSpec'
import { PLUTCHIK_WHEEL_SEGMENT_FILL } from '@/lib/plutchikWheelPalette'
import { buildClassicSegmentPaths, spokeMid } from '@/lib/plutchikWheelGeometry'

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

export type WheelRegion = {
  value: string
  d: string
  fill: string
  label: string
  emotion: PlutchikEmotion
  labelMid: number
  labelR: number
  fontSize: number
}

function intensitiesForFamily(family: EmotionFamily): PlutchikEmotion[] {
  return PLUTCHIK_EMOTIONS.filter((e) => e.family === family && e.tier === 'intensity').sort(
    (a, b) => b.intensity - a.intensity,
  )
}

export function buildPlutchikWheelRegions(): WheelRegion[] {
  const { intensity: paths, dyad: dyadPaths } = buildClassicSegmentPaths()
  const regions: WheelRegion[] = []
  const rMidIn = S.r1 + S.ringSlit
  const rOutIn = S.r2 + S.ringSlit

  SECTOR_FAMILIES.forEach((family, familyIndex) => {
    const levels = intensitiesForFamily(family)
    const mid = spokeMid(familyIndex)
    const layouts = [
      { ring: 0 as const, labelR: (S.rHole + S.r1) / 2, fontSize: 10 },
      { ring: 1 as const, labelR: (rMidIn + S.r2) / 2, fontSize: 11 },
      { ring: 2 as const, labelR: (rOutIn + S.r3) / 2, fontSize: 12 },
    ]
    layouts.forEach(({ ring, labelR, fontSize }) => {
      const emo = levels[ring]
      const seg = paths.find((p) => p.familyIndex === familyIndex && p.ring === ring)!
      regions.push({
        value: emo.value,
        d: seg.d,
        fill: PLUTCHIK_WHEEL_SEGMENT_FILL[emo.value] ?? '#ccc',
        label: emo.label,
        emotion: emo,
        labelMid: mid,
        labelR,
        fontSize,
      })
    })
  })

  dyadPaths.forEach((seg, i) => {
    const value = DYAD_VALUES[i]
    const emo = EMOTION_BY_VALUE[value]
    const bisect = spokeMid(i) + 22.5
    regions.push({
      value,
      d: seg.d,
      fill: PLUTCHIK_WHEEL_SEGMENT_FILL[value] ?? '#f5f5f5',
      label: emo.label,
      emotion: emo,
      labelMid: bisect,
      labelR: S.rTip * 0.88,
      fontSize: 11,
    })
  })

  return regions
}
