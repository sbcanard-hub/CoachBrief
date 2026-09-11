import { daypartForTime, seasonForDate, signedAngleDelta, windForceBand, windSector } from './calibration'
import type { SavedBriefing } from './savedBriefings'
import type { BriefingRequest } from './types'
import type { LiveWeatherData } from './weather'

export type RecurringSiteSignal = {
  key: string
  label: string
  count: number
}

export type SiteLearningProfile = {
  key: string
  label: string
  savedCount: number
  realityCount: number
  situationCount: number
  contextCount: number
  confidence: number
  confidenceLabel: string
  dominantSectorLabel: string
  dominantSectorCount: number
  meanSpeedBias: number | null
  meanDirectionBias: number | null
  recurringSignals: RecurringSiteSignal[]
  lessons: string[]
  recentNotes: Array<{ date: string; text: string }>
}

const SIGNALS = [
  { key: 'droite', label: 'Bascules / avantage droite', patterns: ['droite', 'adonnante tribord'] },
  { key: 'gauche', label: 'Bascules / avantage gauche', patterns: ['gauche', 'adonnante babord', 'adonnante bâbord'] },
  { key: 'pression', label: 'Zones de pression', patterns: ['pression', 'plus de vent', 'renforcement'] },
  { key: 'molle', label: 'Molles / dévent', patterns: ['molle', 'molles', 'devent', 'dévent'] },
  { key: 'risee', label: 'Risées marquées', patterns: ['risee', 'risée', 'risees', 'risées'] },
  { key: 'thermique', label: 'Thermique', patterns: ['thermique', 'brise'] },
  { key: 'courant', label: 'Courant', patterns: ['courant'] },
  { key: 'rafale', label: 'Rafales / irrégularité', patterns: ['rafale', 'rafales', 'irregulier', 'irrégulier', 'instable'] },
  { key: 'nuage', label: 'Effet des nuages', patterns: ['nuage', 'nuages', 'grain'] },
  { key: 'vague', label: 'État de mer / vagues', patterns: ['vague', 'vagues', 'clapot', 'houle'] },
] as const

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function planKeyFromRequest(request: BriefingRequest) {
  const latitude = Number(request.latitude)
  const longitude = Number(request.longitude)
  if (request.latitude !== '' && request.longitude !== '' && Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return `${latitude.toFixed(2)}:${longitude.toFixed(2)}`
  }
  return (request.location || 'plan-eau-inconnu').trim().toLowerCase()
}

function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
}

function circularMeanDelta(values: number[]) {
  if (!values.length) return null
  const radians = values.map((value) => value * Math.PI / 180)
  const x = radians.reduce((sum, value) => sum + Math.cos(value), 0) / radians.length
  const y = radians.reduce((sum, value) => sum + Math.sin(value), 0) / radians.length
  if (Math.abs(x) < 1e-9 && Math.abs(y) < 1e-9) return 0
  return Math.atan2(y, x) * 180 / Math.PI
}

function confidenceLabel(score: number) {
  if (score >= 80) return 'mémoire solide'
  if (score >= 60) return 'bonne mémoire'
  if (score >= 35) return 'en construction'
  return 'démarrage'
}

function noteForItem(item: SavedBriefing) {
  return [item.reality?.notes, item.request.observationNotes]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' · ')
    .trim()
}

function signedNumber(value: number, digits = 0) {
  const rendered = digits ? value.toFixed(digits).replace('.', ',') : String(Math.round(value))
  return `${value > 0 ? '+' : ''}${rendered}`
}

