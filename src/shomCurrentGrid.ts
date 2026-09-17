import type { CurrentHour } from './currentAnalysis'
import { shomCurrentSourceForPoint } from './shomCurrent'
import { nearestHighWater, type ShomHighWaterSchedules } from './shomHighWater'

export type ShomCurrentResult = {
  hours: CurrentHour[]
  source: 'shom' | 'none'
  atlasId: string | null
  atlasLabel: string | null
  coefficient: number | null
  referenceHighWaterTime: string | null
  nearestPointKm: number | null
  note: string
}

export type ShomCurrentAtTime = {
  speed: number | null
  direction: number | null
  source: 'shom' | 'none'
  atlasId: string | null
  atlasLabel: string | null
  referencePort: string | null
  nearestPointKm: number | null
  phaseMinutes: number | null
  referenceMode: 'port-schedule' | 'propagated' | 'none'
  referenceHighWaterUsed: string | null
  note: string
}

type ShomPointSeries = Array<[number, number | null, number | null]>
type ShomTilePoint = { lat: number; lon: number; c45: ShomPointSeries; c95: ShomPointSeries }
type ShomTile = { points?: ShomTilePoint[] }
type ShomManifest = { tileSize?: number; phaseMinutes?: number[]; coefficients?: number[]; units?: string }

const METRES_PER_SECOND_TO_KNOTS = 1.9438444924
const SEMIDIURNAL_MINUTES = 12 * 60 + 25
const jsonCache = new Map<string, Promise<unknown | null>>()

function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, value)) }
function radians(value: number) { return value * Math.PI / 180 }
function normalize(value: number) { return ((value % 360) + 360) % 360 }
function publicAsset(path: string) {
  const base = import.meta.env.BASE_URL || '/'
  return `${base}${path.replace(/^\//, '')}`
}

