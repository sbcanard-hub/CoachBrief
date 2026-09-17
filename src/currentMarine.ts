import type { CurrentHour } from './currentAnalysis'

function safeNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export async function fetchCurrentSeries(latitude: number, longitude: number, date: string): Promise<CurrentHour[]> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !date) return []
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    hourly: 'ocean_current_velocity,ocean_current_direction',
    start_date: date,
    end_date: date,
    timezone: 'auto',
    wind_speed_unit: 'kn',
    cell_selection: 'sea',
  })
  try {
    const response = await fetch(`https://marine-api.open-meteo.com/v1/marine?${params}`)
    if (!response.ok) return []
    const payload = await response.json() as {
      hourly?: {
        time?: string[]
        ocean_current_velocity?: Array<number | null>
        ocean_current_direction?: Array<number | null>
      }
    }
    const times = payload.hourly?.time ?? []
    const speeds = payload.hourly?.ocean_current_velocity ?? []
    const directions = payload.hourly?.ocean_current_direction ?? []
    return times.map((time, index) => ({
      time,
      speed: safeNumber(speeds[index]),
      direction: safeNumber(directions[index]),
    }))
  } catch {
    return []
  }
}
