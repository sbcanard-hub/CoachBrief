import type { OffshorePoint } from './offshore'

type GeoPoint = { lat: number; lon: number }
type ConstraintKind = 'coastline' | 'tss'
type ConstraintLine = { kind: ConstraintKind; points: GeoPoint[] }

type OverpassElement = {
  tags?: Record<string, string>
  geometry?: Array<{ lat?: number; lon?: number }>
  members?: Array<{ geometry?: Array<{ lat?: number; lon?: number }> }>
}

type OverpassResponse = { elements?: OverpassElement[] }

export type OffshoreConstraintProfile = {
  source: 'OpenStreetMap / Overpass'
  available: boolean
  coastLines: ConstraintLine[]
  tssLines: ConstraintLine[]
  note: string
}

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

const EARTH_KM_PER_DEGREE = 111.32
const LAND_SAMPLE_SPACING_KM = 3
// La classification gauche/droite d'une coastline OSM est fragile près des découpages de ways.
// On ne l'utilise désormais que dans une bande quasi nulle autour de la côte (50 m) :
// les vraies intersections géométriques restent, elles, toujours bloquantes.
const MAX_INTERIOR_CLASSIFICATION_DISTANCE_KM = .05
const MIN_CONSECUTIVE_LAND_SAMPLES = 2

function num(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function validPoint(point: OffshorePoint) {
  const lat = num(point.latitude)
  const lon = num(point.longitude)
  return lat == null || lon == null ? null : { lat, lon }
}

function validGeometry(value: Array<{ lat?: number; lon?: number }> | undefined): GeoPoint[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((point): point is { lat: number; lon: number } => typeof point.lat === 'number' && Number.isFinite(point.lat) && typeof point.lon === 'number' && Number.isFinite(point.lon))
    .map((point) => ({ lat: point.lat, lon: point.lon }))
}

function bbox(start: GeoPoint, target: GeoPoint) {
  const pad = Math.max(.18, Math.min(.7, Math.hypot(target.lat - start.lat, target.lon - start.lon) * .12))
  return {
    south: Math.max(-90, Math.min(start.lat, target.lat) - pad),
    west: Math.max(-180, Math.min(start.lon, target.lon) - pad),
    north: Math.min(90, Math.max(start.lat, target.lat) + pad),
    east: Math.min(180, Math.max(start.lon, target.lon) + pad),
  }
}

function boxFor(start: GeoPoint, target: GeoPoint) {
  const b = bbox(start, target)
  return `${b.south.toFixed(5)},${b.west.toFixed(5)},${b.north.toFixed(5)},${b.east.toFixed(5)}`
}

function queryFor(start: GeoPoint, target: GeoPoint) {
  const box = boxFor(start, target)
  return `[out:json][timeout:22];(\n    way["natural"="coastline"](${box});\n    way["seamark:type"~"separation|traffic_separation",i](${box});\n    relation["seamark:type"~"separation|traffic_separation",i](${box});\n  );out tags geom qt;`
}

function coastlineOnlyQuery(start: GeoPoint, target: GeoPoint) {
  const box = boxFor(start, target)
  return `[out:json][timeout:14];way["natural"="coastline"](${box});out tags geom qt;`
}

async function fetchOverpass(query: string): Promise<OverpassResponse> {
  let last: unknown = null
  for (const endpoint of ENDPOINTS) {
    try {
      const controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), 9000)
      try {
        const response = await fetch(`${endpoint}?data=${encodeURIComponent(query)}`, { signal: controller.signal })
        if (!response.ok) throw new Error(`Overpass ${response.status}`)
        return await response.json() as OverpassResponse
      } finally {
        window.clearTimeout(timeout)
      }
    } catch (error) { last = error }
  }
  throw last instanceof Error ? last : new Error('Contraintes cartographiques indisponibles')
}

