/**
 * 对话页侧栏：记忆关系网迷你预览；页面内大图浮窗（非系统全屏）+ 新结点聚焦缩放。
 */
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'motion/react'
import { memoryApi } from '@/services/api'
import { computeHubRingLayout, pickHubNodeId, type MnemoFramePos } from '@/lib/mnemoGraphLayout'
import { motionPresets } from '@/lib/motion'
import { panelClassFromCardStyle, useThemeAppliedSnapshot } from '@/lib/theme'
import { cn } from '@/lib/utils'
import { Maximize2, Network, Sparkles } from 'lucide-react'

type GraphNode = { id: string; node_type: string; label: string; memory_id?: number | null }
type GraphEdge = { from_id: string; to_id: string; edge_type: string; weight: number }

const EDGE_STROKE: Record<string, string> = {
  TEMPORAL_NEXT: '#0d9488',
  CAUSED_BY: '#b45309',
  RELATED_TO: '#64748b',
  EMOTIONALLY_LINKED: '#0f766e',
  SUPPORTS: '#2563eb',
  COACTIVATED_WITH: '#94a3b8',
  DEFAULT: '#94a3b8',
}

function nodeFill(nodeType: string, dark: boolean): string {
  if (nodeType === 'Person') return dark ? '#a89a7a' : '#fef3c7'
  if (nodeType === 'Event') return dark ? '#5e8070' : '#ccfbf1'
  if (nodeType === 'Emotion') return dark ? '#7a5e6a' : '#fce7f3'
  return dark ? '#5c4d3d' : '#cbd5e1'
}

function sortNewNodesForReveal(
  addedIds: string[],
  nodes: GraphNode[],
  prioritizeMemoryIds: number[],
): string[] {
  if (prioritizeMemoryIds.length === 0) return addedIds
  const pri = new Set(prioritizeMemoryIds)
  const scored = addedIds.map((id) => {
    const n = nodes.find((x) => x.id === id)
    const m = n?.memory_id
    const isPri = typeof m === 'number' && pri.has(m)
    return { id, isPri }
  })
  scored.sort((a, b) => Number(b.isPri) - Number(a.isPri))
  return scored.map((s) => s.id)
}

const SIDEBAR_DIMS = { w: 200, h: 112 }
const FULL_DIMS_FALLBACK = { w: 720, h: 420 }

/** 缩放：侧栏密集图略强；诞生/脉冲时更强 */
function focusZoom(compact: boolean, focusId: string | null, birthingIds: Set<string>): number {
  if (!focusId) return 1
  const birthing = birthingIds.has(focusId)
  if (compact) return birthing ? 1.68 : 1.45
  return birthing ? 1.28 : 1.12
}

function svgViewBoxForFocus(W: number, H: number, fx: number, fy: number, zoom: number): string {
  if (zoom <= 1.001) {
    return `0 0 ${W} ${H}`
  }
  const vw = W / zoom
  const vh = H / zoom
  let vx = fx - vw / 2
  let vy = fy - vh / 2
  vx = Math.max(0, Math.min(vx, W - vw))
  vy = Math.max(0, Math.min(vy, H - vh))
  return `${vx} ${vy} ${vw} ${vh}`
}

/** 四边标签：左外 / 右外 / 上外 / 下外，与图一档案理想效果一致（对话专用，非成员页 ForceGraph） */
function frameLabelAttrs(
  p: MnemoFramePos,
  isHub: boolean,
  compact: boolean,
): { tx: number; ty: number; textAnchor: 'start' | 'middle' | 'end'; dominantBaseline: 'auto' | 'middle' | 'hanging' } {
  const pad = compact ? 7 : 11
  if (isHub || p.edge === 'center') {
    return {
      tx: p.x,
      ty: p.y + (compact ? 12 : 17),
      textAnchor: 'middle',
      dominantBaseline: 'middle',
    }
  }
  switch (p.edge) {
    case 'top':
      return { tx: p.x, ty: p.y - pad, textAnchor: 'middle', dominantBaseline: 'auto' }
    case 'bottom':
      return { tx: p.x, ty: p.y + pad, textAnchor: 'middle', dominantBaseline: 'hanging' }
    case 'left':
      return { tx: p.x - pad, ty: p.y, textAnchor: 'end', dominantBaseline: 'middle' }
    case 'right':
      return { tx: p.x + pad, ty: p.y, textAnchor: 'start', dominantBaseline: 'middle' }
    default:
      return { tx: p.x, ty: p.y + pad, textAnchor: 'middle', dominantBaseline: 'middle' }
  }
}

