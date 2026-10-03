// ---------------------------------------------------------------------------
// Core algorithms: binary min-heap priority queue, Dijkstra shortest paths
// (with step-by-step trace), and TSP solvers (nearest neighbor, 2-opt,
// exact brute force). All pure functions — no UI dependencies.
// ---------------------------------------------------------------------------

export interface GraphNode {
  id: string
  name: string
  lat: number
  lng: number
  kind: 'depot' | 'waypoint' | 'delivery'
}

export interface Corridor {
  a: string
  b: string
}

/** Great-circle distance in kilometres. */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const la1 = (a.lat * Math.PI) / 180
  const la2 = (b.lat * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export type Adjacency = Map<string, { to: string; w: number }[]>

export function buildAdjacency(nodes: GraphNode[], corridors: Corridor[]): Adjacency {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const adj: Adjacency = new Map(nodes.map((n) => [n.id, []]))
  for (const c of corridors) {
    const a = byId.get(c.a)
    const b = byId.get(c.b)
    if (!a || !b) continue
    const w = haversineKm(a, b)
    adj.get(c.a)!.push({ to: c.b, w })
    adj.get(c.b)!.push({ to: c.a, w })
  }
  return adj
}

// ---------------------------------------------------------------------------
// Binary min-heap priority queue
// ---------------------------------------------------------------------------

export class MinHeap<T> {
  private keys: T[] = []
  private prio: number[] = []

  size(): number {
    return this.keys.length
  }

  push(key: T, priority: number): void {
    this.keys.push(key)
    this.prio.push(priority)
    this.bubbleUp(this.keys.length - 1)
  }

  pop(): { key: T; priority: number } | undefined {
    if (this.keys.length === 0) return undefined
    const top = { key: this.keys[0], priority: this.prio[0] }
    const lastK = this.keys.pop()!
    const lastP = this.prio.pop()!
    if (this.keys.length > 0) {
      this.keys[0] = lastK
      this.prio[0] = lastP
      this.bubbleDown(0)
    }
    return top
  }

  snapshot(): { key: T; priority: number }[] {
    return this.keys.map((k, i) => ({ key: k, priority: this.prio[i] }))
  }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const p = (i - 1) >> 1
      if (this.prio[p] <= this.prio[i]) break
      this.swap(i, p)
      i = p
    }
  }

  private bubbleDown(i: number): void {
    const n = this.keys.length
    for (;;) {
      const l = 2 * i + 1
      const r = l + 1
      let m = i
      if (l < n && this.prio[l] < this.prio[m]) m = l
      if (r < n && this.prio[r] < this.prio[m]) m = r
      if (m === i) break
      this.swap(i, m)
      i = m
    }
  }

  private swap(i: number, j: number): void {
    ;[this.keys[i], this.keys[j]] = [this.keys[j], this.keys[i]]
    ;[this.prio[i], this.prio[j]] = [this.prio[j], this.prio[i]]
  }
}

// ---------------------------------------------------------------------------
// Dijkstra with trace
// ---------------------------------------------------------------------------

export interface DijkstraStep {
  index: number
  action: 'init' | 'extract' | 'relax' | 'stale' | 'settled'
  node: string
  via?: string
  oldTentative?: number
  newTentative?: number
  note: string
  pq: { key: string; priority: number }[]
  dist: Record<string, number>
  settled: string[]
}

export interface DijkstraResult {
  dist: Record<string, number>
  prev: Record<string, string | null>
  steps: DijkstraStep[]
}

