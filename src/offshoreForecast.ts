import type { OffshoreLeg } from './offshore'

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

async function fetchAtmosphere(latitude: number, longitude: number, target: Date) {
  const date = isoDate(target)
  const params = new URLSearchParams({
    latitude: String(latitude), longitude: String(longitude),
    hourly: 'wind_speed_10m,wind_direction_10m,wind_gusts_10m',
    start_date: date, end_date: date, timezone: 'auto', wind_speed_unit: 'kn',
  })
  try {
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`)
    if (!response.ok) return null
    const payload = await response.json() as { hourly?: { time?: string[]; wind_speed_10m?: Array<number | null>; wind_direction_10m?: Array<number | null>; wind_gusts_10m?: Array<number | null> } }
    const times = payload.hourly?.time ?? []
    if (!times.length) return null
    const index = nearestIndex(times, target)
    return {
      windSpeed: safeNumber(payload.hourly?.wind_speed_10m?.[index]),
      windDirection: safeNumber(payload.hourly?.wind_direction_10m?.[index]),
      windGust: safeNumber(payload.hourly?.wind_gusts_10m?.[index]),
    }
  } catch { return null }
}

async function fetchMarine(latitude: number, longitude: number, target: Date) {
  const date = isoDate(target)
  const params = new URLSearchParams({
    latitude: String(latitude), longitude: String(longitude),
    hourly: 'wave_height,wave_direction,wave_period,ocean_current_velocity,ocean_current_direction',
    start_date: date, end_date: date, timezone: 'auto', wind_speed_unit: 'kn', cell_selection: 'sea',
  })
  try {
    const response = await fetch(`https://marine-api.open-meteo.com/v1/marine?${params}`)
    if (!response.ok) return null
    const payload = await response.json() as { hourly?: { time?: string[]; wave_height?: Array<number | null>; wave_direction?: Array<number | null>; wave_period?: Array<number | null>; ocean_current_velocity?: Array<number | null>; ocean_current_direction?: Array<number | null> } }
    const times = payload.hourly?.time ?? []
    if (!times.length) return null
    const index = nearestIndex(times, target)
    return {
      waveHeight: safeNumber(payload.hourly?.wave_height?.[index]),
      waveDirection: safeNumber(payload.hourly?.wave_direction?.[index]),
      wavePeriod: safeNumber(payload.hourly?.wave_period?.[index]),
      currentSpeed: safeNumber(payload.hourly?.ocean_current_velocity?.[index]),
      currentDirection: safeNumber(payload.hourly?.ocean_current_direction?.[index]),
    }
  } catch { return null }
}

export async function fetchOffshorePointForecast(latitude: number, longitude: number, target: Date): Promise<OffshorePointForecast> {
  const [air, marine] = await Promise.all([fetchAtmosphere(latitude, longitude, target), fetchMarine(latitude, longitude, target)])
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

export async function fetchOffshoreLegForecasts(legs: OffshoreLeg[], departure: Date, averageSpeed: number): Promise<OffshoreLegForecast[]> {
  const schedule = offshoreLegEtas(legs, departure, averageSpeed)
  return Promise.all(schedule.map(async ({ leg, target }) => {
    const point = midpoint(leg)
    const env = await fetchOffshorePointForecast(point.latitude, point.longitude, target)
    return { legIndex: leg.index, eta: target.toISOString(), latitude: point.latitude, longitude: point.longitude, ...env, source: 'Open-Meteo Forecast + Marine' }
  }))
}
