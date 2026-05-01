/**
 * 简易力导向布局：模拟「神经元」间的斥力与边的引力，用于记忆关系网 SVG。
 */

export interface ForceEdge {
  from: string
  to: string
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

  nodeIds.forEach((id, i) => {
    const angle = (2 * Math.PI * i) / Math.max(n, 1) - Math.PI / 2
    pos.set(id, {
      x: cx + r0 * Math.cos(angle) + (Math.random() - 0.5) * 24,
      y: cy + r0 * Math.sin(angle) + (Math.random() - 0.5) * 24,
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
