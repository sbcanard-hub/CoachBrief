import type { OffshorePoint } from './offshore'
import { distanceAndBearing } from './offshore'
import { evaluateOffshoreSegment, fetchOffshoreConstraintProfile, wavePerformanceFactor } from './offshoreConstraints'
import { fetchOffshorePointForecast } from './offshoreForecast'
import { minimumSailableTwa, polarSpeed, trueWindAngle, type PolarTable } from './offshorePolar'
import { fetchShomCurrentAtTime } from './shomCurrentGrid'
import type { ShomHighWaterSchedules } from './shomHighWater'

export type IsochroneNode = {
  latitude: number
  longitude: number
  time: string
  heading: number
  boatSpeed: number
  polarSpeed: number
  waveFactor: number
  groundSpeed: number
  windSpeed: number | null
  windDirection: number | null
  waveHeight: number | null
  waveDirection: number | null
  currentSpeed: number | null
  currentDirection: number | null
  currentSource: 'shom' | 'open-meteo' | 'none'
  tssCrossing: boolean
  parent?: IsochroneNode
}

export type IsochroneStep = { time: string; nodes: IsochroneNode[] }
export type IsochroneResult = {
  steps: IsochroneStep[]
  bestRoute: IsochroneNode[]
  reached: boolean
  eta: string | null
  note: string
  blockedLandCandidates: number
  tssCrossingCandidates: number
  constraintsAvailable: boolean
  constraintsNote: string
  shomCurrentSamples: number
  fallbackCurrentSamples: number
  shomAtlasLabels: string[]
  shomScheduledReferenceSamples: number
  shomPropagatedReferenceSamples: number
}

type ExpansionResult = {
  candidates: IsochroneNode[]
  reached: IsochroneNode | null
  blockedLandCandidates: number
  tssCrossingCandidates: number
  shomCurrentSamples: number
  fallbackCurrentSamples: number
  shomScheduledReferenceSamples: number
  shomPropagatedReferenceSamples: number
  shomAtlasLabels: string[]
}

const EARTH_RADIUS_NM = 3440.065
const NODE_CONCURRENCY = 6
const DETOUR_HEADING_SPREAD = 150
const DETOUR_MAX_NODES = 20
const PRUNE_SECTOR_DEGREES = 15
const PRUNE_NODES_PER_SECTOR = 2
const DEFAULT_BUDGET_MS = 25_000
const SOFT_BUDGET_RATIO = .58
const SOFT_MAX_NODES = 12
const SOFT_HEADING_STEP = 30
const COURSE_CHANGE_FREE = 75
const COURSE_CHANGE_STRONG = 125
const ROUTE_HISTORY_SKIP = 3
const ROUTE_REVISIT_RADIUS_NM = 2.5
const ROUTE_REVISIT_PENALTY = 18
const ROUTE_CROSSING_PENALTY = 28
const ROUTE_PROGRESS_SLACK_NM = 3

function rad(v: number) { return v * Math.PI / 180 }
function deg(v: number) { return v * 180 / Math.PI }
function norm(v: number) { return ((v % 360) + 360) % 360 }
function angleDiff(a: number, b: number) { return Math.abs((((a - b) % 360) + 540) % 360 - 180) }

function advance(latitude: number, longitude: number, bearing: number, distanceNm: number) {
  const d = distanceNm / EARTH_RADIUS_NM
  const brg = rad(bearing)
  const lat1 = rad(latitude)
  const lon1 = rad(longitude)
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brg))
  const lon2 = lon1 + Math.atan2(Math.sin(brg) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2))
  return { latitude: deg(lat2), longitude: ((deg(lon2) + 540) % 360) - 180 }
}

function addCurrent(heading: number, boatSpeed: number, currentSpeed: number | null, currentDirection: number | null) {
  const cur = currentSpeed ?? 0
  const curDir = currentDirection ?? 0
  const east = boatSpeed * Math.sin(rad(heading)) + cur * Math.sin(rad(curDir))
  const north = boatSpeed * Math.cos(rad(heading)) + cur * Math.cos(rad(curDir))
  return { speed: Math.hypot(east, north), bearing: norm(deg(Math.atan2(east, north))) }
}

function asPoint(node: Pick<IsochroneNode, 'latitude' | 'longitude'>, name = 'N'): OffshorePoint {
  return { id: name, name, latitude: String(node.latitude), longitude: String(node.longitude) }
}

function orientation(a: IsochroneNode, b: IsochroneNode, c: IsochroneNode) {
  return (b.longitude - a.longitude) * (c.latitude - a.latitude) - (b.latitude - a.latitude) * (c.longitude - a.longitude)
}

