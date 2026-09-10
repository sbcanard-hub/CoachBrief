export type WaterGeometrySector = {
  bearing: number
  fetchKm: number
  shorelineDetected: boolean
}

export type WaterGeometryProfile = {
  source: 'OpenStreetMap / Overpass'
  waterBodyType: 'côtier' | 'intérieur' | 'indéterminé'
  shapeLabel: string
  shorelineCoverage: number
  openBearing: number | null
  openBearingClarity: number
  nearestShoreBearing: number | null
  nearestShoreDistanceKm: number | null
  maxFetchKm: number
  featureCount: number
  sectors: WaterGeometrySector[]
}

type OsmPoint = { lat: number; lon: number }
type ShorelineKind = 'coastline' | 'inland'
type ShorelineLine = { kind: ShorelineKind; points: OsmPoint[] }
type OverpassGeometryPoint = { lat?: number; lon?: number }
type OverpassElement = {
  type?: string
  tags?: Record<string, string>
  geometry?: OverpassGeometryPoint[]
  members?: Array<{ geometry?: OverpassGeometryPoint[] }>
}
type OverpassResponse = { elements?: OverpassElement[] }

const EARTH_KM_PER_DEGREE = 111.32
const ANALYSIS_RADIUS_KM = 18
const BEARINGS = Array.from({ length: 16 }, (_, index) => index * 22.5)
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function toRadians(value: number) {
  return value * Math.PI / 180
}

function validGeometry(points: OverpassGeometryPoint[] | undefined): OsmPoint[] {
  if (!Array.isArray(points)) return []
  return points
    .filter((point): point is { lat: number; lon: number } => typeof point.lat === 'number' && Number.isFinite(point.lat) && typeof point.lon === 'number' && Number.isFinite(point.lon))
    .map((point) => ({ lat: point.lat, lon: point.lon }))
}

function boundingBox(latitude: number, longitude: number, radiusKm: number) {
  const latDelta = radiusKm / EARTH_KM_PER_DEGREE
  const cosLatitude = Math.max(0.15, Math.cos(toRadians(latitude)))
  const lonDelta = radiusKm / (EARTH_KM_PER_DEGREE * cosLatitude)
  return {
    south: Math.max(-90, latitude - latDelta),
    west: Math.max(-180, longitude - lonDelta),
    north: Math.min(90, latitude + latDelta),
    east: Math.min(180, longitude + lonDelta),
  }
}

function buildOverpassQuery(latitude: number, longitude: number) {
  const box = boundingBox(latitude, longitude, ANALYSIS_RADIUS_KM)
  const bbox = `${box.south.toFixed(5)},${box.west.toFixed(5)},${box.north.toFixed(5)},${box.east.toFixed(5)}`
  return `[out:json][timeout:15];(
    way["natural"="coastline"](${bbox});
    way["natural"="water"](${bbox});
    relation["natural"="water"](${bbox});
    way["waterway"="riverbank"](${bbox});
    relation["waterway"="riverbank"](${bbox});
  );out tags geom qt;`
}

async function fetchOverpass(query: string): Promise<OverpassResponse> {
  let lastError: unknown = null
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(`${endpoint}?data=${encodeURIComponent(query)}`)
      if (!response.ok) throw new Error(`Overpass ${response.status}`)
      return await response.json() as OverpassResponse
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Géométrie du plan d’eau indisponible')
}

function extractShorelines(payload: OverpassResponse): ShorelineLine[] {
  const lines: ShorelineLine[] = []
  for (const element of payload.elements ?? []) {
    const kind: ShorelineKind = element.tags?.natural === 'coastline' ? 'coastline' : 'inland'
    const ownGeometry = validGeometry(element.geometry)
    if (ownGeometry.length >= 2) lines.push({ kind, points: ownGeometry })
    for (const member of element.members ?? []) {
      const geometry = validGeometry(member.geometry)
      if (geometry.length >= 2) lines.push({ kind, points: geometry })
    }
  }
  return lines
}

function projectPoint(point: OsmPoint, latitude: number, longitude: number) {
  const cosLatitude = Math.max(0.15, Math.cos(toRadians(latitude)))
  return {
    x: (point.lon - longitude) * EARTH_KM_PER_DEGREE * cosLatitude,
    y: (point.lat - latitude) * EARTH_KM_PER_DEGREE,
  }
}

function cross(ax: number, ay: number, bx: number, by: number) {
  return ax * by - ay * bx
}

function raySegmentDistanceKm(
  bearing: number,
  first: { x: number; y: number },
  second: { x: number; y: number },
) {
  const radians = toRadians(bearing)
  const rayX = Math.sin(radians)
  const rayY = Math.cos(radians)
  const segmentX = second.x - first.x
  const segmentY = second.y - first.y
  const denominator = cross(rayX, rayY, segmentX, segmentY)
  if (Math.abs(denominator) < 1e-8) return null

  const t = cross(first.x, first.y, segmentX, segmentY) / denominator
  const u = cross(first.x, first.y, rayX, rayY) / denominator
  if (t < 0.05 || u < 0 || u > 1) return null
  return t
}

