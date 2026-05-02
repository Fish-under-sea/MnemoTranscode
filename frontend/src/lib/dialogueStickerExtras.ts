/** 从服务端 message.extras 解析表情包 media_id（与后端 JSON 契约一致） */
export function stickerMediaIdsFromExtras(ex: unknown): number[] {
  if (!ex || typeof ex !== 'object') return []
  const stickers = (ex as { stickers?: unknown }).stickers
  if (!Array.isArray(stickers)) return []
  const out: number[] = []
  for (const s of stickers) {
    if (s && typeof s === 'object' && 'media_id' in s) {
      const n = Number((s as { media_id: unknown }).media_id)
      if (Number.isFinite(n) && n > 0) out.push(n)
    }
  }
  return out
}
