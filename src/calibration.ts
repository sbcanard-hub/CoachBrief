import type { BriefingRequest } from './types'
import type { SavedBriefing } from './savedBriefings'
import type { LiveWeatherData } from './weather'

export const METAR_MAX_TIME_GAP_MINUTES = 90

export type CalibrationSample = {
  id: string
  date: string
  name: string
  speedGap: number | null
  directionGap: number | null
}

export type PlanCalibration = {
  key: string
  label: string
  sampleCount: number
  speedSampleCount: number
  directionSampleCount: number
  meanSpeedBias: number | null
  meanAbsSpeedError: number | null
  meanDirectionBias: number | null
  meanAbsDirectionError: number | null
  samples: CalibrationSample[]
}

export type CalibrationMatch = {
  calibration: PlanCalibration
  scope: 'situation' | 'plan'
  situationLabel: string
  situationSampleCount: number
  contextSampleCount: number
  contextLabel: string
}

export type SourceReliabilityMetric = {
  key: 'model' | 'metar' | 'coach'
  label: string
  sampleCount: number
  speedSampleCount: number
  directionSampleCount: number
  meanSpeedBias: number | null
  meanAbsSpeedError: number | null
  meanDirectionBias: number | null
  meanAbsDirectionError: number | null
  meanDistanceKm: number | null
  meanTimeGapMinutes: number | null
  excludedTimeMismatchCount: number
  confidenceScore: number | null
  confidenceLabel: string
}

export type PlanSourceReliability = {
  key: string
  label: string
  metrics: SourceReliabilityMetric[]
}

export function signedAngleDelta(from: number, to: number) {
  return ((to - from + 540) % 360) - 180
}

function normalizeDirection(value: number) {
  return ((value % 360) + 360) % 360
}

function planKeyFromRequest(request: BriefingRequest) {
  const latitude = Number(request.latitude)
  const longitude = Number(request.longitude)
  if (request.latitude !== '' && request.longitude !== '' && Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return `${latitude.toFixed(2)}:${longitude.toFixed(2)}`
  }
  return (request.location || 'plan-eau-inconnu').trim().toLowerCase()
}

function planKey(item: SavedBriefing) {
  return planKeyFromRequest(item.request)
}

function arithmeticMean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
}

function circularMeanDelta(values: number[]) {
  if (!values.length) return null
  const radians = values.map((value) => value * Math.PI / 180)
  const x = radians.reduce((sum, value) => sum + Math.cos(value), 0) / radians.length
  const y = radians.reduce((sum, value) => sum + Math.sin(value), 0) / radians.length
  if (Math.abs(x) < 1e-9 && Math.abs(y) < 1e-9) return 0
  return Math.atan2(y, x) * 180 / Math.PI
}

function summarizeGroup(key: string, label: string, group: SavedBriefing[]): PlanCalibration {
  const samples: CalibrationSample[] = group
    .map((item) => {
      const forecast = item.weather!.race
      const reality = item.reality!
      const actualSpeed = Number(reality.windSpeed)
      const actualDirection = Number(reality.windDirection)
      const speedGap = reality.windSpeed !== '' && Number.isFinite(actualSpeed) ? actualSpeed - forecast.speed : null
      const directionGap = reality.windDirection !== '' && Number.isFinite(actualDirection) ? signedAngleDelta(forecast.direction, actualDirection) : null
      return {
        id: item.id,
        date: item.request.date || item.savedAt.slice(0, 10),
        name: item.name,
        speedGap,
        directionGap,
      }
    })
    .sort((a, b) => a.date.localeCompare(b.date))

  const speedValues = samples.flatMap((sample) => sample.speedGap == null ? [] : [sample.speedGap])
  const directionValues = samples.flatMap((sample) => sample.directionGap == null ? [] : [sample.directionGap])

  return {
    key,
    label,
    sampleCount: samples.length,
    speedSampleCount: speedValues.length,
    directionSampleCount: directionValues.length,
    meanSpeedBias: arithmeticMean(speedValues),
    meanAbsSpeedError: arithmeticMean(speedValues.map(Math.abs)),
    meanDirectionBias: circularMeanDelta(directionValues),
    meanAbsDirectionError: arithmeticMean(directionValues.map(Math.abs)),
    samples,
  }
}

