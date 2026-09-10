import type { BriefingRequest } from './types'
import type { SavedBriefing } from './savedBriefings'
import type { LiveWeatherData } from './weather'

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
  scope: 'context' | 'situation' | 'plan'
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
  const situationLabel = `${sector.label} · ${force.label}`
  const contextLabel = `${situationLabel} · ${season.label} · ${daypart.label}`
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
      scope: 'context',
      situationLabel,
      situationSampleCount: matchingSituation.length,
      contextSampleCount: matchingContext.length,
      contextLabel,
    }
  }

  if (matchingSituation.length >= 2) {
    return {
      calibration: summarizeGroup(`${planKeyValue}:${sector.key}:${force.key}`, request.location || 'Plan d’eau', matchingSituation),
      scope: 'situation',
      situationLabel,
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
    situationLabel,
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
    hourly: weather.hourly.map((hour) => ({
      ...hour,
      speed: correctedSpeed(hour.speed),
      gust: correctedSpeed(hour.gust),
      direction: correctedDirection(hour.direction),
    })),
    race: {
      ...weather.race,
      speed: correctedSpeed(weather.race.speed),
      gust: correctedSpeed(weather.race.gust),
      direction: correctedDirection(weather.race.direction),
    },
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

function confidenceLabel(score: number | null, samples: number) {
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

function sourceMetric(group: SavedBriefing[], key: SourceReliabilityMetric['key']): SourceReliabilityMetric {
  const speedErrors: number[] = []
  const directionErrors: number[] = []
  const distances: number[] = []

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
      if (item.metar?.distanceKm != null && Number.isFinite(item.metar.distanceKm)) distances.push(item.metar.distanceKm)
    }

    if (actualSpeed != null && sourceSpeed != null) speedErrors.push(actualSpeed - sourceSpeed)
    if (actualDirection != null && sourceDirection != null) directionErrors.push(signedAngleDelta(sourceDirection, actualDirection))
  }

  const labels = { model: 'Open-Meteo', metar: 'METAR proche', coach: 'Relevé coach' } as const
  const sampleCount = Math.max(speedErrors.length, directionErrors.length)
  const meanAbsSpeedError = arithmeticMean(speedErrors.map(Math.abs))
  const meanAbsDirectionError = arithmeticMean(directionErrors.map(Math.abs))
  const meanDistanceKm = key === 'metar' ? arithmeticMean(distances) : null
  const confidenceScore = reliabilityScore(sampleCount, meanAbsSpeedError, meanAbsDirectionError, meanDistanceKm)
  return {
    key,
    label: labels[key],
    sampleCount,
    speedSampleCount: speedErrors.length,
    directionSampleCount: directionErrors.length,
    meanSpeedBias: arithmeticMean(speedErrors),
    meanAbsSpeedError,
    meanDirectionBias: circularMeanDelta(directionErrors),
    meanAbsDirectionError,
    meanDistanceKm,
    confidenceScore,
    confidenceLabel: confidenceLabel(confidenceScore, sampleCount),
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
  })).filter((entry) => entry.metrics.some((metric) => metric.sampleCount > 0))
}

export function calibrationConfidence(sampleCount: number) {
  if (sampleCount >= 8) return 'Base solide'
  if (sampleCount >= 4) return 'Tendance utile'
  if (sampleCount >= 2) return 'Tendance initiale'
  return '1 manche · à confirmer'
}
