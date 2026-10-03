import { useEffect, useMemo } from 'react'
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { GraphNode, Corridor } from '@/lib/algorithms'
import type { PlanResult } from '@/lib/planner'
import type { Delivery } from '@/lib/scenario'
import { MAP_CENTER } from '@/lib/scenario'

export const PRIORITY_COLORS: Record<number, string> = {
  5: '#f87171',
  4: '#fb923c',
  3: '#fbbf24',
  2: '#a3e635',
  1: '#9aa0b4',
}

function FitBounds({ nodes }: { nodes: GraphNode[] }) {
  const map = useMap()
  useEffect(() => {
    const bounds = L.latLngBounds(nodes.map((n) => [n.lat, n.lng] as [number, number]))
    const desktop = window.innerWidth >= 768
    map.fitBounds(bounds, {
      paddingTopLeft: desktop ? [40, 140] : [20, 120],
      paddingBottomRight: desktop ? [380, 480] : [20, 300],
    })
  }, [map, nodes])
  return null
}

interface Props {
  nodes: GraphNode[]
  corridors: Corridor[]
  deliveries: Delivery[]
  result: PlanResult | null
  /** When non-null, the map shows Dijkstra exploration frozen at this step. */
  exploreStep: number | null
}

export default function MapView({ nodes, corridors, deliveries, result, exploreStep }: Props) {
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])
  const deliveryByNode = useMemo(() => new Map(deliveries.map((d) => [d.nodeId, d])), [deliveries])

  const step = exploreStep != null && result ? result.dijkstra.steps[Math.min(exploreStep, result.dijkstra.steps.length - 1)] : null
  const settledSet = useMemo(() => new Set(step?.settled ?? []), [step])
  const rejectedSet = useMemo(() => new Set(result?.rejected.map((r) => r.nodeId) ?? []), [result])
  const tourOrderIndex = useMemo(() => {
    const m = new Map<string, number>()
    result?.best.order.forEach((id, i) => m.set(id, i + 1))
    return m
  }, [result])

  const corridorLines = useMemo(
    () =>
      corridors
        .map((c) => {
          const a = byId.get(c.a)
          const b = byId.get(c.b)
          if (!a || !b) return null
          return { key: `${c.a}-${c.b}`, pts: [[a.lat, a.lng], [b.lat, b.lng]] as [number, number][] }
        })
        .filter(Boolean) as { key: string; pts: [number, number][] }[],
    [corridors, byId],
  )

  const legLines = useMemo(() => {
    if (!result || step) return []
    return result.legs.map((leg, i) => ({
      key: `leg-${i}`,
      pts: leg.corridorPath.map((id) => {
        const n = byId.get(id)!
        return [n.lat, n.lng] as [number, number]
      }),
    }))
  }, [result, step, byId])

  return (
    <MapContainer center={MAP_CENTER} zoom={15} className="h-full w-full" zoomControl={false} attributionControl>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        className="map-tiles-dark"
      />
      <FitBounds nodes={nodes} />

      {/* approved flight corridors */}
      {corridorLines.map((l) => (
        <Polyline key={l.key} positions={l.pts} pathOptions={{ color: '#3d4054', weight: 1.5, dashArray: '2 6', opacity: 0.9 }} />
      ))}

      {/* computed tour legs */}
      {legLines.map((l) => (
        <Polyline
          key={l.key}
          positions={l.pts}
          pathOptions={{ color: '#34d399', weight: 4, opacity: 0.95, lineJoin: 'round' }}
        />
      ))}

      {nodes.map((n) => {
        if (n.kind === 'depot') {
          return (
            <Marker
              key={n.id}
              position={[n.lat, n.lng]}
              icon={L.divIcon({ className: '', html: `<div class="wp-marker wp-depot">⌂</div>`, iconSize: [34, 34], iconAnchor: [17, 17] })}
            >
              <Tooltip direction="top" offset={[0, -16]} opacity={0.95}>
                <span className="font-mono2 text-xs">{n.name}</span>
              </Tooltip>
            </Marker>
          )
        }
        if (n.kind === 'waypoint') {
          const settled = step && settledSet.has(n.id)
          const isCurrent = step && (step.action === 'extract' || step.action === 'relax') && step.node === n.id
          return (
            <Marker
              key={n.id}
              position={[n.lat, n.lng]}
              icon={L.divIcon({
                className: '',
                html: `<div class="wp-marker wp-waypoint ${settled ? 'settled' : ''} ${isCurrent ? 'wp-current' : ''}"></div>`,
                iconSize: [14, 14],
                iconAnchor: [7, 7],
              })}
            >
              <Tooltip direction="top" offset={[0, -8]} opacity={0.95}>
                <span className="font-mono2 text-xs">
                  {n.id}
                  {step ? ` · ${fmtDist(step.dist[n.id])}` : ''}
                </span>
              </Tooltip>
            </Marker>
          )
        }
        // delivery
        const d = deliveryByNode.get(n.id)
        const prio = d?.priority ?? 1
        const rejected = rejectedSet.has(n.id) || (d && !d.enabled)
        const settled = step && settledSet.has(n.id)
        const isCurrent = step && (step.action === 'extract' || step.action === 'relax') && step.node === n.id
        const color = PRIORITY_COLORS[prio]
        return (
          <Marker
            key={n.id}
            position={[n.lat, n.lng]}
            icon={L.divIcon({
              className: '',
              html: `<div class="wp-marker wp-delivery ${rejected ? 'rejected' : ''} ${settled ? 'settled' : ''} ${isCurrent ? 'wp-current' : ''}" style="background:${color}">${prio}</div>`,
              iconSize: [30, 30],
              iconAnchor: [15, 15],
            })}
          >
            <Tooltip direction="top" offset={[0, -14]} opacity={0.95}>
              <span className="font-mono2 text-xs">
                {n.name} · P{prio} · {d?.payloadKg ?? 0} kg
                {step ? ` · ${fmtDist(step.dist[n.id])}` : ''}
              </span>
            </Tooltip>
          </Marker>
        )
      })}

      {/* visit-order badges on accepted stops */}
      {!step &&
        result &&
        result.best.order.map((id) => {
          const n = byId.get(id)
          if (!n) return null
          return (
            <Marker
              key={`ord-${id}`}
              position={[n.lat, n.lng]}
              icon={L.divIcon({
                className: '',
                html: `<div class="order-badge">${tourOrderIndex.get(id)}</div>`,
                iconSize: [18, 18],
                iconAnchor: [24, -8],
              })}
              interactive={false}
            />
          )
        })}
    </MapContainer>
  )
}

function fmtDist(d: number): string {
  return d === Infinity ? '∞' : `${d.toFixed(2)} km`
}
