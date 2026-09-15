import type { BriefingRequest, WeatherModelKey } from './types'
import { fetchWeatherForBriefing, type LiveWeatherData, type WeatherModelInfo } from './weather'

const HISTORICAL_MODEL: WeatherModelInfo = {
  key: 'best_match',
  label: 'Open-Meteo · Historique',
  shortLabel: 'Historique',
  provider: 'Open-Meteo',
  resolution: 'variable',
  horizon: 'archives',
  note: 'Données historiques Open-Meteo utilisées lorsque la date du briefing est passée.',
}

const LIVE_FALLBACK_MODELS: WeatherModelKey[] = ['best_match', 'icon_eu', 'ecmwf_ifs', 'ncep_gfs_global']
const MAX_FORECAST_DAYS = 16

type HistoricalResponse = {
  latitude: number
  longitude: number
  timezone: string
  hourly?: {
    time: string[]
    temperature_2m: number[]
    relative_humidity_2m: number[]
    dew_point_2m: number[]
    pressure_msl: number[]
    cloud_cover: number[]
    wind_speed_10m: number[]
    wind_direction_10m: number[]
    wind_gusts_10m: number[]
  }
}

function minutesFromClock(value: string | undefined, fallback: number) {
  if (!value) return fallback
  const [hours, minutes] = value.split(':').map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return fallback
  return hours * 60 + minutes
}

function minutesFromIso(value: string) {
  const time = value.split('T')[1] ?? '00:00'
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function nearestIndex(times: string[], clock: string | undefined) {
  const target = minutesFromClock(clock, 12 * 60)
  let bestIndex = 0
  let bestDistance = Number.POSITIVE_INFINITY
  times.forEach((time, index) => {
    const distance = Math.abs(minutesFromIso(time) - target)
    if (distance < bestDistance) { bestDistance = distance; bestIndex = index }
  })
  return bestIndex
}

function signedAngleDelta(from: number, to: number) {
  return ((to - from + 540) % 360) - 180
}

function estimateOscillation(directions: number[]) {
  if (directions.length < 3) return 5
  const first = directions[0]
  const last = directions[directions.length - 1]
  const trend = signedAngleDelta(first, last)
  let maxDeviation = 0
  directions.forEach((direction, index) => {
    const ratio = directions.length === 1 ? 0 : index / (directions.length - 1)
    const expected = (first + trend * ratio + 360) % 360
    maxDeviation = Math.max(maxDeviation, Math.abs(signedAngleDelta(expected, direction)))
  })
  return Math.max(3, Math.min(25, Math.round(maxDeviation || 5)))
}

function parseDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day, 12, 0, 0, 0)
  return Number.isNaN(date.getTime()) ? null : date
}

function localTodayAtNoon() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0)
}

export function weatherDateOffsetDays(value: string) {
  const target = parseDateOnly(value)
  if (!target) return null
  return Math.round((target.getTime() - localTodayAtNoon().getTime()) / 86400000)
}

function forecastHorizonStartLabel(target: Date) {
  const start = new Date(target)
  start.setDate(start.getDate() - MAX_FORECAST_DAYS)
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(start)
}

async function fetchWithTimeout(url: string, timeoutMs = 6500) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    window.clearTimeout(timeout)
  }
}

async function resolveCoordinates(request: BriefingRequest) {
  const latitude = Number(request.latitude)
  const longitude = Number(request.longitude)
  if (Number.isFinite(latitude) && Number.isFinite(longitude) && request.latitude !== '' && request.longitude !== '') {
    return { latitude, longitude, name: request.location || 'Point du plan d’eau' }
  }
  const params = new URLSearchParams({ name: request.location.trim(), count: '1', language: 'fr', format: 'json' })
  const response = await fetchWithTimeout(`https://geocoding-api.open-meteo.com/v1/search?${params}`)
  if (!response.ok) throw new Error('Lieu introuvable')
  const data = await response.json() as { results?: Array<{ name: string; latitude: number; longitude: number }> }
  const result = data.results?.[0]
  if (!result) throw new Error('Lieu introuvable')
  return result
}

