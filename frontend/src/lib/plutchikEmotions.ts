/**
 * 普卢奇克情绪轮 — 与 backend/app/lib/emotion_taxonomy.py 保持语义一致
 */

export type EmotionFamily =
  | 'joy'
  | 'trust'
  | 'fear'
  | 'surprise'
  | 'sadness'
  | 'disgust'
  | 'anger'
  | 'anticipation'

export type EmotionTier = 'intensity' | 'dyad'

export interface PlutchikEmotion {
  value: string
  label: string
  family: EmotionFamily
  familyLabel: string
  tier: EmotionTier
  /** 1=外圈弱 2=中 3=内圈强；dyad 为 0 */
  intensity: number
  color: string
}

export const FAMILY_LABEL_ZH: Record<EmotionFamily, string> = {
  joy: '喜悦',
  trust: '信任',
  fear: '恐惧',
  surprise: '惊讶',
  sadness: '悲伤',
  disgust: '厌恶',
  anger: '愤怒',
  anticipation: '期待',
}

export const FAMILY_COLOR: Record<EmotionFamily, string> = {
  joy: '#EAB308',
  trust: '#84CC16',
  fear: '#15803D',
  surprise: '#38BDF8',
  sadness: '#2563EB',
  disgust: '#9333EA',
  anger: '#DC2626',
  anticipation: '#EA580C',
}

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

function intensity(
  value: string,
  label: string,
  family: EmotionFamily,
  level: number,
): PlutchikEmotion {
  return {
    value,
    label,
    family,
    familyLabel: FAMILY_LABEL_ZH[family],
    tier: 'intensity',
    intensity: level,
    color: FAMILY_COLOR[family],
  }
}

function dyad(
  value: string,
  label: string,
  family: EmotionFamily,
  families: [EmotionFamily, EmotionFamily],
): PlutchikEmotion {
  const [a, b] = families
  return {
    value,
    label,
    family,
    familyLabel: `${FAMILY_LABEL_ZH[a]}·${FAMILY_LABEL_ZH[b]}`,
    tier: 'dyad',
    intensity: 0,
    color: FAMILY_COLOR[family],
  }
}

export const PLUTCHIK_EMOTIONS: PlutchikEmotion[] = [
  intensity('joy_serenity', '平静', 'joy', 1),
  intensity('joy_joy', '快乐', 'joy', 2),
  intensity('joy_ecstasy', '狂喜', 'joy', 3),
  intensity('trust_acceptance', '接受', 'trust', 1),
  intensity('trust_trust', '信任', 'trust', 2),
  intensity('trust_admiration', '崇敬', 'trust', 3),
  intensity('fear_apprehension', '担心', 'fear', 1),
  intensity('fear_fear', '恐惧', 'fear', 2),
  intensity('fear_terror', '惊悚', 'fear', 3),
  intensity('surprise_distraction', '不解', 'surprise', 1),
  intensity('surprise_surprise', '惊讶', 'surprise', 2),
  intensity('surprise_amazement', '惊诧', 'surprise', 3),
  intensity('sadness_pensiveness', '伤感', 'sadness', 1),
  intensity('sadness_sadness', '悲伤', 'sadness', 2),
  intensity('sadness_grief', '悲痛', 'sadness', 3),
  intensity('disgust_boredom', '厌倦', 'disgust', 1),
  intensity('disgust_disgust', '厌恶', 'disgust', 2),
  intensity('disgust_loathing', '憎恨', 'disgust', 3),
  intensity('anger_annoyance', '不耐烦', 'anger', 1),
  intensity('anger_anger', '生气', 'anger', 2),
  intensity('anger_rage', '暴怒', 'anger', 3),
  intensity('anticipation_interest', '关心', 'anticipation', 1),
  intensity('anticipation_anticipation', '期待', 'anticipation', 2),
  intensity('anticipation_vigilance', '警惕', 'anticipation', 3),
  dyad('dyad_love', '友爱', 'joy', ['joy', 'trust']),
  dyad('dyad_submission', '屈服', 'trust', ['trust', 'fear']),
  dyad('dyad_awe', '敬畏', 'fear', ['fear', 'surprise']),
  dyad('dyad_disapproval', '反对', 'surprise', ['surprise', 'sadness']),
  dyad('dyad_remorse', '懊悔', 'sadness', ['sadness', 'disgust']),
  dyad('dyad_contempt', '鄙夷', 'disgust', ['disgust', 'anger']),
  dyad('dyad_aggression', '挑衅', 'anger', ['anger', 'anticipation']),
  dyad('dyad_optimism', '乐观', 'anticipation', ['anticipation', 'joy']),
]

