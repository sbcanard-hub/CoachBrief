import type { GpxPoint } from './gpx'
import type { BriefingRequest, CourseType } from './types'
import type { LiveWeatherData } from './weather'
import { notifyPersistentDataChanged } from './persistentDataEvents'

export type SavedCourseVariant = {
  id: string
  name: string
  points: GpxPoint[]
  routeOrder: number[]
  updatedAt: string
}

export type CourseSnapshot = {
  storageKey: string
  courseType: CourseType
  bearing: number
  points: GpxPoint[]
  routeOrder: number[]
  variants: SavedCourseVariant[]
  activeVariantId: string
  activeVariantName: string
}

export type RaceReality = {
  recordedAt: string
  windSpeed: string
  windDirection: string
  gust: string
  waveHeight: string
  currentSpeed: string
  currentDirection: string
  pressure?: string
  cloudCover?: string
  airTemperature?: string
  waterTemperature?: string
  notes: string
}

export type DebriefQuality = 'very-relevant' | 'relevant' | 'partly-relevant' | 'not-very-relevant'

/** Post-race account attached to (and versioned with) its original briefing. */
export type RaceDebrief = {
  updatedAt: string
  validatedAt?: string
  actualStartTime: string
  windSpeed: string
  windDirection: string
  gust: string
  windEvolution: string
  observedShifts: string
  currentObserved: string
  favouredLineSide: string
  favouredCourseSide: string
  winningTrajectory: string
  strategyChange: string
  seaConditions: string
  keyEvents: string
  coachNotes: string
  actualRotation: string
  actualOscillations: string
  manualQuality: DebriefQuality | ''
  manualAssessment: string
}

export type SavedMetarSnapshot = {
  capturedAt: string
  station: string
  stationName: string
  distanceKm: number
  reportTime: string | null
  windSpeed: number | null
  windDirection: number | null
  gust: number | null
  raw: string
}

export type SavedBriefing = {
  version: 1
  id: string
  name: string
  savedAt: string
  updatedAt?: string
  request: BriefingRequest
  weather: LiveWeatherData | null
  course: CourseSnapshot | null
  reality?: RaceReality | null
  debrief?: RaceDebrief | null
  metar?: SavedMetarSnapshot | null
}

export type CoachBriefDataBundle = {
  format: 'coachbrief-data'
  version: 1
  exportedAt: string
  briefings: SavedBriefing[]
}

export type CoachBriefImportResult = {
  importedCount: number
  replacedCount: number
  totalCount: number
  mode: 'merge' | 'replace'
}

const STORAGE_KEY = 'coachbrief:saved-briefings:v1'
const CURRENT_COURSE_KEY = 'coachbrief:current-course:v1'
const RESTORE_COURSE_KEY = 'coachbrief:restore-course:v1'

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function isSavedBriefing(value: unknown): value is SavedBriefing {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<SavedBriefing>
  return candidate.version === 1 && typeof candidate.id === 'string' && typeof candidate.name === 'string' && typeof candidate.savedAt === 'string' && Boolean(candidate.request)
}

function isCoachBriefDataBundle(value: unknown): value is CoachBriefDataBundle {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<CoachBriefDataBundle>
  return candidate.format === 'coachbrief-data'
    && candidate.version === 1
    && typeof candidate.exportedAt === 'string'
    && Array.isArray(candidate.briefings)
    && candidate.briefings.every(isSavedBriefing)
}

export function briefingModifiedAt(item: SavedBriefing) {
  const candidates = [item.updatedAt, item.debrief?.updatedAt, item.reality?.recordedAt, item.savedAt]
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter(Number.isFinite)
  return candidates.length ? Math.max(...candidates) : 0
}

/**
 * Réunit plusieurs copies d'une bibliothèque sans modifier les sources.
 * L'identifiant stable évite les doublons et la copie la plus récemment
 * modifiée gagne, qu'elle provienne du navigateur ou de Firestore.
 */
export function mergeSavedBriefings(...collections: SavedBriefing[][]): SavedBriefing[] {
  const merged = new Map<string, SavedBriefing>()
  for (const collection of collections) {
    for (const item of collection) {
      if (!isSavedBriefing(item)) continue
      const normalized = normalizedBriefing(item)
      const current = merged.get(normalized.id)
      if (!current || briefingModifiedAt(normalized) > briefingModifiedAt(current)) {
        merged.set(normalized.id, normalized)
      }
    }
  }
  return Array.from(merged.values()).sort((a, b) => briefingModifiedAt(b) - briefingModifiedAt(a))
}

