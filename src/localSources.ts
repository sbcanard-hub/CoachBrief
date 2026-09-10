export type LocalWeatherSource = {
  id: string
  name: string
  kind: 'METAR'
  latitude: number
  longitude: number
}

const metarStations: LocalWeatherSource[] = [
  { id: 'LFMD', name: 'Cannes-Mandelieu', kind: 'METAR', latitude: 43.5470, longitude: 6.9541 },
  { id: 'LFMN', name: 'Nice Côte d’Azur', kind: 'METAR', latitude: 43.6656, longitude: 7.2146 },
  { id: 'LFTH', name: 'Hyères Le Palyvestre', kind: 'METAR', latitude: 43.0972, longitude: 6.1458 },
]

function radians(value: number) {
  return value * Math.PI / 180
}

export function distanceKm(latitudeA: number, longitudeA: number, latitudeB: number, longitudeB: number) {
  const radius = 6371
  const dLat = radians(latitudeB - latitudeA)
  const dLon = radians(longitudeB - longitudeA)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(latitudeA)) * Math.cos(radians(latitudeB)) * Math.sin(dLon / 2) ** 2
  return 2 * radius * Math.asin(Math.sqrt(a))
}

export function nearbyMetarSources(latitude: number, longitude: number, limit = 3) {
  return metarStations
    .map((station) => ({ ...station, distance: distanceKm(latitude, longitude, station.latitude, station.longitude) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit)
}

export function aviationWeatherMetarUrl(icao: string) {
  return `https://aviationweather.gov/api/data/metar?ids=${encodeURIComponent(icao)}&format=json`
}