function extract(payload: OverpassResponse): ConstraintLine[] {
  const lines: ConstraintLine[] = []
  for (const element of payload.elements ?? []) {
    const kind: ConstraintKind = element.tags?.natural === 'coastline' ? 'coastline' : 'tss'
    const own = validGeometry(element.geometry)
    if (own.length >= 2) lines.push({ kind, points: own })
    for (const member of element.members ?? []) {
      const geometry = validGeometry(member.geometry)
      if (geometry.length >= 2) lines.push({ kind, points: geometry })
    }
  }
  return lines
}

export async function fetchOffshoreConstraintProfile(start: OffshorePoint, target: OffshorePoint): Promise<OffshoreConstraintProfile> {
  const a = validPoint(start)
  const b = validPoint(target)
  if (!a || !b) return { source: 'OpenStreetMap / Overpass', available: false, coastLines: [], tssLines: [], note: 'Coordonnées insuffisantes.' }

  try {
    const payload = await fetchOverpass(queryFor(a, b))
    const lines = extract(payload)
    const coastLines = lines.filter((line) => line.kind === 'coastline')
    if (coastLines.length) {
      return {
        source: 'OpenStreetMap / Overpass',
        available: true,
        coastLines,
        tssLines: lines.filter((line) => line.kind === 'tss'),
        note: 'Côtes et dispositifs de séparation du trafic issus d’OpenStreetMap. Les intersections réelles avec la côte sont bloquées ; le filtre d’orientation est limité à 50 m.',
      }
    }
  } catch {
    // Repli plus léger ci-dessous : les côtes sont prioritaires pour empêcher un routage à terre.
  }

  try {
    const payload = await fetchOverpass(coastlineOnlyQuery(a, b))
    const coastLines = extract(payload).filter((line) => line.kind === 'coastline')
    if (coastLines.length) {
      return {
        source: 'OpenStreetMap / Overpass',
        available: true,
        coastLines,
        tssLines: [],
        note: 'Côtes OpenStreetMap chargées en mode de secours. Les intersections réelles avec la côte restent bloquées ; les TSS n’ont pas pu être chargés pour ce calcul.',
      }
    }
  } catch {
    // Si même le repli côtier échoue, le moteur passe en sécurité fermée.
  }

  return {
    source: 'OpenStreetMap / Overpass',
    available: false,
    coastLines: [],
    tssLines: [],
    note: 'Côtes indisponibles : routage interrompu par sécurité afin de ne jamais proposer une trajectoire passant sur terre.',
  }
}

function project(point: GeoPoint, referenceLat: number) {
  const cos = Math.max(.15, Math.cos(referenceLat * Math.PI / 180))
  return { x: point.lon * cos, y: point.lat }
}

function orientation(a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
}

function intersects(a: GeoPoint, b: GeoPoint, c: GeoPoint, d: GeoPoint) {
  const ref = (a.lat + b.lat + c.lat + d.lat) / 4
  const pa = project(a, ref), pb = project(b, ref), pc = project(c, ref), pd = project(d, ref)
  const o1 = orientation(pa, pb, pc)
  const o2 = orientation(pa, pb, pd)
  const o3 = orientation(pc, pd, pa)
  const o4 = orientation(pc, pd, pb)
  return (o1 === 0 || o2 === 0 || o1 * o2 < 0) && (o3 === 0 || o4 === 0 || o3 * o4 < 0)
}

function crosses(lines: ConstraintLine[], from: GeoPoint, to: GeoPoint) {
  for (const line of lines) {
    for (let i = 1; i < line.points.length; i += 1) {
      if (intersects(from, to, line.points[i - 1], line.points[i])) return true
    }
  }
  return false
}

function planarKm(a: GeoPoint, b: GeoPoint) {
  const referenceLat = (a.lat + b.lat) / 2
  const cos = Math.max(.15, Math.cos(referenceLat * Math.PI / 180))
  const dx = (b.lon - a.lon) * EARTH_KM_PER_DEGREE * cos
  const dy = (b.lat - a.lat) * EARTH_KM_PER_DEGREE
  return Math.hypot(dx, dy)
}

