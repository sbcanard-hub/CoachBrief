import { fetchElevations } from './elevation'
import type { BriefingRequest } from './types'
import type { LiveWeatherData } from './weather'

export type LocalEffectLevel = 'faible' | 'modéré' | 'fort'

export type LocalEffect = {
  title: string
  level: LocalEffectLevel
  text: string
}

export type TerrainSample = {
  bearing: number
  distanceKm: number
  elevation: number | null
}

export type LocalEffectsAnalysis = {
  confidence: number
  confidenceLabel: string
  elevationCoverage: number
  upwindMaxElevation: number | null
  upwindMeanElevation: number | null
  terrainContrast: number | null
  openBearing: number | null
  openBearingClarity: number
  exposureLabel: string
  thermalLabel: string
  channelingLabel: string
  effects: LocalEffect[]
  coachAdvice: string
  attribution: string
}

const SAMPLE_BEARINGS = Array.from({ length: 24 }, (_, index) => index * 15)
const SAMPLE_DISTANCES_KM = [1, 2, 5, 10]
const EARTH_RADIUS_KM = 6371

function toRadians(value: number) { return value * Math.PI / 180 }
function toDegrees(value: number) { return value * 180 / Math.PI }
function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, value)) }
function signedAngleDelta(from: number, to: number) { return ((to - from + 540) % 360) - 180 }
function angleGap(a: number, b: number) { return Math.abs(signedAngleDelta(a, b)) }
function normalize(value: number) { return ((value % 360) + 360) % 360 }

function destinationPoint(latitude: number, longitude: number, bearing: number, distanceKm: number) {
  const angularDistance = distanceKm / EARTH_RADIUS_KM
  const bearingRad = toRadians(bearing)
  const latitudeRad = toRadians(latitude)
  const longitudeRad = toRadians(longitude)
  const destinationLatitude = Math.asin(
    Math.sin(latitudeRad) * Math.cos(angularDistance)
    + Math.cos(latitudeRad) * Math.sin(angularDistance) * Math.cos(bearingRad),
  )
  const destinationLongitude = longitudeRad + Math.atan2(
    Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(latitudeRad),
    Math.cos(angularDistance) - Math.sin(latitudeRad) * Math.sin(destinationLatitude),
  )
  return {
    latitude: toDegrees(destinationLatitude),
    longitude: ((toDegrees(destinationLongitude) + 540) % 360) - 180,
  }
}

function safeElevation(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : null
}

export async function fetchTerrainSamples(latitude: number, longitude: number): Promise<TerrainSample[]> {
  const points = SAMPLE_BEARINGS.flatMap((bearing) => SAMPLE_DISTANCES_KM.map((distanceKm) => ({
    bearing,
    distanceKm,
    ...destinationPoint(latitude, longitude, bearing, distanceKm),
  })))
  const elevations = await fetchElevations(points)
  return points.map((point, index) => ({
    bearing: point.bearing,
    distanceKm: point.distanceKm,
    elevation: safeElevation(elevations[index]),
  }))
}

function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
}

function median(values: number[]) {
  if (!values.length) return null
  const ordered = [...values].sort((a, b) => a - b)
  const middle = Math.floor(ordered.length / 2)
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2
}

function bearingTerrainScore(samples: TerrainSample[], bearing: number) {
  const points = samples.filter((sample) => sample.bearing === bearing && sample.elevation != null)
  if (!points.length) return null
  const weights: Record<number, number> = { 1: 0.48, 2: 0.29, 5: 0.16, 10: 0.07 }
  let weightSum = 0
  let score = 0
  for (const point of points) {
    const weight = weights[point.distanceKm] ?? 0.05
    score += Math.min(point.elevation ?? 0, 1400) * weight
    weightSum += weight
  }
  return weightSum ? score / weightSum : null
}

function sectorElevations(samples: TerrainSample[], center: number, halfWidth: number, maxDistance = 10) {
  return samples
    .filter((sample) => sample.elevation != null && sample.distanceKm <= maxDistance && angleGap(sample.bearing, center) <= halfWidth)
    .map((sample) => sample.elevation as number)
}

function sectorMean(samples: TerrainSample[], center: number, halfWidth: number, maxDistance = 10) {
  return mean(sectorElevations(samples, center, halfWidth, maxDistance))
}

function nearElevation(samples: TerrainSample[], bearing: number, maxDistance = 2) {
  const points = samples.filter((sample) => sample.elevation != null && sample.distanceKm <= maxDistance && angleGap(sample.bearing, bearing) <= 15)
  if (!points.length) return null
  return Math.max(...points.map((sample) => sample.elevation as number))
}

