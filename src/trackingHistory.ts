import type { BoatClass } from './types'

export type TrackingProvider = 'MetaSail' | 'TracTrac'
export type TrackPoint = { latitude: number; longitude: number }
export type HistoricalRace = {
  id: string
  provider: TrackingProvider
  eventId: string
  raceId?: string
  title: string
  url: string
  location: string
  latitude: number
  longitude: number
  boatClass: BoatClass
  windDirection?: number
  windSpeed?: number
  addedAt: string
  tracks?: TrackPoint[][]
}

const KEY = 'coachbrief:historical-races:v1'

export function parseTrackingUrl(raw: string): Pick<HistoricalRace, 'provider' | 'eventId' | 'raceId' | 'title' | 'url'> {
  const url = new URL(raw.trim())
  if (url.hostname.includes('metasail')) {
    const eventId = url.searchParams.get('idgara')
    const token = url.searchParams.get('token')
    if (!eventId) throw new Error('Identifiant de régate MetaSail absent')
    const stableUrl = `${url.protocol}//${url.host}/ViewRecordedRace2022Mobile.aspx?idgara=${encodeURIComponent(eventId)}${token ? `&token=${encodeURIComponent(token)}` : ''}`
    return { provider: 'MetaSail', eventId, title: `MetaSail · régate ${eventId}`, url: stableUrl }
  }
  if (url.hostname.includes('tractrac')) {
    const scheme = url.searchParams.get('url_scheme') || ''
    const match = scheme.match(/open\.app\/(\d+)\/([\w-]+)/)
    if (!match) throw new Error('Identifiant de manche TracTrac absent')
    const title = url.searchParams.get('race_name') || `TracTrac · manche ${match[2]}`
    return { provider: 'TracTrac', eventId: match[1], raceId: match[2], title, url: raw.trim() }
  }
  throw new Error('Lien non reconnu : utilisez MetaSail ou TracTrac')
}

export function loadHistoricalRaces(): HistoricalRace[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '[]') as HistoricalRace[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveHistoricalRaces(races: HistoricalRace[]) {
  localStorage.setItem(KEY, JSON.stringify(races))
}

function point(element: Element): TrackPoint | null {
  const latitude = Number(element.getAttribute('lat'))
  const longitude = Number(element.getAttribute('lon'))
  return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null
}

function downsample(points: TrackPoint[], maximum = 500) {
  if (points.length <= maximum) return points
  const step = (points.length - 1) / (maximum - 1)
  return Array.from({ length: maximum }, (_, index) => points[Math.round(index * step)])
}

export function parseTrackGpx(text: string): TrackPoint[][] {
  const xml = new DOMParser().parseFromString(text, 'application/xml')
  if (xml.querySelector('parsererror')) throw new Error('Fichier GPX invalide')
  let tracks = Array.from(xml.querySelectorAll('trkseg')).map((segment) =>
    Array.from(segment.querySelectorAll('trkpt')).map(point).filter((item): item is TrackPoint => item !== null))
  if (!tracks.length) {
    const route = Array.from(xml.querySelectorAll('rtept')).map(point).filter((item): item is TrackPoint => item !== null)
    if (route.length) tracks = [route]
  }
  tracks = tracks.filter((track) => track.length >= 8).map((track) => downsample(track))
  if (!tracks.length) throw new Error('Aucune trace navigable trouvée dans ce GPX')
  return tracks
}

function radians(value: number) { return value * Math.PI / 180 }
function signedAngle(a: number, b: number) { return ((a - b + 540) % 360) - 180 }

export function weatherCompatibility(race: HistoricalRace, direction: number, speed: number) {
  if (!Number.isFinite(race.windDirection) || !Number.isFinite(race.windSpeed)) return 'unknown'
  return Math.abs(signedAngle(race.windDirection!, direction)) <= 20 && Math.abs(race.windSpeed! - speed) <= 4 ? 'match' : 'different'
}

export type Lane = 'left' | 'centre-left' | 'centre' | 'centre-right' | 'right'

export function analyzeFirstBeat(tracks: TrackPoint[][], axis: number): { lanes: Lane[]; trackCount: number } | null {
  const valid = tracks.filter((track) => track.length >= 8)
  if (!valid.length) return null
  const samples: number[][] = [[], [], []]
  for (const track of valid) {
    const origin = track[0]
    const latScale = 111320
    const lonScale = Math.cos(radians(origin.latitude)) * 111320
    const heading = radians(axis)
    const projected = track.map((item) => {
      const east = (item.longitude - origin.longitude) * lonScale
      const north = (item.latitude - origin.latitude) * latScale
      return { along: north * Math.cos(heading) + east * Math.sin(heading), cross: -north * Math.sin(heading) + east * Math.cos(heading) }
    })
    const maxAlong = Math.max(...projected.map((item) => item.along))
    if (maxAlong < 80) continue
    const topIndex = projected.findIndex((item) => item.along >= maxAlong * .95)
    const beat = projected.slice(0, topIndex > 4 ? topIndex + 1 : projected.length)
    for (let third = 0; third < 3; third += 1) {
      const selected = beat.filter((item) => item.along >= maxAlong * third / 3 && item.along < maxAlong * (third + 1) / 3)
      if (selected.length) samples[third].push(selected.reduce((sum, item) => sum + item.cross, 0) / selected.length)
    }
  }
  const all = samples.flat()
  if (!all.length) return null
  const scale = Math.max(30, ...all.map(Math.abs))
  const lane = (value: number): Lane => {
    const normalized = value / scale
    return normalized < -.55 ? 'left' : normalized < -.18 ? 'centre-left' : normalized <= .18 ? 'centre' : normalized <= .55 ? 'centre-right' : 'right'
  }
  return {
    lanes: samples.map((values) => lane(values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0)),
    trackCount: valid.length,
  }
}
