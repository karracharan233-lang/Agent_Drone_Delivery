import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import type { PlanResult } from '@/lib/planner'
import { PRIORITY_COLORS } from './MapView'

interface Props {
  result: PlanResult | null
  exploreStep: number | null
  onExploreStep: (i: number | null) => void
  nodeName: (id: string) => string
  collapsed: boolean
  onToggleCollapsed: () => void
}

type Tab = 'plan' | 'dijkstra' | 'queue' | 'compare'

const TABS: { id: Tab; label: string }[] = [
  { id: 'plan', label: 'Route Plan' },
  { id: 'dijkstra', label: 'Dijkstra Trace' },
  { id: 'queue', label: 'Priority Queue' },
  { id: 'compare', label: 'TSP Comparison' },
]

export default function TracePanel({ result, exploreStep, onExploreStep, nodeName, collapsed, onToggleCollapsed }: Props) {
  const [tab, setTab] = useState<Tab>('plan')

  const goDijkstra = () => {
    setTab('dijkstra')
    if (exploreStep == null && result) onExploreStep(0)
  }

  return (
    <div className="glass pointer-events-auto flex w-full flex-col rounded-t-xl border-b-0">
      <div className="flex items-center gap-1 overflow-x-auto px-2 pt-1 slim-scroll">
        <button
          onClick={onToggleCollapsed}
          className="mr-1 flex h-11 w-8 shrink-0 items-center justify-center text-[#9a9aab] hover:text-[#e0e0e0]"
          aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
        >
          {collapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => (t.id === 'dijkstra' ? goDijkstra() : (setTab(t.id), onExploreStep(null)))}
            className={`shrink-0 border-b-2 px-3 py-2.5 text-xs font-medium transition-colors min-h-[44px] ${
              tab === t.id ? 'border-[#00aaff] text-[#e0e0e0]' : 'border-transparent text-[#9a9aab] hover:text-[#c6c6d2]'
            }`}
          >
            {t.label}
          </button>
        ))}
        {result && (
          <div className="ml-auto flex shrink-0 items-center gap-3 pr-3 font-mono2 text-[11px]">
            <span className="text-[#34d399]">{result.best.lengthKm.toFixed(2)} km tour</span>
            <span className="text-[#9a9aab]">/ {result.batteryKm.toFixed(1)} km budget</span>
            {result.rejected.length > 0 && <span className="text-[#f87171]">{result.rejected.length} rejected</span>}
          </div>
        )}
      </div>

      {!collapsed && (
        <div className="min-h-0 flex-1 overflow-y-auto border-t border-[#2a2b36] slim-scroll">
          {!result ? (
            <EmptyState />
          ) : tab === 'plan' ? (
            <PlanTab result={result} nodeName={nodeName} />
          ) : tab === 'dijkstra' ? (
            <DijkstraTab result={result} exploreStep={exploreStep} onExploreStep={onExploreStep} />
          ) : tab === 'queue' ? (
            <QueueTab result={result} nodeName={nodeName} />
          ) : (
            <CompareTab result={result} />
          )}
        </div>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-8 text-center">
      <p className="text-sm font-medium text-[#e0e0e0]">No mission planned yet</p>
      <p className="max-w-md text-xs leading-relaxed text-[#9a9aab]">
        Set the battery budget and delivery priorities in Mission Control, then press <span className="text-[#00aaff]">Run Planner</span>.
        The planner will schedule deliveries by priority, compute shortest corridors with Dijkstra, sequence the tour with TSP solvers,
        and reject any route that busts the battery.
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function PlanTab({ result, nodeName }: { result: PlanResult; nodeName: (id: string) => string }) {
  const headroom = result.batteryKm - result.best.lengthKm
  return (
    <div className="grid gap-4 p-4 lg:grid-cols-[1fr_280px]">
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="rounded bg-[#173026] px-2 py-1 font-mono2 text-[11px] font-semibold text-[#34d399]">
            ACCEPTED · {result.best.order.length} stops · {result.best.lengthKm.toFixed(2)} km
          </span>
          <span className={`rounded px-2 py-1 font-mono2 text-[11px] font-semibold ${headroom >= 0 ? 'bg-[#16233a] text-[#00aaff]' : 'bg-[#3a1a1a] text-[#f87171]'}`}>
            {headroom >= 0 ? `${headroom.toFixed(2)} km battery headroom` : 'OVER BUDGET'}
          </span>
        </div>
        <ol className="space-y-1.5">
          {result.legs.map((leg, i) => (
            <li key={i} className="flex items-start gap-3 rounded-lg bg-[#1b1c26] px-3 py-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#34d399] font-mono2 text-[10px] font-bold text-[#06130d]">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-[#e0e0e0]">
                  {nodeName(leg.from)} <span className="text-[#6a6f88]">→</span> {nodeName(leg.to)}
                </div>
                <div className="mt-0.5 truncate font-mono2 text-[10px] text-[#6a6f88]">corridor: {leg.corridorPath.join(' → ')}</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-mono2 text-xs text-[#00aaff]">{leg.km.toFixed(2)} km</div>
                <div className="font-mono2 text-[10px] text-[#6a6f88]">Σ {leg.cumulativeKm.toFixed(2)}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <div>
        <div className="mb-2 text-[11px] font-semibold tracking-[0.14em] text-[#9a9aab] uppercase">Battery gauge</div>
        <div className="h-3 overflow-hidden rounded-full bg-[#2a2b36]">
          <div
            className={`h-full rounded-full ${headroom >= 0 ? 'bg-gradient-to-r from-[#00aaff] to-[#34d399]' : 'bg-[#f87171]'}`}
            style={{ width: `${Math.min(100, (result.best.lengthKm / result.batteryKm) * 100)}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between font-mono2 text-[10px] text-[#6a6f88]">
          <span>0</span>
          <span>{result.batteryKm.toFixed(1)} km</span>
        </div>
        {result.rejected.length > 0 && (
          <>
            <div className="mb-2 mt-4 text-[11px] font-semibold tracking-[0.14em] text-[#f87171] uppercase">
              Rejected · {result.rejected.length}
            </div>
            <div className="space-y-2">
              {result.rejected.map((r, i) => (
                <div key={i} className="rounded-lg border border-[#f87171]/30 bg-[#f87171]/5 px-3 py-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-[#e0e0e0]">
                    <span className="h-2 w-2 rounded-full" style={{ background: PRIORITY_COLORS[r.priority] }} />
                    {nodeName(r.nodeId)}
                    <span className="ml-auto font-mono2 text-[10px] text-[#f87171]">
                      {r.neededKm.toFixed(2)} &gt; {r.budgetKm.toFixed(1)} km
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-[#9a9aab]">{r.reason}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function DijkstraTab({
  result,
  exploreStep,
  onExploreStep,
}: {
  result: PlanResult
  exploreStep: number | null
  onExploreStep: (i: number | null) => void
}) {
  const total = result.dijkstra.steps.length
  const idx = Math.min(exploreStep ?? 0, total - 1)
  const step = result.dijkstra.steps[idx]
  const [playing, setPlaying] = useState(false)
  const idxRef = useRef(idx)
  idxRef.current = idx

  useEffect(() => {
    if (!playing) return
    const t = setInterval(() => {
      const next = Math.min(idxRef.current + 1, total - 1)
      onExploreStep(next)
      if (next >= total - 1) setPlaying(false)
    }, 650)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, total])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-[#2a2b36] px-4 py-2">
        <button
          onClick={() => {
            setPlaying(false)
            onExploreStep(Math.max(0, idx - 1))
          }}
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#4a4a5a] text-[#c6c6d2] hover:bg-[#2a2b36]"
          aria-label="Previous step"
        >
          <SkipBack size={15} />
        </button>
        <button
          onClick={() => {
            if (!playing && idx >= total - 1) onExploreStep(0)
            setPlaying(!playing)
          }}
          className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#00aaff] text-[#06121c] hover:bg-[#33bdff]"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause size={15} /> : <Play size={15} />}
        </button>
        <button
          onClick={() => {
            setPlaying(false)
            onExploreStep(Math.min(total - 1, idx + 1))
          }}
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#4a4a5a] text-[#c6c6d2] hover:bg-[#2a2b36]"
          aria-label="Next step"
        >
          <SkipForward size={15} />
        </button>
        <input
          type="range"
          min={0}
          max={total - 1}
          value={idx}
          onChange={(e) => {
            setPlaying(false)
            onExploreStep(parseInt(e.target.value))
          }}
          className="ops-slider mx-2 flex-1"
          aria-label="Dijkstra step"
        />
        <span className="font-mono2 text-[11px] text-[#9a9aab]">
          {idx + 1}/{total}
        </span>
        <button
          onClick={() => {
            setPlaying(false)
            onExploreStep(null)
          }}
          className="hidden rounded-lg border border-[#4a4a5a] px-3 text-xs text-[#9a9aab] hover:bg-[#2a2b36] sm:block h-11"
        >
          Exit trace
        </button>
      </div>
      <div className="grid flex-1 gap-4 overflow-y-auto p-4 slim-scroll lg:grid-cols-[1fr_300px]">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded px-2 py-0.5 font-mono2 text-[10px] font-bold uppercase ${
                step.action === 'extract'
                  ? 'bg-[#16233a] text-[#00aaff]'
                  : step.action === 'relax'
                    ? 'bg-[#173026] text-[#34d399]'
                    : step.action === 'stale'
                      ? 'bg-[#3a2e12] text-[#fbbf24]'
                      : 'bg-[#2a2b36] text-[#9a9aab]'
              }`}
            >
              {step.action}
            </span>
            <span className="font-mono2 text-xs text-[#e0e0e0]">{step.node}</span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[#c6c6d2]">{step.note}</p>
          <div className="mt-3">
            <div className="mb-1 text-[10px] font-semibold tracking-[0.14em] text-[#6a6f88] uppercase">Settled nodes</div>
            <div className="flex flex-wrap gap-1">
              {step.settled.length === 0 ? (
                <span className="font-mono2 text-[11px] text-[#6a6f88]">—</span>
              ) : (
                step.settled.map((s) => (
                  <span key={s} className="rounded bg-[#16233a] px-1.5 py-0.5 font-mono2 text-[10px] text-[#00aaff]">
                    {s}·{result.dijkstra.dist[s].toFixed(1)}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
        <div>
          <div className="mb-1 text-[10px] font-semibold tracking-[0.14em] text-[#6a6f88] uppercase">
            Min-heap priority queue · {step.pq.length}
          </div>
          <div className="space-y-1">
            {step.pq.length === 0 && <span className="font-mono2 text-[11px] text-[#6a6f88]">empty</span>}
            {[...step.pq]
              .sort((a, b) => a.priority - b.priority)
              .map((e, i) => (
                <div key={`${e.key}-${i}`} className="flex items-center justify-between rounded bg-[#1b1c26] px-2 py-1">
                  <span className="font-mono2 text-[11px] text-[#e0e0e0]">
                    {i === 0 && <span className="mr-1 text-[#fbbf24]">▸</span>}
                    {e.key}
                  </span>
                  <span className="font-mono2 text-[11px] text-[#00aaff]">{e.priority.toFixed(2)} km</span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function QueueTab({ result, nodeName }: { result: PlanResult; nodeName: (id: string) => string }) {
  const [sel, setSel] = useState(0)
  const ev = result.schedule[Math.min(sel, result.schedule.length - 1)]
  const actionStyle: Record<string, string> = {
    push: 'bg-[#2a2b36] text-[#9a9aab]',
    'pop-accept': 'bg-[#173026] text-[#34d399]',
    'pop-reject': 'bg-[#3a1a1a] text-[#f87171]',
    drop: 'bg-[#3a2e12] text-[#fbbf24]',
  }
  return (
    <div className="grid h-full gap-4 overflow-y-auto p-4 slim-scroll lg:grid-cols-[1fr_300px]">
      <ol className="space-y-1">
        <p className="mb-2 text-[11px] leading-relaxed text-[#9a9aab]">
          Deliveries are enqueued by urgency — <span className="text-[#e0e0e0]">highest priority pops first</span>, ties break toward the
          shorter round trip. Each popped delivery is accepted only if it survives the battery check.
        </p>
        {result.schedule.map((e, i) => (
          <li key={i}>
            <button
              onClick={() => setSel(i)}
              className={`flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left transition-colors min-h-[44px] ${
                sel === i ? 'bg-[#22232e] ring-1 ring-[#00aaff]/40' : 'hover:bg-[#1b1c26]'
              }`}
            >
              <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 font-mono2 text-[9px] font-bold uppercase ${actionStyle[e.action]}`}>
                {e.action.replace('pop-', '')}
              </span>
              <span className="flex-1 text-[11px] leading-relaxed text-[#c6c6d2]">{e.note}</span>
            </button>
          </li>
        ))}
      </ol>
      <div>
        <div className="mb-1 text-[10px] font-semibold tracking-[0.14em] text-[#6a6f88] uppercase">
          Queue after event #{ev.index + 1}
        </div>
        <div className="space-y-1">
          {ev.queue.length === 0 && <span className="font-mono2 text-[11px] text-[#6a6f88]">empty</span>}
          {ev.queue.map((e, i) => {
            const delivery = result.accepted.find((a) => a.nodeId === e.key)
            return (
              <div key={`${e.key}-${i}`} className="flex items-center gap-2 rounded bg-[#1b1c26] px-2 py-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: PRIORITY_COLORS[delivery?.priority ?? 3] }} />
                <span className="flex-1 truncate text-[11px] text-[#e0e0e0]">{nodeName(e.key)}</span>
                <span className="font-mono2 text-[10px] text-[#9a9aab]">
                  {typeof e.priority === 'number' && Math.abs(e.priority) > 100 ? `P${Math.round(-e.priority / 1000)}` : `P${e.priority}`}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function CompareTab({ result }: { result: PlanResult }) {
  const bestLen = useMemo(() => Math.min(...result.methods.map((m) => m.lengthKm)), [result])
  return (
    <div className="p-4">
      <p className="mb-3 max-w-2xl text-[11px] leading-relaxed text-[#9a9aab]">
        Every method sequences the same accepted stops and returns to the depot. Leg distances are true shortest-path corridor distances
        from Dijkstra, not straight lines. The cheapest feasible tour wins.
      </p>
      <div className="space-y-2">
        {result.methods.map((m) => {
          const isBest = m.lengthKm === bestLen
          const gap = bestLen > 0 ? ((m.lengthKm - bestLen) / bestLen) * 100 : 0
          return (
            <div
              key={m.id}
              className={`rounded-lg border px-4 py-3 ${isBest ? 'border-[#34d399]/50 bg-[#34d399]/5' : 'border-[#2a2b36] bg-[#1b1c26]'}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-[#e0e0e0]">{m.label}</span>
                {isBest && (
                  <span className="rounded bg-[#173026] px-1.5 py-0.5 font-mono2 text-[9px] font-bold text-[#34d399] uppercase">
                    Selected
                  </span>
                )}
                <span
                  className={`rounded px-1.5 py-0.5 font-mono2 text-[9px] font-bold uppercase ${
                    m.feasible ? 'bg-[#16233a] text-[#00aaff]' : 'bg-[#3a1a1a] text-[#f87171]'
                  }`}
                >
                  {m.feasible ? 'within battery' : 'over budget'}
                </span>
                <span className="ml-auto font-mono2 text-sm font-semibold text-[#e0e0e0]">{m.lengthKm.toFixed(2)} km</span>
                <span className="font-mono2 text-[10px] text-[#6a6f88]">{gap > 0.005 ? `+${gap.toFixed(1)}% vs best` : 'optimal'}</span>
              </div>
              <div className="mt-2 font-mono2 text-[11px] leading-relaxed text-[#9a9aab]">
                {result.depotId} → {m.order.join(' → ')} → {result.depotId}
              </div>
              <p className="mt-1 text-[11px] text-[#6a6f88]">{m.detail}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
