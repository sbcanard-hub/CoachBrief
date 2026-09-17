export type GeoPoint = { lat: number; lon: number }
export type CoastLine = { points: GeoPoint[] }

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

function countCrossings(coastLines: CoastLine[], from: GeoPoint, to: GeoPoint) {
  let crossings = 0
  for (const line of coastLines) {
    for (let index = 1; index < line.points.length; index += 1) {
      if (properIntersection(from, to, line.points[index - 1], line.points[index])) crossings += 1
    }
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