function GraphSvg({
  compact,
  svgW,
  svgH,
  layout,
  nodes,
  edges,
  dark,
  reduceMotion,
  focusId,
  birthingIds,
  revealedIds,
  emotionPulseIds,
  hubId,
}: {
  compact: boolean
  svgW: number
  svgH: number
  layout: Map<string, MnemoFramePos>
  nodes: GraphNode[]
  edges: GraphEdge[]
  dark: boolean
  reduceMotion: boolean
  focusId: string | null
  birthingIds: Set<string>
  revealedIds: Set<string>
  emotionPulseIds: Set<string>
  hubId: string | null
}) {
  const W = svgW
  const H = svgH

  /** 对话页只做「枢纽辐射」，避免大图下 300+ 条边糊成力导向团（与成员详情 ForceGraph 无关） */
  const edgesToDraw = useMemo(() => {
    if (!hubId) return edges
    return edges.filter((e) => e.from_id === hubId || e.to_id === hubId)
  }, [edges, hubId])

  /** 图一：细灰辐射线；高亮脉冲仍可用语义色 */
  const spokeStroke = dark ? '#9ca3af' : '#788499'

  const edgeStrokeScale = useMemo(() => {
    const ec = edges.length
    return Math.max(0.45, 1 - Math.min(0.55, ec / 500))
  }, [edges.length])

  const focusPos = useMemo(() => {
    if (!focusId) return { x: W / 2, y: H / 2 }
    return layout.get(focusId) ?? { x: W / 2, y: H / 2 }
  }, [focusId, layout, W, H])

  const zoom = focusZoom(compact, focusId, birthingIds)
  const viewBoxTarget = svgViewBoxForFocus(W, H, focusPos.x, focusPos.y, zoom)

  return (
    <motion.svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${W} ${H}`}
      initial={false}
      animate={{
        viewBox: viewBoxTarget,
      }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : { type: 'spring', stiffness: 200, damping: 28, mass: 0.82 }
      }
      className="block select-none"
      role="img"
      aria-label="记忆关系网"
    >
      <g>
        {edgesToDraw.map((e, idx) => {
          const a = layout.get(e.from_id)
          const b = layout.get(e.to_id)
          if (!a || !b) return null
          const chroma = EDGE_STROKE[e.edge_type] ?? EDGE_STROKE.DEFAULT
          const hot =
            !reduceMotion &&
            (emotionPulseIds.has(e.from_id) ||
              emotionPulseIds.has(e.to_id) ||
              (e.edge_type === 'EMOTIONALLY_LINKED' &&
                (birthingIds.has(e.from_id) || birthingIds.has(e.to_id))))
          const bothRevealed = revealedIds.has(e.from_id) && revealedIds.has(e.to_id)
          const opacity = bothRevealed ? (compact ? 0.48 : 0.38) : compact ? 0.12 : 0.09
          const sw = (compact ? 0.65 : 0.75) * edgeStrokeScale
          const stroke = hot ? chroma : spokeStroke
          const key = `${e.from_id}-${e.to_id}-${e.edge_type}-${idx}`

          if (hot) {
            return (
              <motion.line
                key={key}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={stroke}
                strokeWidth={2.15}
                strokeOpacity={0.95}
                initial={false}
                animate={{ strokeOpacity: [0.35, 1, 0.6], strokeWidth: [sw, 2.75, sw + 0.6] }}
                transition={{ duration: 2, repeat: 1, ease: 'easeInOut' }}
              />
            )
          }
          return (
            <line
              key={key}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={stroke}
              strokeWidth={sw}
              strokeOpacity={opacity}
            />
          )
        })}
        {nodes.map((n) => {
          const p = layout.get(n.id)
          if (!p) return null
          const shown = revealedIds.has(n.id)
          const birthing = birthingIds.has(n.id)
          const isHubNode = hubId === n.id
          const r = isHubNode ? (compact ? 6.2 : 10.5) : compact ? 3.6 : 5.2
          const strokeCol =
            focusId === n.id
              ? '#f59e0b'
              : dark
                ? 'rgba(251,191,36,0.35)'
                : 'rgba(4,120,87,0.45)'
          const sw = focusId === n.id ? 1.8 : 1

          if (birthing && !reduceMotion) {
            return (
              <motion.circle
                key={n.id}
                cx={p.x}
                cy={p.y}
                r={r}
                fill={nodeFill(n.node_type, dark)}
                stroke={strokeCol}
                strokeWidth={sw}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ scale: { duration: 0.75, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.45 } }}
                style={{ transformOrigin: `${p.x}px ${p.y}px` }}
              />
            )
          }

          if (!shown) {
            return null
          }

          return (
            <circle
              key={n.id}
              cx={p.x}
              cy={p.y}
              r={r}
              fill={nodeFill(n.node_type, dark)}
              stroke={strokeCol}
              strokeWidth={sw}
            />
          )
        })}
        {nodes.map((n) => {
          const p = layout.get(n.id)
          if (!p || !revealedIds.has(n.id)) return null
          const isHubNode = hubId === n.id
          const maxChars = compact ? (isHubNode ? 14 : 7) : isHubNode ? 28 : 18
          if (compact && !isHubNode && (n.label?.length ?? 0) > 11) return null
          const fontPx = isHubNode ? (compact ? 8 : 11.5) : compact ? 7 : 10
          const raw = n.label || ''
          const labelText = raw.length > maxChars ? `${raw.slice(0, maxChars)}…` : raw
          const { tx, ty, textAnchor, dominantBaseline } = frameLabelAttrs(p, isHubNode, compact)

          return (
            <text
              key={`t-${n.id}`}
              x={tx}
              y={ty}
              textAnchor={textAnchor}
              dominantBaseline={dominantBaseline}
              className="fill-ink-primary"
              style={{
                fontSize: fontPx,
                opacity: compact ? 0.88 : 0.94,
              }}
            >
              {labelText}
            </text>
          )
        })}
        {!reduceMotion &&
          nodes.map((n) => {
            const p = layout.get(n.id)
            if (!p || !emotionPulseIds.has(n.id)) return null
            const isHubNode = hubId === n.id
            const r = isHubNode ? (compact ? 6.2 : 10.5) : compact ? 3.6 : 5.2
            return (
              <motion.circle
                key={`pulse-${n.id}`}
                cx={p.x}
                cy={p.y}
                r={r}
                fill="none"
                stroke="#f59e0b"
                strokeWidth={1.2}
                initial={{ r, opacity: 0.6 }}
                animate={{ r: r + (compact ? 14 : 22), opacity: [0.55, 0] }}
                transition={{ duration: 1.6, ease: 'easeOut' }}
              />
            )
          })}
      </g>
    </motion.svg>
  )
}

export interface DialogueMnemoFloatingPanelProps {
  memberId: number
  prioritizeMemoryIds?: number[]
  /** 大图覆盖层挂载节点：须为独占 DOM 容器（仅由 portal 写入），勿与页面其它 React 子树共用同一父节点 */
  expandHostRef?: RefObject<HTMLDivElement | null>
}

export default function DialogueMnemoFloatingPanel({
  memberId,
  prioritizeMemoryIds = [],
  expandHostRef,
}: DialogueMnemoFloatingPanelProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['mnemo-graph', memberId],
    queryFn: () =>
      memoryApi.mnemoGraph(memberId) as Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }>,
    enabled: Number.isFinite(memberId) && memberId > 0,
    staleTime: 90_000,
    gcTime: 6 * 60_000,
    refetchOnWindowFocus: false,
  })

  const [dark, setDark] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(false)
  const [overlayOpen, setOverlayOpen] = useState(false)
  const { cardStyle } = useThemeAppliedSnapshot()

  const fullGraphAreaRef = useRef<HTMLDivElement>(null)
  const [fullBox, setFullBox] = useState(FULL_DIMS_FALLBACK)

  useEffect(() => {
    const run = () => setDark(document.documentElement.classList.contains('dark'))
    run()
    const obs = new MutationObserver(run)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const u = () => setReduceMotion(mq.matches)
    u()
    mq.addEventListener('change', u)
    return () => mq.removeEventListener('change', u)
  }, [])

  useEffect(() => {
    if (!overlayOpen) {
      setFullBox(FULL_DIMS_FALLBACK)
      return
    }
    const obsEl = fullGraphAreaRef.current
    if (!obsEl || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect
      if (!cr) return
      const w = Math.max(320, Math.floor(cr.width - 16))
      const h = Math.max(280, Math.floor(cr.height - 16))
      setFullBox({ w, h })
    })
    ro.observe(obsEl)
    return () => ro.disconnect()
  }, [overlayOpen])

  const nodes = useMemo(() => {
    if (!data?.nodes?.length) return [] as GraphNode[]
    return data.nodes.map((n) => ({ ...n, id: String(n.id) }))
  }, [data])

  const edges = useMemo(() => {
    if (!data?.edges?.length) return [] as GraphEdge[]
    return data.edges.map((e) => ({
      ...e,
      from_id: String(e.from_id),
      to_id: String(e.to_id),
    }))
  }, [data])

  const forceEdges = useMemo(
    () => edges.map((e) => ({ from: e.from_id, to: e.to_id })),
    [edges],
  )

  const nodeTypes = useMemo(
    () => new Map(nodes.map((n) => [n.id, n.node_type] as const)),
    [nodes],
  )

  const hubId = useMemo(() => {
    if (nodes.length === 0) return null
    const ids = nodes.map((n) => n.id)
    return pickHubNodeId(ids, forceEdges, nodeTypes)
  }, [nodes, forceEdges, nodeTypes])

  const prevIdsRef = useRef<Set<string>>(new Set())
  const initRef = useRef(false)
  const [revealedIds, setRevealedIds] = useState<Set<string>>(() => new Set())
  const [birthingIds, setBirthingIds] = useState<Set<string>>(() => new Set())
  const [emotionPulseIds, setEmotionPulseIds] = useState<Set<string>>(() => new Set())
  const [focusId, setFocusId] = useState<string | null>(null)
  const queueTimerRef = useRef<number | null>(null)
  const priRef = useRef<number[]>([])

  useEffect(() => {
    priRef.current = prioritizeMemoryIds
  }, [prioritizeMemoryIds])

  useEffect(() => {
    return () => {
      if (queueTimerRef.current) clearTimeout(queueTimerRef.current)
    }
  }, [])

  useEffect(() => {
    prevIdsRef.current = new Set()
    initRef.current = false
    setRevealedIds(new Set())
    setBirthingIds(new Set())
    setEmotionPulseIds(new Set())
    setFocusId(null)
  }, [memberId])

  const flushRevealQueue = useCallback(
    (orderedIds: string[]) => {
      if (orderedIds.length === 0) return

      if (reduceMotion) {
        setRevealedIds((prev) => new Set([...prev, ...orderedIds]))
        setBirthingIds(new Set())
        const pulse = new Set<string>()
        for (const id of orderedIds) {
          const n = nodes.find((x) => x.id === id)
          if (n?.node_type === 'Emotion') pulse.add(id)
          const hot = edges.some(
            (e) => (e.from_id === id || e.to_id === id) && e.edge_type === 'EMOTIONALLY_LINKED',
          )
          if (hot) pulse.add(id)
        }
        setEmotionPulseIds(pulse)
        setFocusId(orderedIds[orderedIds.length - 1] ?? null)
        window.setTimeout(() => setEmotionPulseIds(new Set()), 1800)
        return
      }

      let i = 0
      const step = () => {
        if (i >= orderedIds.length) {
          queueTimerRef.current = null
          const last = orderedIds[orderedIds.length - 1] ?? null
          if (last) setFocusId(last)
          return
        }
        const id = orderedIds[i]!
        i += 1
        setFocusId(id)
        setBirthingIds((prev) => new Set(prev).add(id))
        window.setTimeout(() => {
          setRevealedIds((prev) => new Set(prev).add(id))
          setBirthingIds((prev) => {
            const nx = new Set(prev)
            nx.delete(id)
            return nx
          })
          const n = nodes.find((x) => x.id === id)
          const isEmotionNode = n?.node_type === 'Emotion'
          const hasEmotionEdge = edges.some(
            (e) => (e.from_id === id || e.to_id === id) && e.edge_type === 'EMOTIONALLY_LINKED',
          )
          if (isEmotionNode || hasEmotionEdge) {
            setEmotionPulseIds((prev) => new Set(prev).add(id))
            window.setTimeout(() => {
              setEmotionPulseIds((prev) => {
                const nx = new Set(prev)
                nx.delete(id)
                return nx
              })
            }, 2200)
          }
        }, 420)
        queueTimerRef.current = window.setTimeout(step, 820)
      }
      step()
    },
    [reduceMotion, nodes, edges],
  )

  useEffect(() => {
    if (!data?.nodes || isLoading) return
    const ids = new Set(nodes.map((n) => n.id))
    if (!initRef.current) {
      initRef.current = true
      prevIdsRef.current = ids
      setRevealedIds(ids)
      return
    }
    const prev = prevIdsRef.current
    const added = [...ids].filter((id) => !prev.has(id))
    prevIdsRef.current = ids
    if (added.length === 0) return

    if (queueTimerRef.current) {
      clearTimeout(queueTimerRef.current)
      queueTimerRef.current = null
    }

    const ordered = sortNewNodesForReveal(added, nodes, priRef.current)
    setRevealedIds((prevSet) => {
      const nx = new Set(prevSet)
      for (const id of added) nx.delete(id)
      return nx
    })
    flushRevealQueue(ordered)
  }, [data, isLoading, nodes, flushRevealQueue])

  const layoutSidebar = useMemo(() => {
    if (nodes.length === 0) return new Map<string, MnemoFramePos>()
    const ids = nodes.map((n) => n.id)
    return computeHubRingLayout(ids, forceEdges, SIDEBAR_DIMS.w, SIDEBAR_DIMS.h, nodeTypes)
  }, [nodes, forceEdges, nodeTypes])

  const layoutFull = useMemo(() => {
    if (!overlayOpen || nodes.length === 0) {
      return new Map<string, MnemoFramePos>()
    }
    const ids = nodes.map((n) => n.id)
    const { w, h } = fullBox
    return computeHubRingLayout(ids, forceEdges, w, h, nodeTypes)
  }, [nodes, forceEdges, nodeTypes, overlayOpen, fullBox.w, fullBox.h])

  const closeOverlay = useCallback(() => {
    setOverlayOpen(false)
  }, [])

  useEffect(() => {
    if (!overlayOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeOverlay()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [overlayOpen, closeOverlay])

  const empty = !isLoading && !isError && nodes.length === 0

  const portalTarget = expandHostRef?.current ?? document.body
  const dockedToChatCanvas = portalTarget !== document.body

  /** 与对话侧栏「档案角色」同源：DIY 液态玻璃；大图外层用暖色 scrim，不用深色块 */
  const mnemoGlassShell = useMemo(
    () =>
      cn(
        panelClassFromCardStyle(cardStyle),
        'backdrop-blur-xl shadow-e3',
        'ring-0 outline-none focus-visible:ring-0 focus-visible:outline-none',
      ),
    [cardStyle],
  )

  const sidebarMiniShell = useMemo(
    () =>
      cn(
        panelClassFromCardStyle(cardStyle),
        'backdrop-blur-xl shadow-e1 overflow-hidden rounded-xl',
        'ring-0 outline-none',
      ),
    [cardStyle],
  )

  const sidebarBody = (
    <div className={cn(sidebarMiniShell, 'h-[124px]')}>
      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 border-b border-border-default/70 bg-jade-50/60 dark:bg-jade-950/30">
        <div className="flex items-center gap-1.5 min-w-0 text-caption font-medium text-ink-primary">
          <Network size={14} className="shrink-0 text-jade-600 dark:text-jade-400" aria-hidden />
          <span className="truncate">记忆神经网络</span>
          {birthingIds.size > 0 ? (
            <Sparkles size={12} className="shrink-0 text-amber-500" aria-hidden />
          ) : null}
        </div>
        <Maximize2 size={14} className="text-ink-muted shrink-0" aria-hidden />
      </div>
      <div className="relative h-[88px]">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center text-caption text-ink-muted">
            载入图谱…
          </div>
        ) : isError ? (
          <div className="absolute inset-0 flex items-center justify-center text-caption text-red-600/90 px-2 text-center">
            关系网暂不可用
          </div>
        ) : empty ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-[11px] text-ink-muted px-2 text-center leading-relaxed">
            写入记忆或勾选「精炼并写入关系网」发送后，新结点将在此缓缓显现
          </div>
        ) : (
          <GraphSvg
            compact
            svgW={SIDEBAR_DIMS.w}
            svgH={SIDEBAR_DIMS.h}
            layout={layoutSidebar}
            nodes={nodes}
            edges={edges}
            dark={dark}
            reduceMotion={reduceMotion}
            focusId={focusId}
            birthingIds={birthingIds}
            revealedIds={revealedIds}
            emotionPulseIds={emotionPulseIds}
            hubId={hubId}
          />
        )}
      </div>
    </div>
  )

  const overlayLayer = (
    <AnimatePresence mode="wait">
      {overlayOpen ? (
        <motion.div
          key="mnemo-overlay"
          role="dialog"
          tabIndex={-1}
          aria-modal="true"
          aria-label="记忆神经网络大图预览"
          className={
            dockedToChatCanvas
              ? 'pointer-events-auto absolute inset-0 flex min-h-0 flex-col overflow-hidden bg-warm-50/52 p-2 outline-none ring-0 backdrop-blur-md focus:outline-none focus-visible:ring-0 dark:bg-[#1a120b]/44 dark:backdrop-blur-lg sm:p-3'
              : 'pointer-events-auto fixed inset-0 z-[120] flex items-center justify-center overflow-hidden bg-warm-50/48 p-3 outline-none ring-0 backdrop-blur-md focus:outline-none focus-visible:ring-0 dark:bg-[#0f0c0a]/52 dark:backdrop-blur-lg sm:p-6'
          }
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={motionPresets.gentle}
          onClick={closeOverlay}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={motionPresets.confident}
            className={
              dockedToChatCanvas
                ? cn(
                    mnemoGlassShell,
                    'flex min-h-0 min-w-0 h-full max-h-full w-full flex-1 flex-col overflow-hidden rounded-2xl',
                  )
                : cn(
                    mnemoGlassShell,
                    'flex h-[min(86svh,880px)] w-full max-w-[min(96vw,1320px)] min-h-[280px] flex-col overflow-hidden rounded-2xl',
                  )
            }
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border-default/70 bg-jade-50/60 px-3 py-2.5 dark:bg-jade-950/30">
              <div className="flex items-center gap-2 text-body-sm font-medium text-ink-primary">
                <Network size={18} className="text-jade-600 dark:text-jade-400" aria-hidden />
                记忆神经网络
              </div>
              <button
                type="button"
                className="rounded-lg border border-border-default px-3 py-1.5 text-caption text-ink-secondary hover:bg-subtle"
                onClick={closeOverlay}
              >
                关闭
              </button>
            </div>
            <div ref={fullGraphAreaRef} className="relative min-h-0 w-full flex-1 overflow-hidden p-2">
              {isLoading ? (
                <div className="flex h-full min-h-[200px] items-center justify-center text-caption text-ink-muted">
                  载入图谱…
                </div>
              ) : isError ? (
                <div className="flex h-full min-h-[200px] items-center justify-center px-4 text-center text-caption text-red-600/90">
                  关系网暂不可用
                </div>
              ) : empty ? (
                <div className="flex h-full min-h-[200px] items-center justify-center px-6 text-center text-body-sm text-ink-muted">
                  暂无结点。请先通过对话写入记忆。
                </div>
              ) : (
                <GraphSvg
                  compact={false}
                  svgW={fullBox.w}
                  svgH={fullBox.h}
                  layout={layoutFull}
                  nodes={nodes}
                  edges={edges}
                  dark={dark}
                  reduceMotion={reduceMotion}
                  focusId={focusId}
                  birthingIds={birthingIds}
                  revealedIds={revealedIds}
                  emotionPulseIds={emotionPulseIds}
                  hubId={hubId}
                />
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )

  return (
    <>
      <div className="space-y-1.5 shrink-0">
        <button
          type="button"
          className="w-full text-left rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-jade-500/50"
          onClick={() => setOverlayOpen(true)}
          aria-expanded={overlayOpen}
          aria-haspopup="dialog"
        >
          {sidebarBody}
        </button>
        <p className="text-[10px] text-ink-muted leading-snug px-0.5">
          在主对话区展开大图（遮罩仅罩住中间聊天画布，侧栏与输入栏仍可见）
        </p>
      </div>

      {createPortal(overlayLayer, portalTarget)}
    </>
  )
}
