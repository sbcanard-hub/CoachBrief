export type OffshorePlaceResult = {
  id: string
  name: string
  country: string | null
  admin1: string | null
  latitude: number
  longitude: number
}

type OpenMeteoGeocodingResult = {
  id?: number
  name?: string
  latitude?: number
  longitude?: number
  country?: string
  admin1?: string
}

type OpenMeteoGeocodingResponse = { results?: OpenMeteoGeocodingResult[] }

export async function searchOffshorePlaces(query: string): Promise<OffshorePlaceResult[]> {
  const name = query.trim()
  if (name.length < 2) return []
  const params = new URLSearchParams({ name, count: '6', language: 'fr', format: 'json' })
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`)
  if (!response.ok) throw new Error('Recherche de ville indisponible')
  const payload = await response.json() as OpenMeteoGeocodingResponse
  return (payload.results ?? [])
    .filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude) && Boolean(item.name))
    .map((item, index) => ({
      id: String(item.id ?? `${item.name}-${index}`),
      name: item.name as string,
      country: item.country ?? null,
      admin1: item.admin1 ?? null,
      latitude: item.latitude as number,
      longitude: item.longitude as number,
    }))
}

export function offshorePlaceLabel(place: OffshorePlaceResult) {
  return [place.name, place.admin1, place.country].filter(Boolean).join(' · ')
}
