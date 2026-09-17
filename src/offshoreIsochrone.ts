import type { OffshorePoint } from './offshore'
import { distanceAndBearing } from './offshore'
import { fetchOffshorePointForecast } from './offshoreForecast'
import { polarSpeed, trueWindAngle, type PolarTable } from './offshorePolar'

export type IsochroneNode = {
  latitude: number
  longitude: number
  time: string
  heading: number
  boatSpeed: number
  groundSpeed: number
  windSpeed: number | null
  windDirection: number | null
  currentSpeed: number | null
  currentDirection: number | null
  parent?: IsochroneNode
}

export type IsochroneStep = {
  time: string
  nodes: IsochroneNode[]
}

export type IsochroneResult = {
  steps: IsochroneStep[]
  bestRoute: IsochroneNode[]
  reached: boolean
  eta: string | null
  note: string
}

const EARTH_RADIUS_NM = 3440.065
function rad(v: number) { return v * Math.PI / 180 }
function deg(v: number) { return v * 180 / Math.PI }
function norm(v: number) { return ((v % 360) + 360) % 360 }
function angularDistance(a: number, b: number) { return Math.abs((((a - b) % 360) + 540) % 360 - 180) }

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

function asPoint(node: Pick<IsochroneNode, 'latitude' | 'longitude'>, name = 'N') : OffshorePoint {
  return { id: name, name, latitude: String(node.latitude), longitude: String(node.longitude) }
}

function prune(nodes: IsochroneNode[], target: OffshorePoint, maxNodes: number) {
  const targetBearingGroups = new Map<number, IsochroneNode>()
  for (const node of nodes) {
    const geometry = distanceAndBearing(asPoint(node), target)
    const sector = Math.round(geometry.bearing / 15) * 15
    const current = targetBearingGroups.get(sector)
    if (!current || distanceAndBearing(asPoint(current), target).distanceNm > geometry.distanceNm) targetBearingGroups.set(sector, node)
  }
  return [...targetBearingGroups.values()]
    .sort((a, b) => distanceAndBearing(asPoint(a), target).distanceNm - distanceAndBearing(asPoint(b), target).distanceNm)
    .slice(0, maxNodes)
}

function routeFrom(node: IsochroneNode | undefined) {
  const route: IsochroneNode[] = []
  let current = node
  while (current) { route.push(current); current = current.parent }
  return route.reverse()
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
}): Promise<IsochroneResult> {
  const { start, target, departure, polar } = args
  const stepMinutes = args.stepMinutes ?? 60
  const maxHours = args.maxHours ?? 72
  const maxNodes = args.maxNodes ?? 18
  const headingSpread = args.headingSpread ?? 60
  const headingStep = args.headingStep ?? 15
  const startNode: IsochroneNode = { latitude: Number(start.latitude), longitude: Number(start.longitude), time: departure.toISOString(), heading: 0, boatSpeed: 0, groundSpeed: 0, windSpeed: null, windDirection: null, currentSpeed: null, currentDirection: null }
  let frontier = [startNode]
  const steps: IsochroneStep[] = [{ time: departure.toISOString(), nodes: frontier }]
  const iterations = Math.ceil(maxHours * 60 / stepMinutes)

  for (let step = 1; step <= iterations; step += 1) {
    const time = new Date(departure.getTime() + (step - 1) * stepMinutes * 60_000)
    const candidates: IsochroneNode[] = []
    for (const node of frontier) {
      const env = await fetchOffshorePointForecast(node.latitude, node.longitude, time)
      const direct = distanceAndBearing(asPoint(node), target).bearing
      const windDirection = env.windDirection
      const tws = env.windSpeed
      if (windDirection == null || tws == null) continue
      for (let offset = -headingSpread; offset <= headingSpread; offset += headingStep) {
        const heading = norm(direct + offset)
        const twa = trueWindAngle(heading, windDirection)
        const boatSpeed = polarSpeed(polar, twa, tws)
        if (boatSpeed < 0.3) continue
        const ground = addCurrent(heading, boatSpeed, env.currentSpeed, env.currentDirection)
        const next = advance(node.latitude, node.longitude, ground.bearing, ground.speed * stepMinutes / 60)
        const nextNode: IsochroneNode = { ...next, time: new Date(time.getTime() + stepMinutes * 60_000).toISOString(), heading, boatSpeed, groundSpeed: ground.speed, windSpeed: tws, windDirection, currentSpeed: env.currentSpeed, currentDirection: env.currentDirection, parent: node }
        const remaining = distanceAndBearing(asPoint(nextNode), target).distanceNm
        if (remaining <= Math.max(1, ground.speed * stepMinutes / 60)) {
          return { steps: [...steps, { time: nextNode.time, nodes: [nextNode] }], bestRoute: routeFrom(nextNode), reached: true, eta: nextNode.time, note: 'Arrivée atteinte par le calcul isochrone.' }
        }
        candidates.push(nextNode)
      }
    }
    if (!candidates.length) break
    frontier = prune(candidates, target, maxNodes)
    steps.push({ time: frontier[0]?.time ?? time.toISOString(), nodes: frontier })
  }

  const best = frontier.slice().sort((a, b) => distanceAndBearing(asPoint(a), target).distanceNm - distanceAndBearing(asPoint(b), target).distanceNm)[0]
  return { steps, bestRoute: routeFrom(best), reached: false, eta: null, note: best ? 'Horizon atteint avant l’arrivée : meilleure route conservée.' : 'Aucune route exploitable avec les données disponibles.' }
}
