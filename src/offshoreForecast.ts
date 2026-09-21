import type { OffshoreLeg } from './offshore'

export type OffshoreWeatherModel = 'best_match' | 'ecmwf' | 'gfs' | 'icon' | 'meteofrance'

export const OFFSHORE_WEATHER_MODELS: Array<{ value: OffshoreWeatherModel; label: string; detail: string }> = [
  { value: 'best_match', label: 'Best Match', detail: 'Sélection automatique Open-Meteo selon la zone' },
  { value: 'ecmwf', label: 'ECMWF IFS', detail: 'Modèle global ECMWF' },
  { value: 'gfs', label: 'GFS NOAA', detail: 'Modèle global américain' },
  { value: 'icon', label: 'ICON DWD', detail: 'ICON global + Europe selon la zone' },
  { value: 'meteofrance', label: 'AROME / ARPEGE', detail: 'Météo-France : haute résolution en France, ARPEGE au large' },
]

const WEATHER_MODEL_STORAGE_KEY = 'coachbrief:offshore-weather-model:v1'

export function offshoreWeatherModelLabel(model: OffshoreWeatherModel) {
  return OFFSHORE_WEATHER_MODELS.find((item) => item.value === model)?.label ?? 'Best Match'
}

export function getOffshoreWeatherModel(): OffshoreWeatherModel {
  try {
    const value = window.localStorage.getItem(WEATHER_MODEL_STORAGE_KEY)
    if (OFFSHORE_WEATHER_MODELS.some((item) => item.value === value)) return value as OffshoreWeatherModel
  } catch { /* stockage indisponible */ }
  return 'best_match'
}

export function setOffshoreWeatherModel(model: OffshoreWeatherModel) {
  try { window.localStorage.setItem(WEATHER_MODEL_STORAGE_KEY, model) } catch { /* stockage indisponible */ }
}

export type OffshorePointForecast = {
  windSpeed: number | null
  windGust: number | null
  windDirection: number | null
  waveHeight: number | null
  waveDirection: number | null
  wavePeriod: number | null
  currentSpeed: number | null
  currentDirection: number | null
}

export type OffshoreLegForecast = OffshorePointForecast & {
  legIndex: number
  eta: string
  latitude: number
  longitude: number
  source: string
}

type AtmospherePayload = {
  hourly?: {
    time?: string[]
    wind_speed_10m?: Array<number | null>
    wind_direction_10m?: Array<number | null>
    wind_gusts_10m?: Array<number | null>
  }
}

type MarinePayload = {
  hourly?: {
    time?: string[]
    wave_height?: Array<number | null>
    wave_direction?: Array<number | null>
    wave_period?: Array<number | null>
    ocean_current_velocity?: Array<number | null>
    ocean_current_direction?: Array<number | null>
  }
}

const REQUEST_TIMEOUT_MS = 8_000
const GRID_PRECISION_DEG = 0.1
const atmosphereCache = new Map<string, Promise<AtmospherePayload | null>>()
const marineCache = new Map<string, Promise<MarinePayload | null>>()

function safeNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function isoDate(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

function nearestIndex(times: string[], target: Date) {
  const targetMs = target.getTime()
  let best = 0
  let gap = Number.POSITIVE_INFINITY
  times.forEach((time, index) => {
    const parsed = new Date(time).getTime()
    if (!Number.isFinite(parsed)) return
    const delta = Math.abs(parsed - targetMs)
    if (delta < gap) { gap = delta; best = index }
  })
  return best
}

function midpoint(leg: OffshoreLeg) {
  return {
    latitude: (Number(leg.from.latitude) + Number(leg.to.latitude)) / 2,
    longitude: (Number(leg.from.longitude) + Number(leg.to.longitude)) / 2,
  }
}

function gridCoordinate(value: number) {
  return Math.round(value / GRID_PRECISION_DEG) * GRID_PRECISION_DEG
}

function forecastGridPoint(latitude: number, longitude: number) {
  return {
    latitude: Number(gridCoordinate(latitude).toFixed(1)),
    longitude: Number(gridCoordinate(longitude).toFixed(1)),
  }
}

function atmosphereEndpoint(model: OffshoreWeatherModel) {
  if (model === 'ecmwf') return 'https://api.open-meteo.com/v1/ecmwf'
  if (model === 'gfs') return 'https://api.open-meteo.com/v1/gfs'
  if (model === 'icon') return 'https://api.open-meteo.com/v1/dwd-icon'
  if (model === 'meteofrance') return 'https://api.open-meteo.com/v1/meteofrance'
  return 'https://api.open-meteo.com/v1/forecast'
}

async function fetchJsonWithTimeout<T>(url: string): Promise<T | null> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) return null
    return await response.json() as T
  } catch {
    return null
  } finally {
    window.clearTimeout(timeout)
  }
}

