import type { BoatClass } from './types'

export type TrainingLocationMode = 'punctual' | 'continuous' | 'smart'
export type TrainingEventCategory = 'weather' | 'tactics' | 'manoeuvre' | 'speed' | 'incident'
export type TrainingEventImportance = 1 | 2 | 3

export type TrainingGpsPoint = {
  latitude: number
  longitude: number
  recordedAt: string
  accuracy?: number
  elevation?: number
}

export type TrainingReading = {
  id: string
  recordedAt: string
  latitude?: number
  longitude?: number
  windSpeed: string
  windDirection: string
  notes: string
}

export type TrainingBoatTrack = {
  id: string
  boatName: string
  fileName: string
  points: TrainingGpsPoint[]
}

export type TrainingEvent = {
  id: string
  recordedAt: string
  latitude?: number
  longitude?: number
  boatTrackId: 'group' | string
  category: TrainingEventCategory
  importance: TrainingEventImportance
  annotation: string
}

export type TrainingSession = {
  id: string
  name: string
  location: string
  date: string
  boatClass: BoatClass
  locationMode: TrainingLocationMode
  startedAt: string
  endedAt?: string
  sessionNotes: string
  coachTrack: TrainingGpsPoint[]
  readings: TrainingReading[]
  boatTracks: TrainingBoatTrack[]
  events: TrainingEvent[]
}

const STORAGE_KEY = 'coachbrief-training-sessions-v1'

export function loadTrainingSessions(): TrainingSession[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.map((session) => ({ ...session, sessionNotes: session.sessionNotes || '', events: Array.isArray(session.events) ? session.events : [] })) : []
  } catch {
    return []
  }
}

export function saveTrainingSession(session: TrainingSession) {
  const sessions = loadTrainingSessions()
  const index = sessions.findIndex((item) => item.id === session.id)
  if (index >= 0) sessions[index] = session
  else sessions.unshift(session)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
}

export function deleteTrainingSession(id: string) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(loadTrainingSessions().filter((session) => session.id !== id)))
}

export function importTrainingSessions(incoming: TrainingSession[], mode: 'merge' | 'replace' = 'merge') {
  const safeIncoming = incoming.filter((session) => session && typeof session.id === 'string' && Array.isArray(session.coachTrack) && Array.isArray(session.readings) && Array.isArray(session.boatTracks))
    .map((session) => ({ ...session, sessionNotes: session.sessionNotes || '', events: Array.isArray(session.events) ? session.events : [] }))
  if (mode === 'replace') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safeIncoming))
    return
  }
  const merged = new Map(loadTrainingSessions().map((session) => [session.id, session]))
  safeIncoming.forEach((session) => {
    const current = merged.get(session.id)
    const currentDate = Date.parse(current?.endedAt || current?.startedAt || '')
    const incomingDate = Date.parse(session.endedAt || session.startedAt || '')
    if (!current || !Number.isFinite(currentDate) || incomingDate >= currentDate) merged.set(session.id, session)
  })
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...merged.values()].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))))
}

function distanceMetres(a: TrainingGpsPoint, b: TrainingGpsPoint) {
  const radius = 6_371_000
  const lat1 = a.latitude * Math.PI / 180
  const lat2 = b.latitude * Math.PI / 180
  const dLat = (b.latitude - a.latitude) * Math.PI / 180
  const dLon = (b.longitude - a.longitude) * Math.PI / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * radius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

export function trackDistanceMetres(points: TrainingGpsPoint[]) {
  return points.slice(1).reduce((total, point, index) => total + distanceMetres(points[index], point), 0)
}

export function trackAverageSpeedKnots(points: TrainingGpsPoint[]) {
  if (points.length < 2) return 0
  const durationSeconds = (Date.parse(points.at(-1)!.recordedAt) - Date.parse(points[0].recordedAt)) / 1000
  return durationSeconds > 0 ? trackDistanceMetres(points) / durationSeconds * 1.943844 : 0
}

function parsePoint(element: Element): TrainingGpsPoint | null {
  const latitude = Number(element.getAttribute('lat'))
  const longitude = Number(element.getAttribute('lon'))
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  const recordedAt = element.querySelector('time')?.textContent?.trim() || ''
  const elevation = Number(element.querySelector('ele')?.textContent)
  return {
    latitude,
    longitude,
    recordedAt: recordedAt && Number.isFinite(Date.parse(recordedAt)) ? new Date(recordedAt).toISOString() : '',
    ...(Number.isFinite(elevation) ? { elevation } : {}),
  }
}

export function parseTrainingGpx(text: string): { name: string; points: TrainingGpsPoint[] } {
  const documentXml = new DOMParser().parseFromString(text, 'application/xml')
  if (documentXml.querySelector('parsererror')) throw new Error('invalid-gpx')
  const elements = Array.from(documentXml.querySelectorAll('trkpt, rtept'))
  const fallbackStart = Date.now()
  const points = elements.map(parsePoint).filter((point): point is TrainingGpsPoint => point != null)
    .map((point, index) => ({ ...point, recordedAt: point.recordedAt || new Date(fallbackStart + index * 1000).toISOString() }))
  if (points.length < 2) throw new Error('not-enough-points')
  const name = documentXml.querySelector('trk > name, rte > name, metadata > name')?.textContent?.trim() || 'GPS'
  return { name, points }
}