export function windSector(direction: number) {
  const normalized = normalizeDirection(direction)
  const sectors = [
    { key: 'N', label: 'Nord' },
    { key: 'NE', label: 'Nord-Est' },
    { key: 'E', label: 'Est' },
    { key: 'SE', label: 'Sud-Est' },
    { key: 'S', label: 'Sud' },
    { key: 'SO', label: 'Sud-Ouest' },
    { key: 'O', label: 'Ouest' },
    { key: 'NO', label: 'Nord-Ouest' },
  ] as const
  const index = Math.round(normalized / 45) % 8
  return sectors[index]
}

export function windForceBand(speed: number) {
  if (speed < 6) return { key: '0-5', label: '0–5 nd' }
  if (speed < 11) return { key: '6-10', label: '6–10 nd' }
  if (speed < 16) return { key: '11-15', label: '11–15 nd' }
  return { key: '16+', label: '16 nd et +' }
}

export function seasonForDate(date: string | undefined) {
  const month = Number(date?.slice(5, 7))
  if ([12, 1, 2].includes(month)) return { key: 'hiver', label: 'Hiver' }
  if ([3, 4, 5].includes(month)) return { key: 'printemps', label: 'Printemps' }
  if ([6, 7, 8].includes(month)) return { key: 'ete', label: 'Été' }
  if ([9, 10, 11].includes(month)) return { key: 'automne', label: 'Automne' }
  return { key: 'inconnue', label: 'Saison inconnue' }
}

export function daypartForTime(time: string | undefined) {
  const hour = Number(time?.slice(0, 2))
  if (!Number.isFinite(hour)) return { key: 'inconnu', label: 'Horaire inconnu' }
  if (hour < 10) return { key: 'matin-tot', label: 'Matin tôt' }
  if (hour < 12) return { key: 'fin-matin', label: 'Fin de matinée' }
  if (hour < 15) return { key: 'debut-apres-midi', label: 'Début d’après-midi' }
  if (hour < 18) return { key: 'fin-apres-midi', label: 'Fin d’après-midi' }
  return { key: 'soir', label: 'Soir' }
}

function requestDaypart(request: BriefingRequest) {
  return daypartForTime(request.raceTime || request.startTime)
}

export function buildPlanCalibrations(items: SavedBriefing[]): PlanCalibration[] {
  const groups = new Map<string, SavedBriefing[]>()
  for (const item of items) {
    if (!item.weather?.race || !item.reality) continue
    const key = planKey(item)
    const current = groups.get(key) ?? []
    current.push(item)
    groups.set(key, current)
  }
  return Array.from(groups.entries())
    .map(([key, group]) => summarizeGroup(key, group[0].request.location || 'Plan d’eau', group))
    .sort((a, b) => b.sampleCount - a.sampleCount || a.label.localeCompare(b.label))
}

export function calibrationForRequest(items: SavedBriefing[], request: BriefingRequest | null) {
  if (!request) return null
  const key = planKeyFromRequest(request)
  return buildPlanCalibrations(items).find((calibration) => calibration.key === key) ?? null
}

