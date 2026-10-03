import { useCallback, useMemo, useState } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import MapView from '@/components/MapView'
import ControlPanel from '@/components/ControlPanel'
import TracePanel from '@/components/TracePanel'
import { buildAdjacency } from '@/lib/algorithms'
import { planMission, type PlanResult } from '@/lib/planner'
import { CORRIDORS, DEFAULT_BATTERY_KM, DEFAULT_DELIVERIES, NODES, type Delivery } from '@/lib/scenario'

export default function Home() {
  const [deliveries, setDeliveries] = useState<Delivery[]>(DEFAULT_DELIVERIES)
  const [batteryKm, setBatteryKm] = useState(DEFAULT_BATTERY_KM)
  const [result, setResult] = useState<PlanResult | null>(null)
  const [exploreStep, setExploreStep] = useState<number | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [traceCollapsed, setTraceCollapsed] = useState(false)

  const adjacency = useMemo(() => buildAdjacency(NODES, CORRIDORS), [])
  const nodeName = useCallback((id: string) => NODES.find((n) => n.id === id)?.name ?? id, [])

  const run = useCallback(
    (d: Delivery[], b: number) => {
      setResult(planMission(NODES, adjacency, d, b))
      setExploreStep(null)
    },
    [adjacency],
  )

  const handleDeliveries = (d: Delivery[]) => {
    setDeliveries(d)
    if (result) run(d, batteryKm)
  }
  const handleBattery = (b: number) => {
    setBatteryKm(b)
    if (result) run(deliveries, b)
  }
  const handleReset = () => {
    setDeliveries(DEFAULT_DELIVERIES)
    setBatteryKm(DEFAULT_BATTERY_KM)
    setResult(null)
    setExploreStep(null)
  }

  const activeCount = deliveries.filter((d) => d.enabled).length

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0d0f17]">
      <div className="absolute inset-0">
        <MapView nodes={NODES} corridors={CORRIDORS} deliveries={deliveries} result={result} exploreStep={exploreStep} />
      </div>

      {/* Title bar */}
      <div className="pointer-events-none absolute left-3 top-3 z-[500] max-w-[calc(100%-6.5rem)] md:left-5 md:top-5">
        <div className="glass pointer-events-auto rounded-xl px-4 py-3">
          <div className="flex items-center gap-2.5">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="shrink-0 text-[#00aaff]">
              <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <circle cx="12" cy="12" r="2.2" fill="currentColor" />
              <circle cx="4" cy="4" r="2.4" stroke="currentColor" strokeWidth="1.6" />
              <circle cx="20" cy="4" r="2.4" stroke="currentColor" strokeWidth="1.6" />
              <circle cx="4" cy="20" r="2.4" stroke="currentColor" strokeWidth="1.6" />
              <circle cx="20" cy="20" r="2.4" stroke="currentColor" strokeWidth="1.6" />
              <path d="M5.7 5.7l3 3M18.3 5.7l-3 3M5.7 18.3l3-3M18.3 18.3l-3-3" stroke="currentColor" strokeWidth="1.4" />
            </svg>
            <div>
              <h1 className="text-sm font-bold tracking-wide text-[#e0e0e0]">DRONE DELIVERY PATH PLANNER</h1>
              <p className="font-mono2 text-[10px] tracking-[0.12em] text-[#6a6f88]">DIJKSTRA · PRIORITY QUEUE · TSP · BATTERY CONSTRAINTS</p>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5 font-mono2 text-[10px]">
            <span className="rounded bg-[#1b1c26] px-1.5 py-0.5 text-[#9a9aab]">{NODES.length} nodes</span>
            <span className="rounded bg-[#1b1c26] px-1.5 py-0.5 text-[#9a9aab]">{CORRIDORS.length} corridors</span>
            <span className="rounded bg-[#1b1c26] px-1.5 py-0.5 text-[#9a9aab]">{activeCount} deliveries</span>
            <span className="rounded bg-[#16233a] px-1.5 py-0.5 text-[#00aaff]">{batteryKm.toFixed(1)} km battery</span>
          </div>
        </div>
      </div>

      {/* Control panel — desktop */}
      <div className="absolute right-5 top-5 z-[500] hidden max-h-[calc(100%-2.5rem)] w-[330px] overflow-y-auto rounded-xl slim-scroll md:block">
        <ControlPanel
          batteryKm={batteryKm}
          onBatteryChange={handleBattery}
          deliveries={deliveries}
          onDeliveriesChange={handleDeliveries}
          nodeName={nodeName}
          onRun={() => run(deliveries, batteryKm)}
          onReset={handleReset}
          hasResult={result != null}
        />
      </div>

      {/* Control panel toggle — mobile */}
      <button
        onClick={() => setPanelOpen(true)}
        className="glass absolute right-3 top-3 z-[500] flex h-11 w-11 items-center justify-center rounded-xl text-[#00aaff] md:hidden"
        aria-label="Open mission control"
      >
        <SlidersHorizontal size={18} />
      </button>

      {/* Control panel — mobile overlay */}
      {panelOpen && (
        <div className="absolute inset-0 z-[600] bg-black/60 md:hidden" onClick={() => setPanelOpen(false)}>
          <div
            className="absolute bottom-0 left-0 right-0 max-h-[82vh] overflow-y-auto rounded-t-2xl slim-scroll pb-[env(safe-area-inset-bottom)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              <button
                onClick={() => setPanelOpen(false)}
                className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-lg text-[#9a9aab]"
                aria-label="Close mission control"
              >
                <X size={18} />
              </button>
              <ControlPanel
                batteryKm={batteryKm}
                onBatteryChange={handleBattery}
                deliveries={deliveries}
                onDeliveriesChange={handleDeliveries}
                nodeName={nodeName}
                onRun={() => {
                  run(deliveries, batteryKm)
                  setPanelOpen(false)
                  setTraceCollapsed(false)
                }}
                onReset={handleReset}
                hasResult={result != null}
              />
            </div>
          </div>
        </div>
      )}

      {/* Trace / results panel */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-[500] flex justify-center px-0 md:px-5 md:pb-4">
        <div className={`flex w-full flex-col ${traceCollapsed ? '' : 'h-[46vh] md:h-[42vh]'}`}>
          <TracePanel
            result={result}
            exploreStep={exploreStep}
            onExploreStep={setExploreStep}
            nodeName={nodeName}
            collapsed={traceCollapsed}
            onToggleCollapsed={() => setTraceCollapsed(!traceCollapsed)}
          />
        </div>
      </div>
    </div>
  )
}
