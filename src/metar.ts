export type MetarObservation = {
  station: string
  raw: string
  reportTime: string | null
  windDirection: number | null
  variableWind: boolean
  windSpeed: number | null
  gust: number | null
  temperature: number | null
  dewPoint: number | null
  pressure: number | null
}

export type MetarCache = {
  generatedAt: string | null
  source: string
  stations: string[]
  observations: MetarObservation[]
  error?: string | null
}

export async function fetchMetarCache(): Promise<MetarCache> {
  const base = import.meta.env.BASE_URL || '/'
  const response = await fetch(`${base}metar-latest.json?v=${Date.now()}`, { cache: 'no-store' })
  if (!response.ok) throw new Error('Cache METAR indisponible')
  return response.json() as Promise<MetarCache>
}

export function observationForStation(cache: MetarCache | null, station: string) {
  return cache?.observations.find((observation) => observation.station === station)
}

export function formatMetarGeneratedAt(value: string | null) {
  if (!value) return 'pas encore actualisé'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(date)
}

export function signedDirectionDelta(from: number, to: number) {
  return ((to - from + 540) % 360) - 180
}