async function atmospherePayload(latitude: number, longitude: number, target: Date, model: OffshoreWeatherModel) {
  const date = isoDate(target)
  const point = forecastGridPoint(latitude, longitude)
  const key = `${model}:${point.latitude}:${point.longitude}:${date}`
  let pending = atmosphereCache.get(key)
  if (!pending) {
    const params = new URLSearchParams({
      latitude: String(point.latitude), longitude: String(point.longitude),
      hourly: 'wind_speed_10m,wind_direction_10m,wind_gusts_10m',
      start_date: date, end_date: date, timezone: 'auto', wind_speed_unit: 'kn', cell_selection: 'sea',
    })
    pending = fetchJsonWithTimeout<AtmospherePayload>(`${atmosphereEndpoint(model)}?${params}`).then((payload) => {
      // A failed request must not poison all later routing attempts in this tab.
      if (!payload) atmosphereCache.delete(key)
      return payload
    })
    atmosphereCache.set(key, pending)
  }
  return pending
}

async function marinePayload(latitude: number, longitude: number, target: Date) {
  const date = isoDate(target)
  const point = forecastGridPoint(latitude, longitude)
  const key = `${point.latitude}:${point.longitude}:${date}`
  let pending = marineCache.get(key)
  if (!pending) {
    const params = new URLSearchParams({
      latitude: String(point.latitude), longitude: String(point.longitude),
      hourly: 'wave_height,wave_direction,wave_period,ocean_current_velocity,ocean_current_direction',
      start_date: date, end_date: date, timezone: 'auto', wind_speed_unit: 'kn', cell_selection: 'sea',
    })
    pending = fetchJsonWithTimeout<MarinePayload>(`https://marine-api.open-meteo.com/v1/marine?${params}`).then((payload) => {
      if (!payload) marineCache.delete(key)
      return payload
    })
    marineCache.set(key, pending)
  }
  return pending
}

async function fetchAtmosphere(latitude: number, longitude: number, target: Date, model: OffshoreWeatherModel) {
  const payload = await atmospherePayload(latitude, longitude, target, model)
  const times = payload?.hourly?.time ?? []
  if (!times.length) return null
  const index = nearestIndex(times, target)
  return {
    windSpeed: safeNumber(payload?.hourly?.wind_speed_10m?.[index]),
    windDirection: safeNumber(payload?.hourly?.wind_direction_10m?.[index]),
    windGust: safeNumber(payload?.hourly?.wind_gusts_10m?.[index]),
  }
}

async function fetchMarine(latitude: number, longitude: number, target: Date) {
  const payload = await marinePayload(latitude, longitude, target)
  const times = payload?.hourly?.time ?? []
  if (!times.length) return null
  const index = nearestIndex(times, target)
  return {
    waveHeight: safeNumber(payload?.hourly?.wave_height?.[index]),
    waveDirection: safeNumber(payload?.hourly?.wave_direction?.[index]),
    wavePeriod: safeNumber(payload?.hourly?.wave_period?.[index]),
    currentSpeed: safeNumber(payload?.hourly?.ocean_current_velocity?.[index]),
    currentDirection: safeNumber(payload?.hourly?.ocean_current_direction?.[index]),
  }
}

export async function fetchOffshorePointForecast(latitude: number, longitude: number, target: Date, model: OffshoreWeatherModel = getOffshoreWeatherModel()): Promise<OffshorePointForecast> {
  const [air, marine] = await Promise.all([fetchAtmosphere(latitude, longitude, target, model), fetchMarine(latitude, longitude, target)])
  return {
    windSpeed: air?.windSpeed ?? null,
    windGust: air?.windGust ?? null,
    windDirection: air?.windDirection ?? null,
    waveHeight: marine?.waveHeight ?? null,
    waveDirection: marine?.waveDirection ?? null,
    wavePeriod: marine?.wavePeriod ?? null,
    currentSpeed: marine?.currentSpeed ?? null,
    currentDirection: marine?.currentDirection ?? null,
  }
}

export function offshoreLegEtas(legs: OffshoreLeg[], departure: Date, averageSpeed: number) {
  if (!Number.isFinite(averageSpeed) || averageSpeed <= 0) return []
  let cumulativeNm = 0
  return legs.map((leg) => {
    const midpointNm = cumulativeNm + leg.distanceNm / 2
    const target = new Date(departure.getTime() + midpointNm / averageSpeed * 3600_000)
    cumulativeNm += leg.distanceNm
    return { leg, target }
  })
}

export async function fetchOffshoreLegForecasts(legs: OffshoreLeg[], departure: Date, averageSpeed: number, model: OffshoreWeatherModel = getOffshoreWeatherModel()): Promise<OffshoreLegForecast[]> {
  const schedule = offshoreLegEtas(legs, departure, averageSpeed)
  return Promise.all(schedule.map(async ({ leg, target }) => {
    const point = midpoint(leg)
    const env = await fetchOffshorePointForecast(point.latitude, point.longitude, target, model)
    return { legIndex: leg.index, eta: target.toISOString(), latitude: point.latitude, longitude: point.longitude, ...env, source: `${offshoreWeatherModelLabel(model)} via Open-Meteo + Marine` }
  }))
}
