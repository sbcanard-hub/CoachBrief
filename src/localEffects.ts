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

const SAMPLE_BEARINGS = Array.from({ length: 16 }, (_, index) => index * 22.5)
const SAMPLE_DISTANCES_KM = [2, 5, 10]
const EARTH_RADIUS_KM = 6371

function toRadians(value: number) { return value * Math.PI / 180 }
function toDegrees(value: number) { return value * 180 / Math.PI }
function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, value)) }
function signedAngleDelta(from: number, to: number) { return ((to - from + 540) % 360) - 180 }
function angleGap(a: number, b: number) { return Math.abs(signedAngleDelta(a, b)) }

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
  const latitudes = points.map((point) => point.latitude.toFixed(5)).join(',')
  const longitudes = points.map((point) => point.longitude.toFixed(5)).join(',')
  const response = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${encodeURIComponent(latitudes)}&longitude=${encodeURIComponent(longitudes)}`)
  if (!response.ok) throw new Error('Relief indisponible pour ce plan d’eau')
  const payload = await response.json() as { elevation?: unknown[] }
  if (!Array.isArray(payload.elevation) || payload.elevation.length !== points.length) {
    throw new Error('Profil de relief incomplet')
  }
  return points.map((point, index) => ({
    bearing: point.bearing,
    distanceKm: point.distanceKm,
    elevation: safeElevation(payload.elevation?.[index]),
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
  const weights: Record<number, number> = { 2: 0.5, 5: 0.3, 10: 0.2 }
  let weightSum = 0
  let score = 0
  for (const point of points) {
    const weight = weights[point.distanceKm] ?? 0.2
    score += Math.min(point.elevation ?? 0, 1200) * weight
    weightSum += weight
  }
  return weightSum ? score / weightSum : null
}

function sectorElevations(samples: TerrainSample[], center: number, halfWidth: number) {
  return samples
    .filter((sample) => sample.elevation != null && angleGap(sample.bearing, center) <= halfWidth)
    .map((sample) => sample.elevation as number)
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
    ? clamp((sortedOpen[1].score - sortedOpen[0].score) / 100, 0, 1)
    : 0

  const upwindElevations = sectorElevations(samples, windDirection, 45)
  const upwindMaxElevation = upwindElevations.length ? Math.max(...upwindElevations) : null
  const upwindMeanElevation = mean(upwindElevations)
  const leftElevations = sectorElevations(samples, (windDirection + 270) % 360, 35)
  const rightElevations = sectorElevations(samples, (windDirection + 90) % 360, 35)
  const leftRelief = median(leftElevations)
  const rightRelief = median(rightElevations)

  let exposureLabel = 'Exposition au relief difficile à établir'
  if (upwindMaxElevation != null && upwindMeanElevation != null) {
    if (upwindMaxElevation >= 300 || upwindMeanElevation >= 160) exposureLabel = 'Sous influence marquée du relief au vent'
    else if (upwindMaxElevation >= 140 || upwindMeanElevation >= 80) exposureLabel = 'Partiellement abrité par le relief au vent'
    else exposureLabel = 'Secteur au vent plutôt ouvert'
  }

  const channelingPossible = leftRelief != null && rightRelief != null && upwindMeanElevation != null
    && leftRelief >= 120 && rightRelief >= 120 && upwindMeanElevation < Math.min(leftRelief, rightRelief) * 0.75
  const channelingLabel = channelingPossible
    ? 'Couloir de relief possible : accélération/canalisation à surveiller'
    : 'Pas de couloir de relief net détecté dans l’échantillonnage'

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
    else if (windVsOpenGap >= 120) thermalLabel += ` · le thermique peut s’opposer au vent synoptique`
    else thermalLabel += ' · interaction oblique avec le vent synoptique'
  }

  const effects: LocalEffect[] = []
  if (upwindMaxElevation != null && upwindMeanElevation != null) {
    if (upwindMaxElevation >= 300 || upwindMeanElevation >= 160) {
      effects.push({ title: 'Dévent / turbulence', level: 'fort', text: `Relief au vent jusqu’à ${Math.round(upwindMaxElevation)} m dans les 10 km. Attendre des molles, reprises et bascules sous le relief.` })
    } else if (upwindMaxElevation >= 140 || upwindMeanElevation >= 80) {
      effects.push({ title: 'Abri partiel', level: 'modéré', text: `Relief au vent perceptible (max. ${Math.round(upwindMaxElevation)} m). Le vent modèle peut être moins régulier sur le plan d’eau.` })
    } else {
      effects.push({ title: 'Exposition', level: 'faible', text: 'Peu de relief marqué dans le secteur d’où vient le vent : le vent modèle a moins de raisons d’être fortement déformé par l’orographie proche.' })
    }
  }

  if (channelingPossible) {
    effects.push({ title: 'Canalisation', level: 'modéré', text: 'Le relief ressort davantage sur les deux côtés du flux que dans son axe. Une accélération dans l’axe du couloir est plausible.' })
  }

  const gustSpread = gust - windSpeed
  if (gustSpread >= 5 && (upwindMaxElevation ?? 0) >= 120) {
    effects.push({ title: 'Irrégularité', level: gustSpread >= 8 ? 'fort' : 'modéré', text: `Écart rafale–moyen d’environ ${Math.round(gustSpread)} nd combiné au relief : privilégier l’observation des risées et des zones de pression.` })
  }

  if (thermalPotential) {
    effects.push({
      title: 'Thermique',
      level: thermalStrong ? 'fort' : 'modéré',
      text: waterTemperature == null ? thermalLabel : `${thermalLabel}. Écart air/eau ≈ ${airWaterDelta?.toFixed(1).replace('.', ',')}°C, nébulosité ${Math.round(weather.race.cloudCover)} %.` ,
    })
  }

  let confidence = 25
  if (elevationCoverage >= 0.95) confidence += 20
  else if (elevationCoverage >= 0.75) confidence += 10
  if ((terrainContrast ?? 0) >= 150) confidence += 20
  else if ((terrainContrast ?? 0) >= 60) confidence += 12
  else if ((terrainContrast ?? 0) >= 25) confidence += 6
  if (openBearingClarity >= 0.45) confidence += 10
  else if (openBearingClarity >= 0.2) confidence += 5
  if (waterTemperature != null) confidence += 10
  confidence = clamp(Math.round(confidence), 20, 85)

  let coachAdvice = 'Utiliser cette lecture comme couche d’interprétation du modèle et la confirmer sur l’eau.'
  if ((upwindMaxElevation ?? 0) >= 300) {
    coachAdvice = 'Priorité terrain : repérer avant le départ les zones de molle, les couloirs de risées et les bascules sous le relief. Ne pas appliquer une correction uniforme au modèle.'
  } else if (channelingPossible) {
    coachAdvice = 'Tester sur l’eau si l’axe du couloir concentre réellement la pression. Si oui, traiter la canalisation comme un effet local, pas comme une rotation générale du vent.'
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
    attribution: 'Relief : Copernicus DEM GLO-90 via Open-Meteo · analyse indicative, non appliquée automatiquement à la prévision.',
  }
}

export function localEffectBearingLabel(value: number | null) {
  return value == null ? '—' : `${formatDegrees(value)} · ${compassLabel(value)}`
}
