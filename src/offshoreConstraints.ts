import type { OffshorePoint } from './offshore'
import { classifyLandMask } from './landMask'

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
  seaAnchors: GeoPoint[]
  note: string
}

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

const EARTH_KM_PER_DEGREE = 111.32
const LAND_SAMPLE_SPACING_KM = 1.5
const MAX_INTERIOR_CLASSIFICATION_DISTANCE_KM = 15
const COAST_VOTE_NEAREST_SEGMENTS = 7
const COAST_VOTE_MIN_SEGMENTS = 3
const COAST_VOTE_LAND_RATIO = .72
const MIN_CONSECUTIVE_LAND_SAMPLES = 2
const constraintProfileCache = new Map<string, Promise<OffshoreConstraintProfile>>()

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
  if (!a || !b) return { source: 'OpenStreetMap / Overpass', available: false, coastLines: [], tssLines: [], seaAnchors: [], note: 'Coordonnées insuffisantes.' }
  const key = `${a.lat},${a.lon}|${b.lat},${b.lon}`
  const cached = constraintProfileCache.get(key)
  if (cached) return cached
  const pending = loadOffshoreConstraintProfile(a, b)
  constraintProfileCache.set(key, pending)
  return pending
}

async function loadOffshoreConstraintProfile(a: GeoPoint, b: GeoPoint): Promise<OffshoreConstraintProfile> {
  const seaAnchors = [a, b]

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
        seaAnchors,
        note: 'Côtes et TSS OpenStreetMap. Masque topologique indexé ; contrôle côtier local uniquement en cas d’ambiguïté.',
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
        seaAnchors,
        note: 'Côtes OpenStreetMap chargées en secours. Masque topologique indexé actif ; TSS indisponibles pour ce calcul.',
      }
    }
  } catch {
    // Si même le repli côtier échoue, le moteur passe en sécurité fermée.
  }

  const unavailable: OffshoreConstraintProfile = {
    source: 'OpenStreetMap / Overpass',
    available: false,
    coastLines: [],
    tssLines: [],
    seaAnchors,
    note: 'Côtes indisponibles : routage interrompu par sécurité afin de ne jamais proposer une trajectoire passant sur terre.',
  }
  constraintProfileCache.delete(`${a.lat},${a.lon}|${b.lat},${b.lon}`)
  return unavailable
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

function coastVoteSaysLand(coastLines: ConstraintLine[], point: GeoPoint) {
  const candidates: Array<{ distanceKm: number; land: boolean }> = []
  for (const line of coastLines) {
    for (let i = 1; i < line.points.length; i += 1) {
      const a = line.points[i - 1]
      const b = line.points[i]
      const ref = (a.lat + b.lat + point.lat) / 3
      const pa = project(a, ref)
      const pb = project(b, ref)
      const pp = project(point, ref)
      const distanceKm = Math.sqrt(pointSegmentDistanceSquared(pp, pa, pb)) * EARTH_KM_PER_DEGREE
      if (distanceKm <= MAX_INTERIOR_CLASSIFICATION_DISTANCE_KM) {
        candidates.push({ distanceKm, land: orientation(pa, pb, pp) > 0 })
      }
    }
  }

  candidates.sort((a, b) => a.distanceKm - b.distanceKm)
  const nearest = candidates.slice(0, COAST_VOTE_NEAREST_SEGMENTS)
  if (nearest.length < COAST_VOTE_MIN_SEGMENTS) return false
  const landVotes = nearest.reduce((sum, item) => sum + (item.land ? 1 : 0), 0)
  return landVotes / nearest.length >= COAST_VOTE_LAND_RATIO
}

function likelyOnLand(profile: OffshoreConstraintProfile, point: GeoPoint) {
  const classification = classifyLandMask(profile.coastLines, profile.seaAnchors, point)
  if (classification === 'land') return true
  if (classification === 'sea') return false
  // Le vote local, nettement plus coûteux, n'est calculé que lorsque les deux ancres
  // topologiques ne sont pas d'accord à cause d'une tangence ou d'un trou de coastline.
  return coastVoteSaysLand(profile.coastLines, point)
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

function crossesLandOrInterior(profile: OffshoreConstraintProfile, from: GeoPoint, to: GeoPoint) {
  if (crosses(profile.coastLines, from, to)) return true

  let consecutiveLandSamples = 0
  for (const point of samplesAlong(from, to)) {
    if (likelyOnLand(profile, point)) {
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
    crossesLand: crossesLandOrInterior(profile, from, to),
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
