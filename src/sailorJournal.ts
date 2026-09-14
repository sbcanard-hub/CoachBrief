import { notifyPersistentDataChanged } from './persistentDataEvents'
import type { BoatClass } from './types'

export type SailorNavigationKind = 'training' | 'regatta'
export type SailorRating = 1 | 2 | 3 | 4 | 5

export type SailorProfile = {
  id: string
  firstName: string
  lastName: string
  boatClass: BoatClass
  ageCategory: string
  club: string
  createdAt: string
  updatedAt: string
}

export type SailorRatings = {
  start: SailorRating
  speed: SailorRating
  tactics: SailorRating
  strategy: SailorRating
  manoeuvres: SailorRating
}

export type SailorNavigationEntry = {
  id: string
  sailorId: string
  kind: SailorNavigationKind
  date: string
  title: string
  location: string
  boatClass: BoatClass
  conditions: string
  objectives: string
  waterAnalysis: string
  successes: string
  improvements: string
  sailorNotes: string
  coachNotes: string
  nextObjectives: string
  ratings: SailorRatings
  linkedTrainingSessionId?: string
  linkedBoatTrackId?: string
  createdAt: string
  updatedAt: string
}

export type SailorJournalData = {
  profiles: SailorProfile[]
  entries: SailorNavigationEntry[]
}

const STORAGE_KEY = 'coachbrief:sailor-journal:v1'
const emptyJournal = (): SailorJournalData => ({ profiles: [], entries: [] })
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T

function isProfile(value: unknown): value is SailorProfile {
  if (!value || typeof value !== 'object') return false
  const profile = value as Partial<SailorProfile>
  return typeof profile.id === 'string' && typeof profile.firstName === 'string' && typeof profile.lastName === 'string'
}

function isEntry(value: unknown): value is SailorNavigationEntry {
  if (!value || typeof value !== 'object') return false
  const entry = value as Partial<SailorNavigationEntry>
  return typeof entry.id === 'string' && typeof entry.sailorId === 'string' && typeof entry.date === 'string' && Boolean(entry.ratings)
}

function normalize(data: Partial<SailorJournalData>): SailorJournalData {
  const profiles = Array.isArray(data.profiles) ? data.profiles.filter(isProfile) : []
  const profileIds = new Set(profiles.map((profile) => profile.id))
  const entries = Array.isArray(data.entries)
    ? data.entries.filter(isEntry).filter((entry) => profileIds.has(entry.sailorId))
    : []
  return {
    profiles: profiles.map((profile) => ({
      ...profile,
      ageCategory: profile.ageCategory || '',
      club: profile.club || '',
      createdAt: profile.createdAt || new Date(0).toISOString(),
      updatedAt: profile.updatedAt || profile.createdAt || new Date(0).toISOString(),
    })),
    entries: entries.map((entry) => ({
      ...entry,
      createdAt: entry.createdAt || new Date(0).toISOString(),
      updatedAt: entry.updatedAt || entry.createdAt || new Date(0).toISOString(),
    })),
  }
}

export function loadSailorJournal(): SailorJournalData {
  try {
    return normalize(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Partial<SailorJournalData>)
  } catch {
    return emptyJournal()
  }
}

function persist(data: SailorJournalData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalize(data)))
  notifyPersistentDataChanged()
}

export function saveSailorProfile(profile: SailorProfile) {
  const data = loadSailorJournal()
  const profiles = data.profiles.some((item) => item.id === profile.id)
    ? data.profiles.map((item) => item.id === profile.id ? clone(profile) : item)
    : [clone(profile), ...data.profiles]
  persist({ ...data, profiles })
}

export function deleteSailorProfile(id: string) {
  const data = loadSailorJournal()
  persist({
    profiles: data.profiles.filter((profile) => profile.id !== id),
    entries: data.entries.filter((entry) => entry.sailorId !== id),
  })
}

export function saveSailorEntry(entry: SailorNavigationEntry) {
  const data = loadSailorJournal()
  const entries = data.entries.some((item) => item.id === entry.id)
    ? data.entries.map((item) => item.id === entry.id ? clone(entry) : item)
    : [clone(entry), ...data.entries]
  persist({ ...data, entries })
}

export function deleteSailorEntry(id: string) {
  const data = loadSailorJournal()
  persist({ ...data, entries: data.entries.filter((entry) => entry.id !== id) })
}

export function importSailorJournal(incoming: SailorJournalData | undefined, mode: 'merge' | 'replace' = 'merge') {
  const safe = normalize(incoming || {})
  if (mode === 'replace') {
    persist(safe)
    return
  }
  const current = loadSailorJournal()
  const profiles = new Map(current.profiles.map((profile) => [profile.id, profile]))
  safe.profiles.forEach((profile) => {
    const previous = profiles.get(profile.id)
    if (!previous || Date.parse(profile.updatedAt) >= Date.parse(previous.updatedAt)) profiles.set(profile.id, profile)
  })
  const entries = new Map(current.entries.map((entry) => [entry.id, entry]))
  safe.entries.forEach((entry) => {
    const previous = entries.get(entry.id)
    if (!previous || Date.parse(entry.updatedAt) >= Date.parse(previous.updatedAt)) entries.set(entry.id, entry)
  })
  persist({ profiles: [...profiles.values()], entries: [...entries.values()] })
}