export const EMOTION_BY_VALUE = Object.fromEntries(
  PLUTCHIK_EMOTIONS.map((e) => [e.value, e]),
) as Record<string, PlutchikEmotion>

const LEGACY_AND_ALIAS: Record<string, string> = {
  joy: 'joy_joy',
  love: 'dyad_love',
  anger: 'anger_anger',
  sadness: 'sadness_sadness',
  fear: 'fear_fear',
  surprise: 'surprise_surprise',
  nostalgia: 'sadness_pensiveness',
  gratitude: 'trust_admiration',
  regret: 'dyad_remorse',
  peaceful: 'joy_serenity',
  温暖: 'dyad_love',
  感伤: 'sadness_sadness',
  快乐: 'joy_joy',
  平静: 'joy_serenity',
  自豪: 'trust_admiration',
  感激: 'trust_admiration',
  感恩: 'trust_admiration',
  怀念: 'sadness_pensiveness',
  愧疚: 'dyad_remorse',
  安心: 'trust_acceptance',
  坚韧: 'anticipation_vigilance',
  爱: 'dyad_love',
  喜悦: 'joy_joy',
  愤怒: 'anger_anger',
  悲伤: 'sadness_sadness',
  恐惧: 'fear_fear',
  惊讶: 'surprise_surprise',
  厌恶: 'disgust_disgust',
  期待: 'anticipation_anticipation',
  遗憾: 'dyad_remorse',
}

for (const e of PLUTCHIK_EMOTIONS) {
  LEGACY_AND_ALIAS[e.label] = e.value
  LEGACY_AND_ALIAS[e.value] = e.value
}

/** 与后端 normalize_emotion_label 一致 */
export function normalizeEmotionValue(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const s = raw.trim()
  if (!s) return null
  const key = s.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_')
  if (EMOTION_BY_VALUE[key]) return key
  if (LEGACY_AND_ALIAS[key]) return LEGACY_AND_ALIAS[key]
  if (LEGACY_AND_ALIAS[s]) return LEGACY_AND_ALIAS[s]
  return null
}

export function resolveEmotion(raw: string | null | undefined): PlutchikEmotion | null {
  if (!raw?.trim()) return null
  const norm = normalizeEmotionValue(raw)
  if (norm && EMOTION_BY_VALUE[norm]) return EMOTION_BY_VALUE[norm]
  return null
}

/** 供卡片/筛选：兼容旧 value，展示中文与颜色 */
export function emotionDisplay(raw: string | null | undefined): {
  value: string
  label: string
  color: string
} | null {
  const resolved = resolveEmotion(raw)
  if (resolved) {
    return { value: resolved.value, label: resolved.label, color: resolved.color }
  }
  if (raw?.trim()) {
    return { value: raw.trim(), label: raw.trim(), color: '#94a3b8' }
  }
  return null
}

/** 扁平列表（时间线筛选等） */
export const EMOTION_LABELS = PLUTCHIK_EMOTIONS.map((e) => ({
  value: e.value,
  label: e.label,
  color: e.color,
}))

export const EMOTION_GROUPS = FAMILIES.map((family) => ({
  family,
  familyLabel: FAMILY_LABEL_ZH[family],
  color: FAMILY_COLOR[family],
  intensities: PLUTCHIK_EMOTIONS.filter((e) => e.family === family && e.tier === 'intensity'),
  dyads: PLUTCHIK_EMOTIONS.filter((e) => e.tier === 'dyad' && e.family === family),
}))

/** 关系网：根据结点 label（常为中文）解析颜色 */
export function emotionColorFromGraphLabel(label: string): string | undefined {
  return resolveEmotion(label)?.color ?? emotionDisplay(label)?.color
}