export function dijkstra(adj: Adjacency, source: string): DijkstraResult {
  const dist: Record<string, number> = {}
  const prev: Record<string, string | null> = {}
  const settled = new Set<string>()
  const steps: DijkstraStep[] = []
  const heap = new MinHeap<string>()

  for (const id of adj.keys()) {
    dist[id] = Infinity
    prev[id] = null
  }
  dist[source] = 0
  heap.push(source, 0)

  const snapDist = () => ({ ...dist })
  steps.push({
    index: 0,
    action: 'init',
    node: source,
    note: `Initialise: tentative distance of depot ${source} = 0, all others = ∞. Push ${source} into the priority queue.`,
    pq: heap.snapshot(),
    dist: snapDist(),
    settled: [],
  })

  let idx = 1
  while (heap.size() > 0) {
    const { key: u, priority } = heap.pop()!
    if (settled.has(u)) {
      steps.push({
        index: idx++,
        action: 'stale',
        node: u,
        note: `Pop ${u} (${priority.toFixed(2)} km) — already settled, this heap entry is stale. Discard it.`,
        pq: heap.snapshot(),
        dist: snapDist(),
        settled: [...settled],
      })
      continue
    }
    settled.add(u)
    steps.push({
      index: idx++,
      action: 'extract',
      node: u,
      note: `Extract-min: ${u} is the cheapest unsettled node at ${dist[u].toFixed(2)} km. This cost is now final.`,
      pq: heap.snapshot(),
      dist: snapDist(),
      settled: [...settled],
    })
    for (const { to: v, w } of adj.get(u) ?? []) {
      if (settled.has(v)) continue
      const alt = dist[u] + w
      if (alt < dist[v] - 1e-9) {
        const old = dist[v]
        dist[v] = alt
        prev[v] = u
        heap.push(v, alt)
        steps.push({
          index: idx++,
          action: 'relax',
          node: v,
          via: u,
          oldTentative: old,
          newTentative: alt,
          note: `Relax edge ${u}→${v}: ${dist[u].toFixed(2)} + ${w.toFixed(2)} = ${alt.toFixed(2)} km beats ${old === Infinity ? '∞' : old.toFixed(2)} km. Update tentative cost and push ${v}.`,
          pq: heap.snapshot(),
          dist: snapDist(),
          settled: [...settled],
        })
      }
    }
  }
  return { dist, prev, steps }
}

export function reconstructPath(prev: Record<string, string | null>, target: string): string[] {
  const path: string[] = []
  let cur: string | null = target
  while (cur) {
    path.unshift(cur)
    cur = prev[cur] ?? null
  }
  return path
}

// ---------------------------------------------------------------------------
// TSP solvers over a precomputed shortest-path distance matrix
// ---------------------------------------------------------------------------

export type DistMatrix = Record<string, Record<string, number>>

export function tourLength(order: string[], depot: string, dm: DistMatrix, roundTrip = true): number {
  if (order.length === 0) return 0
  let total = dm[depot][order[0]]
  for (let i = 0; i + 1 < order.length; i++) total += dm[order[i]][order[i + 1]]
  if (roundTrip) total += dm[order[order.length - 1]][depot]
  return total
}

/** Greedy nearest-neighbour tour starting at the depot. */
export function tspNearestNeighbor(ids: string[], depot: string, dm: DistMatrix): string[] {
  const remaining = new Set(ids)
  const order: string[] = []
  let cur = depot
  while (remaining.size > 0) {
    let best: string | null = null
    let bestD = Infinity
    for (const id of remaining) {
      if (dm[cur][id] < bestD) {
        bestD = dm[cur][id]
        best = id
      }
    }
    order.push(best!)
    remaining.delete(best!)
    cur = best!
  }
  return order
}

export interface TwoOptMove {
  i: number
  j: number
  before: number
  after: number
}

/** 2-opt improvement; returns improved tour and the accepted moves. */
export function twoOpt(
  order: string[],
  depot: string,
  dm: DistMatrix,
): { order: string[]; moves: TwoOptMove[] } {
  const route = [...order]
  const moves: TwoOptMove[] = []
  let improved = true
  let guard = 0
  while (improved && guard++ < 100) {
    improved = false
    for (let i = 0; i < route.length - 1; i++) {
      for (let j = i + 1; j < route.length; j++) {
        const before = tourLength(route, depot, dm)
        const candidate = [...route.slice(0, i), ...route.slice(i, j + 1).reverse(), ...route.slice(j + 1)]
        const after = tourLength(candidate, depot, dm)
        if (after < before - 1e-9) {
          route.splice(0, route.length, ...candidate)
          moves.push({ i, j, before, after })
          improved = true
        }
      }
    }
  }
  return { order: route, moves }
}

/** Exact optimal tour by exhaustive permutation (feasible for ≤ ~8 stops). */
export function tspBruteForce(ids: string[], depot: string, dm: DistMatrix): { order: string[]; length: number; checked: number } {
  let best: string[] = [...ids]
  let bestLen = Infinity
  let checked = 0
  const perm = ids.slice()
  // fix first stop to kill rotational symmetry
  function heapPermute(n: number) {
    if (n === 1) {
      checked++
      const l = tourLength(perm, depot, dm)
      if (l < bestLen) {
        bestLen = l
        best = [...perm]
      }
      return
    }
    for (let i = 0; i < n; i++) {
      heapPermute(n - 1)
      if (n % 2 === 0) [perm[i], perm[n - 1]] = [perm[n - 1], perm[i]]
      else [perm[0], perm[n - 1]] = [perm[n - 1], perm[0]]
    }
  }
  if (ids.length > 0) heapPermute(ids.length)
  return { order: best, length: bestLen, checked }
}
