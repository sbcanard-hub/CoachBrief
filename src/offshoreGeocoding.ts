export type OffshorePlaceResult = {
  id: string
  name: string
  country: string | null
  admin1: string | null
  latitude: number
  longitude: number
  kind?: 'city' | 'port' | 'waypoint'
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

type NominatimResult = {
  place_id?: number
  lat?: string
  lon?: string
  display_name?: string
  name?: string
  type?: string
  class?: string
  addresstype?: string
  address?: {
    city?: string
    town?: string
    village?: string
    municipality?: string
    state?: string
    region?: string
    country?: string
  }
}

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
      kind: 'city',
    }))
}

function harbourLike(item: NominatimResult) {
  const values = [item.type, item.class, item.addresstype].map((value) => (value ?? '').toLowerCase())
  return values.some((value) => ['marina', 'harbour', 'harbor', 'port', 'dock', 'pier'].includes(value))
}

function mapNominatim(item: NominatimResult, index: number, kind: 'port' | 'waypoint'): OffshorePlaceResult | null {
  const latitude = Number(item.lat)
  const longitude = Number(item.lon)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  const address = item.address ?? {}
  const fallbackName = item.display_name?.split(',')[0]?.trim() || `${kind === 'port' ? 'Port' : 'Waypoint'} ${index + 1}`
  return {
    id: `osm-${kind}-${item.place_id ?? index}`,
    name: item.name?.trim() || fallbackName,
    country: address.country ?? null,
    admin1: address.city ?? address.town ?? address.village ?? address.municipality ?? address.state ?? address.region ?? null,
    latitude,
    longitude,
    kind,
  }
}

async function searchNominatim(query: string, limit = 10) {
  const name = query.trim()
  if (name.length < 2) return [] as NominatimResult[]
  const params = new URLSearchParams({
    q: name,
    format: 'jsonv2',
    limit: String(limit),
    addressdetails: '1',
    namedetails: '1',
    'accept-language': 'fr',
  })
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) throw new Error('Recherche OpenStreetMap indisponible')
  return await response.json() as NominatimResult[]
}

export async function searchOffshorePorts(query: string): Promise<OffshorePlaceResult[]> {
  const payload = await searchNominatim(query, 10)
  return payload
    .filter((item) => harbourLike(item))
    .slice(0, 6)
    .map((item, index) => mapNominatim(item, index, 'port'))
    .filter((item): item is OffshorePlaceResult => Boolean(item))
}

export async function searchOffshoreWaypoints(query: string): Promise<OffshorePlaceResult[]> {
  const payload = await searchNominatim(query, 8)
  return payload
    .map((item, index) => mapNominatim(item, index, 'waypoint'))
    .filter((item): item is OffshorePlaceResult => Boolean(item))
    .slice(0, 6)
}

export function offshorePlaceLabel(place: OffshorePlaceResult) {
  return [place.name, place.admin1, place.country].filter(Boolean).join(' · ')
}
