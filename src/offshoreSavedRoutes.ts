import type { OffshorePoint } from './offshore'
import type { OffshoreLegForecast, OffshoreWeatherModel } from './offshoreForecast'
import type { IsochroneResult } from './offshoreIsochrone'
import type { PolarTable } from './offshorePolar'
import { notifyPersistentDataChanged } from './persistentDataEvents'

export type OffshoreIsochroneSettings = {
  stepMinutes: string
  maxHours: string
  tidalCoefficient: string
  referenceHighWater: string
  portHighWaters: Record<string, string>
  weatherModel?: OffshoreWeatherModel
}

export type OffshoreSavedRoute = {
  version: 1
  id: string
  name: string
  savedAt: string
  updatedAt: string
  raceName: string
  departureDate: string
  departureTime: string
  boatName: string
  boatType: string
  averageSpeed: string
  points: OffshorePoint[]
  forecasts: OffshoreLegForecast[]
  polar: PolarTable
  isochrones: IsochroneResult | null
  isochroneSettings?: OffshoreIsochroneSettings
}

const STORAGE_KEY = 'coachbrief:offshore-routes:v1'

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function isSavedRoute(value: unknown): value is OffshoreSavedRoute {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<OffshoreSavedRoute>
  return candidate.version === 1
    && typeof candidate.id === 'string'
    && typeof candidate.name === 'string'
    && typeof candidate.savedAt === 'string'
    && Array.isArray(candidate.points)
    && Array.isArray(candidate.forecasts)
    && Boolean(candidate.polar)
}

export function loadOffshoreSavedRoutes(): OffshoreSavedRoute[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isSavedRoute).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  } catch {
    return []
  }
}

function persist(routes: OffshoreSavedRoute[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(routes))
  notifyPersistentDataChanged()
}

export function saveOffshoreRoute(
  snapshot: Omit<OffshoreSavedRoute, 'version' | 'id' | 'savedAt' | 'updatedAt' | 'name'>,
  options: { id?: string | null; name: string; saveAs?: boolean },
) {
  const now = new Date().toISOString()
  const current = loadOffshoreSavedRoutes()
  const existing = !options.saveAs && options.id ? current.find((item) => item.id === options.id) : null
  if (existing) {
    const updated: OffshoreSavedRoute = {
      ...existing,
      ...clone(snapshot),
      name: options.name.trim() || existing.name,
      updatedAt: now,
    }
    persist(current.map((item) => item.id === existing.id ? updated : item))
    return updated
  }

  const created: OffshoreSavedRoute = {
    version: 1,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: options.name.trim() || snapshot.raceName.trim() || `Route au large · ${snapshot.departureDate || 'sans date'}`,
    savedAt: now,
    updatedAt: now,
    ...clone(snapshot),
  }
  persist([created, ...current])
  return created
}

export function deleteOffshoreSavedRoute(id: string) {
  persist(loadOffshoreSavedRoutes().filter((item) => item.id !== id))
}

export function importOffshoreSavedRoutes(routes: OffshoreSavedRoute[] | undefined, mode: 'merge' | 'replace' = 'merge') {
  const incoming = (routes || []).filter(isSavedRoute).map(clone)
  if (mode === 'replace') {
    persist(incoming.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))
    return
  }
  const merged = new Map(loadOffshoreSavedRoutes().map((item) => [item.id, item]))
  for (const item of incoming) {
    const existing = merged.get(item.id)
    if (!existing || item.updatedAt > existing.updatedAt) merged.set(item.id, item)
  }
  persist(Array.from(merged.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))
}
