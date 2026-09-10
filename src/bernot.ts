import type { BriefingRequest, StartLineBias } from './types'

export const bernotColumns = ['Gauche', 'Centre G.', 'Centre', 'Centre D.', 'Droite'] as const
export type BernotZone = (typeof bernotColumns)[number]

export type WeatherScenario = {
  windStart: number
  windEnd: number
  oscillation: number
  raceWindSpeed: number
  maxWindSpeed: number
  cloudCover: number
  waveHeight: number
}

export type BernotRow = {
  factor: string
  priority: number
  zone: BernotZone
  note: string
  score: number
}

export type CoachRecommendation = {
  title: string
  text: string
  why: string
}

export const mockWeatherScenario: WeatherScenario = {
  windStart: 80,
  windEnd: 110,
  oscillation: 8,
  raceWindSpeed: 11,
  maxWindSpeed: 14,
  cloudCover: 25,
  waveHeight: 0.6,
}

function numberOr(value: string | undefined, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function zoneFromSigned(value: number): BernotZone {
  if (value <= -15) return 'Gauche'
  if (value < -3) return 'Centre G.'
  if (value >= 15) return 'Droite'
  if (value > 3) return 'Centre D.'
  return 'Centre'
}

function lineBiasValue(bias: StartLineBias | undefined) {
  if (bias === 'Pin') return -12
  if (bias === 'Comité') return 12
  return 0
}

function lineBiasZone(bias: StartLineBias | undefined): BernotZone {
  if (bias === 'Pin') return 'Gauche'
  if (bias === 'Comité') return 'Droite'
  return 'Centre'
}

function signedLabel(value: number) {
  if (value === 0) return 'neutre'
  return `${value > 0 ? '+' : ''}${value}° vers la ${value > 0 ? 'droite' : 'gauche'}`
}

export function buildBernotRows(request: BriefingRequest | null, weather: WeatherScenario = mockWeatherScenario): BernotRow[] {
  const windDelta = weather.windEnd - weather.windStart
  const windwardOffset = numberOr(request?.windwardOffset)
  const lineBias = request?.startLineBias
  const tacticalVector = windwardOffset + lineBiasValue(lineBias)
  const hasLocation = Boolean(request?.location.trim())

  const rows: Omit<BernotRow, 'priority'>[] = [
    {
      factor: 'Vent',
      score: 9 + Math.abs(windDelta) / 8 + weather.oscillation / 5,
      zone: zoneFromSigned(windDelta),
      note: windDelta === 0
        ? `Vent sans rotation nette, oscillation ±${weather.oscillation}°.`
        : `Rotation de ${Math.abs(windDelta)}° vers la ${windDelta > 0 ? 'droite' : 'gauche'}, oscillation ±${weather.oscillation}°.` ,
    },
    {
      factor: 'Axe parcours',
      score: 6 + Math.abs(windwardOffset) / 3 + (lineBias === 'Neutre' || !lineBias ? 0 : 1.5),
      zone: zoneFromSigned(tacticalVector),
      note: `Bouée au vent ${signedLabel(windwardOffset)}${lineBias && lineBias !== 'Neutre' ? ` · ligne favorable ${lineBias}` : ''}.`,
    },
    {
      factor: 'Vagues',
      score: 4 + weather.waveHeight * 3 + Math.max(0, weather.maxWindSpeed - weather.raceWindSpeed) / 2,
      zone: 'Centre',
      note: `${weather.waveHeight.toFixed(1).replace('.', ',')} m dans la maquette ; impact surtout sur vitesse et conduite.` ,
    },
    {
      factor: 'Relief / côte',
      score: hasLocation ? 5 : 2,
      zone: 'Centre',
      note: hasLocation
        ? `Effets locaux à confirmer sur ${request?.location} avec observations et relief.`
        : 'Lieu non renseigné : effet de côte non évalué.',
    },
    {
      factor: 'Nuages',
      score: 2.5 + weather.cloudCover / 25,
      zone: weather.cloudCover >= 60 ? zoneFromSigned(windDelta) : 'Centre',
      note: `${weather.cloudCover}% de nébulosité dans la maquette ; influence ${weather.cloudCover >= 60 ? 'à surveiller' : 'secondaire'}.`,
    },
    {
      factor: 'Adversaires',
      score: lineBias && lineBias !== 'Neutre' ? 4.8 : 3.2,
      zone: lineBiasZone(lineBias),
      note: lineBias && lineBias !== 'Neutre'
        ? `Extrémité ${lineBias} favorable : intégrer densité de flotte et voie de sortie.`
        : 'Ligne neutre : la position de flotte devient surtout une contrainte de sortie.',
    },
    {
      factor: 'Courant',
      score: 2.8,
      zone: 'Centre',
      note: 'Courant non renseigné pour l’instant : facteur volontairement dépriorisé.',
    },
  ]

  return rows
    .sort((a, b) => b.score - a.score)
    .map((row, index) => ({ ...row, priority: index + 1 }))
}

export function buildCoachRecommendations(request: BriefingRequest | null, weather: WeatherScenario = mockWeatherScenario): CoachRecommendation[] {
  const windDelta = weather.windEnd - weather.windStart
  const windwardOffset = numberOr(request?.windwardOffset)
  const lineBias = request?.startLineBias ?? 'Neutre'
  const courseAxis = numberOr(request?.courseAxis, weather.windStart)

  const windRecommendation: CoachRecommendation = Math.abs(windDelta) <= 5
    ? {
        title: 'Jouer les oscillations plutôt qu’une rotation générale',
        text: `Le vent reste globalement autour de l’axe, avec une oscillation prévue de ±${weather.oscillation}°.` ,
        why: 'Quand la tendance générale est faible, la valeur vient surtout du bon timing des bascules et de la capacité à rester libre.',
      }
    : {
        title: `Garder une option vers la ${windDelta > 0 ? 'droite' : 'gauche'}`,
        text: `La maquette fait évoluer le vent de ${String(weather.windStart).padStart(3, '0')}° à ${String(weather.windEnd).padStart(3, '0')}°.` ,
        why: `La rotation générale est de ${Math.abs(windDelta)}°. Il faut conserver une voie qui permette de bénéficier de cette tendance sans s’enfermer trop tôt au bord du plan d’eau.`,
      }

  const lineRecommendation: CoachRecommendation = lineBias === 'Neutre'
    ? {
        title: 'Départ : privilégier la voie de sortie',
        text: 'La ligne est saisie comme neutre : le placement doit surtout servir le premier bord choisi.',
        why: 'Sans avantage géométrique net à une extrémité, l’espace, la vitesse au signal et la possibilité de virer deviennent prioritaires.',
      }
    : {
        title: `Départ : avantage ${lineBias}`,
        text: `L’extrémité ${lineBias} est indiquée favorable, mais elle doit rester compatible avec le bord recherché après le départ.` ,
        why: 'Une extrémité favorable peut être très chargée. Le gain de ligne doit être comparé au risque de trafic et à la possibilité de sortir rapidement vers la zone tactique visée.',
      }

  const geometryRecommendation: CoachRecommendation = Math.abs(windwardOffset) >= 4
    ? {
        title: `Bouée au vent décalée vers la ${windwardOffset > 0 ? 'droite' : 'gauche'}`,
        text: `Le désaxage saisi est de ${signedLabel(windwardOffset)} par rapport à l’axe ${String(Math.round(courseAxis)).padStart(3, '0')}°.` ,
        why: 'Un désaxage modifie la longueur relative des laylines et peut renforcer ou réduire l’intérêt d’un côté du plan d’eau. Il faut le croiser avec la rotation du vent.',
      }
    : {
        title: 'Parcours presque dans l’axe',
        text: `Le désaxage de la bouée au vent est faible par rapport à l’axe ${String(Math.round(courseAxis)).padStart(3, '0')}°.` ,
        why: 'Avec une géométrie proche de l’axe, les décisions tactiques peuvent davantage se concentrer sur le vent, le courant et la flotte.',
      }

  return [windRecommendation, lineRecommendation, geometryRecommendation]
}