function fetchDistanceForBearing(
  bearing: number,
  lines: ShorelineLine[],
  latitude: number,
  longitude: number,
) {
  let nearest = ANALYSIS_RADIUS_KM
  let detected = false
  for (const line of lines) {
    for (let index = 1; index < line.points.length; index += 1) {
      const first = projectPoint(line.points[index - 1], latitude, longitude)
      const second = projectPoint(line.points[index], latitude, longitude)
      const distance = raySegmentDistanceKm(bearing, first, second)
      if (distance != null && distance <= ANALYSIS_RADIUS_KM && distance < nearest) {
        nearest = distance
        detected = true
      }
    }
  }
  return { fetchKm: nearest, shorelineDetected: detected }
}

function circularMean(values: number[]) {
  if (!values.length) return null
  const vector = values.reduce((result, value) => {
    const radians = toRadians(value)
    result.x += Math.sin(radians)
    result.y += Math.cos(radians)
    return result
  }, { x: 0, y: 0 })
  if (Math.hypot(vector.x, vector.y) < 0.15) return null
  return (Math.atan2(vector.x, vector.y) * 180 / Math.PI + 360) % 360
}

function median(values: number[]) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

function shapeLabelFor(coverage: number, coastal: boolean, medianFetch: number) {
  if (coastal) {
    if (coverage <= 0.35 || medianFetch >= 13) return 'Côte très ouverte / grand large dominant'
    if (coverage <= 0.65 || medianFetch >= 8) return 'Baie ou côte ouverte'
    return 'Baie côtière relativement fermée'
  }
  if (coverage >= 0.9 && medianFetch <= 4) return 'Petit plan d’eau fermé ou lac encaissé'
  if (coverage >= 0.8 && medianFetch <= 9) return 'Plan d’eau intérieur semi-fermé'
  if (coverage >= 0.55) return 'Grand lac ou retenue avec plusieurs ouvertures'
  return 'Géométrie du plan d’eau partiellement identifiée'
}

export async function fetchWaterGeometryProfile(latitude: number, longitude: number): Promise<WaterGeometryProfile> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new Error('Coordonnées invalides pour le plan d’eau')
  const payload = await fetchOverpass(buildOverpassQuery(latitude, longitude))
  const shorelines = extractShorelines(payload)
  if (!shorelines.length) throw new Error('Aucun rivage exploitable trouvé autour de ce point')

  const sectors: WaterGeometrySector[] = BEARINGS.map((bearing) => ({
    bearing,
    ...fetchDistanceForBearing(bearing, shorelines, latitude, longitude),
  }))
  const detected = sectors.filter((sector) => sector.shorelineDetected)
  const shorelineCoverage = detected.length / sectors.length
  const fetches = sectors.map((sector) => sector.fetchKm)
  const maxFetchKm = Math.max(...fetches)
  const medianFetch = median(fetches)
  const openCandidates = sectors
    .filter((sector) => sector.fetchKm >= maxFetchKm - 1.25)
    .map((sector) => sector.bearing)
  const openBearing = circularMean(openCandidates)
  const openBearingClarity = openBearing == null
    ? 0
    : clamp((maxFetchKm - medianFetch) / 10, 0, 1)

  const nearestSector = detected.length
    ? [...detected].sort((a, b) => a.fetchKm - b.fetchKm)[0]
    : null
  const coastal = shorelines.some((line) => line.kind === 'coastline')

  return {
    source: 'OpenStreetMap / Overpass',
    waterBodyType: coastal ? 'côtier' : shorelines.some((line) => line.kind === 'inland') ? 'intérieur' : 'indéterminé',
    shapeLabel: shapeLabelFor(shorelineCoverage, coastal, medianFetch),
    shorelineCoverage,
    openBearing,
    openBearingClarity,
    nearestShoreBearing: nearestSector?.bearing ?? null,
    nearestShoreDistanceKm: nearestSector?.fetchKm ?? null,
    maxFetchKm,
    featureCount: shorelines.length,
    sectors,
  }
}

export function waterFetchForBearing(profile: WaterGeometryProfile, bearing: number) {
  const normalized = ((bearing % 360) + 360) % 360
  const nearest = [...profile.sectors].sort((a, b) => {
    const gapA = Math.abs(((a.bearing - normalized + 540) % 360) - 180)
    const gapB = Math.abs(((b.bearing - normalized + 540) % 360) - 180)
    return gapA - gapB
  })[0]
  return nearest?.fetchKm ?? null
}
