import { daypartForTime, seasonForDate, signedAngleDelta, windForceBand, windSector } from './calibration'
import type { SavedBriefing } from './savedBriefings'
import type { BriefingRequest } from './types'
import type { LiveWeatherData } from './weather'

export type KnowledgeConfidence = {
  sampleCount: number
  situationCount: number
  contextCount: number
  recentCount: number
  consistencyScore: number
  score: number
  label: string
  explanation: string
}

export type CommunityObservation = {
  id: string
  planKey: string
  observedAt: string
  windSector: string
  forceBand: string
  season?: string
  daypart?: string
  speedBias?: number | null
  directionBias?: number | null
}

const COMMUNITY_CACHE_KEY = 'coachbrief:community-knowledge-cache:v1'

function planKeyFromRequest(request: BriefingRequest) {
  const latitude = Number(request.latitude)
  const longitude = Number(request.longitude)
  if (request.latitude !== '' && request.longitude !== '' && Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return `${latitude.toFixed(2)}:${longitude.toFixed(2)}`
  }
  return (request.location || 'plan-eau-inconnu').trim().toLowerCase()
}

function standardDeviation(values: number[]) {
  if (values.length < 2) return null
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

function directionSpread(values: number[]) {
  if (values.length < 2) return null
  const radians = values.map((value) => value * Math.PI / 180)
  const x = radians.reduce((sum, value) => sum + Math.cos(value), 0) / radians.length
  const y = radians.reduce((sum, value) => sum + Math.sin(value), 0) / radians.length
  const mean = Math.atan2(y, x) * 180 / Math.PI
  return values.reduce((sum, value) => sum + Math.abs(signedAngleDelta(mean, value)), 0) / values.length
}

function recentWithinOneYear(date: string) {
  const timestamp = new Date(`${date.slice(0, 10)}T12:00:00`).getTime()
  if (!Number.isFinite(timestamp)) return false
  const ageDays = Math.abs(Date.now() - timestamp) / 86_400_000
  return ageDays <= 365
}

function consistencyFromBiases(speedBiases: number[], directionBiases: number[]) {
  const scores: number[] = []
  const speedSd = standardDeviation(speedBiases)
  if (speedSd != null) scores.push(Math.max(0, Math.min(100, 100 - speedSd * 22)))
  const dirSpread = directionSpread(directionBiases)
  if (dirSpread != null) scores.push(Math.max(0, Math.min(100, 100 - dirSpread * 2.2)))
  if (!scores.length) return 50
  return Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length)
}

function personalLabel(samples: number, score: number) {
  if (samples <= 0) return 'Pas encore de recul'
  if (samples === 1) return 'Indication'
  if (samples <= 3) return 'Tendance émergente'
  if (samples <= 6) return score >= 60 ? 'Confiance moyenne' : 'Tendance à confirmer'
  return score >= 70 ? 'Confiance forte' : 'Confiance moyenne'
}

function communityLabel(samples: number, score: number) {
  if (samples < 3) return 'Pas assez de données partagées'
  if (samples <= 5) return 'Signal faible'
  if (samples <= 12) return score >= 55 ? 'Tendance intéressante' : 'Signal à confirmer'
  if (samples <= 25) return score >= 65 ? 'Bonne confiance' : 'Tendance intéressante'
  return score >= 75 ? 'Confiance forte' : 'Bonne confiance'
}

function scoreEvidence(sampleCount: number, situationCount: number, contextCount: number, recentCount: number, consistencyScore: number, community: boolean) {
  const sampleTarget = community ? 13 : 7
  const sampleScore = Math.min(45, (sampleCount / sampleTarget) * 45)
  const similarityScore = Math.min(25, situationCount * 5 + contextCount * 4)
  const recentScore = sampleCount ? Math.min(15, (recentCount / Math.max(1, Math.min(sampleCount, 5))) * 15) : 0
  const consistencyContribution = sampleCount >= 2 ? consistencyScore * 0.15 : 4
  return Math.max(0, Math.min(100, Math.round(sampleScore + similarityScore + recentScore + consistencyContribution)))
}

