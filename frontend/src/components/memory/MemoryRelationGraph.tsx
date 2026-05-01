/**
 * 成员记忆关系网（Engram 节点/边）简易放射布局
 */
import { useQuery } from '@tanstack/react-query'
import { memoryApi } from '@/services/api'
import { LoadingState } from '@/components/ui/state'

type GraphNode = { id: string; node_type: string; label: string; memory_id?: number | null }
type GraphEdge = { from_id: string; to_id: string; edge_type: string; weight: number }

const EDGE_COLORS: Record<string, string> = {
  TEMPORAL_NEXT: '#0d9488',
  CAUSED_BY: '#b45309',
  RELATED_TO: '#64748b',
  EMOTIONALLY_LINKED: '#c026d3',
  SUPPORTS: '#2563eb',
  COACTIVATED_WITH: '#94a3b8',
  DEFAULT: '#94a3b8',
}

export default function MemoryRelationGraph({ memberId }: { memberId: number }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['mnemo-graph', memberId],
    queryFn: () => memoryApi.mnemoGraph(memberId) as Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }>,
    enabled: Number.isFinite(memberId) && memberId > 0,
  })

  if (isLoading) {
    return (
      <div className="py-8">
        <LoadingState message="加载关系网…" />
      </div>
    )
  }
  if (isError || !data) {
    return <p className="text-caption text-ink-muted">关系网暂不可用</p>
  }
  const { nodes, edges } = data
  if (nodes.length === 0) {
    return (
      <p className="text-caption text-ink-muted">
        还没有图节点。导入聊天记录、添加记忆或开启「对话后提炼记忆」后，这里会显示链式联结。
      </p>
    )
  }

  const w = 520
  const h = 420
  const cx = w / 2
  const cy = h / 2
  const r = Math.min(w, h) * 0.36
  const pos = new Map<string, { x: number; y: number }>()
  nodes.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / Math.max(nodes.length, 1) - Math.PI / 2
    pos.set(n.id, { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) })
  })

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 text-caption text-ink-secondary mb-1">
        {(['TEMPORAL_NEXT', 'CAUSED_BY', 'RELATED_TO', 'EMOTIONALLY_LINKED'] as const).map((k) => (
          <span key={k} className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: EDGE_COLORS[k] }} />
            {k}
          </span>
        ))}
      </div>
      <div className="rounded-xl border border-border-default bg-subtle/60 overflow-x-auto">
        <svg width={w} height={h} className="mx-auto block">
          <defs>
            <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill="#64748b" />
            </marker>
          </defs>
          {edges.map((e, idx) => {
            const a = pos.get(e.from_id)
            const b = pos.get(e.to_id)
            if (!a || !b) return null
            const color = EDGE_COLORS[e.edge_type] || EDGE_COLORS.DEFAULT
            return (
              <g key={`${e.from_id}-${e.to_id}-${idx}`}>
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={color}
                  strokeWidth={1 + (e.weight || 0.5)}
                  strokeOpacity={0.75}
                  markerEnd="url(#arrowhead)"
                />
                <title>{e.edge_type}</title>
              </g>
            )
          })}
          {nodes.map((n) => {
            const p = pos.get(n.id)
            if (!p) return null
            const fill =
              n.node_type === 'Person'
                ? '#fef3c7'
                : n.node_type === 'Event'
                  ? '#ccfbf1'
                  : n.node_type === 'Emotion'
                    ? '#fce7f3'
                    : '#f1f5f9'
            return (
              <g key={n.id} transform={`translate(${p.x}, ${p.y})`}>
                <circle r="22" fill={fill} stroke="#0f766e" strokeWidth="1.5" />
                <text
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="text-[9px] fill-ink-primary"
                  style={{ fontSize: '9px' }}
                >
                  {n.label.length > 10 ? `${n.label.slice(0, 10)}…` : n.label}
                </text>
                <title>{`${n.node_type}: ${n.label}`}</title>
              </g>
            )
          })}
        </svg>
      </div>
      <p className="text-caption text-ink-muted">
        共 {nodes.length} 个节点、{edges.length} 条联结。时间相邻记忆之间会有 TEMPORAL_NEXT；AI 还可推断因果与主题关联。
      </p>
    </div>
  )
}
