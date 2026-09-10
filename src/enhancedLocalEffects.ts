import { analyseLocalEffects } from './localEffects'
import type { LocalEffect, LocalEffectsAnalysis, TerrainSample } from './localEffects'
import type { BriefingRequest } from './types'
import type { LiveWeatherData } from './weather'
import { waterFetchForBearing } from './waterGeometry'
import type { WaterGeometryProfile } from './waterGeometry'

export type EnhancedLocalEffectsAnalysis = LocalEffectsAnalysis & {
  waterGeometry: WaterGeometryProfile
  upwindFetchKm: number | null
  waterExposureLabel: string
  waterInteractionLabel: string
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function signedAngleDelta(from: number, to: number) {
  return ((to - from + 540) % 360) - 180
}

function angleGap(a: number, b: number) {
  return Math.abs(signedAngleDelta(a, b))
}

function daylightWindow(request: BriefingRequest) {
  const clock = request.raceTime || request.startTime || '12:00'
  const hour = Number(clock.split(':')[0])
  return Number.isFinite(hour) && hour >= 9 && hour <= 18
}

function formatKm(value: number | null) {
  if (value == null) return '—'
  if (value >= 17.5) return '≥ 18 km'
  return `${value < 10 ? value.toFixed(1).replace('.', ',') : Math.round(value)} km`
}

export function analyseLocalEffectsWithWater(
  request: BriefingRequest,
  weather: LiveWeatherData,
  terrain: TerrainSample[],
  waterGeometry: WaterGeometryProfile,
): EnhancedLocalEffectsAnalysis {
  const base = analyseLocalEffects(request, weather, terrain)
  const windDirection = weather.race.direction
  const windSpeed = weather.race.speed
  const upwindFetchKm = waterFetchForBearing(waterGeometry, windDirection)
  const openGap = waterGeometry.openBearing == null ? null : angleGap(windDirection, waterGeometry.openBearing)
  const daylight = daylightWindow(request)
  const lightEnoughForLocalCirculation = daylight && weather.race.cloudCover <= 60 && windSpeed <= 14

  let waterExposureLabel = 'Ouverture au vent indéterminée'
  if (upwindFetchKm != null) {
    if (upwindFetchKm >= 14) waterExposureLabel = `Très grand fetch au vent · ${formatKm(upwindFetchKm)}`
    else if (upwindFetchKm >= 7) waterExposureLabel = `Fetch au vent important · ${formatKm(upwindFetchKm)}`
    else if (upwindFetchKm >= 3) waterExposureLabel = `Fetch au vent intermédiaire · ${formatKm(upwindFetchKm)}`
    else waterExposureLabel = `Rivage proche dans l’axe du vent · ${formatKm(upwindFetchKm)}`
  }

  let waterInteractionLabel = waterGeometry.shapeLabel
  if (waterGeometry.openBearing != null && waterGeometry.openBearingClarity >= 0.2 && openGap != null) {
    if (openGap <= 45) waterInteractionLabel += ' · vent venant du secteur le plus ouvert'
    else if (openGap >= 135) waterInteractionLabel += ' · vent venant du côté fermé / terrestre'
    else waterInteractionLabel += ' · vent travers au secteur d’ouverture principal'
  }

  const effects: LocalEffect[] = [...base.effects]
  if (upwindFetchKm != null) {
    if (upwindFetchKm < 2.5) {
      effects.unshift({
        title: 'Rivage au vent',
        level: 'fort',
        text: `Le rivage est détecté à environ ${formatKm(upwindFetchKm)} dans le secteur d’où vient le vent. Le flux peut arriver déformé par la côte, les bâtiments, la végétation ou le relief avant d’atteindre la zone de course.`,
      })
    } else if (upwindFetchKm < 6) {
      effects.unshift({
        title: 'Fetch limité',
        level: 'modéré',
        text: `Le vent ne traverse qu’environ ${formatKm(upwindFetchKm)} d’eau dans son axe avant la zone de course. Des effets de bord de rive peuvent encore peser sur la régularité du flux.`,
      })
    } else if (upwindFetchKm >= 12) {
      effects.unshift({
        title: 'Secteur au vent ouvert',
        level: 'faible',
        text: `Le vent dispose d’un fetch d’au moins ${formatKm(upwindFetchKm)}. La forme immédiate du rivage a moins de chances de perturber fortement le flux avant son arrivée sur le parcours.`,
      })
    }
  }

  if (waterGeometry.openBearing != null && waterGeometry.openBearingClarity >= 0.25) {
    const openDirection = `${String(Math.round(waterGeometry.openBearing)).padStart(3, '0')}°`
    if (lightEnoughForLocalCirculation && (openGap == null || openGap > 35)) {
      effects.push({
        title: 'Ouverture / thermique',
        level: windSpeed <= 9 && weather.race.cloudCover <= 40 ? 'fort' : 'modéré',
        text: `Le plan d’eau présente une ouverture dominante vers ${openDirection}. Avec l’ensoleillement et un vent synoptique modéré, surveiller une circulation locale qui chercherait à s’aligner progressivement avec ce secteur ouvert.`,
      })
    } else {
      effects.push({
        title: 'Géométrie du plan d’eau',
        level: 'faible',
        text: `L’ouverture principale du plan d’eau est détectée vers ${openDirection}. Cette information sert à interpréter les effets de côte, de fetch et de circulation locale.`,
      })
    }
  }

  let coachAdvice = base.coachAdvice
  if (upwindFetchKm != null && upwindFetchKm < 2.5) {
    coachAdvice = 'Priorité à la transition côte–plan d’eau : observer très tôt où le vent se réorganise après le rivage, puis comparer la pression et l’angle entre la zone proche de la côte et le centre du parcours.'
  } else if (waterGeometry.openBearing != null && waterGeometry.openBearingClarity >= 0.25 && lightEnoughForLocalCirculation) {
    coachAdvice = `Surveiller si le vent réel évolue vers le secteur d’ouverture ${String(Math.round(waterGeometry.openBearing)).padStart(3, '0')}°. Si la rotation s’accompagne d’un renforcement cohérent et durable, elle peut signaler une circulation locale plutôt qu’une simple oscillation.`
  } else if (upwindFetchKm != null && upwindFetchKm >= 12 && (base.upwindMaxElevation ?? 0) < 140) {
    coachAdvice = 'Le secteur au vent est à la fois assez ouvert sur l’eau et peu contraint par le relief proche : donner davantage de poids au scénario des modèles, tout en contrôlant les bascules réelles sur l’eau.'
  }

  let confidence = base.confidence
  if (waterGeometry.featureCount >= 3) confidence += 4
  if (waterGeometry.shorelineCoverage >= 0.45) confidence += 3
  if (waterGeometry.openBearingClarity >= 0.3) confidence += 3
  confidence = clamp(Math.round(confidence), 20, 90)

  return {
    ...base,
    confidence,
    confidenceLabel: confidence >= 75 ? 'bonne' : confidence >= 55 ? 'moyenne' : 'prudente',
    openBearing: waterGeometry.openBearing ?? base.openBearing,
    openBearingClarity: Math.max(base.openBearingClarity, waterGeometry.openBearingClarity),
    thermalLabel: lightEnoughForLocalCirculation && waterGeometry.openBearing != null && waterGeometry.openBearingClarity >= 0.25
      ? `${base.thermalLabel} · ouverture du plan d’eau intégrée`
      : base.thermalLabel,
    effects,
    coachAdvice,
    attribution: `${base.attribution} Rivages : © OpenStreetMap contributors via Overpass.`,
    waterGeometry,
    upwindFetchKm,
    waterExposureLabel,
    waterInteractionLabel,
  }
}
