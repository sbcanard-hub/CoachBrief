import type { WeatherModelKey } from './types'

type ModelPoint = {
  model: { key: WeatherModelKey; shortLabel: string }
  available: boolean
  speed: number | null
  direction: number | null
  hourly: Array<{ time: string; speed: number | null; direction: number | null }>
}

export type MultiModelSynthesis = {
  confidence: 'Élevée' | 'Moyenne' | 'Faible'
  confidenceScore: number
  independentAvailable: number
  independentTotal: number
  consensusCount: number
  meanSpeed: number | null
  meanDirection: number | null
  speedRange: [number, number] | null
  directionSpread: number | null
  outliers: string[]
  strengthTrend: 'renforcement' | 'affaiblissement' | 'stable' | 'incertaine'
  strengthDelta: number | null
  rotationTrend: 'droite' | 'gauche' | 'stable' | 'partagée' | 'incertaine'
  rotationDelta: number | null
  headline: string
  advice: string
}

function circularMean(values: number[]) {
  if (!values.length) return null
  const radians = values.map((value) => value * Math.PI / 180)
  const x = radians.reduce((sum, value) => sum + Math.cos(value), 0) / values.length
  const y = radians.reduce((sum, value) => sum + Math.sin(value), 0) / values.length
  if (Math.abs(x) < 1e-9 && Math.abs(y) < 1e-9) return null
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
}

function signedAngleDelta(from: number, to: number) {
  return ((to - from + 540) % 360) - 180
}

function angleGap(a: number, b: number) {
  return Math.abs(signedAngleDelta(a, b))
}

function median(values: number[]) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

function round(value: number, digits = 0) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function directionLabel(value: number | null) {
  if (value == null) return 'direction incertaine'
  const labels = ['N', 'N-E', 'E', 'S-E', 'S', 'S-O', 'O', 'N-O']
  return `${String(Math.round(value)).padStart(3, '0')}° ${labels[Math.round((((value % 360) + 360) % 360) / 45) % 8]}`
}

function timelineEdge(model: ModelPoint, edge: 'first' | 'last') {
  const valid = model.hourly.filter((hour) => hour.speed != null && hour.direction != null)
  if (!valid.length) return null
  return edge === 'first' ? valid[0] : valid[valid.length - 1]
}

