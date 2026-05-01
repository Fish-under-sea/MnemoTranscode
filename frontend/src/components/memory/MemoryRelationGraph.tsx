/**
 * 成员记忆关系网：力导向 + 可拖拽 + 全屏 + 点击节点点亮链路动效（沿边粒子）
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { memoryApi } from '@/services/api'
import { LoadingState } from '@/components/ui/state'
import { computeForceLayout } from '@/lib/mnemoGraphLayout'
import { buildLinkKey, computeHighlightedKeys } from '@/lib/mnemoGraphHighlight'
import ForceGraph2D, {
  type ForceGraphMethods,
  type LinkObject,
  type NodeObject,
} from 'react-force-graph-2d'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { Focus, Maximize2, Minimize2, MousePointer2, Sparkles } from 'lucide-react'

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

interface FgNode {
  id: string
  label: string
  node_type: string
  memory_id?: number | null
  x?: number
  y?: number
}

interface FgLink {
  source: string
  target: string
  edge_type: string
  weight: number
  __key: string
  __curve: number
}

function useIsDark() {
  const [dark, setDark] = useState(false)
  useEffect(() => {
    const run = () => setDark(document.documentElement.classList.contains('dark'))
    run()
    const obs = new MutationObserver(run)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])
  return dark
}

function useGraphDimensions() {
  const outerRef = useRef<HTMLDivElement>(null)
  const graphBoxRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ w: 640, h: 400 })

  useEffect(() => {
    const el = graphBoxRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect()
      setDims({
        w: Math.max(320, Math.floor(r.width)),
        h: Math.max(280, Math.floor(r.height)),
      })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return { outerRef, graphBoxRef, dims }
}

/** force-graph 的 ref 节点类型别名（避免在组件内声明） */
type FGNodeObj = NodeObject<FgNode>
type FGLinkObj = LinkObject<FgNode, FgLink>