async function fetchHistoricalWeather(request: BriefingRequest): Promise<LiveWeatherData> {
  const place = await resolveCoordinates(request)
  const params = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    hourly: 'temperature_2m,relative_humidity_2m,dew_point_2m,pressure_msl,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m',
    start_date: request.date,
    end_date: request.date,
    timezone: 'auto',
    wind_speed_unit: 'kn',
  })

  const urls = [
    `https://historical-forecast-api.open-meteo.com/v1/forecast?${params}`,
    `https://archive-api.open-meteo.com/v1/archive?${params}`,
  ]

  let forecast: HistoricalResponse | null = null
  for (const url of urls) {
    try {
      const response = await fetchWithTimeout(url)
      if (!response.ok) continue
      const data = await response.json() as HistoricalResponse
      if (data.hourly?.time?.length) { forecast = data; break }
    } catch { /* try next historical source */ }
  }
  if (!forecast?.hourly?.time?.length) throw new Error(`Données historiques indisponibles pour le ${request.date}`)

  const h = forecast.hourly
  const startMinutes = minutesFromClock(request.startTime, 0)
  const endMinutes = minutesFromClock(request.endTime, 24 * 60 - 1)
  const selectedIndexes = h.time.map((time, index) => ({ index, minute: minutesFromIso(time) }))
    .filter(({ minute }) => minute >= startMinutes && minute <= endMinutes)
    .map(({ index }) => index)
  const indexes = selectedIndexes.length ? selectedIndexes : h.time.map((_, index) => index)
  const raceIndex = nearestIndex(h.time, request.raceTime || request.startTime)
  const previousIndex = Math.max(0, raceIndex - 2)
  const pressureDelta = h.pressure_msl[raceIndex] - h.pressure_msl[previousIndex]
  const pressureTrend: LiveWeatherData['pressureTrend'] = pressureDelta > 0.7 ? 'hausse' : pressureDelta < -0.7 ? 'baisse' : 'stable'
  const directions = indexes.map((index) => h.wind_direction_10m[index])
  const speeds = indexes.map((index) => h.wind_speed_10m[index])

  return {
    placeName: `${request.location || place.name} · historique`,
    latitude: place.latitude,
    longitude: place.longitude,
    timezone: forecast.timezone,
    model: HISTORICAL_MODEL,
    hourly: indexes.map((index) => ({
      time: h.time[index].split('T')[1] ?? h.time[index],
      speed: h.wind_speed_10m[index],
      gust: h.wind_gusts_10m[index],
      direction: h.wind_direction_10m[index],
      temperature: h.temperature_2m[index],
    })),
    race: {
      speed: h.wind_speed_10m[raceIndex],
      gust: h.wind_gusts_10m[raceIndex],
      direction: h.wind_direction_10m[raceIndex],
      temperature: h.temperature_2m[raceIndex],
      humidity: h.relative_humidity_2m[raceIndex],
      dewPoint: h.dew_point_2m[raceIndex],
      pressure: h.pressure_msl[raceIndex],
      cloudCover: h.cloud_cover[raceIndex],
    },
    pressureTrend,
    scenario: {
      windStart: directions[0] ?? h.wind_direction_10m[raceIndex],
      windEnd: directions[directions.length - 1] ?? h.wind_direction_10m[raceIndex],
      oscillation: estimateOscillation(directions),
      raceWindSpeed: h.wind_speed_10m[raceIndex],
      maxWindSpeed: Math.max(...speeds, h.wind_speed_10m[raceIndex]),
      cloudCover: h.cloud_cover[raceIndex],
      waveHeight: 0,
    },
  }
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

async function fetchLiveWeather(request: BriefingRequest): Promise<LiveWeatherData> {
  const preferredModel = request.weatherModel ?? 'best_match'
  const attempted = new Set<WeatherModelKey>()
  const failures: string[] = []

  attempted.add(preferredModel)
  try {
    return await fetchWeatherForBriefing(request, preferredModel)
  } catch (error) {
    failures.push(`${preferredModel}: ${errorText(error)}`)
  }

  const fallbackModels = LIVE_FALLBACK_MODELS.filter((model) => !attempted.has(model))
  fallbackModels.forEach((model) => attempted.add(model))
  const results = await Promise.allSettled(fallbackModels.map((model) => fetchWeatherForBriefing(request, model)))

  for (let index = 0; index < results.length; index += 1) {
    const result = results[index]
    if (result.status === 'fulfilled') return result.value
    failures.push(`${fallbackModels[index]}: ${errorText(result.reason)}`)
  }

  throw new Error(`Aucune source de prévision disponible pour le ${request.date}. ${failures.join(' · ')}`)
}

export async function fetchWeatherForBriefingResilient(request: BriefingRequest): Promise<LiveWeatherData> {
  const offsetDays = weatherDateOffsetDays(request.date)
  if (offsetDays == null) throw new Error('Date de briefing invalide')

  if (offsetDays < 0) return fetchHistoricalWeather(request)

  if (offsetDays > MAX_FORECAST_DAYS) {
    const target = parseDateOnly(request.date)
    const availableFrom = target ? forecastHorizonStartLabel(target) : 'J-16'
    throw new Error(`La prévision numérique pour le ${request.date} n’est pas encore disponible. Elle entrera dans l’horizon de prévision vers le ${availableFrom} (J-${MAX_FORECAST_DAYS}).`)
  }

  try {
    return await fetchLiveWeather(request)
  } catch (liveError) {
    if (offsetDays === 0) {
      try { return await fetchHistoricalWeather(request) } catch { /* keep the live diagnostic */ }
    }
    throw liveError
  }
}