export function buildMultiModelSynthesis(models: ModelPoint[]): MultiModelSynthesis {
  const independent = models.filter((item) => item.model.key !== 'best_match')
  const available = independent.filter((item) => item.available && item.speed != null && item.direction != null)
  const total = independent.length

  if (available.length < 2) {
    return {
      confidence: 'Faible', confidenceScore: Math.round(available.length / Math.max(1, total) * 35),
      independentAvailable: available.length, independentTotal: total, consensusCount: available.length,
      meanSpeed: available[0]?.speed ?? null, meanDirection: available[0]?.direction ?? null,
      speedRange: null, directionSpread: null, outliers: [], strengthTrend: 'incertaine', strengthDelta: null,
      rotationTrend: 'incertaine', rotationDelta: null,
      headline: 'Pas assez de modèles indépendants disponibles pour dégager une tendance robuste.',
      advice: 'S’appuyer d’abord sur les observations terrain et les sources locales avant de retenir une tendance modèle.',
    }
  }

  const speeds = available.map((item) => item.speed as number)
  const directions = available.map((item) => item.direction as number)
  const centralSpeed = median(speeds) as number
  const centralDirection = circularMean(directions)

  const outlierModels = available.filter((item) => {
    const speedGap = Math.abs((item.speed as number) - centralSpeed)
    const directionGap = centralDirection == null ? 0 : angleGap(item.direction as number, centralDirection)
    return speedGap > 3 || directionGap > 28
  })
  const outlierKeys = new Set(outlierModels.map((item) => item.model.key))
  let consensus = available.filter((item) => !outlierKeys.has(item.model.key))
  if (consensus.length < 2) consensus = available

  const consensusSpeeds = consensus.map((item) => item.speed as number)
  const consensusDirections = consensus.map((item) => item.direction as number)
  const meanSpeed = consensusSpeeds.reduce((sum, value) => sum + value, 0) / consensusSpeeds.length
  const meanDirection = circularMean(consensusDirections)
  const minSpeed = Math.min(...consensusSpeeds)
  const maxSpeed = Math.max(...consensusSpeeds)
  const speedSpread = maxSpeed - minSpeed
  const directionSpread = meanDirection == null ? 180 : Math.max(...consensusDirections.map((value) => angleGap(value, meanDirection)))

  const availabilityScore = available.length / Math.max(1, total) * 35
  const speedAgreementScore = Math.max(0, 35 - speedSpread * 7)
  const directionAgreementScore = Math.max(0, 30 - directionSpread)
  const confidenceScore = Math.round(Math.min(100, availabilityScore + speedAgreementScore + directionAgreementScore))
  const confidence: MultiModelSynthesis['confidence'] = confidenceScore >= 75 ? 'Élevée' : confidenceScore >= 52 ? 'Moyenne' : 'Faible'

  const strengthChanges: number[] = []
  const rotationChanges: number[] = []
  consensus.forEach((item) => {
    const first = timelineEdge(item, 'first')
    const last = timelineEdge(item, 'last')
    if (!first || !last || first.speed == null || last.speed == null || first.direction == null || last.direction == null) return
    strengthChanges.push(last.speed - first.speed)
    rotationChanges.push(signedAngleDelta(first.direction, last.direction))
  })

  const strengthDelta = strengthChanges.length ? strengthChanges.reduce((sum, value) => sum + value, 0) / strengthChanges.length : null
  const strengthTrend: MultiModelSynthesis['strengthTrend'] = strengthDelta == null ? 'incertaine' : strengthDelta > 1.5 ? 'renforcement' : strengthDelta < -1.5 ? 'affaiblissement' : 'stable'

  const meaningfulRotations = rotationChanges.filter((value) => Math.abs(value) >= 8)
  const rightCount = meaningfulRotations.filter((value) => value > 0).length
  const leftCount = meaningfulRotations.filter((value) => value < 0).length
  const rotationDelta = rotationChanges.length ? rotationChanges.reduce((sum, value) => sum + value, 0) / rotationChanges.length : null
  let rotationTrend: MultiModelSynthesis['rotationTrend'] = 'incertaine'
  if (rotationChanges.length) {
    if (rightCount > 0 && leftCount > 0) rotationTrend = 'partagée'
    else if (Math.abs(rotationDelta ?? 0) < 8) rotationTrend = 'stable'
    else rotationTrend = (rotationDelta ?? 0) > 0 ? 'droite' : 'gauche'
  }

  const outliers = outlierModels.map((item) => item.model.shortLabel)
  const consensusText = `${consensus.length} modèle${consensus.length > 1 ? 's' : ''} indépendant${consensus.length > 1 ? 's' : ''} sur ${available.length}`
  const speedText = `${round(minSpeed, 1).toString().replace('.', ',')}–${round(maxSpeed, 1).toString().replace('.', ',')} nd`
  const outlierText = outliers.length ? ` ${outliers.join(', ')} ${outliers.length > 1 ? 's’écartent' : 's’écarte'} du groupe.` : ''
  const headline = `${consensusText} convergent vers ${speedText}, autour de ${directionLabel(meanDirection)}. Confiance ${confidence.toLowerCase()} (${confidenceScore}/100).${outlierText}`

  const trendParts: string[] = []
  if (strengthTrend === 'renforcement') trendParts.push(`renforcement probable d’environ ${round(Math.abs(strengthDelta ?? 0), 1).toString().replace('.', ',')} nd sur la fenêtre`)
  else if (strengthTrend === 'affaiblissement') trendParts.push(`affaiblissement probable d’environ ${round(Math.abs(strengthDelta ?? 0), 1).toString().replace('.', ',')} nd sur la fenêtre`)
  else if (strengthTrend === 'stable') trendParts.push('force globalement stable sur la fenêtre')

  if (rotationTrend === 'droite') trendParts.push(`rotation moyenne à droite d’environ ${Math.round(Math.abs(rotationDelta ?? 0))}°`)
  else if (rotationTrend === 'gauche') trendParts.push(`rotation moyenne à gauche d’environ ${Math.round(Math.abs(rotationDelta ?? 0))}°`)
  else if (rotationTrend === 'partagée') trendParts.push('rotation non consensuelle entre les modèles')
  else if (rotationTrend === 'stable') trendParts.push('direction globalement stable')

  const advice = confidence === 'Élevée'
    ? `Signal modèle cohérent : ${trendParts.join(' ; ')}. Utiliser cette tendance comme scénario principal, puis ajuster avec le plan d’eau.`
    : confidence === 'Moyenne'
      ? `Tendance exploitable mais à confirmer : ${trendParts.join(' ; ')}. Donner davantage de poids au METAR, aux effets locaux et au relevé coach.`
      : `Dispersion significative : ${trendParts.join(' ; ')}. Ne pas verrouiller le briefing sur un seul modèle ; privilégier les observations et préparer plusieurs scénarios.`

  return {
    confidence, confidenceScore, independentAvailable: available.length, independentTotal: total,
    consensusCount: consensus.length, meanSpeed: round(meanSpeed, 1), meanDirection: meanDirection == null ? null : round(meanDirection),
    speedRange: [round(minSpeed, 1), round(maxSpeed, 1)], directionSpread: round(directionSpread), outliers,
    strengthTrend, strengthDelta: strengthDelta == null ? null : round(strengthDelta, 1),
    rotationTrend, rotationDelta: rotationDelta == null ? null : round(rotationDelta), headline, advice,
  }
}
