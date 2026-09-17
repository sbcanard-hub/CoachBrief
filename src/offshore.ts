export type OffshorePoint = {
  id: string
  name: string
  latitude: string
  longitude: string
}

export type OffshoreLeg = {
  index: number
  from: OffshorePoint
  to: OffshorePoint
  distanceNm: number
  bearing: number
}

const EARTH_RADIUS_NM = 3440.065

function radians(value: number) { return value * Math.PI / 180 }
function degrees(value: number) { return value * 180 / Math.PI }
function normalize(value: number) { return ((value % 360) + 360) % 360 }

export function validOffshorePoint(point: OffshorePoint) {
  const latitude = Number(point.latitude)
  const longitude = Number(point.longitude)
  return point.name.trim().length > 0 && Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180
}

export function distanceAndBearing(from: OffshorePoint, to: OffshorePoint) {
  const lat1 = radians(Number(from.latitude))
  const lat2 = radians(Number(to.latitude))
  const dLat = lat2 - lat1
  const dLon = radians(Number(to.longitude) - Number(from.longitude))
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  const centralAngle = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const y = Math.sin(dLon) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
  return {
    distanceNm: EARTH_RADIUS_NM * centralAngle,
    bearing: normalize(degrees(Math.atan2(y, x))),
  }
}

export function buildOffshoreLegs(points: OffshorePoint[]): OffshoreLeg[] {
  const valid = points.filter(validOffshorePoint)
  const legs: OffshoreLeg[] = []
  for (let index = 0; index < valid.length - 1; index += 1) {
    const from = valid[index]
    const to = valid[index + 1]
    const geometry = distanceAndBearing(from, to)
    legs.push({ index: index + 1, from, to, ...geometry })
  }
  return legs
}

export function totalOffshoreDistance(legs: OffshoreLeg[]) {
  return legs.reduce((sum, leg) => sum + leg.distanceNm, 0)
}

export function estimateOffshoreEtaHours(distanceNm: number, averageSpeed: number) {
  if (!Number.isFinite(distanceNm) || !Number.isFinite(averageSpeed) || averageSpeed <= 0) return null
  return distanceNm / averageSpeed
}
