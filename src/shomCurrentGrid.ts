import type { CurrentHour } from './currentAnalysis'
import { shomCurrentSourceForPoint } from './shomCurrent'

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

type ShomPointSeries = Array<[number, number | null, number | null]>
type ShomTilePoint = { lat: number; lon: number; c45: ShomPointSeries; c95: ShomPointSeries }
type ShomTile = { points?: ShomTilePoint[] }
type ShomManifest = { tileSize?: number; phaseMinutes?: number[]; coefficients?: number[]; units?: string }

const METRES_PER_SECOND_TO_KNOTS = 1.9438444924

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
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    return await response.json() as T
  } catch {
    return null
  }
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

  const manifest = await fetchJson<ShomManifest>(publicAsset(`shom-current/${atlas.id}/manifest.json`))
  const tileSize = manifest?.tileSize ?? 0.25
  const key = tileKey(latitude, longitude, tileSize)
  const tile = await fetchJson<ShomTile>(publicAsset(`shom-current/${atlas.id}/tiles/${key}.json`))
  const points = tile?.points ?? []
  if (!points.length) return { hours: [], source: 'none', atlasId: atlas.id, atlasLabel: atlas.label, coefficient, referenceHighWaterTime, nearestPointKm: null, note: 'Atlas identifié, mais aucune tuile SHOM préparée n’est disponible pour ce point.' }

  const nearest = [...points]
    .map((point) => ({ point, distance: distanceKm(latitude, longitude, point.lat, point.lon) }))
    .sort((a, b) => a.distance - b.distance)[0]
  if (!nearest) return { hours: [], source: 'none', atlasId: atlas.id, atlasLabel: atlas.label, coefficient, referenceHighWaterTime, nearestPointKm: null, note: 'Point SHOM exploitable introuvable.' }

  const rows45 = new Map(nearest.point.c45.map((row) => [row[0], row]))
  const rows95 = new Map(nearest.point.c95.map((row) => [row[0], row]))
  const phases = Array.from(new Set([...rows45.keys(), ...rows95.keys()])).sort((a, b) => a - b)
  const referenceMinutes = clockMinutes(referenceHighWaterTime)
  const hours: CurrentHour[] = phases.map((phase) => {
    const a = rows45.get(phase)
    const b = rows95.get(phase)
    const u = interpolateCoefficient(a?.[1] ?? null, b?.[1] ?? null, coefficient)
    const v = interpolateCoefficient(a?.[2] ?? null, b?.[2] ?? null, coefficient)
    const current = uvToCurrent(u, v)
    return { time: clockFromMinutes(referenceMinutes + phase), speed: current.speed, direction: current.direction }
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