function routeSegmentsCross(a: IsochroneNode, b: IsochroneNode, c: IsochroneNode, d: IsochroneNode) {
  const o1 = orientation(a, b, c)
  const o2 = orientation(a, b, d)
  const o3 = orientation(c, d, a)
  const o4 = orientation(c, d, b)
  const epsilon = 1e-10
  if (Math.abs(o1) < epsilon || Math.abs(o2) < epsilon || Math.abs(o3) < epsilon || Math.abs(o4) < epsilon) return false
  return (o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0)
}

function trajectoryPenalty(node: IsochroneNode, target: OffshorePoint) {
  const remaining = distanceAndBearing(asPoint(node), target).distanceNm
  let bestHistoricalRemaining = remaining
  let penalty = 0
  let depth = 0
  let cursor = node.parent

  while (cursor) {
    const cursorRemaining = distanceAndBearing(asPoint(cursor), target).distanceNm
    bestHistoricalRemaining = Math.min(bestHistoricalRemaining, cursorRemaining)

    if (depth >= ROUTE_HISTORY_SKIP) {
      const revisitDistance = distanceAndBearing(asPoint(node), asPoint(cursor, 'H')).distanceNm
      if (revisitDistance < ROUTE_REVISIT_RADIUS_NM) {
        penalty += ROUTE_REVISIT_PENALTY * (1 - revisitDistance / ROUTE_REVISIT_RADIUS_NM)
      }
      if (node.parent && cursor.parent && routeSegmentsCross(node.parent, node, cursor.parent, cursor)) {
        penalty += ROUTE_CROSSING_PENALTY
      }
    }

    cursor = cursor.parent
    depth += 1
  }

  const lostProgress = Math.max(0, remaining - bestHistoricalRemaining - ROUTE_PROGRESS_SLACK_NM)
  penalty += lostProgress * 2.8
  return penalty
}

function routeScore(node: IsochroneNode, target: OffshorePoint) {
  const remaining = distanceAndBearing(asPoint(node), target).distanceNm
  let score = remaining + (node.tssCrossing ? 12 : 0) + trajectoryPenalty(node, target)

  if (node.parent) {
    const parentRemaining = distanceAndBearing(asPoint(node.parent), target).distanceNm
    const regression = Math.max(0, remaining - parentRemaining)
    score += regression * 1.6

    if (node.parent.parent) {
      const turn = angleDiff(node.heading, node.parent.heading)
      if (turn > COURSE_CHANGE_FREE) score += (turn - COURSE_CHANGE_FREE) * 0.035
      if (turn > COURSE_CHANGE_STRONG) score += 5
    }
  }
  return score
}

function prune(nodes: IsochroneNode[], target: OffshorePoint, maxNodes: number) {
  const sectors = new Map<number, IsochroneNode[]>()
  for (const node of nodes) {
    const geometry = distanceAndBearing(asPoint(node), target)
    const sector = Math.round(geometry.bearing / PRUNE_SECTOR_DEGREES) * PRUNE_SECTOR_DEGREES
    const bucket = sectors.get(sector) ?? []
    bucket.push(node)
    bucket.sort((a, b) => routeScore(a, target) - routeScore(b, target))
    if (bucket.length > PRUNE_NODES_PER_SECTOR) bucket.length = PRUNE_NODES_PER_SECTOR
    sectors.set(sector, bucket)
  }
  return [...sectors.values()]
    .flat()
    .sort((a, b) => routeScore(a, target) - routeScore(b, target))
    .slice(0, maxNodes)
}

function routeFrom(node: IsochroneNode | undefined) {
  const route: IsochroneNode[] = []
  let current = node
  while (current) { route.push(current); current = current.parent }
  return route.reverse()
}

function candidateHeadings(direct: number, windFromDirection: number, polar: PolarTable, headingSpread: number, headingStep: number) {
  const headings = new Set<number>()
  for (let offset = -headingSpread; offset <= headingSpread; offset += headingStep) headings.add(norm(direct + offset))
  const minimumTwa = minimumSailableTwa(polar)
  const directTwa = trueWindAngle(direct, windFromDirection)
  if (minimumTwa > 0 && directTwa < minimumTwa + headingStep) {
    headings.add(norm(windFromDirection - minimumTwa))
    headings.add(norm(windFromDirection + minimumTwa))
  }
  return [...headings]
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length)
  let cursor = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await worker(items[index])
    }
  })
  await Promise.all(runners)
  return results
}

