/**
 * 记忆关系网布局：
 * - `computeForceLayout`：通用力导向（如 MemoryRelationGraph）。
 * - `computeHubRingLayout`：对话页「中心枢纽 + 外围结点贴四边外框」（图一辐射框），非力导向。
 */

export interface ForceEdge {
  from: string
  to: string
}

/** 确定性扰动：同构图多次布局结果一致，避免 React 重算时整张图乱跳。 */
function _layoutSeed(nodeIds: string[]): number {
  const s = [...nodeIds].sort().join('\0')
  let h = 216389193
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function _seededUnit(seed: number, salt: number): number {
  const x = Math.imul(seed ^ salt, 2246822507) ^ Math.imul(salt, 3266489917)
  const t = (x >>> 0) / 4294967296
  return t - 0.5
}

/** 选枢纽：优先 Person；否则度最大；否则字典序最小（稳定） */
export function pickHubNodeId(
  nodeIds: string[],
  edges: ForceEdge[],
  nodeTypes?: Map<string, string>,
): string | null {
  if (nodeIds.length === 0) return null
  const deg = new Map<string, number>()
  for (const id of nodeIds) deg.set(id, 0)
  for (const e of edges) {
    if (deg.has(e.from)) deg.set(e.from, (deg.get(e.from) ?? 0) + 1)
    if (deg.has(e.to)) deg.set(e.to, (deg.get(e.to) ?? 0) + 1)
  }
  if (nodeTypes) {
    const persons = nodeIds
      .filter((id) => nodeTypes.get(id) === 'Person')
      .sort((a, b) => a.localeCompare(b))
    if (persons.length > 0) return persons[0]!
  }
  let best = nodeIds[0]!
  let bestD = deg.get(best) ?? 0
  for (const id of nodeIds) {
    const d = deg.get(id) ?? 0
    if (d > bestD || (d === bestD && id < best)) {
      best = id
      bestD = d
    }
  }
  return best
}

/** 对话页外框边：用于标签 text-anchor / 法线方向（枢纽为 center） */
export type MnemoFrameEdge = 'top' | 'right' | 'bottom' | 'left' | 'center'

export type MnemoFramePos = { x: number; y: number; edge: MnemoFrameEdge }

/** 按边长比例分配结点数（最大余数法，总和恒等于 total） */
function _allocateAlongFrame(
  total: number,
  topW: number,
  rightW: number,
  bottomW: number,
  leftW: number,
): [number, number, number, number] {
  const w = [topW, rightW, bottomW, leftW]
  const sum = w[0]! + w[1]! + w[2]! + w[3]!
  if (total <= 0 || sum <= 0) return [0, 0, 0, 0]
  const raw = w.map((wi) => (total * wi) / sum)
  const out = raw.map((r) => Math.floor(r))
  let rem = total - out.reduce((a, b) => a + b, 0)
  const frac = out.map((o, i) => ({ i, f: raw[i]! - o }))
  frac.sort((a, b) => b.f - a.f)
  for (let j = 0; j < rem; j++) {
    out[frac[j]!.i]! += 1
  }
  return [out[0]!, out[1]!, out[2]!, out[3]!]
}

/**
 * 外围结点按「顶→右→底→左」贴在矩形四条边上（参考档案页理想效果），枢纽在中心；
 * 不做力导向、无随机抖动，标签侧可由 `edge` 对齐。
 */
export function computeHubRingLayout(
  nodeIds: string[],
  edges: ForceEdge[],
  width: number,
  height: number,
  nodeTypes?: Map<string, string>,
): Map<string, MnemoFramePos> {
  const pos = new Map<string, MnemoFramePos>()
  const cx = width / 2
  const cy = height / 2
  if (nodeIds.length === 0) return pos

  const margin = Math.max(20, Math.min(width, height) * 0.08)
  const left = margin
  const right = width - margin
  const top = margin
  const bottom = height - margin
  const pw = Math.max(8, right - left)
  const ph = Math.max(8, bottom - top)

  const hub = pickHubNodeId(nodeIds, edges, nodeTypes) ?? nodeIds[0]!
  const peripheral = [...nodeIds].filter((id) => id !== hub).sort((a, b) => a.localeCompare(b))

  pos.set(hub, { x: cx, y: cy, edge: 'center' })

  const m = peripheral.length
  if (m === 0) return pos

  const eps = Math.max(5, Math.min(pw, ph) * 0.035)
  const [nTop, nRight, nBottom, nLeft] = _allocateAlongFrame(m, pw, ph, pw, ph)

  let offset = 0
  const take = (n: number) => {
    const slice = peripheral.slice(offset, offset + n)
    offset += n
    return slice
  }

  const placeLinear = (n: number, t0: number, t1: number) =>
    n <= 0 ? [] : Array.from({ length: n }, (_, k) => (n === 1 ? 0.5 : k / (n - 1)) * (t1 - t0) + t0)

  const topIds = take(nTop)
  const xsTop = placeLinear(topIds.length, left + eps, right - eps)
  topIds.forEach((id, k) => {
    pos.set(id, { x: xsTop[k]!, y: top, edge: 'top' })
  })

  const rightIds = take(nRight)
  const ysRight = placeLinear(rightIds.length, top + eps, bottom - eps)
  rightIds.forEach((id, k) => {
    pos.set(id, { x: right, y: ysRight[k]!, edge: 'right' })
  })

  const bottomIds = take(nBottom)
  const xsBottom = placeLinear(bottomIds.length, right - eps, left + eps)
  bottomIds.forEach((id, k) => {
    pos.set(id, { x: xsBottom[k]!, y: bottom, edge: 'bottom' })
  })

  const leftIds = take(nLeft)
  const ysLeft = placeLinear(leftIds.length, bottom - eps, top + eps)
  leftIds.forEach((id, k) => {
    pos.set(id, { x: left, y: ysLeft[k]!, edge: 'left' })
  })

  return pos
}

export function computeForceLayout(
  nodeIds: string[],
  edges: ForceEdge[],
  width: number,
  height: number,
  iterations = 72,
): Map<string, { x: number; y: number }> {
  const cx = width / 2
  const cy = height / 2
  const n = nodeIds.length
  const pos = new Map<string, { x: number; y: number }>()
  const r0 = Math.min(width, height) * 0.22
  const seed = _layoutSeed(nodeIds)

  nodeIds.forEach((id, i) => {
    const angle = (2 * Math.PI * i) / Math.max(n, 1) - Math.PI / 2
    const jx = _seededUnit(seed, i * 17 + 3) * 24
    const jy = _seededUnit(seed, i * 17 + 11) * 24
    pos.set(id, {
      x: cx + r0 * Math.cos(angle) + jx,
      y: cy + r0 * Math.sin(angle) + jy,
    })
  })

  if (n === 0) return pos

  const area = width * height
  const k = Math.sqrt(area / Math.max(n, 1))
  const ideal = k * 0.85

  const edgeList = edges.filter((e) => pos.has(e.from) && pos.has(e.to))

  for (let iter = 0; iter < iterations; iter++) {
    const disp = new Map<string, { x: number; y: number }>()
    nodeIds.forEach((id) => disp.set(id, { x: 0, y: 0 }))

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = nodeIds[i]
        const b = nodeIds[j]
        const pa = pos.get(a)!
        const pb = pos.get(b)!
        let dx = pa.x - pb.x
        let dy = pa.y - pb.y
        let dist = Math.sqrt(dx * dx + dy * dy) || 0.01
        const f = (k * k) / dist
        dx = (dx / dist) * f
        dy = (dy / dist) * f
        disp.get(a)!.x += dx
        disp.get(a)!.y += dy
        disp.get(b)!.x -= dx
        disp.get(b)!.y -= dy
      }
    }

    for (const e of edgeList) {
      const pa = pos.get(e.from)!
      const pb = pos.get(e.to)!
      let dx = pb.x - pa.x
      let dy = pb.y - pa.y
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01
      const f = (dist - ideal) * 0.045 * (1 + (iter / iterations) * 0.4)
      dx = (dx / dist) * f
      dy = (dy / dist) * f
      disp.get(e.from)!.x += dx
      disp.get(e.from)!.y += dy
      disp.get(e.to)!.x -= dx
      disp.get(e.to)!.y -= dy
    }

    const pull = 0.028
    for (const id of nodeIds) {
      const p = pos.get(id)!
      disp.get(id)!.x += (cx - p.x) * pull
      disp.get(id)!.y += (cy - p.y) * pull
    }

    const cool = 1 - (iter / iterations) * 0.88
    const margin = 44
    for (const id of nodeIds) {
      const p = pos.get(id)!
      const d = disp.get(id)!
      const mag = Math.sqrt(d.x * d.x + d.y * d.y) || 1
      const lim = 14 * cool
      const scale = mag > lim ? lim / mag : 1
      p.x += d.x * scale
      p.y += d.y * scale
      p.x = Math.max(margin, Math.min(width - margin, p.x))
      p.y = Math.max(margin, Math.min(height - margin, p.y))
    }
  }

  return pos
}