function pointSegmentDistanceSquared(point: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  if (Math.abs(dx) + Math.abs(dy) < 1e-12) return (point.x - a.x) ** 2 + (point.y - a.y) ** 2
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy)))
  const x = a.x + t * dx
  const y = a.y + t * dy
  return (point.x - x) ** 2 + (point.y - y) ** 2
}

// Dans OSM, une coastline est orientée avec la terre à gauche et la mer à droite.
// Cette classification n'est qu'un filet de sécurité à très courte distance de la côte.
function likelyOnLand(coastLines: ConstraintLine[], point: GeoPoint) {
  let bestDistance = Number.POSITIVE_INFINITY
  let bestSide = 0
  for (const line of coastLines) {
    for (let i = 1; i < line.points.length; i += 1) {
      const a = line.points[i - 1]
      const b = line.points[i]
      const ref = (a.lat + b.lat + point.lat) / 3
      const pa = project(a, ref)
      const pb = project(b, ref)
      const pp = project(point, ref)
      const distance = pointSegmentDistanceSquared(pp, pa, pb)
      if (distance < bestDistance) {
        bestDistance = distance
        bestSide = orientation(pa, pb, pp)
      }
    }
  }
  if (!Number.isFinite(bestDistance)) return false
  const distanceKm = Math.sqrt(bestDistance) * EARTH_KM_PER_DEGREE
  return distanceKm <= MAX_INTERIOR_CLASSIFICATION_DISTANCE_KM && bestSide > 0
}

function samplesAlong(from: GeoPoint, to: GeoPoint) {
  const distanceKm = planarKm(from, to)
  const count = Math.max(1, Math.ceil(distanceKm / LAND_SAMPLE_SPACING_KM))
  const samples: GeoPoint[] = []
  for (let index = 1; index < count; index += 1) {
    const ratio = index / count
    samples.push({
      lat: from.lat + (to.lat - from.lat) * ratio,
      lon: from.lon + (to.lon - from.lon) * ratio,
    })
  }
  return samples
}

function crossesLandOrInterior(coastLines: ConstraintLine[], from: GeoPoint, to: GeoPoint) {
  // Une intersection réelle avec la côte reste toujours bloquante.
  if (crosses(coastLines, from, to)) return true

  // Le test d'orientation n'est plus autorisé à éliminer des branches en mer ouverte.
  let consecutiveLandSamples = 0
  for (const point of samplesAlong(from, to)) {
    if (likelyOnLand(coastLines, point)) {
      consecutiveLandSamples += 1
      if (consecutiveLandSamples >= MIN_CONSECUTIVE_LAND_SAMPLES) return true
    } else {
      consecutiveLandSamples = 0
    }
  }
  return false
}

export function evaluateOffshoreSegment(profile: OffshoreConstraintProfile | null, from: GeoPoint, to: GeoPoint) {
  if (!profile?.available || profile.coastLines.length === 0) {
    return { crossesLand: true, crossesTss: false }
  }
  return {
    crossesLand: crossesLandOrInterior(profile.coastLines, from, to),
    crossesTss: crosses(profile.tssLines, from, to),
  }
}

function angleGap(a: number, b: number) {
  return Math.abs((((a - b) % 360) + 540) % 360 - 180)
}

export function wavePerformanceFactor(heading: number, waveHeight: number | null, waveDirection: number | null, wavePeriod: number | null) {
  if (waveHeight == null || waveDirection == null || waveHeight <= .5) return 1
  const relative = angleGap(heading, waveDirection)
  const encounter = relative <= 60 ? 1 : relative <= 120 ? .7 : .35
  const heightSeverity = Math.min(.28, Math.max(0, waveHeight - .5) * .085)
  const shortSea = wavePeriod != null && wavePeriod < 6 ? .04 : 0
  return Math.max(.62, 1 - heightSeverity * encounter - shortSea * encounter)
}