export function calibrationForSituation(items: SavedBriefing[], request: BriefingRequest | null, weather: LiveWeatherData | null): CalibrationMatch | null {
  if (!request || !weather) return null
  const planKeyValue = planKeyFromRequest(request)
  const sector = windSector(weather.race.direction)
  const force = windForceBand(weather.race.speed)
  const season = seasonForDate(request.date)
  const daypart = requestDaypart(request)
  const baseSituationLabel = `${sector.label} · ${force.label}`
  const contextLabel = `${baseSituationLabel} · ${season.label} · ${daypart.label}`
  const eligible = items.filter((item) => item.weather?.race && item.reality && planKey(item) === planKeyValue)
  const matchingSituation = eligible.filter((item) => {
    const race = item.weather!.race
    return windSector(race.direction).key === sector.key && windForceBand(race.speed).key === force.key
  })
  const matchingContext = matchingSituation.filter((item) => (
    seasonForDate(item.request.date).key === season.key
    && requestDaypart(item.request).key === daypart.key
  ))

  if (matchingContext.length >= 2) {
    return {
      calibration: summarizeGroup(`${planKeyValue}:${sector.key}:${force.key}:${season.key}:${daypart.key}`, request.location || 'Plan d’eau', matchingContext),
      scope: 'situation',
      situationLabel: contextLabel,
      situationSampleCount: matchingContext.length,
      contextSampleCount: matchingContext.length,
      contextLabel,
    }
  }

  if (matchingSituation.length >= 2) {
    return {
      calibration: summarizeGroup(`${planKeyValue}:${sector.key}:${force.key}`, request.location || 'Plan d’eau', matchingSituation),
      scope: 'situation',
      situationLabel: `${baseSituationLabel} · toutes saisons/créneaux`,
      situationSampleCount: matchingSituation.length,
      contextSampleCount: matchingContext.length,
      contextLabel,
    }
  }

  const fallback = calibrationForRequest(items, request)
  if (!fallback) return null
  return {
    calibration: fallback,
    scope: 'plan',
    situationLabel: contextLabel,
    situationSampleCount: matchingSituation.length,
    contextSampleCount: matchingContext.length,
    contextLabel,
  }
}

export function applyCalibrationToWeather(weather: LiveWeatherData, calibration: PlanCalibration): LiveWeatherData {
  const speedBias = calibration.meanSpeedBias ?? 0
  const directionBias = calibration.meanDirectionBias ?? 0
  const correctedSpeed = (value: number) => Math.max(0, value + speedBias)
  const correctedDirection = (value: number) => normalizeDirection(value + directionBias)
  return {
    ...weather,
    hourly: weather.hourly.map((hour) => ({ ...hour, speed: correctedSpeed(hour.speed), gust: correctedSpeed(hour.gust), direction: correctedDirection(hour.direction) })),
    race: { ...weather.race, speed: correctedSpeed(weather.race.speed), gust: correctedSpeed(weather.race.gust), direction: correctedDirection(weather.race.direction) },
    scenario: {
      ...weather.scenario,
      windStart: correctedDirection(weather.scenario.windStart),
      windEnd: correctedDirection(weather.scenario.windEnd),
      raceWindSpeed: correctedSpeed(weather.scenario.raceWindSpeed),
      maxWindSpeed: correctedSpeed(weather.scenario.maxWindSpeed),
    },
  }
}