function tileKey(latitude: number, longitude: number, tileSize: number) {
  const latFloor = Math.floor(latitude / tileSize) * tileSize
  const lonFloor = Math.floor(longitude / tileSize) * tileSize
  const lat = `${latFloor >= 0 ? '+' : '-'}${Math.abs(latFloor).toFixed(2).padStart(5, '0')}`.replace('.', 'p')
  const lon = `${lonFloor >= 0 ? '+' : '-'}${Math.abs(lonFloor).toFixed(2).padStart(6, '0')}`.replace('.', 'p')
  return `${lat}_${lon}`
}

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const dLat = radians(lat2 - lat1)
  const dLon = radians(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function clockMinutes(clock: string) {
  const [hour, minute] = clock.split(':').map(Number)
  return (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0)
}

function clockFromMinutes(total: number) {
  const normalized = ((total % 1440) + 1440) % 1440
  const hour = Math.floor(normalized / 60)
  const minute = Math.round(normalized % 60)
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function interpolateCoefficient(neap: number | null, spring: number | null, coefficient: number) {
  if (neap == null && spring == null) return null
  if (neap == null) return spring
  if (spring == null) return neap
  const ratio = clamp((coefficient - 45) / 50, 0, 1)
  return neap + (spring - neap) * ratio
}

function uvToCurrent(u: number | null, v: number | null) {
  if (u == null || v == null || !Number.isFinite(u) || !Number.isFinite(v)) return { speed: null, direction: null }
  const speed = Math.hypot(u, v) * METRES_PER_SECOND_TO_KNOTS
  const direction = normalize(Math.atan2(u, v) * 180 / Math.PI)
  return { speed, direction }
}

async function fetchJson<T>(url: string): Promise<T | null> {
  let pending = jsonCache.get(url)
  if (!pending) {
    pending = (async () => {
      try {
        const response = await fetch(url)
        if (!response.ok) return null
        return await response.json() as T
      } catch {
        return null
      }
    })()
    jsonCache.set(url, pending)
  }
  return await pending as T | null
}

async function nearestGridPoint(latitude: number, longitude: number, atlasId: string) {
  const manifest = await fetchJson<ShomManifest>(publicAsset(`shom-current/${atlasId}/manifest.json`))
  const tileSize = manifest?.tileSize ?? 0.25
  const key = tileKey(latitude, longitude, tileSize)
  const tile = await fetchJson<ShomTile>(publicAsset(`shom-current/${atlasId}/tiles/${key}.json`))
  const points = tile?.points ?? []
  if (!points.length) return null
  return [...points]
    .map((point) => ({ point, distance: distanceKm(latitude, longitude, point.lat, point.lon) }))
    .sort((a, b) => a.distance - b.distance)[0] ?? null
}

function coefficientRows(point: ShomTilePoint, coefficient: number) {
  const rows45 = new Map(point.c45.map((row) => [row[0], row]))
  const rows95 = new Map(point.c95.map((row) => [row[0], row]))
  const phases = Array.from(new Set([...rows45.keys(), ...rows95.keys()])).sort((a, b) => a - b)
  return phases.map((phase) => {
    const a = rows45.get(phase)
    const b = rows95.get(phase)
    return {
      phase,
      u: interpolateCoefficient(a?.[1] ?? null, b?.[1] ?? null, coefficient),
      v: interpolateCoefficient(a?.[2] ?? null, b?.[2] ?? null, coefficient),
    }
  })
}

function interpolatePhase(rows: Array<{ phase: number; u: number | null; v: number | null }>, phase: number) {
  if (!rows.length) return { u: null, v: null, phase: null as number | null }
  const target = clamp(phase, rows[0].phase, rows[rows.length - 1].phase)
  const upperIndex = rows.findIndex((row) => row.phase >= target)
  if (upperIndex <= 0) return { u: rows[0].u, v: rows[0].v, phase: target }
  const upper = rows[upperIndex]
  const lower = rows[upperIndex - 1]
  if (!upper || upper.phase === lower.phase) return { u: lower.u, v: lower.v, phase: target }
  const ratio = (target - lower.phase) / (upper.phase - lower.phase)
  const blend = (a: number | null, b: number | null) => a == null ? b : b == null ? a : a + (b - a) * ratio
  return { u: blend(lower.u, upper.u), v: blend(lower.v, upper.v), phase: target }
}

export async function fetchShomCurrentSeries(
  latitude: number,
  longitude: number,
  coefficient: number,
  referenceHighWaterTime: string,
): Promise<ShomCurrentResult> {
  const atlas = shomCurrentSourceForPoint(latitude, longitude)
  if (!atlas) return { hours: [], source: 'none', atlasId: null, atlasLabel: null, coefficient: null, referenceHighWaterTime: null, nearestPointKm: null, note: 'Aucun atlas SHOM identifié pour ce point.' }
  if (!Number.isFinite(coefficient) || coefficient < 20 || coefficient > 120 || !/^\d{1,2}:\d{2}$/.test(referenceHighWaterTime)) {
    return { hours: [], source: 'none', atlasId: atlas.id, atlasLabel: atlas.label, coefficient: null, referenceHighWaterTime: null, nearestPointKm: null, note: 'Coefficient et heure de pleine mer de référence requis pour exploiter l’atlas SHOM.' }
  }

  const nearest = await nearestGridPoint(latitude, longitude, atlas.id)
  if (!nearest) return { hours: [], source: 'none', atlasId: atlas.id, atlasLabel: atlas.label, coefficient, referenceHighWaterTime, nearestPointKm: null, note: 'Atlas identifié, mais aucune tuile SHOM préparée n’est disponible pour ce point.' }

  const referenceMinutes = clockMinutes(referenceHighWaterTime)
  const rows = coefficientRows(nearest.point, coefficient)
  const hours: CurrentHour[] = rows.map((row) => {
    const current = uvToCurrent(row.u, row.v)
    return { time: clockFromMinutes(referenceMinutes + row.phase), speed: current.speed, direction: current.direction }
  })

  return {
    hours,
    source: hours.length ? 'shom' : 'none',
    atlasId: atlas.id,
    atlasLabel: atlas.label,
    coefficient,
    referenceHighWaterTime,
    nearestPointKm: nearest.distance,
    note: hours.length
      ? `Courant SHOM interpolé entre coefficients 45 et 95 au point de grille le plus proche (${nearest.distance.toFixed(1).replace('.', ',')} km).`
      : 'Aucune phase SHOM exploitable dans la tuile.',
  }
}

export async function fetchShomCurrentAtTime(
  latitude: number,
  longitude: number,
  coefficient: number,
  referenceHighWater: Date,
  target: Date,
  referenceSchedules?: ShomHighWaterSchedules,
): Promise<ShomCurrentAtTime> {
  const atlas = shomCurrentSourceForPoint(latitude, longitude)
  const none = (note: string): ShomCurrentAtTime => ({
    speed: null, direction: null, source: 'none', atlasId: atlas?.id ?? null, atlasLabel: atlas?.label ?? null,
    referencePort: atlas?.referencePort ?? null, nearestPointKm: null, phaseMinutes: null,
    referenceMode: 'none', referenceHighWaterUsed: null, note,
  })
  if (!atlas) return none('Hors zone d’atlas SHOM configurée.')
  if (!Number.isFinite(coefficient) || coefficient < 20 || coefficient > 120 || !Number.isFinite(referenceHighWater.getTime()) || !Number.isFinite(target.getTime())) {
    return none('Coefficient ou pleine mer de référence invalide.')
  }

  const nearest = await nearestGridPoint(latitude, longitude, atlas.id)
  if (!nearest) return none('Atlas SHOM identifié, mais tuile locale absente.')

  const scheduled = nearestHighWater(referenceSchedules?.[atlas.id], target)
  const chosenReference = scheduled ?? referenceHighWater
  const deltaMinutes = (target.getTime() - chosenReference.getTime()) / 60_000
  const cycle = scheduled ? 0 : Math.round(deltaMinutes / SEMIDIURNAL_MINUTES)
  const phase = scheduled ? deltaMinutes : deltaMinutes - cycle * SEMIDIURNAL_MINUTES
  const interpolated = interpolatePhase(coefficientRows(nearest.point, coefficient), phase)
  const current = uvToCurrent(interpolated.u, interpolated.v)
  const available = current.speed != null && current.direction != null
  const mode: ShomCurrentAtTime['referenceMode'] = scheduled ? 'port-schedule' : 'propagated'
  return {
    speed: current.speed,
    direction: current.direction,
    source: available ? 'shom' : 'none',
    atlasId: atlas.id,
    atlasLabel: atlas.label,
    referencePort: atlas.referencePort,
    nearestPointKm: nearest.distance,
    phaseMinutes: interpolated.phase,
    referenceMode: mode,
    referenceHighWaterUsed: chosenReference.toISOString(),
    note: available
      ? `SHOM ${atlas.referencePort} · phase ${Math.round(interpolated.phase ?? phase)} min · PM ${mode === 'port-schedule' ? 'saisie' : 'propagée'} · grille à ${nearest.distance.toFixed(1).replace('.', ',')} km.`
      : 'Point SHOM trouvé mais vecteur de courant indisponible pour cette phase.',
  }
}
