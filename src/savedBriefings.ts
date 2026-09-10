import type { GpxPoint } from './gpx'
import type { BriefingRequest, CourseType } from './types'
import type { LiveWeatherData } from './weather'

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

export type SavedBriefing = {
  version: 1
  id: string
  name: string
  savedAt: string
  request: BriefingRequest
  weather: LiveWeatherData | null
  course: CourseSnapshot | null
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

export function loadSavedBriefings(): SavedBriefing[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isSavedBriefing).sort((a, b) => b.savedAt.localeCompare(a.savedAt))
  } catch {
    return []
  }
}

function persistSavedBriefings(items: SavedBriefing[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
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

export function saveBriefing(request: BriefingRequest, weather: LiveWeatherData | null, course: CourseSnapshot | null, name?: string) {
  const item: SavedBriefing = {
    version: 1,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name?.trim() || `${request.location || 'Régate'} · ${request.date || 'sans date'}`,
    savedAt: new Date().toISOString(),
    request: clone(request),
    weather: weather ? clone(weather) : null,
    course: course ? clone(course) : null,
  }
  const next = [item, ...loadSavedBriefings()]
  persistSavedBriefings(next)
  return item
}

export function deleteSavedBriefing(id: string) {
  persistSavedBriefings(loadSavedBriefings().filter((item) => item.id !== id))
}

export function importSavedBriefing(text: string) {
  const parsed = JSON.parse(text) as unknown
  if (!isSavedBriefing(parsed)) throw new Error('Fichier CoachBrief invalide')
  const imported: SavedBriefing = {
    ...clone(parsed),
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    savedAt: new Date().toISOString(),
    name: `${parsed.name} · import`,
  }
  persistSavedBriefings([imported, ...loadSavedBriefings()])
  return imported
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
