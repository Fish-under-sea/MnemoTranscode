/**
 * 记忆网高亮：选中节点时点亮时间链片段 + 与该点直接相连的全部联结。
 */

export type MnemoEdgeInput = { from_id: string; to_id: string; edge_type: string; weight: number }

export function buildLinkKey(from_id: string, to_id: string, edge_type: string, idx: number): string {
  return `${from_id}→${to_id}:${edge_type}:${idx}`
}

/**
 * @returns 需加亮的边 key 集合、涉及到的节点 id（含选中点）
 */
export function computeHighlightedKeys(
  selectedId: string | null,
  edges: MnemoEdgeInput[],
): { linkKeys: Set<string>; nodeIds: Set<string> } {
  const linkKeys = new Set<string>()
  const nodeIds = new Set<string>()
  if (!selectedId || edges.length === 0) {
    return { linkKeys, nodeIds }
  }
  nodeIds.add(selectedId)

  const temporal = edges.filter((e) => e.edge_type === 'TEMPORAL_NEXT')
  const forward = new Map<string, string>()
  const backward = new Map<string, string>()
  for (const e of temporal) {
    forward.set(e.from_id, e.to_id)
    backward.set(e.to_id, e.from_id)
  }

  const chainNodes = new Set<string>([selectedId])
  let cur = selectedId
  while (forward.has(cur)) {
    cur = forward.get(cur)!
    chainNodes.add(cur)
  }
  cur = selectedId
  while (backward.has(cur)) {
    cur = backward.get(cur)!
    chainNodes.add(cur)
  }

  edges.forEach((e, idx) => {
    const key = buildLinkKey(e.from_id, e.to_id, e.edge_type, idx)
    const onTimeChain =
      e.edge_type === 'TEMPORAL_NEXT' && chainNodes.has(e.from_id) && chainNodes.has(e.to_id)
    const incident = e.from_id === selectedId || e.to_id === selectedId
    if (onTimeChain || incident) {
      linkKeys.add(key)
      nodeIds.add(e.from_id)
      nodeIds.add(e.to_id)
    }
  })

  return { linkKeys, nodeIds }
}
