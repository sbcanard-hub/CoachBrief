import type { BernotRow, BernotZone, WeatherScenario } from './bernot'
import { analyseStartLine } from './startLine'
import { analyzeWindShifts } from './windShiftAnalysis'
import type { SavedBriefing } from './savedBriefings'
import type { BriefingRequest } from './types'

export type TacticalSide = 'left' | 'neutral' | 'right'
export type CoherenceState = 'strong' | 'medium' | 'shared' | 'insufficient'
export type CoherenceFactor = { label: string; side: TacticalSide; weight: number; detail: string }
export type TacticalCoherence = {
  state: CoherenceState
  preferredSide: TacticalSide
  confidence: 'high' | 'medium' | 'low'
  factors: CoherenceFactor[]
  supporting: CoherenceFactor[]
  opposing: CoherenceFactor[]
  summary: string
}

const zoneSide: Record<BernotZone, TacticalSide> = {
  Gauche: 'left', 'Centre G.': 'left', Centre: 'neutral', 'Centre D.': 'right', Droite: 'right',
}
const sideFr = { left: 'gauche', neutral: 'neutre', right: 'droite' } as const
function angle(from: number, to: number) { return ((to - from + 540) % 360) - 180 }
function valid(value: string | undefined) { const n = Number(value); return value?.trim() && Number.isFinite(n) ? n : null }

function measuredLine(request: BriefingRequest | null, wind: number): CoherenceFactor | null {
  const values = [request?.committeeLatitude, request?.committeeLongitude, request?.pinLatitude, request?.pinLongitude]
  if (!request || values.some((value) => valid(value) == null)) return null
  const result = analyseStartLine(
    { latitude: Number(request.committeeLatitude), longitude: Number(request.committeeLongitude) },
    { latitude: Number(request.pinLatitude), longitude: Number(request.pinLongitude) }, wind, request.boatClass,
  )
  if (!result) return null
  const side = result.favoured === 'pin' ? 'left' : result.favoured === 'committee' ? 'right' : 'neutral'
  return { label: 'Ligne de départ', side, weight: 5.5, detail: result.favoured === 'neutral' ? 'géométrie neutre' : `${result.favoured === 'pin' ? 'viseur' : 'comité'} favorisé` }
}

function localMemory(request: BriefingRequest | null, saved: SavedBriefing[]): CoherenceFactor | null {
  if (!request?.location.trim()) return null
  const matches = saved.filter((item) => item.request.location.trim().toLocaleLowerCase() === request.location.trim().toLocaleLowerCase() && item.reality?.windDirection && item.weather)
  const deltas = matches.map((item) => angle(item.weather!.race.direction, Number(item.reality!.windDirection))).filter(Number.isFinite)
  if (!deltas.length) return null
  const mean = deltas.reduce((sum, value) => sum + value, 0) / deltas.length
  const side: TacticalSide = Math.abs(mean) < 5 ? 'neutral' : mean > 0 ? 'right' : 'left'
  return { label: 'Historique local', side, weight: Math.min(4.5, 2 + deltas.length * .4), detail: `${deltas.length} retour(s), écart moyen ${Math.round(Math.abs(mean))}° ${side === 'neutral' ? '' : `vers la ${sideFr[side]}`}`.trim() }
}

/** Reconciles tactical evidence only; it never changes the underlying weather scenario. */
export function buildTacticalCoherence(request: BriefingRequest | null, scenario: WeatherScenario, rows: BernotRow[], saved: SavedBriefing[] = []): TacticalCoherence {
  const factors: CoherenceFactor[] = rows.filter((row) => row.factor !== 'Adversaires').map((row) => ({
    label: row.factor, side: zoneSide[row.zone], weight: Math.max(1, 8 - row.priority), detail: row.note,
  }))
  const line = measuredLine(request, scenario.windStart)
  if (line) factors.push(line)
  else if (request?.startLineBias && request.startLineBias !== 'Neutre') factors.push({ label: 'Ligne de départ', side: request.startLineBias === 'Pin' ? 'left' : 'right', weight: 4, detail: `${request.startLineBias} déclaré favorable` })
  const shifts = analyzeWindShifts(request?.expressReadings)
  if (shifts.sufficient) factors.push({ label: 'Bascules relevées', side: shifts.trend === 'left' ? 'left' : shifts.trend === 'right' ? 'right' : 'neutral', weight: 6, detail: `${shifts.points.length} relevés · ${shifts.pattern ?? 'stable'}` })
  const latestDirection = valid(request?.expressReadings?.at(-1)?.windDirection ?? request?.observedWindDirection)
  if (latestDirection != null) {
    const gap = angle(scenario.windStart, latestDirection)
    factors.push({ label: 'Relevé terrain', side: Math.abs(gap) < 5 ? 'neutral' : gap > 0 ? 'right' : 'left', weight: 6.5, detail: `écart de ${Math.round(Math.abs(gap))}° avec le modèle` })
  }
  const memory = localMemory(request, saved); if (memory) factors.push(memory)

  const directional = factors.filter((factor) => factor.side !== 'neutral')
  const rightWeight = directional.filter((factor) => factor.side === 'right').reduce((sum, factor) => sum + factor.weight, 0)
  const leftWeight = directional.filter((factor) => factor.side === 'left').reduce((sum, factor) => sum + factor.weight, 0)
  const total = rightWeight + leftWeight
  const preferredSide: TacticalSide = total === 0 || rightWeight === leftWeight ? 'neutral' : rightWeight > leftWeight ? 'right' : 'left'
  const supportWeight = preferredSide === 'right' ? rightWeight : preferredSide === 'left' ? leftWeight : Math.max(rightWeight, leftWeight)
  const ratio = total ? supportWeight / total : 0
  const state: CoherenceState = directional.length < 2 ? 'insufficient' : preferredSide === 'neutral' || ratio < .64 ? 'shared' : ratio >= .78 ? 'strong' : 'medium'
  const supporting = preferredSide === 'neutral' ? [] : directional.filter((factor) => factor.side === preferredSide).sort((a, b) => b.weight - a.weight)
  const opposing = preferredSide === 'neutral' ? directional : directional.filter((factor) => factor.side !== preferredSide).sort((a, b) => b.weight - a.weight)
  const confidence = state === 'strong' ? 'high' : state === 'medium' ? 'medium' : 'low'
  const dominant = supporting.slice(0, 2).map((factor) => factor.label.toLowerCase()).join(' et ')
  const opposition = opposing.slice(0, 2).map((factor) => factor.label.toLowerCase()).join(' et ')
  const summary = state === 'insufficient' ? 'Informations insuffisantes pour dégager une préférence tactique.'
    : state === 'shared' ? `Analyse partagée : ${rightWeight >= leftWeight ? 'les signaux dominants favorisent la droite' : 'les signaux dominants favorisent la gauche'}, mais ${opposition || 'des facteurs de poids comparable'} favorisent l’autre côté.`
      : `${state === 'strong' ? 'Convergence forte' : 'Convergence moyenne'} : ${supporting.length} facteur(s) orientent la stratégie vers la ${sideFr[preferredSide]}. ${dominant ? `${dominant} dominent par leur priorité ; ` : ''}${opposition ? `${opposition} restent contradictoires.` : 'aucun facteur directionnel ne les contredit.'}`
  return { state, preferredSide, confidence, factors, supporting, opposing, summary }
}
