export type ElevationPoint = { latitude: number; longitude: number }

type ElevationResponse = { elevation?: number | Array<number | null> }

function normalizeElevations(payload: ElevationResponse, expected: number): Array<number | null> | null {
  const raw = Array.isArray(payload.elevation) ? payload.elevation : typeof payload.elevation === 'number' ? [payload.elevation] : null
  if (!raw || raw.length !== expected) return null
  return raw.map((value) => typeof value === 'number' && Number.isFinite(value) ? value : null)
}

async function requestElevations(points: ElevationPoint[]): Promise<Array<number | null>> {
  const params = new URLSearchParams({
    latitude: points.map((point) => point.latitude.toFixed(5)).join(','),
    longitude: points.map((point) => point.longitude.toFixed(5)).join(','),
  })
  const response = await fetch(`https://api.open-meteo.com/v1/elevation?${params}`)
  if (!response.ok) throw new Error(`Elevation HTTP ${response.status}`)
  const values = normalizeElevations(await response.json() as ElevationResponse, points.length)
  if (!values) throw new Error('Invalid elevation response')
  return values
}

async function resilientBatch(points: ElevationPoint[]): Promise<Array<number | null>> {
  try {
    return await requestElevations(points)
  } catch {
    if (points.length === 1) return [null]
    const middle = Math.ceil(points.length / 2)
    const [left, right] = await Promise.all([
      resilientBatch(points.slice(0, middle)),
      resilientBatch(points.slice(middle)),
    ])
    return [...left, ...right]
  }
}

/**
 * Free elevation lookup with small batches and recursive fallback.
 * One failed batch no longer makes the whole relief analysis disappear.
 */
export async function fetchElevations(points: ElevationPoint[], batchSize = 20): Promise<Array<number | null>> {
  const output: Array<number | null> = []
  for (let index = 0; index < points.length; index += batchSize) {
    output.push(...await resilientBatch(points.slice(index, index + batchSize)))
  }
  return output
}

/** Open-Meteo's sea cells are reported at 0 m. */
export function isLandElevation(value: number | null): boolean {
  return value !== null && value > 0
}
