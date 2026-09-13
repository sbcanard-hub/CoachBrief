import { signedAngleDelta, windForceBand, windSector } from './calibration'
import type { RaceDebrief, SavedBriefing, DebriefQuality } from './savedBriefings'

export type DebriefComparison = {
  key: 'wind' | 'direction' | 'rotation' | 'oscillations' | 'strategy' | 'line' | 'memory'
  forecast: string
  actual: string
  verdict: 'good' | 'partial' | 'gap' | 'unknown'
}

const numeric = (value: string) => value.trim() !== '' && Number.isFinite(Number(value)) ? Number(value) : null

export function forecastRotation(item: SavedBriefing) {
  const hours = item.weather?.hourly ?? []
  if (hours.length < 2) return null
  return signedAngleDelta(hours[0].direction, hours[hours.length - 1].direction)
}

export function forecastOscillation(item: SavedBriefing) {
  const directions = item.weather?.hourly.map((hour) => hour.direction) ?? []
  if (directions.length < 2) return null
  const reference = directions[0]
  return Math.max(...directions.map((direction) => Math.abs(signedAngleDelta(reference, direction))))
}

export function buildDebriefComparison(item: SavedBriefing, debrief: RaceDebrief, windUnit = 'kn'): DebriefComparison[] {
  const forecast = item.weather?.race
  const speed = numeric(debrief.windSpeed)
  const direction = numeric(debrief.windDirection)
  const speedGap = forecast && speed != null ? Math.abs(speed - forecast.speed) : null
  const directionGap = forecast && direction != null ? Math.abs(signedAngleDelta(forecast.direction, direction)) : null
  const expectedLine = item.request.startLineBias
  const lineMatches = debrief.favouredLineSide && debrief.favouredLineSide === expectedLine
  return [
    { key: 'wind', forecast: forecast ? `${forecast.speed.toFixed(1)} ${windUnit}` : '—', actual: speed == null ? '—' : `${speed.toFixed(1)} ${windUnit}`, verdict: speedGap == null ? 'unknown' : speedGap <= 2 ? 'good' : speedGap <= 4 ? 'partial' : 'gap' },
    { key: 'direction', forecast: forecast ? `${Math.round(forecast.direction)}°` : '—', actual: direction == null ? '—' : `${Math.round(direction)}°`, verdict: directionGap == null ? 'unknown' : directionGap <= 12 ? 'good' : directionGap <= 25 ? 'partial' : 'gap' },
    { key: 'rotation', forecast: forecastRotation(item) == null ? '—' : `${Math.round(forecastRotation(item)!)}°`, actual: debrief.actualRotation || '—', verdict: debrief.actualRotation ? 'partial' : 'unknown' },
    { key: 'oscillations', forecast: forecastOscillation(item) == null ? '—' : `${Math.round(forecastOscillation(item)!)}°`, actual: debrief.actualOscillations || '—', verdict: debrief.actualOscillations ? 'partial' : 'unknown' },
    { key: 'strategy', forecast: expectedLine, actual: debrief.winningTrajectory || '—', verdict: debrief.winningTrajectory ? 'partial' : 'unknown' },
    { key: 'line', forecast: expectedLine, actual: debrief.favouredLineSide || '—', verdict: !debrief.favouredLineSide ? 'unknown' : lineMatches ? 'good' : 'gap' },
    { key: 'memory', forecast: item.reality ? item.reality.notes || '—' : '—', actual: debrief.windEvolution || debrief.observedShifts || '—', verdict: debrief.windEvolution || debrief.observedShifts ? 'partial' : 'unknown' },
  ]
}

export function calculatedDebriefQuality(comparisons: DebriefComparison[]): DebriefQuality {
  const measurable = comparisons.filter((entry) => ['wind', 'direction', 'line'].includes(entry.key) && entry.verdict !== 'unknown')
  if (!measurable.length) return 'partly-relevant'
  const score = measurable.reduce((sum, entry) => sum + (entry.verdict === 'good' ? 2 : entry.verdict === 'partial' ? 1 : 0), 0) / (measurable.length * 2)
  return score >= .85 ? 'very-relevant' : score >= .65 ? 'relevant' : score >= .35 ? 'partly-relevant' : 'not-very-relevant'
}

export function extractLessons(item: SavedBriefing, debrief: RaceDebrief) {
  const lessons: string[] = []
  const speed = numeric(debrief.windSpeed)
  const direction = numeric(debrief.windDirection)
  if (speed != null && direction != null && debrief.favouredCourseSide) lessons.push(`${windSector(direction).key} · ${windForceBand(speed).label} · ${debrief.favouredCourseSide}`)
  if (debrief.windEvolution || debrief.observedShifts) lessons.push([debrief.windEvolution, debrief.observedShifts].filter(Boolean).join(' · '))
  if (debrief.winningTrajectory) lessons.push(debrief.winningTrajectory)
  return lessons.slice(0, 3)
}
