import { useEffect, useMemo, useRef, useState } from 'react'
import { Anchor, Clock3, Compass, Download, LoaderCircle, MapPin, Route } from 'lucide-react'
import type { OffshorePoint } from '../offshore'
import { computeIsochrones, type IsochroneResult } from '../offshoreIsochrone'
import type { PolarTable } from '../offshorePolar'
import { parseHighWaterLines, SHOM_REFERENCE_PORTS, type ShomHighWaterSchedules } from '../shomHighWater'
import './offshoreIsochrone.css'
import './offshoreNavigationWaypoints.css'

type Props = {
  start: OffshorePoint
  target: OffshorePoint
  departureDate: string
  departureTime: string
  polar: PolarTable
  onResult: (result: IsochroneResult | null) => void
}

type NavigationWaypoint = {
  name: string
  latitude: number
  longitude: number
  time: string
  heading: number
  legDistanceNm: number
  cumulativeDistanceNm: number
  reason: 'cap' | 'distance' | 'arrival'
}

function fmtTime(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date) : '—'
}

function fmtNumber(value: number | null | undefined, digits = 1) {
  return value == null || !Number.isFinite(value) ? '—' : value.toFixed(digits).replace('.', ',')
}

function fmtBearing(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? '—' : `${String(Math.round(value)).padStart(3, '0')}°`
}

function trueWindAngle(heading: number, windFrom: number | null) {
  if (windFrom == null || !Number.isFinite(windFrom)) return null
  return Math.abs((((heading - windFrom) % 360) + 540) % 360 - 180)
}

function angleDiff(a: number, b: number) {
  return Math.abs((((a - b) % 360) + 540) % 360 - 180)
}

function distanceNm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const radiusNm = 3440.065
  const rad = (value: number) => value * Math.PI / 180
  const lat1 = rad(a.latitude)
  const lat2 = rad(b.latitude)
  const dLat = lat2 - lat1
  const dLon = rad(b.longitude - a.longitude)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * radiusNm * Math.asin(Math.min(1, Math.sqrt(h)))
}

function directRouteDistanceNm(start: OffshorePoint, target: OffshorePoint) {
  const latitudeA = Number(start.latitude)
  const longitudeA = Number(start.longitude)
  const latitudeB = Number(target.latitude)
  const longitudeB = Number(target.longitude)
  if (![latitudeA, longitudeA, latitudeB, longitudeB].every(Number.isFinite)) return null
  return distanceNm(
    { latitude: latitudeA, longitude: longitudeA },
    { latitude: latitudeB, longitude: longitudeB },
  )
}

function routingPreset(distance: number | null) {
  if (distance == null) return { stepMinutes: '60', maxHours: '48', label: 'Réglage standard' }
  if (distance < 15) return { stepMinutes: '10', maxHours: '6', label: 'Petit trajet côtier' }
  if (distance < 40) return { stepMinutes: '15', maxHours: '12', label: 'Trajet côtier court' }
  if (distance < 100) return { stepMinutes: '30', maxHours: '24', label: 'Trajet intermédiaire' }
  return { stepMinutes: '60', maxHours: '48', label: 'Route au large' }
}

function navigationWaypoints(result: IsochroneResult | null) {
  if (!result || result.bestRoute.length < 2) return [] as NavigationWaypoint[]
  const route = result.bestRoute
  const waypoints: NavigationWaypoint[] = []
  let distanceSinceWaypoint = 0
  let cumulativeDistance = 0
  let waypointNumber = 1

  for (let index = 1; index < route.length; index += 1) {
    const previous = route[index - 1]
    const current = route[index]
    const segmentDistance = distanceNm(previous, current)
    distanceSinceWaypoint += segmentDistance
    cumulativeDistance += segmentDistance

    const isArrival = index === route.length - 1
    const headingChange = index > 1 ? angleDiff(current.heading, previous.heading) : 0
    const significantTurn = headingChange >= 12
    const spacingReached = distanceSinceWaypoint >= 10
    if (!isArrival && !significantTurn && !spacingReached) continue

    waypoints.push({
      name: isArrival ? 'A' : `WP${waypointNumber++}`,
      latitude: current.latitude,
      longitude: current.longitude,
      time: current.time,
      heading: current.heading,
      legDistanceNm: distanceSinceWaypoint,
      cumulativeDistanceNm: cumulativeDistance,
      reason: isArrival ? 'arrival' : significantTurn ? 'cap' : 'distance',
    })
    distanceSinceWaypoint = 0
  }

  return waypoints
}

