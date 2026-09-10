import type { WeatherScenario } from './bernot'
import type { BriefingRequest, WeatherModelKey } from './types'

type GeoPlace = {
  name: string
  latitude: number
  longitude: number
  timezone?: string
  admin1?: string
  country?: string
}

type GeocodingResponse = { results?: GeoPlace[] }

type ForecastHourly = {
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

type ForecastResponse = {
  latitude: number
  longitude: number
  timezone: string
  hourly: ForecastHourly
}

type WindForecastResponse = {
  timezone: string
  hourly?: {
    time: string[]
    wind_speed_10m: Array<number | null>
    wind_direction_10m: Array<number | null>
    wind_gusts_10m: Array<number | null>
  }
}

type MarineHourly = {
  time: string[]
  wave_height: Array<number | null>
  wave_direction: Array<number | null>
  wave_period: Array<number | null>
  sea_surface_temperature: Array<number | null>
  ocean_current_velocity: Array<number | null>
  ocean_current_direction: Array<number | null>
}

type MarineResponse = { hourly?: MarineHourly }

export type WeatherHour = {
  time: string
  speed: number
  gust: number
  direction: number
  temperature: number
}

export type WeatherModelInfo = {
  key: WeatherModelKey
  label: string
  shortLabel: string
  provider: string
  resolution: string
  horizon: string
  note: string
}

export const WEATHER_MODELS: WeatherModelInfo[] = [
  {
    key: 'best_match',
    label: 'Open-Meteo · Best Match',
    shortLabel: 'Best Match',
    provider: 'Open-Meteo',
    resolution: 'variable',
    horizon: 'jusqu’à 16 j',
    note: 'Sélection automatique du modèle jugé le plus adapté au point demandé.',
  },
  {
    key: 'meteofrance_arome_france',
    label: 'Météo-France · AROME France',
    shortLabel: 'AROME',
    provider: 'Météo-France',
    resolution: '≈ 2,5 km',
    horizon: '≈ 2 j',
    note: 'Modèle à maille fine, particulièrement intéressant sur le littoral français à courte échéance.',
  },
  {
    key: 'ecmwf_ifs',
    label: 'ECMWF · IFS HRES',
    shortLabel: 'ECMWF',
    provider: 'ECMWF',
    resolution: '≈ 9 km',
    horizon: '≈ 10–15 j',
    note: 'Référence globale à haute résolution, utile pour la tendance synoptique et la cohérence générale.',
  },
  {
    key: 'icon_eu',
    label: 'DWD · ICON-EU',
    shortLabel: 'ICON-EU',
    provider: 'DWD',
    resolution: '≈ 7 km',
    horizon: '≈ 5 j',
    note: 'Modèle européen indépendant, utile pour confronter les rotations et gradients de vent.',
  },
  {
    key: 'ncep_gfs_global',
    label: 'NOAA · GFS Global',
    shortLabel: 'GFS',
    provider: 'NOAA/NCEP',
    resolution: '≈ 11–25 km',
    horizon: '≈ 16 j',
    note: 'Modèle global américain, moins fin localement mais utile pour vérifier la tendance de fond.',
  },
]

export function weatherModelInfo(key: WeatherModelKey | undefined) {
  return WEATHER_MODELS.find((model) => model.key === key) ?? WEATHER_MODELS[0]
}

export type WindModelComparison = {
  model: WeatherModelInfo
  available: boolean
  speed: number | null
  gust: number | null
  direction: number | null
  timezone: string | null
  error?: string
}

export type LiveWeatherData = {
  placeName: string
  latitude: number
  longitude: number
  timezone: string
  model?: WeatherModelInfo
  hourly: WeatherHour[]
  race: {
    speed: number
    gust: number
    direction: number
    temperature: number
    humidity: number
    dewPoint: number
    pressure: number
    cloudCover: number
  }
  pressureTrend: 'hausse' | 'baisse' | 'stable'
  marine?: {
    waveHeight: number | null
    waveDirection: number | null
    wavePeriod: number | null
    seaTemperature: number | null
    currentVelocity: number | null
    currentDirection: number | null
  }
  scenario: WeatherScenario
}

function simplifyLocation(location: string) {
  return location
    .replace(/^baie\s+d['’]*/i, '')
    .replace(/^baie\s+de\s+/i, '')
    .replace(/^port\s+d['’]*/i, '')
    .replace(/^port\s+de\s+/i, '')
    .trim()
}

async function geocode(location: string) {
  const candidates = Array.from(new Set([location.trim(), simplifyLocation(location)]))
  for (const name of candidates) {
    if (name.length < 2) continue
    const params = new URLSearchParams({ name, count: '1', language: 'fr', format: 'json' })
    const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`)
    if (!response.ok) continue
    const data = await response.json() as GeocodingResponse
    const result = data.results?.[0]
    if (result) return result
  }
  throw new Error('Lieu introuvable')
}

async function resolvePlace(request: BriefingRequest): Promise<GeoPlace> {
  const latitude = Number(request.latitude)
  const longitude = Number(request.longitude)
  if (Number.isFinite(latitude) && Number.isFinite(longitude) && request.latitude !== '' && request.longitude !== '') {
    return { name: request.location || 'Point du plan d’eau', latitude, longitude }
  }
  return geocode(request.location)
}

function minutesFromIso(value: string) {
  const time = value.split('T')[1] ?? '00:00'
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function minutesFromClock(value: string | undefined, fallback: number) {
  if (!value) return fallback
  const [hours, minutes] = value.split(':').map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return fallback
  return hours * 60 + minutes
}

function nearestIndex(times: string[], clock: string | undefined) {
  const target = minutesFromClock(clock, 12 * 60)
  let bestIndex = 0
  let bestDistance = Number.POSITIVE_INFINITY
  times.forEach((time, index) => {
    const distance = Math.abs(minutesFromIso(time) - target)
    if (distance < bestDistance) {
      bestDistance = distance
      bestIndex = index
    }
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

function safeNumber(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

async function fetchMarine(latitude: number, longitude: number, date: string, raceTime: string | undefined) {
  const params = new URLSearchParams({
    latitude: String(latitude), longitude: String(longitude),
    hourly: 'wave_height,wave_direction,wave_period,sea_surface_temperature,ocean_current_velocity,ocean_current_direction',
    start_date: date, end_date: date, timezone: 'auto', wind_speed_unit: 'kn', cell_selection: 'sea',
  })
  try {
    const response = await fetch(`https://marine-api.open-meteo.com/v1/marine?${params}`)
    if (!response.ok) return undefined
    const data = await response.json() as MarineResponse
    if (!data.hourly?.time.length) return undefined
    const index = nearestIndex(data.hourly.time, raceTime)
    return {
      waveHeight: safeNumber(data.hourly.wave_height[index]),
      waveDirection: safeNumber(data.hourly.wave_direction[index]),
      wavePeriod: safeNumber(data.hourly.wave_period[index]),
      seaTemperature: safeNumber(data.hourly.sea_surface_temperature[index]),
      currentVelocity: safeNumber(data.hourly.ocean_current_velocity[index]),
      currentDirection: safeNumber(data.hourly.ocean_current_direction[index]),
    }
  } catch { return undefined }
}

export async function fetchWindModelComparisons(
  request: BriefingRequest,
  latitude: number,
  longitude: number,
): Promise<WindModelComparison[]> {
  if (!request.date || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return []
  const raceTime = request.raceTime || request.startTime

  return Promise.all(WEATHER_MODELS.map(async (model): Promise<WindModelComparison> => {
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      hourly: 'wind_speed_10m,wind_direction_10m,wind_gusts_10m',
      start_date: request.date,
      end_date: request.date,
      timezone: 'auto',
      wind_speed_unit: 'kn',
      models: model.key,
    })

    try {
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`)
      if (!response.ok) {
        return { model, available: false, speed: null, gust: null, direction: null, timezone: null, error: 'Indisponible pour cette échéance ou cette zone.' }
      }
      const forecast = await response.json() as WindForecastResponse
      if (!forecast.hourly?.time.length) {
        return { model, available: false, speed: null, gust: null, direction: null, timezone: forecast.timezone ?? null, error: 'Pas de donnée à l’heure de la manche.' }
      }
      const raceIndex = nearestIndex(forecast.hourly.time, raceTime)
      const speed = safeNumber(forecast.hourly.wind_speed_10m[raceIndex])
      const gust = safeNumber(forecast.hourly.wind_gusts_10m[raceIndex])
      const direction = safeNumber(forecast.hourly.wind_direction_10m[raceIndex])
      if (speed == null || direction == null) {
        return { model, available: false, speed, gust, direction, timezone: forecast.timezone ?? null, error: 'Vent incomplet pour cette échéance.' }
      }
      return { model, available: true, speed, gust, direction, timezone: forecast.timezone ?? null }
    } catch {
      return { model, available: false, speed: null, gust: null, direction: null, timezone: null, error: 'Connexion au modèle impossible.' }
    }
  }))
}

export async function fetchWeatherForBriefing(
  request: BriefingRequest,
  modelKey: WeatherModelKey = request.weatherModel ?? 'best_match',
): Promise<LiveWeatherData> {
  if (!request.location.trim() || !request.date) throw new Error('Lieu et date requis')

  const place = await resolvePlace(request)
  const selectedModel = weatherModelInfo(modelKey)
  const params = new URLSearchParams({
    latitude: String(place.latitude), longitude: String(place.longitude),
    hourly: 'temperature_2m,relative_humidity_2m,dew_point_2m,pressure_msl,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m',
    start_date: request.date, end_date: request.date, timezone: 'auto', wind_speed_unit: 'kn', models: selectedModel.key,
  })

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`)
  if (!response.ok) throw new Error(`${selectedModel.shortLabel} indisponible pour cette date`)
  const forecast = await response.json() as ForecastResponse
  if (!forecast.hourly?.time.length) throw new Error(`Aucune prévision horaire ${selectedModel.shortLabel}`)

  const startMinutes = minutesFromClock(request.startTime, 0)
  const endMinutes = minutesFromClock(request.endTime, 24 * 60 - 1)
  const selectedIndexes = forecast.hourly.time
    .map((time, index) => ({ index, minute: minutesFromIso(time) }))
    .filter(({ minute }) => minute >= startMinutes && minute <= endMinutes)
    .map(({ index }) => index)
  const indexes = selectedIndexes.length ? selectedIndexes : forecast.hourly.time.map((_, index) => index)
  const hourly = indexes.map((index) => ({
    time: forecast.hourly.time[index].split('T')[1] ?? forecast.hourly.time[index],
    speed: forecast.hourly.wind_speed_10m[index], gust: forecast.hourly.wind_gusts_10m[index],
    direction: forecast.hourly.wind_direction_10m[index], temperature: forecast.hourly.temperature_2m[index],
  }))

  const raceIndex = nearestIndex(forecast.hourly.time, request.raceTime || request.startTime)
  const previousIndex = Math.max(0, raceIndex - 2)
  const pressureDelta = forecast.hourly.pressure_msl[raceIndex] - forecast.hourly.pressure_msl[previousIndex]
  const pressureTrend: LiveWeatherData['pressureTrend'] = pressureDelta > 0.7 ? 'hausse' : pressureDelta < -0.7 ? 'baisse' : 'stable'
  const marine = await fetchMarine(place.latitude, place.longitude, request.date, request.raceTime || request.startTime)
  const directions = indexes.map((index) => forecast.hourly.wind_direction_10m[index])
  const speeds = indexes.map((index) => forecast.hourly.wind_speed_10m[index])
  const scenario: WeatherScenario = {
    windStart: directions[0] ?? forecast.hourly.wind_direction_10m[raceIndex],
    windEnd: directions[directions.length - 1] ?? forecast.hourly.wind_direction_10m[raceIndex],
    oscillation: estimateOscillation(directions), raceWindSpeed: forecast.hourly.wind_speed_10m[raceIndex],
    maxWindSpeed: Math.max(...speeds, forecast.hourly.wind_speed_10m[raceIndex]), cloudCover: forecast.hourly.cloud_cover[raceIndex],
    waveHeight: marine?.waveHeight ?? 0, waveDirection: marine?.waveDirection ?? undefined,
    currentVelocity: marine?.currentVelocity ?? undefined, currentDirection: marine?.currentDirection ?? undefined,
  }

  return {
    placeName: request.latitude && request.longitude ? `${request.location} · point précis` : [place.name, place.admin1].filter(Boolean).join(' · '),
    latitude: place.latitude, longitude: place.longitude, timezone: forecast.timezone, model: selectedModel, hourly,
    race: {
      speed: forecast.hourly.wind_speed_10m[raceIndex], gust: forecast.hourly.wind_gusts_10m[raceIndex],
      direction: forecast.hourly.wind_direction_10m[raceIndex], temperature: forecast.hourly.temperature_2m[raceIndex],
      humidity: forecast.hourly.relative_humidity_2m[raceIndex], dewPoint: forecast.hourly.dew_point_2m[raceIndex],
      pressure: forecast.hourly.pressure_msl[raceIndex], cloudCover: forecast.hourly.cloud_cover[raceIndex],
    },
    pressureTrend, marine, scenario,
  }
}