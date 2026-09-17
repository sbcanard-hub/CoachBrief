export type GeoPoint = { lat: number; lon: number }
export type CoastLine = { points: GeoPoint[] }

type IndexedSegment = {
  a: GeoPoint
  b: GeoPoint
  minLat: number
  maxLat: number
  minLon: number
  maxLon: number
}

type CoastIndex = {
  segments: IndexedSegment[]
  grid: Map<string, IndexedSegment[]>
}

const GRID_DEGREES = .1
const coastIndexCache = new WeakMap<CoastLine[], CoastIndex>()

function project(point: GeoPoint, referenceLat: number) {
  const cos = Math.max(.15, Math.cos(referenceLat * Math.PI / 180))
  return { x: point.lon * cos, y: point.lat }
}

function orientation(a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
}

function properIntersection(a: GeoPoint, b: GeoPoint, c: GeoPoint, d: GeoPoint) {
  const ref = (a.lat + b.lat + c.lat + d.lat) / 4
  const pa = project(a, ref), pb = project(b, ref), pc = project(c, ref), pd = project(d, ref)
  const o1 = orientation(pa, pb, pc)
  const o2 = orientation(pa, pb, pd)
  const o3 = orientation(pc, pd, pa)
  const o4 = orientation(pc, pd, pb)
  const eps = 1e-12
  return ((o1 > eps && o2 < -eps) || (o1 < -eps && o2 > eps))
    && ((o3 > eps && o4 < -eps) || (o3 < -eps && o4 > eps))
}

function gridCell(value: number) {
  return Math.floor(value / GRID_DEGREES)
}

function gridKey(latCell: number, lonCell: number) {
  return `${latCell}:${lonCell}`
}

function buildIndex(coastLines: CoastLine[]): CoastIndex {
  const cached = coastIndexCache.get(coastLines)
  if (cached) return cached

  const segments: IndexedSegment[] = []
  const grid = new Map<string, IndexedSegment[]>()
  for (const line of coastLines) {
    for (let index = 1; index < line.points.length; index += 1) {
      const a = line.points[index - 1]
      const b = line.points[index]
      const segment: IndexedSegment = {
        a,
        b,
        minLat: Math.min(a.lat, b.lat),
        maxLat: Math.max(a.lat, b.lat),
        minLon: Math.min(a.lon, b.lon),
        maxLon: Math.max(a.lon, b.lon),
      }
      segments.push(segment)
      const minLatCell = gridCell(segment.minLat)
      const maxLatCell = gridCell(segment.maxLat)
      const minLonCell = gridCell(segment.minLon)
      const maxLonCell = gridCell(segment.maxLon)
      for (let latCell = minLatCell; latCell <= maxLatCell; latCell += 1) {
        for (let lonCell = minLonCell; lonCell <= maxLonCell; lonCell += 1) {
          const key = gridKey(latCell, lonCell)
          const bucket = grid.get(key) ?? []
          bucket.push(segment)
          grid.set(key, bucket)
        }
      }
    }
  }

  const index = { segments, grid }
  coastIndexCache.set(coastLines, index)
  return index
}

function candidateSegments(coastLines: CoastLine[], from: GeoPoint, to: GeoPoint) {
  const index = buildIndex(coastLines)
  const minLat = Math.min(from.lat, to.lat)
  const maxLat = Math.max(from.lat, to.lat)
  const minLon = Math.min(from.lon, to.lon)
  const maxLon = Math.max(from.lon, to.lon)
  const minLatCell = gridCell(minLat)
  const maxLatCell = gridCell(maxLat)
  const minLonCell = gridCell(minLon)
  const maxLonCell = gridCell(maxLon)
  const cellCount = (maxLatCell - minLatCell + 1) * (maxLonCell - minLonCell + 1)
  if (cellCount > 500) return index.segments

  const unique = new Set<IndexedSegment>()
  for (let latCell = minLatCell; latCell <= maxLatCell; latCell += 1) {
    for (let lonCell = minLonCell; lonCell <= maxLonCell; lonCell += 1) {
      for (const segment of index.grid.get(gridKey(latCell, lonCell)) ?? []) unique.add(segment)
    }
  }
  return [...unique]
}

function countCrossings(coastLines: CoastLine[], from: GeoPoint, to: GeoPoint) {
  const minLat = Math.min(from.lat, to.lat)
  const maxLat = Math.max(from.lat, to.lat)
  const minLon = Math.min(from.lon, to.lon)
  const maxLon = Math.max(from.lon, to.lon)
  let crossings = 0
  for (const segment of candidateSegments(coastLines, from, to)) {
    if (segment.maxLat < minLat || segment.minLat > maxLat || segment.maxLon < minLon || segment.minLon > maxLon) continue
    if (properIntersection(from, to, segment.a, segment.b)) crossings += 1
  }
  return crossings
}

/**
 * Les ancres sont D et A, explicitement placées sur l'eau par l'utilisateur.
 * En partant d'une ancre marine, chaque franchissement de coastline change de
 * milieu. Un nombre impair de franchissements signifie donc que le point est
 * dans une surface terrestre. Les deux ancres doivent être d'accord afin de
 * neutraliser les tangences et les jonctions imparfaites de ways OSM.
 */
export function pointInsideLandMask(coastLines: CoastLine[], seaAnchors: GeoPoint[], point: GeoPoint) {
  const votes = seaAnchors.slice(0, 2).map((anchor) => countCrossings(coastLines, anchor, point) % 2 === 1)
  return votes.length >= 2 && votes.every(Boolean)
}
