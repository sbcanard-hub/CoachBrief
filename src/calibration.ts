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
  scope: 'situation' | 'plan'
  situationLabel: string
  situationSampleCount: number
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
  const situationLabel = `${sector.label} · ${force.label}`
  const eligible = items.filter((item) => item.weather?.race && item.reality && planKey(item) === planKeyValue)
  const matching = eligible.filter((item) => {
    const race = item.weather!.race
    return windSector(race.direction).key === sector.key && windForceBand(race.speed).key === force.key
  })

  if (matching.length >= 2) {
    return {
      calibration: summarizeGroup(`${planKeyValue}:${sector.key}:${force.key}`, request.location || 'Plan d’eau', matching),
      scope: 'situation',
      situationLabel,
      situationSampleCount: matching.length,
    }
  }

  const fallback = calibrationForRequest(items, request)
  if (!fallback) return null
  return {
    calibration: fallback,
    scope: 'plan',
    situationLabel,
    situationSampleCount: matching.length,
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

function sourceMetric(group: SavedBriefing[], key: SourceReliabilityMetric['key']): SourceReliabilityMetric {
  const speedErrors: number[] = []
  const directionErrors: number[] = []

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
    }

    if (actualSpeed != null && sourceSpeed != null) speedErrors.push(actualSpeed - sourceSpeed)
    if (actualDirection != null && sourceDirection != null) directionErrors.push(signedAngleDelta(sourceDirection, actualDirection))
  }

  const labels = { model: 'Open-Meteo', metar: 'METAR proche', coach: 'Relevé coach' } as const
  return {
    key,
    label: labels[key],
    sampleCount: Math.max(speedErrors.length, directionErrors.length),
    speedSampleCount: speedErrors.length,
    directionSampleCount: directionErrors.length,
    meanSpeedBias: arithmeticMean(speedErrors),
    meanAbsSpeedError: arithmeticMean(speedErrors.map(Math.abs)),
    meanDirectionBias: circularMeanDelta(directionErrors),
    meanAbsDirectionError: arithmeticMean(directionErrors.map(Math.abs)),
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