export default function MemoryRelationGraph({ memberId }: { memberId: number }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['mnemo-graph', memberId],
    queryFn: () => memoryApi.mnemoGraph(memberId) as Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }>,
    enabled: Number.isFinite(memberId) && memberId > 0,
  })

  const fgRef = useRef<ForceGraphMethods<FGNodeObj, FGLinkObj> | undefined>(undefined)
  const [fullscreen, setFullscreen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { outerRef, graphBoxRef, dims } = useGraphDimensions()
  const isDark = useIsDark()

  const [reduceMotion, setReduceMotion] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const u = () => setReduceMotion(mq.matches)
    u()
    mq.addEventListener('change', u)
    return () => mq.removeEventListener('change', u)
  }, [])

  useEffect(() => {
    const onFs = () => {
      if (!document.fullscreenElement) setFullscreen(false)
    }
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  const { nodes, edges } = useMemo(() => {
    if (!data?.nodes?.length) {
      return { nodes: [] as GraphNode[], edges: [] as GraphEdge[] }
    }
    return {
      nodes: data.nodes.map((n) => ({ ...n, id: String(n.id) })),
      edges: data.edges.map((e) => ({
        ...e,
        from_id: String(e.from_id),
        to_id: String(e.to_id),
      })),
    }
  }, [data])

  const { linkKeys: activeLinkKeys, nodeIds: activeNodeIds } = useMemo(
    () => computeHighlightedKeys(selectedId, edges),
    [selectedId, edges],
  )

  const graphData = useMemo(() => {
    if (!nodes.length) return { nodes: [] as FgNode[], links: [] as FgLink[] }
    const w = Math.max(400, dims.w)
    const h = Math.max(300, dims.h)
    const ids = nodes.map((n) => n.id)
    const fe = edges.map((e) => ({ from: e.from_id, to: e.to_id }))
    const seed = computeForceLayout(ids, fe, w, h, nodes.length > 28 ? 44 : 56)
    const fgNodes: FgNode[] = nodes.map((n) => {
      const p = seed.get(n.id)
      return {
        id: n.id,
        label: n.label,
        node_type: n.node_type,
        memory_id: n.memory_id,
        ...(p ? { x: p.x, y: p.y } : {}),
      }
    })
    const links: FgLink[] = edges.map((e, idx) => ({
      source: e.from_id,
      target: e.to_id,
      edge_type: e.edge_type,
      weight: e.weight,
      __key: buildLinkKey(e.from_id, e.to_id, e.edge_type, idx),
      __curve: ((idx % 5) - 2) * 0.04,
    }))
    return { nodes: fgNodes, links }
  }, [nodes, edges, dims.w, dims.h])

  useEffect(() => {
    if (selectedId) fgRef.current?.d3ReheatSimulation?.()
  }, [selectedId])

  const bgColor = isDark ? '#1a1510' : '#FEFEF9'

  const nodeColor = useCallback(
    (n: FgNode) => {
      const dim = isDark ? '#5c4d3d' : '#cbd5e1'
      if (selectedId && n.id === selectedId) return '#f59e0b'
      if (selectedId && activeNodeIds.has(n.id)) {
        if (n.node_type === 'Person') return '#fde68a'
        if (n.node_type === 'Event') return '#5eead4'
        if (n.node_type === 'Emotion') return '#f9a8d4'
        return '#6ee7b7'
      }
      if (n.node_type === 'Person') return isDark ? '#a89a7a' : '#fef3c7'
      if (n.node_type === 'Event') return isDark ? '#5e8070' : '#ccfbf1'
      if (n.node_type === 'Emotion') return isDark ? '#7a5e6a' : '#fce7f3'
      return dim
    },
    [selectedId, activeNodeIds, isDark],
  )

  const linkColor = useCallback(
    (l: FgLink) => {
      const base = EDGE_COLORS[l.edge_type] || EDGE_COLORS.DEFAULT
      if (!selectedId) return base + 'cc'
      if (activeLinkKeys.has(l.__key)) return base
      return isDark ? 'rgba(120,100,80,0.14)' : 'rgba(100,116,139,0.18)'
    },
    [selectedId, activeLinkKeys, isDark],
  )

  const linkWidth = useCallback(
    (l: FgLink) => {
      const w0 = 0.7 + Math.min(1.6, (l.weight || 0.5) * 1.2)
      if (!selectedId) return w0
      if (activeLinkKeys.has(l.__key)) return w0 + 1.6
      return 0.35
    },
    [selectedId, activeLinkKeys],
  )

  const linkParticles = useCallback(
    (l: FgLink) => {
      if (reduceMotion) return 0
      if (!selectedId) return nodes.length > 35 ? 0 : 1
      if (activeLinkKeys.has(l.__key)) return l.edge_type === 'TEMPORAL_NEXT' ? 3 : 2
      return 0
    },
    [selectedId, activeLinkKeys, reduceMotion, nodes.length],
  )

  const nodeCanvasObject = useCallback(
    (node: FgNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const r = selectedId === node.id ? 7 : 5.5
      const cx = node.x ?? 0
      const cy = node.y ?? 0
      const lit = !selectedId || activeNodeIds.has(node.id)
      if (lit && selectedId) {
        ctx.beginPath()
        ctx.arc(cx, cy, r + 4, 0, 2 * Math.PI, false)
        ctx.fillStyle = selectedId === node.id ? 'rgba(245,158,11,0.22)' : 'rgba(16,185,129,0.12)'
        ctx.fill()
      }
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, 2 * Math.PI, false)
      ctx.fillStyle = nodeColor(node)
      ctx.fill()
      ctx.strokeStyle = isDark ? 'rgba(251,191,36,0.35)' : 'rgba(4,120,87,0.45)'
      ctx.lineWidth = selectedId === node.id ? 2 / globalScale : 1 / globalScale
      ctx.stroke()

      const fontPx = Math.max(8, 11 / globalScale)
      ctx.font = `${fontPx}px "Noto Sans SC", "Source Han Sans SC", sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillStyle = isDark ? '#f5e6c8' : '#064e3b'
      const raw = node.label || ''
      const txt = raw.length > 10 ? `${raw.slice(0, 10)}…` : raw
      ctx.fillText(txt, cx, cy + r + 2 / globalScale)
    },
    [selectedId, activeNodeIds, nodeColor, isDark],
  )

  const nodePointerAreaPaint = useCallback(
    (node: FgNode, color: string, ctx: CanvasRenderingContext2D) => {
      const r = 14
      ctx.beginPath()
      ctx.arc(node.x ?? 0, node.y ?? 0, r, 0, 2 * Math.PI, false)
      ctx.fillStyle = color
      ctx.fill()
    },
    [],
  )

  const toggleFullscreen = async () => {
    const el = outerRef.current
    if (!el) return
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen()
        setFullscreen(true)
      } else {
        await document.exitFullscreen()
        setFullscreen(false)
      }
    } catch {
      setFullscreen((v) => !v)
    }
  }

  if (isLoading) {
    return (
      <div className="py-8">
        <LoadingState message="加载记忆网络…" />
      </div>
    )
  }
  if (isError || !data) {
    return <p className="text-caption text-ink-muted">关系网暂不可用</p>
  }
  if (nodes.length === 0) {
    return (
      <div className="text-caption text-ink-muted space-y-2">
        <p>
          还没有网络节点。使用「导入聊天记录」并<strong className="text-ink-secondary">勾选由 AI 构建关系</strong>
          （导入时默认开启），系统会用 LLM 与 Engram 提炼分叉联结；也可在 AI 对话中开启「对话后提炼记忆」。
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-caption text-ink-secondary items-center">
        {(Object.keys(EDGE_COLORS) as string[])
          .filter((k) => k !== 'DEFAULT')
          .slice(0, 5)
          .map((k) => (
            <span key={k} className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: EDGE_COLORS[k] }} />
              {k}
            </span>
          ))}
        <span className="inline-flex items-center gap-1 text-ink-muted ml-auto">
          <MousePointer2 size={12} className="shrink-0 opacity-70" />
          可拖拽节点 · 滚轮缩放 · 点击点亮链路
        </span>
      </div>

      <div
        ref={outerRef}
        className={cn(
          'relative flex flex-col rounded-xl border border-border-default overflow-hidden transition-shadow duration-300',
          fullscreen
            ? 'fixed inset-0 z-[200] h-dvh rounded-none border-0 shadow-none'
            : 'shadow-e1 h-[min(540px,72vh)]',
        )}
        style={{ backgroundColor: bgColor }}
      >
        <div
          className={cn(
            'flex flex-wrap items-center gap-2 px-2 py-2 shrink-0 border-b border-border-default/60 bg-subtle/40 backdrop-blur-sm',
            fullscreen && 'px-4 py-3',
          )}
        >
          <Button type="button" size="sm" variant="secondary" leftIcon={<Focus size={16} />} onClick={() => fgRef.current?.zoomToFit?.(400, 24)}>
            适配画布
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            leftIcon={fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            onClick={() => void toggleFullscreen()}
          >
            {fullscreen ? '退出全屏' : '全屏'}
          </Button>
          {selectedId ? (
            <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedId(null)} leftIcon={<Sparkles size={16} />}>
              清除高亮
            </Button>
          ) : null}
          <span className="text-caption text-ink-muted ml-auto hidden sm:inline">
            共 {nodes.length} 结点 · {edges.length} 联结
          </span>
        </div>

        <div ref={graphBoxRef} className="flex-1 min-h-0 min-w-0 w-full">
          <ForceGraph2D<FgNode, FgLink>
            ref={fgRef}
            graphData={graphData}
            width={Math.max(320, dims.w)}
            height={Math.max(280, dims.h)}
            backgroundColor={bgColor}
            nodeLabel={(n) => `${n.node_type}: ${n.label}`}
            nodeCanvasObjectMode={() => 'replace'}
            nodeCanvasObject={nodeCanvasObject}
            nodePointerAreaPaint={nodePointerAreaPaint}
            linkColor={linkColor}
            linkWidth={linkWidth}
            linkDirectionalArrowLength={3.5}
            linkDirectionalArrowRelPos={1}
            linkDirectionalArrowColor={linkColor}
            linkCurvature={(l) => (l as FgLink).__curve}
            linkDirectionalParticles={linkParticles}
            linkDirectionalParticleSpeed={0.006}
            linkDirectionalParticleWidth={2.2}
            linkDirectionalParticleColor={linkColor}
            onNodeClick={(n) => setSelectedId(String(n.id))}
            onBackgroundClick={() => setSelectedId(null)}
            enableNodeDrag
            enablePanInteraction
            enableZoomInteraction
            minZoom={0.35}
            maxZoom={8}
            d3AlphaDecay={0.016}
            d3VelocityDecay={0.24}
            warmupTicks={96}
            cooldownTicks={reduceMotion ? 40 : 120}
          />
        </div>
      </div>

      <p className="text-caption text-ink-muted">
        导入聊天记录时系统会调用 AI 与时间链共同绘制联结。点击任一节点可点亮其时间链片段及直接关联边；拖动能整理布局；全屏便于细看分叉结构。
      </p>
    </div>
  )
}