function numeric(value: string | number | null | undefined) {
  if (value === '' || value == null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function scoreLabel(score: number | null, samples: number) {
  if (score == null || samples === 0) return 'Pas de recul'
  if (samples < 2) return 'À confirmer'
  if (score >= 80) return 'Confiance forte'
  if (score >= 65) return 'Confiance bonne'
  if (score >= 45) return 'Confiance moyenne'
  return 'Confiance faible'
}

function reliabilityScore(sampleCount: number, speedError: number | null, directionError: number | null, distanceKm: number | null) {
  if (!sampleCount || (speedError == null && directionError == null)) return null
  const sampleQuality = Math.min(1, sampleCount / 8)
  const parts: number[] = []
  if (speedError != null) parts.push(Math.max(0, 1 - speedError / 5))
  if (directionError != null) parts.push(Math.max(0, 1 - directionError / 45))
  const errorQuality = parts.reduce((sum, value) => sum + value, 0) / parts.length
  let score = 100 * (0.35 * sampleQuality + 0.65 * errorQuality)
  if (distanceKm != null) {
    const distancePenalty = Math.min(0.35, Math.max(0, distanceKm) / 500)
    score *= 1 - distancePenalty
  }
  if (sampleCount === 1) score = Math.min(score, 55)
  return Math.max(0, Math.min(100, Math.round(score)))
}

function resolveMetarReportIso(reportTime: string | null | undefined, referenceIso: string | null | undefined) {
  if (!reportTime || !referenceIso) return null
  const match = reportTime.match(/^(\d{2})(\d{2})(\d{2})Z$/)
  const reference = new Date(referenceIso)
  if (!match || Number.isNaN(reference.getTime())) return null

  const day = Number(match[1])
  const hour = Number(match[2])
  const minute = Number(match[3])
  const candidates: Date[] = []

  for (const monthOffset of [-1, 0, 1]) {
    const monthAnchor = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + monthOffset, 1))
    const candidate = new Date(Date.UTC(monthAnchor.getUTCFullYear(), monthAnchor.getUTCMonth(), day, hour, minute))
    if (candidate.getUTCFullYear() === monthAnchor.getUTCFullYear() && candidate.getUTCMonth() === monthAnchor.getUTCMonth() && candidate.getUTCDate() === day) {
      candidates.push(candidate)
    }
  }

  if (!candidates.length) return null
  candidates.sort((a, b) => Math.abs(a.getTime() - reference.getTime()) - Math.abs(b.getTime() - reference.getTime()))
  return candidates[0].toISOString()
}

function wallClockMsInTimezone(iso: string, timezone: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date)
    const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value)
    const year = read('year')
    const month = read('month')
    const day = read('day')
    const hour = read('hour')
    const minute = read('minute')
    if (![year, month, day, hour, minute].every(Number.isFinite)) return null
    return Date.UTC(year, month - 1, day, hour, minute)
  } catch {
    return null
  }
}

function requestWallClockMs(request: BriefingRequest) {
  const dateMatch = request.date?.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const time = request.raceTime || request.startTime
  const timeMatch = time?.match(/^(\d{2}):(\d{2})/)
  if (!dateMatch || !timeMatch) return null
  const year = Number(dateMatch[1])
  const month = Number(dateMatch[2])
  const day = Number(dateMatch[3])
  const hour = Number(timeMatch[1])
  const minute = Number(timeMatch[2])
  if (![year, month, day, hour, minute].every(Number.isFinite)) return null
  return Date.UTC(year, month - 1, day, hour, minute)
}

function metarGapToRaceMinutes(item: SavedBriefing) {
  if (!item.metar || !item.weather?.timezone) return null
  const reportIso = resolveMetarReportIso(item.metar.reportTime, item.metar.capturedAt || item.savedAt)
  const reportWallClock = reportIso ? wallClockMsInTimezone(reportIso, item.weather.timezone) : null
  const raceWallClock = requestWallClockMs(item.request)
  if (reportWallClock == null || raceWallClock == null) return null
  return Math.abs(reportWallClock - raceWallClock) / 60000
}

