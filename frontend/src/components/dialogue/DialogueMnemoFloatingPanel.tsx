/**
 * 对话页侧栏：仅调节项（缩放、力导向、统计）；画布只在浮层内渲染，与成员页共用 MemoryRelationGraph 内核。
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'motion/react'
import { memoryApi } from '@/services/api'
import MemoryRelationGraph, { type MemoryRelationGraphHandle } from '@/components/memory/MemoryRelationGraph'
import { Button } from '@/components/ui/Button'
import { motionPresets } from '@/lib/motion'
import { panelClassFromCardStyle, useThemeAppliedSnapshot } from '@/lib/theme'
import { cn } from '@/lib/utils'
import { Maximize2, Minimize2, Network, ZoomIn, ZoomOut } from 'lucide-react'

export interface DialogueMnemoFloatingPanelProps {
  memberId: number
  expandHostRef?: RefObject<HTMLDivElement | null>
}

export default function DialogueMnemoFloatingPanel({
  memberId,
  expandHostRef,
}: DialogueMnemoFloatingPanelProps) {
  const graphRef = useRef<MemoryRelationGraphHandle>(null)
  const forceSidebarLabelId = useId()
  const [overlayOpen, setOverlayOpen] = useState(false)
  const [forceSimOn, setForceSimOn] = useState(true)
  const { cardStyle } = useThemeAppliedSnapshot()

  const { data: mnemoCounts } = useQuery({
    queryKey: ['mnemo-graph', memberId],
    queryFn: () =>
      memoryApi.mnemoGraph(memberId) as Promise<{ nodes: unknown[]; edges: unknown[] }>,
    enabled: Number.isFinite(memberId) && memberId > 0,
    staleTime: 90_000,
    select: (d) => ({
      n: d.nodes?.length ?? 0,
      e: d.edges?.length ?? 0,
    }),
  })

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

  const portalTarget = expandHostRef?.current ?? document.body
  const dockedToChatCanvas = portalTarget !== document.body

  const sidebarCard = (
    <div className={cn(sidebarMiniShell, 'flex flex-col')}>
      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 border-b border-border-default/70 bg-jade-50/60 dark:bg-jade-950/30 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0 text-caption font-medium text-ink-primary">
          <Network size={14} className="shrink-0 text-jade-600 dark:text-jade-400" aria-hidden />
          <span className="truncate">记忆神经网络</span>
        </div>
        <button
          type="button"
          className="rounded-md p-1 text-ink-muted hover:bg-subtle hover:text-ink-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-jade-500/50"
          aria-label={overlayOpen ? '收起大图' : '展开大图'}
          aria-expanded={overlayOpen}
          onClick={() => setOverlayOpen((o) => !o)}
        >
          {overlayOpen ? <Minimize2 size={15} aria-hidden /> : <Maximize2 size={15} aria-hidden />}
        </button>
      </div>

      <div className="px-2.5 py-2 space-y-2.5 shrink-0">
        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="flex-1 min-w-[4.5rem] sm:flex-initial"
            leftIcon={<ZoomIn size={14} />}
            disabled={!overlayOpen}
            title={overlayOpen ? '放大视图' : '请先展开大图'}
            onClick={() => graphRef.current?.zoomIn()}
          >
            放大
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="flex-1 min-w-[4.5rem] sm:flex-initial"
            leftIcon={<ZoomOut size={14} />}
            disabled={!overlayOpen}
            title={overlayOpen ? '缩小视图' : '请先展开大图'}
            onClick={() => graphRef.current?.zoomOut()}
          >
            缩小
          </Button>
        </div>

        <div
          className={cn(
            'inline-flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5',
            'border-border-default bg-surface dark:bg-surface/80',
          )}
        >
          <span
            id={forceSidebarLabelId}
            className="text-caption text-brand dark:text-brand-accent whitespace-nowrap"
          >
            力导向
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={forceSimOn}
            aria-labelledby={forceSidebarLabelId}
            title={
              forceSimOn
                ? '关闭后冻结当前布局，仅拖拽结点微调'
                : '开启后恢复斥力与链路拉力自动平衡'
            }
            className={cn(
              'relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ease-out',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
              forceSimOn ? 'bg-brand dark:bg-brand' : 'bg-muted dark:bg-muted',
            )}
            onClick={() => setForceSimOn((v) => !v)}
          >
            <span
              aria-hidden
              className={cn(
                'absolute top-1 left-1 block h-4 w-4 rounded-full bg-surface shadow-e1 ring-1 ring-black/10 dark:ring-white/15 transition-transform duration-200 ease-out',
                forceSimOn ? 'translate-x-[1.25rem]' : 'translate-x-0',
              )}
            />
          </button>
        </div>

        <p className="text-[11px] leading-snug text-ink-muted">
          共 {mnemoCounts?.n ?? '—'} 结点 · {mnemoCounts?.e ?? '—'} 联结
        </p>
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
          aria-label="记忆神经网络画布"
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
            <div className="flex shrink-0 justify-end border-b border-border-default/70 bg-jade-50/60 px-2 py-2 dark:bg-jade-950/30">
              <button
                type="button"
                className="rounded-lg border border-border-default px-3 py-1.5 text-caption text-ink-secondary hover:bg-subtle"
                onClick={closeOverlay}
              >
                关闭
              </button>
            </div>
            <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden p-2 sm:p-3">
              <MemoryRelationGraph
                ref={graphRef}
                memberId={memberId}
                hideToolbar
                forceSimulationOn={forceSimOn}
                onForceSimulationChange={setForceSimOn}
                rootClassName="flex min-h-0 flex-1 flex-col overflow-hidden gap-3"
                cardHeightClassName="flex min-h-0 flex-1 min-h-[320px] shadow-e1"
              />
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )

  return (
    <>
      <div className="space-y-1.5 shrink-0">{sidebarCard}</div>
      <p className="text-[10px] text-ink-muted leading-snug px-0.5">
        调节项始终在侧栏；大图内仅画布（与成员页相同的拖拽、滚轮缩放与点击高亮）。展开后可用侧栏「放大/缩小」与「力导向」。
      </p>
      {createPortal(overlayLayer, portalTarget)}
    </>
  )
}
