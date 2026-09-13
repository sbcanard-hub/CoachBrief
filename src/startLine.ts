import type { BoatClass } from './types'

export type LineEnd = { latitude: number; longitude: number }
export type StartLineAnalysis = {
  orientation: number
  windAngle: number
  lengthMetres: number
  advantageMetres: number
  favoured: 'committee' | 'pin' | 'neutral'
  boatLengths: number
}

const boatLengths: Record<BoatClass, number> = { Optimist: 2.3, '420': 4.2, ILCA: 4.23 }
const radians = (degrees: number) => degrees * Math.PI / 180
const normal = (degrees: number) => (degrees % 360 + 360) % 360

export function bearing(from: LineEnd, to: LineEnd) {
  const lat1 = radians(from.latitude); const lat2 = radians(to.latitude)
  const longitudeDelta = radians(to.longitude - from.longitude)
  return normal(Math.atan2(Math.sin(longitudeDelta) * Math.cos(lat2), Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(longitudeDelta)) * 180 / Math.PI)
}

export function distanceMetres(from: LineEnd, to: LineEnd) {
  const latDelta = radians(to.latitude - from.latitude); const longitudeDelta = radians(to.longitude - from.longitude)
  const a = Math.sin(latDelta / 2) ** 2 + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(longitudeDelta / 2) ** 2
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function analyseStartLine(committee: LineEnd, pin: LineEnd, windFrom: number, boatClass: BoatClass): StartLineAnalysis | null {
  if (![committee.latitude, committee.longitude, pin.latitude, pin.longitude, windFrom].every(Number.isFinite)) return null
  const lengthMetres = distanceMetres(committee, pin)
  if (lengthMetres < 1) return null
  const orientation = bearing(committee, pin)
  const signedProjection = lengthMetres * Math.cos(radians(orientation - normal(windFrom)))
  const advantageMetres = Math.abs(signedProjection)
  const neutralThreshold = Math.max(1, lengthMetres * 0.02)
  const favoured = advantageMetres <= neutralThreshold ? 'neutral' : signedProjection > 0 ? 'pin' : 'committee'
  const rawAngle = Math.abs(normal(orientation - windFrom))
  const angle = rawAngle > 180 ? 360 - rawAngle : rawAngle
  return { orientation, windAngle: Math.min(angle, 180 - angle), lengthMetres, advantageMetres, favoured, boatLengths: advantageMetres / boatLengths[boatClass] }
}
