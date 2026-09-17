export type CurrentHour = {
  time: string
  speed: number | null
  direction: number | null
}

export type CurrentPhase = 'étale' | 'renforcement' | 'plein courant' | 'affaiblissement' | 'indéterminé'
export type CurrentInfluenceLevel = 'faible' | 'modéré' | 'fort'

export type BathymetrySample = {
  bearing: number
  distanceKm: number
  depth: number | null
}

export type BathymetryCurrentContext = {
  available: boolean
  source: 'EMODnet Bathymetry DTM'
  centreDepth: number | null
  minDepth: number | null
  maxDepth: number | null
  depthRange: number | null
  contrastRatio: number | null
  deepestBearing: number | null
  shallowestBearing: number | null
  currentAlignmentGap: number | null
  influence: CurrentInfluenceLevel
  note: string
  samples: BathymetrySample[]
}

export type TidalCurrentAnalysis = {
  phase: CurrentPhase
  trendText: string
  raceSpeed: number | null
  raceDirection: number | null
  maxSpeed: number | null
  maxTime: string | null
  nextSlackTime: string | null
  nextReversalTime: string | null
  minutesToMax: number | null
  minutesToSlack: number | null
  crossCourse: number | null
  tacticalWeight: number
  shomAtlasRelevant: boolean
  shomRegionLabel: string | null
}

const EARTH_RADIUS_KM = 6371
const SAMPLE_BEARINGS = Array.from({ length: 8 }, (_, index) => index * 45)

function radians(value: number) { return value * Math.PI / 180 }
function degrees(value: number) { return value * 180 / Math.PI }
function normalize(value: number) { return ((value % 360) + 360) % 360 }
function signedAngleDelta(from: number, to: number) { return ((to - from + 540) % 360) - 180 }
function angleGap(a: number, b: number) { return Math.abs(signedAngleDelta(a, b)) }
function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, value)) }

function destination(latitude: number, longitude: number, bearing: number, distanceKm: number) {
  const angular = distanceKm / EARTH_RADIUS_KM
  const direction = radians(normalize(bearing))
  const lat1 = radians(latitude)
  const lon1 = radians(longitude)
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(direction))
  const lon2 = lon1 + Math.atan2(Math.sin(direction) * Math.sin(angular) * Math.cos(lat1), Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2))
  return { latitude: degrees(lat2), longitude: degrees(lon2) }
}

function minuteOfDay(value: string) {
  const clock = value.includes('T') ? value.split('T')[1] : value
  const [hour, minute] = clock.split(':').map(Number)
  return (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0)
}

function nearestIndex(hours: CurrentHour[], clock: string) {
  const target = minuteOfDay(clock)
  let best = 0
  let gap = Number.POSITIVE_INFINITY
  hours.forEach((hour, index) => {
    const candidate = Math.abs(minuteOfDay(hour.time) - target)
    if (candidate < gap) { gap = candidate; best = index }
  })
  return best
}

function shomRegion(latitude: number, longitude: number) {
  const metropolitanAtlantic = latitude >= 43 && latitude <= 51.8 && longitude >= -6.5 && longitude <= 2.5
  if (!metropolitanAtlantic) return null
  if (latitude >= 48.2 && longitude <= -1.2) return 'Bretagne Nord / Manche ouest'
  if (latitude >= 48.2) return 'Manche / Golfe normand-breton / Pas-de-Calais'
  if (latitude >= 46.8 && longitude <= -1.0) return 'Finistère / Bretagne sud'
  return 'Atlantique / Gascogne'
}

export function analyseTidalCurrent(
  hours: CurrentHour[],
  raceTime: string,
  courseAxis: number,
  latitude: number,
  longitude: number,
): TidalCurrentAnalysis {
  const usable = hours.filter((hour) => hour.speed != null && hour.direction != null)
  const region = shomRegion(latitude, longitude)
  if (!usable.length) {
    return { phase: 'indéterminé', trendText: 'Courant horaire indisponible.', raceSpeed: null, raceDirection: null, maxSpeed: null, maxTime: null, nextSlackTime: null, nextReversalTime: null, minutesToMax: null, minutesToSlack: null, crossCourse: null, tacticalWeight: 0, shomAtlasRelevant: Boolean(region), shomRegionLabel: region }
  }

  const index = nearestIndex(usable, raceTime)
  const current = usable[index]
  const previous = usable[Math.max(0, index - 1)]
  const next = usable[Math.min(usable.length - 1, index + 1)]
  const speeds = usable.map((hour) => hour.speed as number)
  const maxSpeed = Math.max(...speeds)
  const maxIndex = speeds.indexOf(maxSpeed)
  const slackThreshold = Math.max(0.12, maxSpeed * 0.2)
  const currentSpeed = current.speed as number
  const speedDelta = (next.speed as number) - (previous.speed as number)
  const closeToMax = maxSpeed > 0 && currentSpeed >= maxSpeed * 0.85

  let phase: CurrentPhase = 'indéterminé'
  if (currentSpeed <= slackThreshold) phase = 'étale'
  else if (closeToMax) phase = 'plein courant'
  else if (speedDelta > Math.max(0.08, maxSpeed * 0.08)) phase = 'renforcement'
  else if (speedDelta < -Math.max(0.08, maxSpeed * 0.08)) phase = 'affaiblissement'
  else phase = 'plein courant'

  const raceMinutes = minuteOfDay(current.time)
  const future = usable.slice(index + 1)
  const nextSlack = future.find((hour) => (hour.speed as number) <= slackThreshold) ?? null
  let nextReversal: CurrentHour | null = null
  for (let offset = index + 1; offset < usable.length; offset += 1) {
    const candidate = usable[offset]
    if (angleGap(candidate.direction as number, current.direction as number) >= 120) { nextReversal = candidate; break }
  }

  const maxTime = usable[maxIndex]?.time ?? null
  const minutesToMax = maxTime == null ? null : minuteOfDay(maxTime) - raceMinutes
  const minutesToSlack = nextSlack == null ? null : minuteOfDay(nextSlack.time) - raceMinutes
  const relative = signedAngleDelta(courseAxis, current.direction as number)
  const crossCourse = Math.sin(radians(relative)) * currentSpeed
  const phaseWeight = phase === 'plein courant' ? 2 : phase === 'renforcement' ? 1.5 : phase === 'affaiblissement' ? 1 : phase === 'étale' ? 0.2 : 0
  const tacticalWeight = clamp(currentSpeed * 2.2 + Math.abs(crossCourse) * 2 + phaseWeight, 0, 8)

  const trendText = phase === 'étale'
    ? 'Courant proche de l’étale : surveiller surtout le sens d’établissement après la renverse.'
    : phase === 'renforcement'
      ? 'Courant en renforcement : son poids tactique augmentera pendant la manche.'
      : phase === 'affaiblissement'
        ? 'Courant en affaiblissement : l’avantage courant peut diminuer au fil de la manche.'
        : 'Plein courant ou plateau de courant : effet tactique potentiellement structurant.'

  return {
    phase,
    trendText,
    raceSpeed: currentSpeed,
    raceDirection: current.direction,
    maxSpeed,
    maxTime,
    nextSlackTime: nextSlack?.time ?? null,
    nextReversalTime: nextReversal?.time ?? null,
    minutesToMax,
    minutesToSlack,
    crossCourse,
    tacticalWeight,
    shomAtlasRelevant: Boolean(region),
    shomRegionLabel: region,
  }
}