function normalizedBriefing(item: SavedBriefing): SavedBriefing {
  return {
    ...clone(item),
    updatedAt: item.updatedAt || item.reality?.recordedAt || item.savedAt,
  }
}

export function loadSavedBriefings(): SavedBriefing[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isSavedBriefing).map(normalizedBriefing).sort((a, b) => b.savedAt.localeCompare(a.savedAt))
  } catch {
    return []
  }
}

function persistSavedBriefings(items: SavedBriefing[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.map(normalizedBriefing)))
  notifyPersistentDataChanged()
}

export function writeCurrentCourseSnapshot(snapshot: CourseSnapshot) {
  try {
    window.sessionStorage.setItem(CURRENT_COURSE_KEY, JSON.stringify(snapshot))
  } catch {
    // Le briefing reste utilisable même si le stockage de session est bloqué.
  }
}

export function readCurrentCourseSnapshot(): CourseSnapshot | null {
  try {
    const raw = window.sessionStorage.getItem(CURRENT_COURSE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CourseSnapshot
    return parsed && Array.isArray(parsed.points) && Array.isArray(parsed.routeOrder) ? parsed : null
  } catch {
    return null
  }
}

export function saveBriefing(request: BriefingRequest, weather: LiveWeatherData | null, course: CourseSnapshot | null, name?: string, metar?: SavedMetarSnapshot | null) {
  const now = new Date().toISOString()
  const existing = request.savedBriefingId
    ? loadSavedBriefings().find((candidate) => candidate.id === request.savedBriefingId)
    : null
  if (existing) {
    const updated: SavedBriefing = {
      ...existing,
      name: name?.trim() || existing.name,
      updatedAt: now,
      request: clone(request),
      weather: weather ? clone(weather) : existing.weather,
      course: course ? clone(course) : existing.course,
      metar: metar ? clone(metar) : existing.metar,
    }
    persistSavedBriefings(loadSavedBriefings().map((item) => item.id === existing.id ? updated : item))
    return updated
  }
  const item: SavedBriefing = {
    version: 1,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name?.trim() || `${request.location || 'Régate'} · ${request.date || 'sans date'}`,
    savedAt: now,
    updatedAt: now,
    request: clone(request),
    weather: weather ? clone(weather) : null,
    course: course ? clone(course) : null,
    reality: null,
    metar: metar ? clone(metar) : null,
  }
  const next = [item, ...loadSavedBriefings()]
  persistSavedBriefings(next)
  return item
}

export function saveRaceReality(id: string, reality: Omit<RaceReality, 'recordedAt'>) {
  const items = loadSavedBriefings()
  const now = new Date().toISOString()
  const next = items.map((item) => item.id === id
    ? { ...item, updatedAt: now, reality: { ...clone(reality), recordedAt: now } }
    : item)
  persistSavedBriefings(next)
  return next.find((item) => item.id === id) ?? null
}

export function saveRaceDebrief(id: string, debrief: Omit<RaceDebrief, 'updatedAt' | 'validatedAt'>, validate = false) {
  const items = loadSavedBriefings()
  const now = new Date().toISOString()
  const next = items.map((item): SavedBriefing => {
    if (item.id !== id) return item
    const savedDebrief: RaceDebrief = { ...clone(debrief), updatedAt: now, ...(validate ? { validatedAt: now } : {}) }
    // Historical learning only consumes `reality`; an unvalidated draft therefore cannot affect it.
    const reality: RaceReality | null = validate ? {
      recordedAt: now,
      windSpeed: debrief.windSpeed || item.reality?.windSpeed || '',
      windDirection: debrief.windDirection || item.reality?.windDirection || '',
      gust: debrief.gust || item.reality?.gust || '',
      waveHeight: item.reality?.waveHeight || '',
      currentSpeed: debrief.currentObserved || item.reality?.currentSpeed || '',
      currentDirection: item.reality?.currentDirection || '',
      pressure: item.reality?.pressure || '',
      cloudCover: item.reality?.cloudCover || '',
      airTemperature: item.reality?.airTemperature || '',
      waterTemperature: item.reality?.waterTemperature || '',
      notes: [item.reality?.notes, debrief.windEvolution, debrief.observedShifts, debrief.coachNotes].filter(Boolean).join(' · '),
    } : item.reality ?? null
    return { ...item, updatedAt: now, debrief: savedDebrief, reality }
  })
  persistSavedBriefings(next)
  return next.find((item) => item.id === id) ?? null
}

export function deleteRaceDebrief(id: string) {
  const now = new Date().toISOString()
  const next = loadSavedBriefings().map((item): SavedBriefing => item.id === id
    ? { ...item, updatedAt: now, debrief: null }
    : item)
  persistSavedBriefings(next)
}

export function saveExistingBriefing(item: SavedBriefing) {
  persistSavedBriefings(mergeSavedBriefings(loadSavedBriefings(), [item]))
}

export function updateSavedBriefingRequest(request: BriefingRequest) {
  if (!request.savedBriefingId) return null
  const now = new Date().toISOString()
  let updated: SavedBriefing | null = null
  const next = loadSavedBriefings().map((item) => {
    if (item.id !== request.savedBriefingId) return item
    updated = { ...item, updatedAt: now, request: clone(request) }
    return updated
  })
  if (updated) persistSavedBriefings(next)
  return updated
}

export function deleteSavedBriefing(id: string) {
  persistSavedBriefings(loadSavedBriefings().filter((item) => item.id !== id))
}

export function importSavedBriefing(text: string) {
  const parsed = JSON.parse(text) as unknown
  if (!isSavedBriefing(parsed)) throw new Error('Fichier CoachBrief invalide')
  const now = new Date().toISOString()
  const imported: SavedBriefing = {
    ...clone(parsed),
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    savedAt: now,
    updatedAt: now,
    name: `${parsed.name} · import`,
  }
  persistSavedBriefings([imported, ...loadSavedBriefings()])
  return imported
}

export function exportCoachBriefData(): CoachBriefDataBundle {
  return {
    format: 'coachbrief-data',
    version: 1,
    exportedAt: new Date().toISOString(),
    briefings: loadSavedBriefings().map(normalizedBriefing),
  }
}

export function coachBriefDataToJson() {
  return JSON.stringify(exportCoachBriefData(), null, 2)
}

export function importCoachBriefData(text: string, mode: 'merge' | 'replace' = 'merge'): CoachBriefImportResult {
  const parsed = JSON.parse(text) as unknown
  if (!isCoachBriefDataBundle(parsed)) throw new Error('Sauvegarde globale CoachBrief invalide')

  const incoming = parsed.briefings.map(normalizedBriefing)
  if (mode === 'replace') {
    persistSavedBriefings([...incoming].sort((a, b) => b.savedAt.localeCompare(a.savedAt)))
    return { importedCount: incoming.length, replacedCount: 0, totalCount: incoming.length, mode }
  }

  const current = loadSavedBriefings()
  const merged = new Map(current.map((item) => [item.id, item]))
  let importedCount = 0
  let replacedCount = 0

  for (const incomingItem of incoming) {
    const existing = merged.get(incomingItem.id)
    if (!existing) {
      merged.set(incomingItem.id, incomingItem)
      importedCount += 1
      continue
    }
    if (briefingModifiedAt(incomingItem) > briefingModifiedAt(existing)) {
      merged.set(incomingItem.id, incomingItem)
      replacedCount += 1
    }
  }

  const next = Array.from(merged.values()).sort((a, b) => b.savedAt.localeCompare(a.savedAt))
  persistSavedBriefings(next)
  return { importedCount, replacedCount, totalCount: next.length, mode }
}

export function briefingToJson(item: SavedBriefing) {
  return JSON.stringify(item, null, 2)
}

export function prepareBriefingRestore(item: SavedBriefing) {
  if (!item.course) return
  try {
    window.sessionStorage.setItem(RESTORE_COURSE_KEY, JSON.stringify(item.course))
    window.localStorage.setItem(item.course.storageKey, JSON.stringify(item.course.variants))
  } catch {
    // Le formulaire pourra quand même être rouvert sans le tracé mémorisé.
  }
}

export function requestForSavedBriefing(item: SavedBriefing): BriefingRequest {
  return { ...clone(item.request), savedBriefingId: item.id }
}

export function consumeCourseRestore(storageKey: string): CourseSnapshot | null {
  try {
    const raw = window.sessionStorage.getItem(RESTORE_COURSE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CourseSnapshot
    if (!parsed || parsed.storageKey !== storageKey || !Array.isArray(parsed.points) || !Array.isArray(parsed.routeOrder)) return null
    window.sessionStorage.removeItem(RESTORE_COURSE_KEY)
    return parsed
  } catch {
    return null
  }
}