export function buildSiteLearningProfile(
  items: SavedBriefing[],
  request: BriefingRequest,
  weather: LiveWeatherData | null,
): SiteLearningProfile {
  const key = planKeyFromRequest(request)
  const planItems = items.filter((item) => planKeyFromRequest(item.request) === key && item.weather?.race)
  const realityItems = planItems.filter((item) => item.reality)

  const sectorCounts = new Map<string, { label: string; count: number }>()
  for (const item of planItems) {
    const sector = windSector(item.weather!.race.direction)
    const current = sectorCounts.get(sector.key) ?? { label: sector.label, count: 0 }
    current.count += 1
    sectorCounts.set(sector.key, current)
  }
  const dominantSector = Array.from(sectorCounts.values()).sort((a, b) => b.count - a.count)[0]

  let situationItems: SavedBriefing[] = []
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
    contextItems = situationItems.filter((item) => (
      seasonForDate(item.request.date).key === season.key
      && daypartForTime(item.request.raceTime || item.request.startTime).key === daypart.key
    ))
  }

  const speedBiases = realityItems.flatMap((item) => {
    const actual = Number(item.reality!.windSpeed)
    return item.reality!.windSpeed !== '' && Number.isFinite(actual) ? [actual - item.weather!.race.speed] : []
  })
  const directionBiases = realityItems.flatMap((item) => {
    const actual = Number(item.reality!.windDirection)
    return item.reality!.windDirection !== '' && Number.isFinite(actual)
      ? [signedAngleDelta(item.weather!.race.direction, actual)]
      : []
  })
  const meanSpeedBias = mean(speedBiases)
  const meanDirectionBias = circularMeanDelta(directionBiases)

  const signalCounts = new Map<string, RecurringSiteSignal>()
  for (const item of planItems) {
    const normalized = normalizeText(noteForItem(item))
    if (!normalized) continue
    for (const signal of SIGNALS) {
      const found = signal.patterns.some((pattern) => normalized.includes(normalizeText(pattern)))
      if (!found) continue
      const current = signalCounts.get(signal.key) ?? { key: signal.key, label: signal.label, count: 0 }
      current.count += 1
      signalCounts.set(signal.key, current)
    }
  }
  const recurringSignals = Array.from(signalCounts.values())
    .filter((signal) => signal.count >= 2)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 5)

  let confidence = 10
  confidence += Math.min(35, realityItems.length * 7)
  confidence += Math.min(20, situationItems.length * 7)
  confidence += Math.min(15, contextItems.length * 7)
  confidence += Math.min(10, recurringSignals.reduce((sum, signal) => sum + signal.count, 0))
  confidence = Math.min(90, Math.round(confidence))

  const lessons: string[] = []
  if (contextItems.length >= 2 && weather) {
    lessons.push(`${contextItems.length} manches très comparables existent déjà pour ce secteur, cette force, cette saison et ce créneau horaire.`)
  } else if (situationItems.length >= 2 && weather) {
    lessons.push(`${situationItems.length} manches comparables existent déjà pour le même secteur de vent et la même plage de force.`)
  } else if (realityItems.length) {
    lessons.push(`L’historique local contient ${realityItems.length} manche${realityItems.length > 1 ? 's' : ''} avec retour réel, mais pas encore assez de cas similaires pour parler d’un comportement récurrent dans cette situation.`)
  } else {
    lessons.push('La mémoire locale démarre : enregistrez le briefing puis renseignez le vent réellement observé après la manche pour que CoachBrief apprenne ce plan d’eau.')
  }

  if (meanSpeedBias != null && realityItems.length >= 2 && Math.abs(meanSpeedBias) >= 0.8) {
    lessons.push(meanSpeedBias > 0
      ? `Sur l’historique, le vent réel est en moyenne ${signedNumber(meanSpeedBias, 1)} nd plus fort que le modèle.`
      : `Sur l’historique, le vent réel est en moyenne ${Math.abs(meanSpeedBias).toFixed(1).replace('.', ',')} nd plus faible que le modèle.`)
  }
  if (meanDirectionBias != null && realityItems.length >= 2 && Math.abs(meanDirectionBias) >= 8) {
    lessons.push(meanDirectionBias > 0
      ? `La direction réelle ressort en moyenne ${Math.round(Math.abs(meanDirectionBias))}° plus à droite que le modèle.`
      : `La direction réelle ressort en moyenne ${Math.round(Math.abs(meanDirectionBias))}° plus à gauche que le modèle.`)
  }
  if (recurringSignals.length) {
    lessons.push(`Signaux terrain qui reviennent : ${recurringSignals.slice(0, 3).map((signal) => `${signal.label.toLowerCase()} (${signal.count})`).join(', ')}.`)
  }

  const recentNotes = planItems
    .map((item) => ({ date: item.request.date || item.savedAt.slice(0, 10), text: noteForItem(item) }))
    .filter((entry) => entry.text)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3)

  return {
    key,
    label: request.location || planItems[0]?.request.location || 'Plan d’eau',
    savedCount: planItems.length,
    realityCount: realityItems.length,
    situationCount: situationItems.length,
    contextCount: contextItems.length,
    confidence,
    confidenceLabel: confidenceLabel(confidence),
    dominantSectorLabel: dominantSector?.label ?? '—',
    dominantSectorCount: dominantSector?.count ?? 0,
    meanSpeedBias,
    meanDirectionBias,
    recurringSignals,
    lessons: lessons.slice(0, 4),
    recentNotes,
  }
}