function compassLabel(value: number | null) {
  if (value == null) return '—'
  const labels = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO']
  return labels[Math.round((((value % 360) + 360) % 360) / 22.5) % 16]
}

function formatDegrees(value: number | null) {
  return value == null ? '—' : `${String(Math.round(value)).padStart(3, '0')}°`
}

function confidenceLabel(score: number) {
  if (score >= 75) return 'bonne'
  if (score >= 55) return 'moyenne'
  return 'prudente'
}

type TerrainFeature = {
  bearing: number
  strength: number
  alignment: number
}

function detectValleyAxis(samples: TerrainSample[], windDirection: number): TerrainFeature | null {
  let best: TerrainFeature | null = null
  for (const bearing of SAMPLE_BEARINGS) {
    const center = bearingTerrainScore(samples, bearing)
    const left = bearingTerrainScore(samples, normalize(bearing - 30))
    const right = bearingTerrainScore(samples, normalize(bearing + 30))
    if (center == null || left == null || right == null) continue
    const shoulder = Math.min(left, right)
    const strength = shoulder - center
    if (strength < 45) continue
    const alignment = Math.min(angleGap(windDirection, bearing), angleGap(windDirection, normalize(bearing + 180)))
    if (!best || strength > best.strength) best = { bearing, strength, alignment }
  }
  return best
}

function detectNarrowRidge(samples: TerrainSample[], windDirection: number): TerrainFeature | null {
  let best: TerrainFeature | null = null
  for (const bearing of SAMPLE_BEARINGS) {
    const center = nearElevation(samples, bearing, 2)
    const left = nearElevation(samples, normalize(bearing - 30), 2)
    const right = nearElevation(samples, normalize(bearing + 30), 2)
    if (center == null || left == null || right == null) continue
    const surrounding = Math.max(left, right)
    const strength = center - surrounding
    if (strength < 55) continue
    const alignment = angleGap(windDirection, bearing)
    if (!best || strength > best.strength) best = { bearing, strength, alignment }
  }
  return best
}

