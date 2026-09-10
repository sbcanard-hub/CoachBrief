import type { SavedBriefing } from './savedBriefings'

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

export function signedAngleDelta(from: number, to: number) {
  return ((to - from + 540) % 360) - 180
}

function planKey(item: SavedBriefing) {
  const latitude = Number(item.request.latitude)
  const longitude = Number(item.request.longitude)
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return `${latitude.toFixed(2)}:${longitude.toFixed(2)}`
  }
  return (item.request.location || 'plan-eau-inconnu').trim().toLowerCase()
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

export function buildPlanCalibrations(items: SavedBriefing[]): PlanCalibration[] {
  const groups = new Map<string, SavedBriefing[]>()

  for (const item of items) {
    if (!item.weather?.race || !item.reality) continue
    const key = planKey(item)
    const current = groups.get(key) ?? []
    current.push(item)
    groups.set(key, current)
  }

  return Array.from(groups.entries()).map(([key, group]) => {
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
      label: group[0].request.location || 'Plan d’eau',
      sampleCount: samples.length,
      speedSampleCount: speedValues.length,
      directionSampleCount: directionValues.length,
      meanSpeedBias: arithmeticMean(speedValues),
      meanAbsSpeedError: arithmeticMean(speedValues.map(Math.abs)),
      meanDirectionBias: circularMeanDelta(directionValues),
      meanAbsDirectionError: arithmeticMean(directionValues.map(Math.abs)),
      samples,
    }
  }).sort((a, b) => b.sampleCount - a.sampleCount || a.label.localeCompare(b.label))
}

export function calibrationConfidence(sampleCount: number) {
  if (sampleCount >= 8) return 'Base solide'
  if (sampleCount >= 4) return 'Tendance utile'
  if (sampleCount >= 2) return 'Tendance initiale'
  return '1 manche · à confirmer'
}
