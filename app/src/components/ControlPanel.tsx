import { useState } from 'react'
import { ChevronDown, Play, RotateCcw } from 'lucide-react'
import type { Delivery } from '@/lib/scenario'
import { PRIORITY_COLORS } from './MapView'

interface Props {
  batteryKm: number
  onBatteryChange: (v: number) => void
  deliveries: Delivery[]
  onDeliveriesChange: (d: Delivery[]) => void
  nodeName: (id: string) => string
  onRun: () => void
  onReset: () => void
  hasResult: boolean
}

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-[#2a2b36] last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-[11px] font-semibold tracking-[0.14em] text-[#9a9aab] uppercase min-h-[44px]"
      >
        {title}
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

const PRIORITY_LABELS = ['', 'Routine', 'Low', 'Standard', 'Urgent', 'Critical']

export default function ControlPanel({
  batteryKm,
  onBatteryChange,
  deliveries,
  onDeliveriesChange,
  nodeName,
  onRun,
  onReset,
  hasResult,
}: Props) {
  const enabledCount = deliveries.filter((d) => d.enabled).length

  return (
    <div className="glass rounded-xl overflow-hidden">
      <div className="flex items-center justify-between border-b border-[#2a2b36] bg-[#2a2a33]/60 px-4 py-3">
        <span className="text-[11px] font-semibold tracking-[0.18em] text-[#e0e0e0]">MISSION CONTROL</span>
        <span className="font-mono2 text-[10px] text-[#00aaff]">{enabledCount} ACTIVE</span>
      </div>

      <Section title="Battery Budget">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-[#9a9aab]">Max tour energy</span>
          <span className="font-mono2 text-lg font-semibold text-[#00aaff]">{batteryKm.toFixed(1)} km</span>
        </div>
        <input
          type="range"
          min={4}
          max={16}
          step={0.5}
          value={batteryKm}
          onChange={(e) => onBatteryChange(parseFloat(e.target.value))}
          className="ops-slider mt-3"
          aria-label="Battery budget in kilometres"
        />
        <div className="mt-1.5 flex justify-between font-mono2 text-[10px] text-[#6a6f88]">
          <span>4 km</span>
          <span>16 km</span>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-[#9a9aab]">
          Any route whose total distance exceeds this budget is rejected.
        </p>
      </Section>

      <Section title={`Deliveries · ${deliveries.length}`}>
        <div className="space-y-1">
          {deliveries.map((d) => (
            <div
              key={d.nodeId}
              className={`flex items-center gap-2 rounded-lg px-2 py-2 min-h-[44px] ${d.enabled ? 'bg-[#22232e]' : 'bg-transparent opacity-45'}`}
            >
              <button
                onClick={() => onDeliveriesChange(deliveries.map((x) => (x.nodeId === d.nodeId ? { ...x, enabled: !x.enabled } : x)))}
                className={`h-4 w-4 shrink-0 rounded border transition-colors ${
                  d.enabled ? 'border-[#00aaff] bg-[#00aaff]' : 'border-[#4a4a5a] bg-transparent'
                }`}
                aria-label={`Toggle ${d.nodeId}`}
              >
                {d.enabled && (
                  <svg viewBox="0 0 12 12" className="h-full w-full text-[#06121c]">
                    <path d="M2 6l3 3 5-6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
                  </svg>
                )}
              </button>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium text-[#e0e0e0]">{nodeName(d.nodeId)}</div>
                <div className="font-mono2 text-[10px] text-[#6a6f88]">
                  {d.payloadKg.toFixed(1)} kg · {PRIORITY_LABELS[d.priority]}
                </div>
              </div>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((p) => (
                  <button
                    key={p}
                    onClick={() => onDeliveriesChange(deliveries.map((x) => (x.nodeId === d.nodeId ? { ...x, priority: p } : x)))}
                    className="h-5 w-3.5 rounded-sm transition-all min-h-[20px]"
                    style={{ background: p <= d.priority ? PRIORITY_COLORS[d.priority] : '#2a2b36' }}
                    aria-label={`Set priority ${p}`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <div className="flex gap-2 px-4 py-4">
        <button
          onClick={onRun}
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-[#00aaff] text-sm font-semibold text-[#06121c] transition-colors hover:bg-[#33bdff] active:bg-[#0090dd]"
        >
          <Play size={15} strokeWidth={2.5} />
          {hasResult ? 'Re-run Planner' : 'Run Planner'}
        </button>
        <button
          onClick={onReset}
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#4a4a5a] text-[#9a9aab] transition-colors hover:bg-[#2a2b36] hover:text-[#e0e0e0]"
          aria-label="Reset scenario"
        >
          <RotateCcw size={15} />
        </button>
      </div>
    </div>
  )
}