function sourceMetric(group: SavedBriefing[], key: SourceReliabilityMetric['key']): SourceReliabilityMetric {
  const speedErrors: number[] = []
  const directionErrors: number[] = []
  const distances: number[] = []
  const timeGaps: number[] = []
  let excludedTimeMismatchCount = 0

  for (const item of group) {
    if (!item.reality) continue
    const actualSpeed = numeric(item.reality.windSpeed)
    const actualDirection = numeric(item.reality.windDirection)
    let sourceSpeed: number | null = null
    let sourceDirection: number | null = null

    if (key === 'model') {
      sourceSpeed = item.weather?.race.speed ?? null
      sourceDirection = item.weather?.race.direction ?? null
    } else if (key === 'coach') {
      sourceSpeed = numeric(item.request.observedWindSpeed)
      sourceDirection = numeric(item.request.observedWindDirection)
    } else {
      sourceSpeed = item.metar?.windSpeed ?? null
      sourceDirection = item.metar?.windDirection ?? null
      const hasMetarWind = sourceSpeed != null || sourceDirection != null
      if (hasMetarWind) {
        const timeGap = metarGapToRaceMinutes(item)
        if (timeGap == null || timeGap > METAR_MAX_TIME_GAP_MINUTES) {
          excludedTimeMismatchCount += 1
          continue
        }
        timeGaps.push(timeGap)
        if (item.metar?.distanceKm != null && Number.isFinite(item.metar.distanceKm)) distances.push(item.metar.distanceKm)
      }
    }

    if (actualSpeed != null && sourceSpeed != null) speedErrors.push(actualSpeed - sourceSpeed)
    if (actualDirection != null && sourceDirection != null) directionErrors.push(signedAngleDelta(sourceDirection, actualDirection))
  }

  const names = { model: 'Open-Meteo', metar: 'METAR proche', coach: 'Relevé coach' } as const
  const sampleCount = Math.max(speedErrors.length, directionErrors.length)
  const meanAbsSpeedError = arithmeticMean(speedErrors.map(Math.abs))
  const meanAbsDirectionError = arithmeticMean(directionErrors.map(Math.abs))
  const meanDistanceKm = key === 'metar' ? arithmeticMean(distances) : null
  const meanTimeGapMinutes = key === 'metar' ? arithmeticMean(timeGaps) : null
  const confidenceScore = reliabilityScore(sampleCount, meanAbsSpeedError, meanAbsDirectionError, meanDistanceKm)
  const confidenceLabel = scoreLabel(confidenceScore, sampleCount)
  const temporalNote = key === 'metar' && excludedTimeMismatchCount > 0 ? ` · ${excludedTimeMismatchCount} hors créneau` : ''

  return {
    key,
    label: `${confidenceScore == null ? names[key] : `${names[key]} · ${confidenceScore}/100 · ${confidenceLabel}`}${temporalNote}`,
    sampleCount,
    speedSampleCount: speedErrors.length,
    directionSampleCount: directionErrors.length,
    meanSpeedBias: arithmeticMean(speedErrors),
    meanAbsSpeedError,
    meanDirectionBias: circularMeanDelta(directionErrors),
    meanAbsDirectionError,
    meanDistanceKm,
    meanTimeGapMinutes,
    excludedTimeMismatchCount,
    confidenceScore,
    confidenceLabel,
  }
}

export function buildSourceReliabilities(items: SavedBriefing[]): PlanSourceReliability[] {
  const groups = new Map<string, SavedBriefing[]>()
  for (const item of items) {
    if (!item.reality) continue
    const key = planKey(item)
    const current = groups.get(key) ?? []
    current.push(item)
    groups.set(key, current)
  }
  return Array.from(groups.entries()).map(([key, group]) => ({
    key,
    label: group[0].request.location || 'Plan d’eau',
    metrics: [sourceMetric(group, 'model'), sourceMetric(group, 'metar'), sourceMetric(group, 'coach')],
  })).filter((entry) => entry.metrics.some((metric) => metric.sampleCount > 0 || metric.excludedTimeMismatchCount > 0))
}

export function sourceReliabilityForRequest(items: SavedBriefing[], request: BriefingRequest | null) {
  if (!request) return null
  const key = planKeyFromRequest(request)
  return buildSourceReliabilities(items).find((entry) => entry.key === key) ?? null
}

export function calibrationConfidence(sampleCount: number) {
  if (sampleCount >= 8) return 'Base solide'
  if (sampleCount >= 4) return 'Tendance utile'
  if (sampleCount >= 2) return 'Tendance initiale'
  return '1 manche · à confirmer'
}
