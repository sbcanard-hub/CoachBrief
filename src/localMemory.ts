import { signedAngleDelta } from './calibration'
import type { SavedBriefing } from './savedBriefings'
import type { BriefingRequest } from './types'
import type { LiveWeatherData } from './weather'

export type LocalMemoryMatch = { briefing: SavedBriefing; score: number }
export type LocalMemoryResult = {
  matches: LocalMemoryMatch[]
  confidence: 'faible' | 'moyen' | 'bon'
  speedRange: [number, number] | null
  directionRange: [number, number] | null
}

function number(value: string | number | null | undefined) {
  if (value === '' || value == null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizedLocation(value: string) {
  return value.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
}

/** A conservative identity: named waters must have the same name; unnamed GPS points must be within roughly 500 m. */
export function isSameWater(item: BriefingRequest, current: BriefingRequest) {
  const itemName = normalizedLocation(item.location)
  const currentName = normalizedLocation(current.location)
  if (itemName && currentName) return itemName === currentName
  const lat1 = number(item.latitude); const lon1 = number(item.longitude)
  const lat2 = number(current.latitude); const lon2 = number(current.longitude)
  if ([lat1, lon1, lat2, lon2].some((value) => value == null)) return false
  const latDelta = (lat1! - lat2!) * 111
  const lonDelta = (lon1! - lon2!) * 111 * Math.cos((lat2! * Math.PI) / 180)
  return Math.hypot(latDelta, lonDelta) <= 0.5
}

function clockMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number)
  return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : 12 * 60
}

function circularDistance(a: number, b: number) { return Math.abs(signedAngleDelta(a, b)) }
function monthDistance(a: string, b: string) {
  const first = Number(a.slice(5, 7)); const second = Number(b.slice(5, 7))
  if (!Number.isFinite(first) || !Number.isFinite(second)) return 6
  const gap = Math.abs(first - second)
  return Math.min(gap, 12 - gap)
}

/** Scores only completed, genuinely close cases. Missing optional context never improves a score. */
export function findSimilarLocalSituations(items: SavedBriefing[], request: BriefingRequest, weather: LiveWeatherData | null): LocalMemoryResult {
  if (!weather) return { matches: [], confidence: 'faible', speedRange: null, directionRange: null }
  const targetTime = clockMinutes(request.raceTime || request.startTime)
  const targetCurrent = weather.marine?.currentVelocity
  const matches = items.flatMap((briefing): LocalMemoryMatch[] => {
    if (!briefing.reality || !briefing.weather || !isSameWater(briefing.request, request)) return []
    const candidate = briefing.weather.race
    const directionGap = circularDistance(candidate.direction, weather.race.direction)
    const speedGap = Math.abs(candidate.speed - weather.race.speed)
    const timeGap = Math.abs(clockMinutes(briefing.request.raceTime || briefing.request.startTime) - targetTime)
    const seasonGap = monthDistance(briefing.request.date, request.date)
    if (directionGap > 45 || speedGap > 4 || timeGap > 180 || seasonGap > 2) return []
    let score = 100 - directionGap * 0.65 - speedGap * 6 - timeGap / 18 - seasonGap * 7
    score -= Math.min(15, Math.abs(candidate.pressure - weather.race.pressure) * 1.5)
    score -= Math.min(12, Math.abs(candidate.cloudCover - weather.race.cloudCover) * 0.2)
    const candidateCurrent = briefing.weather.marine?.currentVelocity
    if (targetCurrent != null && candidateCurrent != null) score -= Math.min(10, Math.abs(targetCurrent - candidateCurrent) * 8)
    return score >= 58 ? [{ briefing, score: Math.round(score) }] : []
  }).sort((a, b) => b.score - a.score).slice(0, 8)

  const speedDeltas = matches.flatMap(({ briefing }) => {
    const actual = number(briefing.reality?.windSpeed)
    return actual == null ? [] : [actual - briefing.weather!.race.speed]
  })
  const directionDeltas = matches.flatMap(({ briefing }) => {
    const actual = number(briefing.reality?.windDirection)
    return actual == null ? [] : [signedAngleDelta(briefing.weather!.race.direction, actual)]
  })
  const range = (values: number[]): [number, number] | null => values.length ? [Math.min(...values), Math.max(...values)] : null
  return {
    matches,
    confidence: matches.length >= 6 ? 'bon' : matches.length >= 3 ? 'moyen' : 'faible',
    speedRange: range(speedDeltas),
    directionRange: range(directionDeltas),
  }
}
