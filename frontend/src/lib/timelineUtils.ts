import type { Memory } from '@/services/memoryTypes'

export interface TimelineGroup {
  year: number | null
  items: Memory[]
}

export function groupMemoriesByYear(memories: Memory[]): TimelineGroup[] {
  const map = new Map<number | null, Memory[]>()
  for (const m of memories) {
    const year = m.timestamp ? new Date(m.timestamp).getFullYear() : null
    const arr = map.get(year) ?? []
    arr.push(m)
    map.set(year, arr)
  }
  const groups: TimelineGroup[] = []
  const numericYears = Array.from(map.keys())
    .filter((y): y is number => y !== null)
    .sort((a, b) => b - a)
  for (const y of numericYears) {
    const list = (map.get(y) ?? []).slice()
    list.sort((a, b) => {
      const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0
      const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0
      return tb - ta
    })
    groups.push({ year: y, items: list })
  }
  if (map.has(null)) {
    const list = map.get(null) ?? []
    groups.push({ year: null, items: list })
  }
  return groups
}