export function buildPersonalKnowledgeConfidence(items: SavedBriefing[], request: BriefingRequest, weather: LiveWeatherData | null): KnowledgeConfidence {
  const key = planKeyFromRequest(request)
  const realityItems = items.filter((item) => planKeyFromRequest(item.request) === key && item.weather?.race && item.reality)
  let situationItems = realityItems
  let contextItems: SavedBriefing[] = []

  if (weather) {
    const sector = windSector(weather.race.direction)
    const force = windForceBand(weather.race.speed)
    const season = seasonForDate(request.date)
    const daypart = daypartForTime(request.raceTime || request.startTime)
    situationItems = realityItems.filter((item) => {
      const race = item.weather!.race
      return windSector(race.direction).key === sector.key && windForceBand(race.speed).key === force.key
    })
    contextItems = situationItems.filter((item) => seasonForDate(item.request.date).key === season.key && daypartForTime(item.request.raceTime || item.request.startTime).key === daypart.key)
  }

  const speedBiases = realityItems.flatMap((item) => {
    const actual = Number(item.reality!.windSpeed)
    return item.reality!.windSpeed !== '' && Number.isFinite(actual) ? [actual - item.weather!.race.speed] : []
  })
  const directionBiases = realityItems.flatMap((item) => {
    const actual = Number(item.reality!.windDirection)
    return item.reality!.windDirection !== '' && Number.isFinite(actual) ? [signedAngleDelta(item.weather!.race.direction, actual)] : []
  })

  const recentCount = realityItems.filter((item) => recentWithinOneYear(item.request.date || item.savedAt)).length
  const consistencyScore = consistencyFromBiases(speedBiases, directionBiases)
  const score = scoreEvidence(realityItems.length, situationItems.length, contextItems.length, recentCount, consistencyScore, false)
  const label = personalLabel(realityItems.length, score)
  const explanation = realityItems.length <= 1
    ? 'Le score reste prudent tant qu’une seule manche réelle est disponible.'
    : `${situationItems.length} cas comparables · ${contextItems.length} très comparables · régularité ${consistencyScore}/100 · ${recentCount} récent${recentCount > 1 ? 's' : ''}.`

  return { sampleCount: realityItems.length, situationCount: situationItems.length, contextCount: contextItems.length, recentCount, consistencyScore, score, label, explanation }
}

export function loadCommunityKnowledgeCache(): CommunityObservation[] {
  try {
    const raw = window.localStorage.getItem(COMMUNITY_CACHE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is CommunityObservation => Boolean(item && typeof item === 'object' && typeof (item as CommunityObservation).id === 'string' && typeof (item as CommunityObservation).planKey === 'string'))
  } catch {
    return []
  }
}

export function buildCommunityKnowledgeConfidence(observations: CommunityObservation[], request: BriefingRequest, weather: LiveWeatherData | null): KnowledgeConfidence {
  const key = planKeyFromRequest(request)
  const site = observations.filter((item) => item.planKey === key)
  let situation = site
  let context: CommunityObservation[] = []

  if (weather) {
    const sector = windSector(weather.race.direction).key
    const force = windForceBand(weather.race.speed).key
    const season = seasonForDate(request.date).key
    const daypart = daypartForTime(request.raceTime || request.startTime).key
    situation = site.filter((item) => item.windSector === sector && item.forceBand === force)
    context = situation.filter((item) => item.season === season && item.daypart === daypart)
  }

  const speedBiases = site.flatMap((item) => typeof item.speedBias === 'number' ? [item.speedBias] : [])
  const directionBiases = site.flatMap((item) => typeof item.directionBias === 'number' ? [item.directionBias] : [])
  const recentCount = site.filter((item) => recentWithinOneYear(item.observedAt)).length
  const consistencyScore = consistencyFromBiases(speedBiases, directionBiases)
  const score = scoreEvidence(site.length, situation.length, context.length, recentCount, consistencyScore, true)
  const label = communityLabel(site.length, score)
  const explanation = site.length
    ? `${situation.length} observations comparables · ${context.length} très comparables · régularité ${consistencyScore}/100 · ${recentCount} récente${recentCount > 1 ? 's' : ''}.`
    : 'Aucune donnée communautaire synchronisée pour ce plan d’eau pour le moment.'

  return { sampleCount: site.length, situationCount: situation.length, contextCount: context.length, recentCount, consistencyScore, score, label, explanation }
}