async function fetchDepth(latitude: number, longitude: number) {
  const geom = `POINT(${longitude.toFixed(6)} ${latitude.toFixed(6)})`
  try {
    const response = await fetch(`https://rest.emodnet-bathymetry.eu/depth_sample?geom=${encodeURIComponent(geom)}`)
    if (!response.ok) return null
    const data = await response.json() as { avg?: number; smoothed?: number }
    const depth = typeof data.smoothed === 'number' ? data.smoothed : typeof data.avg === 'number' ? data.avg : null
    return depth == null || !Number.isFinite(depth) ? null : Math.abs(depth)
  } catch {
    return null
  }
}

export async function fetchBathymetryCurrentContext(
  latitude: number,
  longitude: number,
  currentDirection: number | null,
): Promise<BathymetryCurrentContext> {
  const centreDepthPromise = fetchDepth(latitude, longitude)
  const samplePromises = SAMPLE_BEARINGS.map(async (bearing): Promise<BathymetrySample> => {
    const point = destination(latitude, longitude, bearing, 1.0)
    return { bearing, distanceKm: 1, depth: await fetchDepth(point.latitude, point.longitude) }
  })
  const [centreDepth, samples] = await Promise.all([centreDepthPromise, Promise.all(samplePromises)])
  const valid = samples.filter((sample): sample is BathymetrySample & { depth: number } => sample.depth != null)
  if (valid.length < 4) {
    return { available: false, source: 'EMODnet Bathymetry DTM', centreDepth, minDepth: null, maxDepth: null, depthRange: null, contrastRatio: null, deepestBearing: null, shallowestBearing: null, currentAlignmentGap: null, influence: 'faible', note: 'Bathymétrie insuffisante autour du parcours pour estimer un effet de fond.', samples }
  }

  const deepest = [...valid].sort((a, b) => b.depth - a.depth)[0]
  const shallowest = [...valid].sort((a, b) => a.depth - b.depth)[0]
  const minDepth = shallowest.depth
  const maxDepth = deepest.depth
  const depthRange = maxDepth - minDepth
  const referenceDepth = centreDepth ?? valid.reduce((sum, sample) => sum + sample.depth, 0) / valid.length
  const contrastRatio = depthRange / Math.max(2, referenceDepth)
  const currentAlignmentGap = currentDirection == null ? null : Math.min(angleGap(currentDirection, deepest.bearing), angleGap(currentDirection, normalize(deepest.bearing + 180)))

  let influence: CurrentInfluenceLevel = 'faible'
  if (contrastRatio >= .55 && (currentAlignmentGap == null || currentAlignmentGap <= 35)) influence = 'fort'
  else if (contrastRatio >= .25) influence = 'modéré'

  const note = influence === 'fort'
    ? `Fort contraste de profondeur autour du parcours (${Math.round(minDepth)}–${Math.round(maxDepth)} m). Le courant est proche de l’axe du couloir profond : veine accélérée et différences de vitesse entre lignes de fond à vérifier sur l’eau.`
    : influence === 'modéré'
      ? `Contraste de fond sensible (${Math.round(minDepth)}–${Math.round(maxDepth)} m). Les zones plus profondes peuvent canaliser davantage le courant tandis que les hauts-fonds augmentent le frottement ; ne pas appliquer une vitesse uniforme à tout le parcours.`
      : `Fond relativement homogène à l’échelle d’environ 1 km (${Math.round(minDepth)}–${Math.round(maxDepth)} m) : effet bathymétrique local probablement secondaire.`

  return {
    available: true,
    source: 'EMODnet Bathymetry DTM',
    centreDepth,
    minDepth,
    maxDepth,
    depthRange,
    contrastRatio,
    deepestBearing: deepest.bearing,
    shallowestBearing: shallowest.bearing,
    currentAlignmentGap,
    influence,
    note,
    samples,
  }
}
