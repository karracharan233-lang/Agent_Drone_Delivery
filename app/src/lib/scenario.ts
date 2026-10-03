import type { GraphNode, Corridor } from './algorithms'

// Fictional harbour district. The depot sits south-west; delivery sites and
// intermediate waypoints are connected by approved flight corridors.
export const MAP_CENTER: [number, number] = [37.7945, -122.4045]

export const NODES: GraphNode[] = [
  { id: 'DEPOT', name: 'Depot · Pier 9', lat: 37.7901, lng: -122.4135, kind: 'depot' },
  { id: 'W1', name: 'Waypoint W1', lat: 37.7916, lng: -122.4077, kind: 'waypoint' },
  { id: 'W2', name: 'Waypoint W2', lat: 37.7889, lng: -122.4021, kind: 'waypoint' },
  { id: 'W3', name: 'Waypoint W3', lat: 37.7954, lng: -122.4117, kind: 'waypoint' },
  { id: 'W4', name: 'Waypoint W4', lat: 37.7938, lng: -122.4053, kind: 'waypoint' },
  { id: 'W5', name: 'Waypoint W5', lat: 37.7924, lng: -122.3987, kind: 'waypoint' },
  { id: 'W6', name: 'Waypoint W6', lat: 37.7995, lng: -122.4077, kind: 'waypoint' },
  { id: 'W7', name: 'Waypoint W7', lat: 37.7974, lng: -122.3999, kind: 'waypoint' },
  { id: 'D1', name: 'D1 · Ferry Plaza', lat: 37.7957, lng: -122.394, kind: 'delivery' },
  { id: 'D2', name: 'D2 · North Tower', lat: 37.8019, lng: -122.4031, kind: 'delivery' },
  { id: 'D3', name: 'D3 · Hillside Clinic', lat: 37.7992, lng: -122.4151, kind: 'delivery' },
  { id: 'D4', name: 'D4 · Market Square', lat: 37.7945, lng: -122.4089, kind: 'delivery' },
  { id: 'D5', name: 'D5 · East Wharf', lat: 37.7907, lng: -122.3949, kind: 'delivery' },
  { id: 'D6', name: 'D6 · Garden Court', lat: 37.7881, lng: -122.4093, kind: 'delivery' },
  { id: 'D7', name: 'D7 · Observatory', lat: 37.8038, lng: -122.4121, kind: 'delivery' },
]

export const CORRIDORS: Corridor[] = [
  { a: 'DEPOT', b: 'W1' },
  { a: 'DEPOT', b: 'W3' },
  { a: 'DEPOT', b: 'D6' },
  { a: 'W1', b: 'W2' },
  { a: 'W1', b: 'W4' },
  { a: 'W1', b: 'D4' },
  { a: 'W2', b: 'W5' },
  { a: 'W2', b: 'D6' },
  { a: 'W3', b: 'D3' },
  { a: 'W3', b: 'W4' },
  { a: 'W3', b: 'D4' },
  { a: 'W4', b: 'D4' },
  { a: 'W4', b: 'W6' },
  { a: 'W4', b: 'W5' },
  { a: 'W5', b: 'D5' },
  { a: 'W5', b: 'D1' },
  { a: 'W5', b: 'W7' },
  { a: 'W6', b: 'D3' },
  { a: 'W6', b: 'D2' },
  { a: 'W6', b: 'W7' },
  { a: 'W6', b: 'D7' },
  { a: 'W7', b: 'D1' },
  { a: 'W7', b: 'D2' },
  { a: 'D3', b: 'D7' },
  { a: 'D2', b: 'D7' },
  { a: 'D6', b: 'W1' },
]

export interface Delivery {
  nodeId: string
  priority: number // 1 (routine) … 5 (critical)
  payloadKg: number
  enabled: boolean
}

export const DEFAULT_DELIVERIES: Delivery[] = [
  { nodeId: 'D1', priority: 3, payloadKg: 1.8, enabled: true },
  { nodeId: 'D2', priority: 5, payloadKg: 0.9, enabled: true },
  { nodeId: 'D3', priority: 4, payloadKg: 1.2, enabled: true },
  { nodeId: 'D4', priority: 2, payloadKg: 2.4, enabled: true },
  { nodeId: 'D5', priority: 1, payloadKg: 3.1, enabled: true },
  { nodeId: 'D6', priority: 3, payloadKg: 1.5, enabled: true },
  { nodeId: 'D7', priority: 4, payloadKg: 0.6, enabled: true },
]

export const DEFAULT_BATTERY_KM = 9