function cacheCoord(value: number) { return (Math.round(value * 100) / 100).toFixed(2) }
function modeledHours(route: IsochroneNode[], departure: Date) {
  if (!route.length) return 0
  const last = new Date(route[route.length - 1].time).getTime()
  return Number.isFinite(last) ? Math.max(0, Math.round((last - departure.getTime()) / 3_600_000)) : 0
}

export async function computeIsochrones(args: {
  start: OffshorePoint
  target: OffshorePoint
  departure: Date
  polar: PolarTable
  stepMinutes?: number
  maxHours?: number
  maxNodes?: number
  headingSpread?: number
  headingStep?: number
  budgetMs?: number
  tidalCoefficient?: number | null
  referenceHighWater?: Date | null
  referenceHighWaterSchedules?: ShomHighWaterSchedules
}): Promise<IsochroneResult> {
  const { start, target, departure, polar } = args
  const budgetMs = Math.max(8_000, args.budgetMs ?? DEFAULT_BUDGET_MS)
  let budgetExhausted = false
  const stepMinutes = args.stepMinutes ?? 60
  const maxHours = args.maxHours ?? 72
  const maxNodes = args.maxNodes ?? 18
  const headingSpread = args.headingSpread ?? 60
  const headingStep = args.headingStep ?? 15
  const constraints = await fetchOffshoreConstraintProfile(start, target)
  // Loading the coastline can take several seconds (or require a fallback
  // endpoint). The routing budget applies to the search, not that prerequisite.
  const startedAt = Date.now()
  const deadline = startedAt + budgetMs
  const softDeadline = startedAt + budgetMs * SOFT_BUDGET_RATIO
  if (!constraints.available) {
    return {
      steps: [], bestRoute: [], reached: false, eta: null,
      note: 'Le contrôle côtier est indisponible. Réessaie plus tard : aucune route ne peut être proposée sans vérifier les traversées de terre.',
      blockedLandCandidates: 0, tssCrossingCandidates: 0,
      constraintsAvailable: false, constraintsNote: constraints.note,
      shomCurrentSamples: 0, fallbackCurrentSamples: 0, shomAtlasLabels: [],
      shomScheduledReferenceSamples: 0, shomPropagatedReferenceSamples: 0,
    }
  }
  const directConstraint = evaluateOffshoreSegment(
    constraints,
    { lat: Number(start.latitude), lon: Number(start.longitude) },
    { lat: Number(target.latitude), lon: Number(target.longitude) },
  )
  const detourMode = directConstraint.crossesLand
  const effectiveHeadingSpread = detourMode ? Math.max(headingSpread, DETOUR_HEADING_SPREAD) : headingSpread
  const effectiveMaxNodes = detourMode ? Math.max(maxNodes, DETOUR_MAX_NODES) : maxNodes
  const useShom = args.tidalCoefficient != null
    && Number.isFinite(args.tidalCoefficient)
    && args.referenceHighWater != null
    && Number.isFinite(args.referenceHighWater.getTime())

  const forecastCache = new Map<string, ReturnType<typeof fetchOffshorePointForecast>>()
  const shomCache = new Map<string, ReturnType<typeof fetchShomCurrentAtTime>>()
  const getForecast = (lat: number, lon: number, time: Date) => {
    const key = `${cacheCoord(lat)}|${cacheCoord(lon)}|${time.toISOString()}`
    let promise = forecastCache.get(key)
    if (!promise) {
      promise = fetchOffshorePointForecast(lat, lon, time)
      forecastCache.set(key, promise)
    }
    return promise
  }
  const getShom = (lat: number, lon: number, time: Date) => {
    const key = `${cacheCoord(lat)}|${cacheCoord(lon)}|${time.toISOString()}|${args.tidalCoefficient ?? ''}`
    let promise = shomCache.get(key)
    if (!promise) {
      promise = fetchShomCurrentAtTime(
        lat,
        lon,
        args.tidalCoefficient as number,
        args.referenceHighWater as Date,
        time,
        args.referenceHighWaterSchedules,
      )
      shomCache.set(key, promise)
    }
    return promise
  }

  let blockedLandCandidates = 0
  let tssCrossingCandidates = 0
  let shomCurrentSamples = 0
  let fallbackCurrentSamples = 0
  let shomScheduledReferenceSamples = 0
  let shomPropagatedReferenceSamples = 0
  const shomAtlasLabels = new Set<string>()

  const startNode: IsochroneNode = {
    latitude: Number(start.latitude), longitude: Number(start.longitude), time: departure.toISOString(), heading: 0,
    boatSpeed: 0, polarSpeed: 0, waveFactor: 1, groundSpeed: 0, windSpeed: null, windDirection: null,
    waveHeight: null, waveDirection: null, currentSpeed: null, currentDirection: null, currentSource: 'none', tssCrossing: false,
  }
  let frontier = [startNode]
  const steps: IsochroneStep[] = [{ time: departure.toISOString(), nodes: frontier }]
  const iterations = Math.ceil(maxHours * 60 / stepMinutes)

  for (let step = 1; step <= iterations; step += 1) {
    if (Date.now() >= deadline) { budgetExhausted = true; break }
    const softMode = Date.now() >= softDeadline
    const activeFrontier = softMode ? frontier.slice(0, SOFT_MAX_NODES) : frontier
    const activeHeadingStep = softMode ? Math.max(headingStep, SOFT_HEADING_STEP) : headingStep
    const time = new Date(departure.getTime() + (step - 1) * stepMinutes * 60_000)

    const expansions = await mapWithConcurrency(activeFrontier, NODE_CONCURRENCY, async (node): Promise<ExpansionResult> => {
      const local: ExpansionResult = {
        candidates: [], reached: null,
        blockedLandCandidates: 0, tssCrossingCandidates: 0,
        shomCurrentSamples: 0, fallbackCurrentSamples: 0,
        shomScheduledReferenceSamples: 0, shomPropagatedReferenceSamples: 0,
        shomAtlasLabels: [],
      }

      if (Date.now() >= deadline) { budgetExhausted = true; return local }
      const env = await getForecast(node.latitude, node.longitude, time)
      if (Date.now() >= deadline) { budgetExhausted = true; return local }
      let currentSpeed = env.currentSpeed
      let currentDirection = env.currentDirection
      let currentSource: IsochroneNode['currentSource'] = currentSpeed != null && currentDirection != null ? 'open-meteo' : 'none'

      if (useShom) {
        const shom = await getShom(node.latitude, node.longitude, time)
        if (shom.source === 'shom' && shom.speed != null && shom.direction != null) {
          currentSpeed = shom.speed
          currentDirection = shom.direction
          currentSource = 'shom'
          local.shomCurrentSamples += 1
          if (shom.referenceMode === 'port-schedule') local.shomScheduledReferenceSamples += 1
          if (shom.referenceMode === 'propagated') local.shomPropagatedReferenceSamples += 1
          if (shom.atlasLabel) local.shomAtlasLabels.push(shom.atlasLabel)
        } else if (currentSource === 'open-meteo') {
          local.fallbackCurrentSamples += 1
        }
      } else if (currentSource === 'open-meteo') {
        local.fallbackCurrentSamples += 1
      }

      if (Date.now() >= deadline) { budgetExhausted = true; return local }
      const direct = distanceAndBearing(asPoint(node), target).bearing
      if (env.windDirection == null || env.windSpeed == null) return local

      const headings = candidateHeadings(direct, env.windDirection, polar, effectiveHeadingSpread, activeHeadingStep)
      for (const heading of headings) {
        if (Date.now() >= deadline) { budgetExhausted = true; break }
        const twa = trueWindAngle(heading, env.windDirection)
        const rawPolarSpeed = polarSpeed(polar, twa, env.windSpeed)
        const waveFactor = wavePerformanceFactor(heading, env.waveHeight, env.waveDirection, env.wavePeriod)
        const boatSpeed = rawPolarSpeed * waveFactor
        if (boatSpeed < 0.3) continue

        const ground = addCurrent(heading, boatSpeed, currentSpeed, currentDirection)
        const next = advance(node.latitude, node.longitude, ground.bearing, ground.speed * stepMinutes / 60)
        const segment = evaluateOffshoreSegment(
          constraints,
          { lat: node.latitude, lon: node.longitude },
          { lat: next.latitude, lon: next.longitude },
        )
        if (segment.crossesLand) { local.blockedLandCandidates += 1; continue }
        if (segment.crossesTss) local.tssCrossingCandidates += 1

        const nextNode: IsochroneNode = {
          ...next,
          time: new Date(time.getTime() + stepMinutes * 60_000).toISOString(),
          heading,
          boatSpeed,
          polarSpeed: rawPolarSpeed,
          waveFactor,
          groundSpeed: ground.speed,
          windSpeed: env.windSpeed,
          windDirection: env.windDirection,
          waveHeight: env.waveHeight,
          waveDirection: env.waveDirection,
          currentSpeed,
          currentDirection,
          currentSource,
          tssCrossing: node.tssCrossing || segment.crossesTss,
          parent: node,
        }

        const trajectoryCost = trajectoryPenalty(nextNode, target)
        const extremeLoopThreshold = detourMode ? 58 : 42
        if (trajectoryCost >= extremeLoopThreshold) continue

        const remaining = distanceAndBearing(asPoint(nextNode), target).distanceNm
        if (remaining <= Math.max(1, ground.speed * stepMinutes / 60)) {
          if (!local.reached || routeScore(nextNode, target) < routeScore(local.reached, target)) local.reached = nextNode
        } else {
          local.candidates.push(nextNode)
        }
      }
      return local
    })

    const candidates: IsochroneNode[] = []
    let reachedNode: IsochroneNode | null = null
    for (const expansion of expansions) {
      candidates.push(...expansion.candidates)
      blockedLandCandidates += expansion.blockedLandCandidates
      tssCrossingCandidates += expansion.tssCrossingCandidates
      shomCurrentSamples += expansion.shomCurrentSamples
      fallbackCurrentSamples += expansion.fallbackCurrentSamples
      shomScheduledReferenceSamples += expansion.shomScheduledReferenceSamples
      shomPropagatedReferenceSamples += expansion.shomPropagatedReferenceSamples
      expansion.shomAtlasLabels.forEach((label) => shomAtlasLabels.add(label))
      if (expansion.reached && (!reachedNode || routeScore(expansion.reached, target) < routeScore(reachedNode, target))) reachedNode = expansion.reached
    }

    if (reachedNode) {
      return {
        steps: [...steps, { time: reachedNode.time, nodes: [reachedNode] }],
        bestRoute: routeFrom(reachedNode), reached: true, eta: reachedNode.time,
        note: detourMode
          ? 'Arrivée atteinte par le calcul isochrone après recherche élargie d’un contournement maritime, avec contrôle des boucles et croisements de trajectoire.'
          : 'Arrivée atteinte par le calcul isochrone avec contrôle côte, mer, courant et cohérence de trajectoire.',
        blockedLandCandidates, tssCrossingCandidates,
        constraintsAvailable: constraints.available, constraintsNote: constraints.note,
        shomCurrentSamples, fallbackCurrentSamples, shomAtlasLabels: [...shomAtlasLabels],
        shomScheduledReferenceSamples, shomPropagatedReferenceSamples,
      }
    }

    if (!candidates.length) break
    const activeMaxNodes = softMode ? Math.min(effectiveMaxNodes, SOFT_MAX_NODES) : effectiveMaxNodes
    frontier = prune(candidates, target, activeMaxNodes)
    steps.push({ time: frontier[0]?.time ?? time.toISOString(), nodes: frontier })
    if (budgetExhausted || Date.now() >= deadline) { budgetExhausted = true; break }
  }

  const best = frontier.slice().sort((a, b) => routeScore(a, target) - routeScore(b, target))[0]
  const bestRoute = routeFrom(best)
  const progressed = bestRoute.length >= 2
  const hoursDone = modeledHours(bestRoute, departure)
  return {
    steps, bestRoute, reached: false, eta: null,
    note: budgetExhausted
      ? progressed
        ? `Calcul interrompu à environ ${hoursDone} h sur ${maxHours} h par la limite de temps : meilleure route maritime partielle conservée. Les boucles, retours sur trace et croisements inutiles sont désormais fortement pénalisés.`
        : `Calcul interrompu avant de produire une route exploitable (0 h sur ${maxHours} h). Essaie un pas de 2 h ou un horizon plus court.`
      : progressed
        ? detourMode
          ? `Horizon atteint avant l’arrivée après ${hoursDone} h : un contournement maritime cohérent a été exploré mais n’a pas encore rejoint A.`
          : `Horizon atteint avant l’arrivée après ${hoursDone} h : meilleure route conservée avec contraintes et courant disponibles.`
        : blockedLandCandidates > 0
          ? 'Aucune trajectoire maritime n’a pu quitter D : les premiers pas traversent une côte. Vérifie la position du départ et réessaie avec un pas de temps plus court.'
          : 'Aucune trajectoire isochrone n’a pu être générée dès le départ. Vérifie la date/heure, la météo et la polaire au point D.',
    blockedLandCandidates, tssCrossingCandidates,
    constraintsAvailable: constraints.available, constraintsNote: constraints.note,
    shomCurrentSamples, fallbackCurrentSamples, shomAtlasLabels: [...shomAtlasLabels],
    shomScheduledReferenceSamples, shomPropagatedReferenceSamples,
  }
}
