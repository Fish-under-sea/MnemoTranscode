/**
 * 情绪轮贴图与热区标定（对齐 frontend/public/emotion-wheel.png）
 */
import specJson from '@/lib/plutchikWheelClassicSpec.json'

export type PlutchikClassicSpec = {
  viewWidth: number
  viewHeight: number
  center: [number, number]
  rHole: number
  r1: number
  r2: number
  r3: number
  rTip: number
  ringSlit: number
  petalGapDeg: number
  innerHalf: number
  midHalf: number
  outerHalf: number
  outerBulge: number
  imageSrc: string
}

export const PLUTCHIK_CLASSIC_SPEC: PlutchikClassicSpec = {
  ...specJson,
  center: [specJson.center[0], specJson.center[1]],
}

export const PLUTCHIK_WHEEL_IMAGE_SRC = PLUTCHIK_CLASSIC_SPEC.imageSrc
export const PLUTCHIK_CLASSIC_VIEW_W = PLUTCHIK_CLASSIC_SPEC.viewWidth
export const PLUTCHIK_CLASSIC_VIEW_H = PLUTCHIK_CLASSIC_SPEC.viewHeight
export const PLUTCHIK_CLASSIC_CX = PLUTCHIK_CLASSIC_SPEC.center[0]
export const PLUTCHIK_CLASSIC_CY = PLUTCHIK_CLASSIC_SPEC.center[1]