function xmlEscape(value: string) {
  return value.replace(/[<>&'\"]/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '\"': '&quot;' })[character] ?? character)
}

export function OffshoreIsochronePanel({ start, target, departureDate, departureTime, polar, onResult }: Props) {
  const directDistance = useMemo(() => directRouteDistanceNm(start, target), [start, target])
  const automaticPreset = useMemo(() => routingPreset(directDistance), [directDistance])
  const routeSignature = `${start.latitude}|${start.longitude}|${target.latitude}|${target.longitude}`
  const previousRouteSignature = useRef<string | null>(null)
  const [stepMinutes, setStepMinutes] = useState(automaticPreset.stepMinutes)
  const [maxHours, setMaxHours] = useState(automaticPreset.maxHours)
  const [tidalCoefficient, setTidalCoefficient] = useState('70')
  const [referenceHighWater, setReferenceHighWater] = useState('')
  const [portHighWaters, setPortHighWaters] = useState<Record<string, string>>({})
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [result, setResult] = useState<IsochroneResult | null>(null)

  useEffect(() => {
    if (previousRouteSignature.current === routeSignature) return
    previousRouteSignature.current = routeSignature
    setStepMinutes(automaticPreset.stepMinutes)
    setMaxHours(automaticPreset.maxHours)
    setState('idle')
    setResult(null)
    onResult(null)
  }, [automaticPreset.maxHours, automaticPreset.stepMinutes, onResult, routeSignature])

  const schedules = useMemo<ShomHighWaterSchedules>(() => Object.fromEntries(
    SHOM_REFERENCE_PORTS.map(({ atlasId }) => [atlasId, parseHighWaterLines(portHighWaters[atlasId] ?? '')])
      .filter(([, values]) => values.length > 0),
  ), [portHighWaters])

  const routeDiagnostics = useMemo(() => {
    if (!result || result.bestRoute.length < 2) return []
    const route = result.bestRoute.slice(1)
    const stride = Math.max(1, Math.ceil(route.length / 8))
    const selected = route.filter((_, index) => index % stride === 0)
    const last = route[route.length - 1]
    if (selected[selected.length - 1] !== last) selected.push(last)
    return selected.map((node) => ({
      ...node,
      twa: trueWindAngle(node.heading, node.windDirection),
      currentEffect: node.groundSpeed - node.boatSpeed,
      waveLossPct: Math.max(0, (1 - node.waveFactor) * 100),
    }))
  }, [result])

  const routeWeatherSummary = useMemo(() => {
    if (!result || result.bestRoute.length < 2) return null
    const route = result.bestRoute.slice(1)
    const validCurrentEffects = route.map((node) => node.groundSpeed - node.boatSpeed).filter(Number.isFinite)
    const avgCurrentEffect = validCurrentEffects.length ? validCurrentEffects.reduce((sum, value) => sum + value, 0) / validCurrentEffects.length : 0
    const waveLosses = route.map((node) => Math.max(0, (1 - node.waveFactor) * 100)).filter(Number.isFinite)
    const avgWaveLoss = waveLosses.length ? waveLosses.reduce((sum, value) => sum + value, 0) / waveLosses.length : 0
    const twas = route.map((node) => trueWindAngle(node.heading, node.windDirection)).filter((value): value is number => value != null)
    return {
      avgCurrentEffect,
      avgWaveLoss,
      minTwa: twas.length ? Math.min(...twas) : null,
      maxTwa: twas.length ? Math.max(...twas) : null,
    }
  }, [result])

  const navWaypoints = useMemo(() => navigationWaypoints(result), [result])

  function exportGpx() {
    if (!result || !navWaypoints.length) return
    const startNode = result.bestRoute[0]
    const routePoints = [
      { name: 'D', latitude: startNode.latitude, longitude: startNode.longitude },
      ...navWaypoints.map((waypoint) => ({ name: waypoint.name, latitude: waypoint.latitude, longitude: waypoint.longitude })),
    ]
    const pointsXml = routePoints.map((point) => `    <rtept lat="${point.latitude.toFixed(6)}" lon="${point.longitude.toFixed(6)}"><name>${xmlEscape(point.name)}</name></rtept>`).join('\n')
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="CoachBrief" xmlns="http://www.topografix.com/GPX/1/1">\n  <rte>\n    <name>CoachBrief route météo</name>\n${pointsXml}\n  </rte>\n</gpx>`
    const blob = new Blob([gpx], { type: 'application/gpx+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `coachbrief-route-${departureDate || 'offshore'}.gpx`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  async function run() {
    const departure = new Date(`${departureDate}T${departureTime}:00`)
    if (!departureDate || !departureTime || !Number.isFinite(departure.getTime())) return
    const genericHighWater = referenceHighWater ? new Date(referenceHighWater) : null
    const firstScheduled = Object.values(schedules).flat()[0] ?? null
    const highWater = genericHighWater && Number.isFinite(genericHighWater.getTime()) ? genericHighWater : firstScheduled
    const coefficient = Number(tidalCoefficient)
    setState('loading')
    setResult(null)
    onResult(null)
    try {
      const next = await computeIsochrones({
        start,
        target,
        departure,
        polar,
        stepMinutes: Math.max(10, Number(stepMinutes) || 60),
        maxHours: Math.max(3, Number(maxHours) || 48),
        budgetMs: 25_000,
        tidalCoefficient: Number.isFinite(coefficient) ? coefficient : null,
        referenceHighWater: highWater,
        referenceHighWaterSchedules: schedules,
      })
      setResult(next)
      onResult(next)
      setState('ready')
    } catch {
      setState('error')
    }
  }

  return <section className="offshore-card offshore-isochrone-card">
    <div className="offshore-card-heading">
      <div><span>05</span><div><small>Routage météo</small><h2>Isochrones</h2></div></div>
      <Route size={24} />
    </div>
    <div className="offshore-isochrone-controls">
      <label><span><Clock3 size={14} /> Pas de temps</span><select value={stepMinutes} onChange={(e) => setStepMinutes(e.target.value)}><option value="10">10 min</option><option value="15">15 min</option><option value="30">30 min</option><option value="60">1 h</option><option value="120">2 h</option></select></label>
      <label><span>Horizon</span><select value={maxHours} onChange={(e) => setMaxHours(e.target.value)}><option value="3">3 h</option><option value="6">6 h</option><option value="12">12 h</option><option value="24">24 h</option><option value="48">48 h</option><option value="72">72 h</option><option value="120">5 jours</option></select></label>
      <label><span><Anchor size={14} /> Coefficient marée</span><input type="number" min="20" max="120" value={tidalCoefficient} onChange={(e) => setTidalCoefficient(e.target.value)} /></label>
      <label className="offshore-high-water"><span>PM générique de secours</span><input type="datetime-local" value={referenceHighWater} onChange={(e) => setReferenceHighWater(e.target.value)} /></label>
      <button type="button" className="offshore-add" onClick={() => void run()} disabled={state === 'loading' || !departureDate || !departureTime}>
        {state === 'loading' ? <LoaderCircle size={17} className="current-spin" /> : <Compass size={17} />}
        {state === 'loading' ? 'Calcul des isochrones…' : 'Calculer le routage'}
      </button>
      {directDistance != null && <small>{automaticPreset.label} · {fmtNumber(directDistance)} nm : réglage automatique {automaticPreset.stepMinutes} min / {automaticPreset.maxHours} h. Tu peux le modifier manuellement.</small>}
      {state === 'loading' && <small>Calcul adaptatif, limité à environ 25 s pour éviter un blocage prolongé sur mobile.</small>}
    </div>

    <div className="offshore-shom-schedules">
      <div className="offshore-shom-schedules-title"><Anchor size={16} /><div><strong>Pleines mers par port de référence SHOM</strong><small>Une date/heure par ligne. CoachBrief choisit la PM la plus proche de chaque nœud de routage.</small></div></div>
      <div className="offshore-shom-schedule-grid">
        {SHOM_REFERENCE_PORTS.map(({ atlasId, port }) => {
          const validCount = schedules[atlasId]?.length ?? 0
          const hasInput = Boolean((portHighWaters[atlasId] ?? '').trim())
          return <label key={atlasId}>
            <span>{port}</span>
            {!hasInput && <small>Exemple ci-dessous — ces horaires ne sont pas utilisés tant que le champ reste vide.</small>}
            <textarea
              rows={3}
              value={portHighWaters[atlasId] ?? ''}
              onChange={(e) => setPortHighWaters((current) => ({ ...current, [atlasId]: e.target.value }))}
              placeholder={'2026-09-17T10:25\n2026-09-17T22:48\n2026-09-18T11:10'}
            />
            <small>{hasInput ? `${validCount} PM valide${validCount > 1 ? 's' : ''}` : 'Aucune PM saisie'}</small>
          </label>
        })}
      </div>
    </div>

    <p className="offshore-help">À chaque pas, CoachBrief recalcule vent, courant et mer, applique la polaire puis élimine les branches qui coupent une côte détectée. Quand plusieurs pleines mers sont saisies pour Roscoff, Cherbourg ou Saint-Malo, le moteur utilise automatiquement la référence du bon atlas et la PM la plus proche dans le temps. La PM générique ne sert plus que de secours.</p>
    {state === 'error' && <p className="offshore-analysis-error">Le routage n’a pas pu être calculé avec les données disponibles.</p>}
    {result && <div className="offshore-isochrone-summary">
      <span>Isochrones <strong>{Math.max(0, result.steps.length - 1)}</strong></span>
      <span>Route retenue <strong>{Math.max(0, result.bestRoute.length - 1)} pas</strong></span>
      <span>Arrivée <strong>{result.reached ? fmtTime(result.eta) : 'hors horizon'}</strong></span>
      <span>Coupures de terre écartées <strong>{result.blockedLandCandidates}</strong></span>
      <span>Options coupant un TSS <strong>{result.tssCrossingCandidates}</strong></span>
      <span>Échantillons courant SHOM <strong>{result.shomCurrentSamples}</strong></span>
      <span>PM de port utilisées <strong>{result.shomScheduledReferenceSamples}</strong></span>
      <span>PM propagées ~12 h 25 <strong>{result.shomPropagatedReferenceSamples}</strong></span>
      <span>Replis Open-Meteo <strong>{result.fallbackCurrentSamples}</strong></span>
      <span>Atlas SHOM utilisés <strong>{result.shomAtlasLabels.length ? result.shomAtlasLabels.join(' · ') : 'aucun'}</strong></span>
      <p>{result.note}</p>
      <p>{result.constraintsNote}</p>
    </div>}

    {navWaypoints.length > 0 && <div className="offshore-navigation-waypoints">
      <div className="offshore-navigation-waypoints-heading">
        <div><MapPin size={18} /><div><strong>Waypoints de navigation</strong><small>Points pratiques à viser pour suivre la route météo retenue. Un WP est créé à chaque changement de cap important ou au plus tard tous les 10 nm.</small></div></div>
        <button type="button" className="offshore-add offshore-gpx-button" onClick={exportGpx}><Download size={16} /> Exporter GPX</button>
      </div>
      <div className="offshore-navigation-waypoints-grid">
        {navWaypoints.map((waypoint) => <article key={`${waypoint.name}-${waypoint.time}`}>
          <div className="offshore-navigation-waypoint-name"><b>{waypoint.name}</b><small>{waypoint.reason === 'arrival' ? 'Arrivée' : waypoint.reason === 'cap' ? 'Changement de cap' : 'Point intermédiaire'}</small></div>
          <span>Position <b>{waypoint.latitude.toFixed(5)} · {waypoint.longitude.toFixed(5)}</b></span>
          <span>Cap à suivre <b>{fmtBearing(waypoint.heading)}</b></span>
          <span>Distance depuis le point précédent <b>{fmtNumber(waypoint.legDistanceNm)} nm</b></span>
          <span>Distance cumulée <b>{fmtNumber(waypoint.cumulativeDistanceNm)} nm</b></span>
          <span>Passage prévu <b>{fmtTime(waypoint.time)}</b></span>
        </article>)}
      </div>
      <p className="offshore-source">Ces waypoints sont liés à ce calcul météo. Relance le routage si l’heure de départ, la météo, la polaire ou les conditions de courant changent.</p>
    </div>}

    {routeDiagnostics.length > 0 && <div className="offshore-route-diagnostics">
      <div className="offshore-route-diagnostics-title">
        <strong>Pourquoi cette route météo ?</strong>
        <small>Échantillons de la route retenue : ils montrent les conditions réellement utilisées par le moteur, pas une simple ligne géométrique.</small>
      </div>
      {routeWeatherSummary && <div className="offshore-route-diagnostics-summary">
        <span>TWA parcouru <b>{fmtNumber(routeWeatherSummary.minTwa, 0)}° → {fmtNumber(routeWeatherSummary.maxTwa, 0)}°</b></span>
        <span>Effet moyen du courant sur la vitesse sol <b>{routeWeatherSummary.avgCurrentEffect >= 0 ? '+' : ''}{fmtNumber(routeWeatherSummary.avgCurrentEffect)} nd</b></span>
        <span>Perte moyenne liée à la mer <b>{fmtNumber(routeWeatherSummary.avgWaveLoss)} %</b></span>
      </div>}
      <div className="offshore-route-diagnostics-grid">
        {routeDiagnostics.map((node, index) => <article key={`${node.time}-${index}`}>
          <strong>{fmtTime(node.time)}</strong>
          <span>Cap <b>{fmtBearing(node.heading)}</b></span>
          <span>Vent <b>{fmtNumber(node.windSpeed)} nd · {fmtBearing(node.windDirection)}</b></span>
          <span>TWA <b>{node.twa == null ? '—' : `${fmtNumber(node.twa, 0)}°`}</b></span>
          <span>Polaire <b>{fmtNumber(node.polarSpeed)} nd</b></span>
          <span>Après mer <b>{fmtNumber(node.boatSpeed)} nd</b>{node.waveLossPct > .1 && <small>−{fmtNumber(node.waveLossPct)} %</small>}</span>
          <span>Vitesse sol <b>{fmtNumber(node.groundSpeed)} nd</b><small>{node.currentEffect >= 0 ? '+' : ''}{fmtNumber(node.currentEffect)} nd vs bateau</small></span>
          <span>Courant <b>{fmtNumber(node.currentSpeed)} nd · {fmtBearing(node.currentDirection)}</b><small>{node.currentSource === 'shom' ? 'SHOM' : node.currentSource === 'open-meteo' ? 'Open-Meteo' : 'non disponible'}</small></span>
        </article>)}
      </div>
      <p className="offshore-source">Ce diagnostic explique pourquoi le moteur a retenu ces caps. Il ne prouve pas à lui seul qu’une route plus côtière serait plus lente : pour cela, il faudra comparer explicitement une seconde route candidate avec les mêmes conditions météo.</p>
    </div>}

    <p className="offshore-source">Les PM saisies par port sont prioritaires et évitent de propager artificiellement un même horaire entre Roscoff, Cherbourg et Saint-Malo. Lorsqu’aucune PM locale n’est fournie pour un atlas, le moteur garde le secours semi-diurne d’environ 12 h 25 à partir de la PM générique. Sans tuile SHOM locale, il revient automatiquement au courant Open-Meteo.</p>
  </section>
}