export function analyseLocalEffects(
  request: BriefingRequest,
  weather: LiveWeatherData,
  samples: TerrainSample[],
): LocalEffectsAnalysis {
  const validElevations = samples.filter((sample) => sample.elevation != null)
  const elevationCoverage = samples.length ? validElevations.length / samples.length : 0
  const windDirection = weather.race.direction
  const windSpeed = weather.race.speed
  const gust = weather.race.gust

  const bearingScores = SAMPLE_BEARINGS
    .map((bearing) => ({ bearing, score: bearingTerrainScore(samples, bearing) }))
    .filter((entry): entry is { bearing: number; score: number } => entry.score != null)
  const scores = bearingScores.map((entry) => entry.score)
  const terrainContrast = scores.length >= 2 ? Math.max(...scores) - Math.min(...scores) : null
  const sortedOpen = [...bearingScores].sort((a, b) => a.score - b.score)
  const openBearing = sortedOpen[0]?.bearing ?? null
  const openBearingClarity = sortedOpen.length >= 2
    ? clamp((sortedOpen[1].score - sortedOpen[0].score) / 80, 0, 1)
    : 0

  const upwindElevations = sectorElevations(samples, windDirection, 35)
  const upwindNearElevations = sectorElevations(samples, windDirection, 30, 2)
  const upwindMaxElevation = upwindElevations.length ? Math.max(...upwindElevations) : null
  const upwindNearMax = upwindNearElevations.length ? Math.max(...upwindNearElevations) : null
  const upwindMeanElevation = mean(upwindElevations)
  const leftRelief = sectorMean(samples, (windDirection + 270) % 360, 30, 5)
  const rightRelief = sectorMean(samples, (windDirection + 90) % 360, 30, 5)

  let exposureLabel = 'Exposition au relief difficile à établir'
  if (upwindMaxElevation != null && upwindMeanElevation != null) {
    const nearSignal = upwindNearMax ?? 0
    if (nearSignal >= 180 || (upwindMaxElevation >= 350 && nearSignal >= 100)) exposureLabel = 'Sous influence marquée du relief proche au vent'
    else if (nearSignal >= 80 || upwindMeanElevation >= 110) exposureLabel = 'Partiellement abrité par le relief au vent'
    else if (upwindMaxElevation >= 350) exposureLabel = 'Relief régional présent mais influence directe à confirmer'
    else exposureLabel = 'Secteur au vent plutôt ouvert'
  }

  const valley = detectValleyAxis(samples, windDirection)
  const ridge = detectNarrowRidge(samples, windDirection)
  const valleyAligned = valley && valley.alignment <= 30
  const channelingPossible = Boolean(valleyAligned && valley && valley.strength >= 60)
  const channelingLabel = channelingPossible && valley
    ? `Vallée / couloir détecté vers ${formatDegrees(valley.bearing)} · alignement vent ${Math.round(valley.alignment)}°`
    : valley
      ? `Vallée possible vers ${formatDegrees(valley.bearing)}, mais vent peu aligné`
      : 'Pas de vallée ou couloir net détecté dans l’échantillonnage'

  const waterTemperature = weather.marine?.seaTemperature ?? null
  const airWaterDelta = waterTemperature == null ? null : weather.race.temperature - waterTemperature
  const daylightLike = (() => {
    const clock = request.raceTime || request.startTime || '12:00'
    const hour = Number(clock.split(':')[0])
    return Number.isFinite(hour) && hour >= 9 && hour <= 18
  })()
  const thermalPotential = airWaterDelta != null && daylightLike
    && airWaterDelta >= 2 && weather.race.cloudCover <= 60 && windSpeed <= 14
  const thermalStrong = thermalPotential && (airWaterDelta ?? 0) >= 4 && weather.race.cloudCover <= 35 && windSpeed <= 9
  const windVsOpenGap = openBearing == null ? null : angleGap(windDirection, openBearing)
  let thermalLabel = waterTemperature == null
    ? 'Thermique non évalué : température de l’eau indisponible'
    : !thermalPotential
      ? 'Signal thermique faible avec les données disponibles'
      : thermalStrong ? 'Potentiel thermique marqué' : 'Potentiel thermique présent'
  if (thermalPotential && windVsOpenGap != null && openBearingClarity >= 0.2) {
    if (windVsOpenGap <= 60) thermalLabel += ` · le vent vient du secteur ouvert ${compassLabel(openBearing)} : renforcement local possible`
    else if (windVsOpenGap >= 120) thermalLabel += ' · le thermique peut s’opposer au vent synoptique'
    else thermalLabel += ' · interaction oblique avec le vent synoptique'
  }

  const effects: LocalEffect[] = []
  if (upwindMaxElevation != null && upwindMeanElevation != null) {
    if ((upwindNearMax ?? 0) >= 180 || ((upwindNearMax ?? 0) >= 100 && upwindMaxElevation >= 350)) {
      effects.push({ title: 'Dévent / turbulence', level: 'fort', text: `Relief proche au vent jusqu’à ${Math.round(upwindNearMax ?? upwindMaxElevation)} m dans les 2 km. Risque crédible de molles, reprises et bascules sous le relief.` })
    } else if ((upwindNearMax ?? 0) >= 80 || upwindMeanElevation >= 110) {
      effects.push({ title: 'Abri partiel', level: 'modéré', text: `Relief au vent suffisamment proche pour perturber le flux. Le vent modèle peut être moins régulier localement.` })
    } else if (upwindMaxElevation >= 350) {
      effects.push({ title: 'Relief régional', level: 'faible', text: `Relief élevé détecté plus loin dans le secteur au vent (max. ${Math.round(upwindMaxElevation)} m), mais sans obstacle proche suffisant pour conclure à un dévent fort sur le parcours.` })
    } else {
      effects.push({ title: 'Exposition', level: 'faible', text: 'Peu de relief marqué et proche dans le secteur d’où vient le vent : le flux a moins de raisons d’être fortement déformé par l’orographie immédiate.' })
    }
  }

  if (valley) {
    if (valleyAligned) {
      const level: LocalEffectLevel = valley.strength >= 120 && windSpeed >= 6 ? 'fort' : 'modéré'
      effects.push({ title: 'Vallée / Venturi', level, text: `Axe bas détecté vers ${formatDegrees(valley.bearing)}, encadré par des reliefs plus hauts (contraste ≈ ${Math.round(valley.strength)} m). Le vent est aligné à ${Math.round(valley.alignment)}° : canalisation et accélération possibles dans l’axe du couloir.` })
    } else {
      effects.push({ title: 'Vallée', level: 'faible', text: `Axe de vallée possible vers ${formatDegrees(valley.bearing)}, mais le vent actuel est décalé d’environ ${Math.round(valley.alignment)}° : effet de canalisation limité pour l’instant.` })
    }
  }

  if (ridge && ridge.alignment <= 45) {
    effects.push({
      title: 'Cap / pointe de relief',
      level: ridge.strength >= 110 ? 'fort' : 'modéré',
      text: `Saillie de relief proche vers ${formatDegrees(ridge.bearing)} (contraste ≈ ${Math.round(ridge.strength)} m) dans le secteur au vent. Surveiller accélération sur les bords exposés et dévent/turbulence dans son sillage.`,
    })
  }

  if (leftRelief != null && rightRelief != null) {
    const crossContrast = Math.abs(leftRelief - rightRelief)
    if (crossContrast >= 90) {
      effects.push({
        title: 'Dissymétrie latérale',
        level: crossContrast >= 160 ? 'fort' : 'modéré',
        text: `Contraste de relief marqué entre les deux côtés du flux (≈ ${Math.round(crossContrast)} m). Un côté du plan d’eau peut être davantage déventé ou accéléré que l’autre : à confirmer avec les risées réelles.`,
      })
    }
  }

  const gustSpread = gust - windSpeed
  if (gustSpread >= 5 && ((upwindNearMax ?? 0) >= 80 || channelingPossible)) {
    effects.push({ title: 'Irrégularité', level: gustSpread >= 8 ? 'fort' : 'modéré', text: `Écart rafale–moyen d’environ ${Math.round(gustSpread)} nd combiné au relief proche : privilégier l’observation des risées et des zones de pression.` })
  }

  if (thermalPotential) {
    effects.push({
      title: 'Thermique',
      level: thermalStrong ? 'fort' : 'modéré',
      text: `${thermalLabel}. Écart air/eau ≈ ${airWaterDelta?.toFixed(1).replace('.', ',')}°C, nébulosité ${Math.round(weather.race.cloudCover)} %.`,
    })
  }

  let confidence = 25
  if (elevationCoverage >= 0.95) confidence += 20
  else if (elevationCoverage >= 0.75) confidence += 10
  if ((terrainContrast ?? 0) >= 150) confidence += 16
  else if ((terrainContrast ?? 0) >= 60) confidence += 10
  else if ((terrainContrast ?? 0) >= 25) confidence += 5
  if (valley && valley.strength >= 80) confidence += 8
  if (ridge && ridge.strength >= 80) confidence += 6
  if (openBearingClarity >= 0.45) confidence += 8
  else if (openBearingClarity >= 0.2) confidence += 4
  if (waterTemperature != null) confidence += 8
  confidence = clamp(Math.round(confidence), 20, 88)

  let coachAdvice = 'Utiliser cette lecture comme couche d’interprétation du modèle et la confirmer sur l’eau.'
  if (valleyAligned && valley) {
    coachAdvice = `Priorité au couloir détecté vers ${formatDegrees(valley.bearing)} : comparer pression et angle dans l’axe de la vallée et sur ses deux bords. Si l’accélération est stable, traiter le Venturi comme un effet local structurant.`
  } else if (ridge && ridge.alignment <= 45) {
    coachAdvice = `Tester l’effet de la pointe vers ${formatDegrees(ridge.bearing)} : pression renforcée sur le bord exposé, zone plus molle et instable sous le vent. Ne pas extrapoler cet effet à tout le plan d’eau.`
  } else if ((upwindNearMax ?? 0) >= 180) {
    coachAdvice = 'Priorité terrain : repérer avant le départ les zones de molle, les couloirs de risées et les bascules sous le relief proche. Ne pas appliquer une correction uniforme au modèle.'
  } else if (thermalPotential) {
    coachAdvice = 'Surveiller l’installation du thermique par séquences : évolution de la direction, hausse de la pression dans les risées et cohérence avec le secteur ouvert détecté.'
  }

  return {
    confidence,
    confidenceLabel: confidenceLabel(confidence),
    elevationCoverage,
    upwindMaxElevation,
    upwindMeanElevation,
    terrainContrast,
    openBearing,
    openBearingClarity,
    exposureLabel,
    thermalLabel,
    channelingLabel,
    effects,
    coachAdvice,
    attribution: 'Relief : Copernicus DEM GLO-90 via Open-Meteo · analyse multi-échelle 1/2/5/10 km, indicative et à confirmer sur l’eau.',
  }
}

export function localEffectBearingLabel(value: number | null) {
  return value == null ? '—' : `${formatDegrees(value)} · ${compassLabel(value)}`
}
