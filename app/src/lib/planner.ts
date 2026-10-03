// ---------------------------------------------------------------------------
// Mission planner: priority queue scheduling → battery feasibility →
// Dijkstra shortest-path matrix → TSP tour construction & comparison.
// Every decision is recorded as a trace event so the UI can explain *why*.
// ---------------------------------------------------------------------------

import {
  MinHeap,
  dijkstra,
  reconstructPath,
  tourLength,
  tspBruteForce,
  tspNearestNeighbor,
  twoOpt,
} from './algorithms'
import type { Adjacency, DijkstraResult, DistMatrix, GraphNode } from './algorithms'
import type { Delivery } from './scenario'

export interface ScheduleEvent {
  index: number
  action: 'push' | 'pop-accept' | 'pop-reject' | 'drop'
  nodeId: string
  priority: number
  note: string
  queue: { key: string; priority: number }[]
}

export interface Rejection {
  nodeId: string
  priority: number
  reason: string
  neededKm: number
  budgetKm: number
}

export interface TourMethod {
  id: 'nn' | '2opt' | 'exact'
  label: string
  order: string[]
  lengthKm: number
  feasible: boolean
  detail: string
}

export interface PlanLeg {
  from: string
  to: string
  corridorPath: string[]
  km: number
  cumulativeKm: number
}

export interface PlanResult {
  depotId: string
  batteryKm: number
  dijkstra: DijkstraResult
  schedule: ScheduleEvent[]
  accepted: Delivery[]
  rejected: Rejection[]
  distMatrix: DistMatrix
  methods: TourMethod[]
  best: TourMethod
  legs: PlanLeg[]
}

