import type { BriefingRequest } from './types'
import type { LiveWeatherData, WeatherHour } from './weather'

export type CoachObservationSignal = {
  hasObservation: boolean
  observationTime?: string
  windSpeed?: number
  windDirection?: number
  gust?: number
  waveHeight?: number
  currentVelocity?: number
  currentDirection?: number
  cloudCover?: number
  pressure?: number
  notes?: string
  modelHour?: WeatherHour
  windSpeedDelta?: number
  windDirectionDelta?: number
  gustDelta?: number
  waveHeightDelta?: number
  cloudCoverDelta?: number
  pressureDelta?: number
}

function numberFrom(value: string | undefined) {
  if (value == null || value.trim() === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function clockMinutes(value: string | undefined) {
  if (!value) return undefined
  const [hours, minutes] = value.split(':').map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return undefined
  return hours * 60 + minutes
}

function nearestModelHour(hours: WeatherHour[], time: string | undefined) {
  const target = clockMinutes(time)
  if (target == null || hours.length === 0) return undefined

  let best: WeatherHour | undefined
  let bestDistance = Number.POSITIVE_INFINITY
  for (const hour of hours) {
    const minute = clockMinutes(hour.time)
    if (minute == null) continue
    const distance = Math.abs(minute - target)
    if (distance < bestDistance) {
      best = hour
      bestDistance = distance
    }
  }

  return bestDistance <= 90 ? best : undefined
}

export function signedDirectionDelta(from: number, to: number) {
  return ((to - from + 540) % 360) - 180
}

export function buildCoachObservationSignal(request: BriefingRequest | null, weather: LiveWeatherData | null): CoachObservationSignal {
  const observationTime = request?.observationTime || undefined
  const windSpeed = numberFrom(request?.observedWindSpeed)
  const windDirection = numberFrom(request?.observedWindDirection)
  const gust = numberFrom(request?.observedGust)
  const waveHeight = numberFrom(request?.observedWaveHeight)
  const currentVelocity = numberFrom(request?.observedCurrentSpeed)
  const currentDirection = numberFrom(request?.observedCurrentDirection)
  const cloudCover = numberFrom(request?.observedCloudCover)
  const pressure = numberFrom(request?.observedPressure)
  const notes = request?.observationNotes?.trim() || undefined
  const hasObservation = [windSpeed, windDirection, gust, waveHeight, currentVelocity, currentDirection, cloudCover, pressure].some((value) => value != null) || Boolean(notes)
  const modelHour = weather ? nearestModelHour(weather.hourly, observationTime) : undefined

  return {
    hasObservation,
    observationTime,
    windSpeed,
    windDirection,
    gust,
    waveHeight,
    currentVelocity,
    currentDirection,
    cloudCover,
    pressure,
    notes,
    modelHour,
    windSpeedDelta: windSpeed != null && modelHour ? windSpeed - modelHour.speed : undefined,
    windDirectionDelta: windDirection != null && modelHour ? signedDirectionDelta(modelHour.direction, windDirection) : undefined,
    gustDelta: gust != null && modelHour ? gust - modelHour.gust : undefined,
    waveHeightDelta: waveHeight != null && weather?.marine?.waveHeight != null ? waveHeight - weather.marine.waveHeight : undefined,
    cloudCoverDelta: cloudCover != null && weather ? cloudCover - weather.race.cloudCover : undefined,
    pressureDelta: pressure != null && weather ? pressure - weather.race.pressure : undefined,
  }
}

export function observationImpactLabel(signal: CoachObservationSignal) {
  if (!signal.hasObservation) return 'Aucun relevé terrain saisi'
  const speedGap = Math.abs(signal.windSpeedDelta ?? 0)
  const directionGap = Math.abs(signal.windDirectionDelta ?? 0)
  if (speedGap >= 4 || directionGap >= 20) return 'Écart terrain / modèle important'
  if (speedGap >= 2 || directionGap >= 10) return 'Écart terrain / modèle à surveiller'
  if (signal.modelHour) return 'Terrain proche du modèle'
  return 'Relevé terrain disponible'
}