export function planMission(
  nodes: GraphNode[],
  adj: Adjacency,
  deliveries: Delivery[],
  batteryKm: number,
): PlanResult {
  const depot = nodes.find((n) => n.kind === 'depot')!
  const depotId = depot.id
  const nodeName = new Map(nodes.map((n) => [n.id, n.name]))

  // -- Step 1: Dijkstra from the depot over the corridor graph --------------
  const djk = dijkstra(adj, depotId)

  // -- Step 2: priority queue schedules deliveries by urgency ---------------
  // Higher priority value = more urgent = popped first. Ties break toward the
  // cheaper round trip so the queue ordering is fully deterministic.
  const heap = new MinHeap<string>()
  const schedule: ScheduleEvent[] = []
  const enabled = deliveries.filter((d) => d.enabled)
  let sIdx = 0
  for (const d of enabled) {
    const roundTrip = 2 * djk.dist[d.nodeId]
    const score = -(d.priority * 1000) + roundTrip // min-heap: lower pops first
    heap.push(d.nodeId, score)
    schedule.push({
      index: sIdx++,
      action: 'push',
      nodeId: d.nodeId,
      priority: d.priority,
      note: `Enqueue ${d.nodeId} (priority ${d.priority}, direct round trip ${roundTrip.toFixed(2)} km).`,
      queue: heap.snapshot().map((e) => ({ key: e.key, priority: e.priority })),
    })
  }

  const accepted: Delivery[] = []
  const rejected: Rejection[] = []
  while (heap.size() > 0) {
    const { key } = heap.pop()!
    const d = enabled.find((x) => x.nodeId === key)!
    const roundTrip = 2 * djk.dist[key]
    if (roundTrip > batteryKm) {
      rejected.push({
        nodeId: key,
        priority: d.priority,
        reason: `Even a solo round trip (${roundTrip.toFixed(2)} km) exceeds the ${batteryKm.toFixed(1)} km battery budget.`,
        neededKm: roundTrip,
        budgetKm: batteryKm,
      })
      schedule.push({
        index: sIdx++,
        action: 'pop-reject',
        nodeId: key,
        priority: d.priority,
        note: `Pop ${key} (priority ${d.priority}) — REJECT: solo round trip ${roundTrip.toFixed(2)} km > battery ${batteryKm.toFixed(1)} km.`,
        queue: heap.snapshot().map((e) => ({ key: e.key, priority: e.priority })),
      })
    } else {
      accepted.push(d)
      schedule.push({
        index: sIdx++,
        action: 'pop-accept',
        nodeId: key,
        priority: d.priority,
        note: `Pop ${key} (priority ${d.priority}) — individually feasible at ${roundTrip.toFixed(2)} km. Tentatively accepted.`,
        queue: heap.snapshot().map((e) => ({ key: e.key, priority: e.priority })),
      })
    }
  }

  // -- Step 3: shortest-path distance matrix among depot + accepted stops ---
  const ids = accepted.map((d) => d.nodeId)
  const distMatrix: DistMatrix = {}
  const relevant = [depotId, ...ids]
  for (const a of relevant) {
    const res = a === depotId ? djk : dijkstra(adj, a)
    distMatrix[a] = {}
    for (const b of relevant) distMatrix[a][b] = res.dist[b]
  }

  // -- Step 4: TSP tour construction with battery-budget rejection loop -----
  // Build the best tour over accepted stops; while it busts the battery,
  // drop the lowest-priority stop and re-solve.
  const stillAccepted = [...accepted]
  let order: string[] = []
  let bestLen = 0
  for (;;) {
    const curIds = stillAccepted.map((d) => d.nodeId)
    const nn = tspNearestNeighbor(curIds, depotId, distMatrix)
    const opt = twoOpt(nn, depotId, distMatrix)
    order = opt.order
    bestLen = tourLength(order, depotId, distMatrix)
    if (bestLen <= batteryKm || stillAccepted.length === 0) break
    // drop lowest priority (tie: longest solo round trip)
    let dropIdx = 0
    for (let i = 1; i < stillAccepted.length; i++) {
      const a = stillAccepted[i]
      const b = stillAccepted[dropIdx]
      if (a.priority < b.priority || (a.priority === b.priority && djk.dist[a.nodeId] > djk.dist[b.nodeId])) {
        dropIdx = i
      }
    }
    const dropped = stillAccepted.splice(dropIdx, 1)[0]
    rejected.push({
      nodeId: dropped.nodeId,
      priority: dropped.priority,
      reason: `Shared tour of ${bestLen.toFixed(2)} km exceeds the ${batteryKm.toFixed(1)} km battery — ${dropped.nodeId} is the lowest-priority stop, so it is dropped and the tour re-planned.`,
      neededKm: bestLen,
      budgetKm: batteryKm,
    })
    schedule.push({
      index: sIdx++,
      action: 'drop',
      nodeId: dropped.nodeId,
      priority: dropped.priority,
      note: `Battery check: tour ${bestLen.toFixed(2)} km > ${batteryKm.toFixed(1)} km. Drop lowest-priority stop ${dropped.nodeId} and re-solve TSP.`,
      queue: stillAccepted.map((d) => ({ key: d.nodeId, priority: d.priority })),
    })
  }

  const finalIds = stillAccepted.map((d) => d.nodeId)

  // -- Step 5: compare TSP methods on the final feasible stop set -----------
  const methods: TourMethod[] = []
  const nnOrder = tspNearestNeighbor(finalIds, depotId, distMatrix)
  const nnLen = tourLength(nnOrder, depotId, distMatrix)
  methods.push({
    id: 'nn',
    label: 'Nearest Neighbour (greedy)',
    order: nnOrder,
    lengthKm: nnLen,
    feasible: nnLen <= batteryKm,
    detail: 'Repeatedly fly to the closest unvisited stop.',
  })
  const t2 = twoOpt(nnOrder, depotId, distMatrix)
  const t2Len = tourLength(t2.order, depotId, distMatrix)
  methods.push({
    id: '2opt',
    label: 'Nearest Neighbour + 2-opt',
    order: t2.order,
    lengthKm: t2Len,
    feasible: t2Len <= batteryKm,
    detail:
      t2.moves.length === 0
        ? 'No segment reversal improves the greedy tour — it is already locally optimal.'
        : `${t2.moves.length} segment reversal${t2.moves.length > 1 ? 's' : ''} saved ${(nnLen - t2Len).toFixed(2)} km.`,
  })
  if (finalIds.length <= 8 && finalIds.length > 0) {
    const bf = tspBruteForce(finalIds, depotId, distMatrix)
    methods.push({
      id: 'exact',
      label: 'Exact (brute force)',
      order: bf.order,
      lengthKm: bf.length,
      feasible: bf.length <= batteryKm,
      detail: `All ${bf.checked.toLocaleString()} permutations evaluated — provably optimal.`,
    })
  } else if (finalIds.length > 8) {
    methods.push({
      id: 'exact',
      label: 'Exact (brute force)',
      order: t2.order,
      lengthKm: t2Len,
      feasible: t2Len <= batteryKm,
      detail: `Skipped: ${finalIds.length} stops ⇒ ${finalIds.length}! permutations is intractable. 2-opt result shown instead.`,
    })
  }
  const best = methods.reduce((m, c) => (c.lengthKm < m.lengthKm ? c : m))

  // -- Step 6: expand the best tour into corridor legs for the map ----------
  const legs: PlanLeg[] = []
  const fullRoute = [depotId, ...best.order, depotId]
  let cumulative = 0
  for (let i = 0; i + 1 < fullRoute.length; i++) {
    const from = fullRoute[i]
    const to = fullRoute[i + 1]
    const res = dijkstra(adj, from)
    const corridorPath = reconstructPath(res.prev, to)
    const km = res.dist[to]
    cumulative += km
    legs.push({ from, to, corridorPath, km, cumulativeKm: cumulative })
  }

  void nodeName
  return {
    depotId,
    batteryKm,
    dijkstra: djk,
    schedule,
    accepted: stillAccepted,
    rejected,
    distMatrix,
    methods,
    best,
    legs,
  }
}
