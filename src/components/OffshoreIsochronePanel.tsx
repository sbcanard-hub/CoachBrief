import { useEffect, useMemo, useRef, useState } from 'react'
import { Anchor, Clock3, Compass, Download, LoaderCircle, MapPin, Route, Wind } from 'lucide-react'
import type { OffshorePoint } from '../offshore'
import { computeIsochrones, type IsochroneProgress, type IsochroneResult } from '../offshoreIsochrone'
import { getOffshoreWeatherModel, OFFSHORE_WEATHER_MODELS, offshoreWeatherModelLabel, setOffshoreWeatherModel, type OffshoreWeatherModel } from '../offshoreForecast'
import type { PolarTable } from '../offshorePolar'
import type { OffshoreIsochroneSettings } from '../offshoreSavedRoutes'
import { parseHighWaterLines, SHOM_REFERENCE_PORTS, type ShomHighWaterSchedules } from '../shomHighWater'
import './offshoreIsochrone.css'
import './offshoreNavigationWaypoints.css'
import './offshoreMultiModel.css'

type Props = {
  points: OffshorePoint[]
  departureDate: string
  departureTime: string
  polar: PolarTable
  settings: OffshoreIsochroneSettings | null
  settingsRestoreKey: number
  onSettingsChange: (settings: OffshoreIsochroneSettings) => void
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

type ModelComparison = {
  model: OffshoreWeatherModel
  result: IsochroneResult | null
  error: boolean
  distanceNm: number | null
  durationHours: number | null
  meanSeparationNm: number | null
}

type RouteProgress = IsochroneProgress & { leg: number; legs: number }

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

function routeDistanceNm(result: IsochroneResult | null) {
  if (!result || result.bestRoute.length < 2) return null
  let total = 0
  for (let index = 1; index < result.bestRoute.length; index += 1) total += distanceNm(result.bestRoute[index - 1], result.bestRoute[index])
  return total
}

function routeDurationHours(result: IsochroneResult | null) {
  if (!result || result.bestRoute.length < 2) return null
  const first = new Date(result.bestRoute[0].time).getTime()
  const last = new Date(result.bestRoute[result.bestRoute.length - 1].time).getTime()
  return Number.isFinite(first) && Number.isFinite(last) && last >= first ? (last - first) / 3_600_000 : null
}

function routeSeparationNm(reference: IsochroneResult | null, candidate: IsochroneResult | null) {
  if (!reference || !candidate || reference.bestRoute.length < 2 || candidate.bestRoute.length < 2) return null
  const samples = 8
  let total = 0
  for (let index = 0; index < samples; index += 1) {
    const fraction = index / (samples - 1)
    const referenceIndex = Math.round(fraction * (reference.bestRoute.length - 1))
    const candidateIndex = Math.round(fraction * (candidate.bestRoute.length - 1))
    total += distanceNm(reference.bestRoute[referenceIndex], candidate.bestRoute[candidateIndex])
  }
  return total / samples
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
  return value.replace(/[<>&'"]/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[character] ?? character)
}

function mergeLegResults(results: IsochroneResult[]): IsochroneResult {
  const reached = results.length > 0 && results.every((item) => item.reached)
  const bestRoute = results.flatMap((item, index) => index === 0 ? item.bestRoute : item.bestRoute.slice(1))
  return {
    steps: results.flatMap((item) => item.steps),
    bestRoute,
    reached,
    eta: reached ? results.at(-1)?.eta ?? null : null,
    note: reached ? `Route calculée via ${results.length} tronçon${results.length > 1 ? 's' : ''}.` : results.at(-1)?.note ?? 'Route partielle : un tronçon n’a pas atteint son point cible.',
    blockedLandCandidates: results.reduce((sum, item) => sum + item.blockedLandCandidates, 0),
    tssCrossingCandidates: results.reduce((sum, item) => sum + item.tssCrossingCandidates, 0),
    constraintsAvailable: results.every((item) => item.constraintsAvailable),
    constraintsNote: [...new Set(results.map((item) => item.constraintsNote).filter(Boolean))].join(' · '),
    shomCurrentSamples: results.reduce((sum, item) => sum + item.shomCurrentSamples, 0),
    fallbackCurrentSamples: results.reduce((sum, item) => sum + item.fallbackCurrentSamples, 0),
    shomAtlasLabels: [...new Set(results.flatMap((item) => item.shomAtlasLabels))],
    shomScheduledReferenceSamples: results.reduce((sum, item) => sum + item.shomScheduledReferenceSamples, 0),
    shomPropagatedReferenceSamples: results.reduce((sum, item) => sum + item.shomPropagatedReferenceSamples, 0),
  }
}

export function OffshoreIsochronePanel({ points, departureDate, departureTime, polar, settings, settingsRestoreKey, onSettingsChange, onResult }: Props) {
  const start = points[0]
  const target = points[points.length - 1]
  const directDistance = useMemo(() => directRouteDistanceNm(start, target), [start, target])
  const automaticPreset = useMemo(() => routingPreset(directDistance), [directDistance])
  const routeSignature = points.map((point) => `${point.latitude}|${point.longitude}`).join('>')
  const previousRouteSignature = useRef<string | null>(null)
  const [stepMinutes, setStepMinutes] = useState(settings?.stepMinutes ?? automaticPreset.stepMinutes)
  const [maxHours, setMaxHours] = useState(settings?.maxHours ?? automaticPreset.maxHours)
  const [tidalCoefficient, setTidalCoefficient] = useState(settings?.tidalCoefficient ?? '70')
  const [referenceHighWater, setReferenceHighWater] = useState(settings?.referenceHighWater ?? '')
  const [portHighWaters, setPortHighWaters] = useState<Record<string, string>>(settings?.portHighWaters ?? {})
  const [weatherModel, setWeatherModel] = useState<OffshoreWeatherModel>(settings?.weatherModel ?? getOffshoreWeatherModel())
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [progress, setProgress] = useState<RouteProgress | null>(null)
  const [result, setResult] = useState<IsochroneResult | null>(null)
  const [comparisonState, setComparisonState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [comparisons, setComparisons] = useState<ModelComparison[]>([])
  const restoredSettings = useRef(settings)

  useEffect(() => {
    restoredSettings.current = settings
  }, [settings])

  useEffect(() => {
    if (previousRouteSignature.current === routeSignature) return
    previousRouteSignature.current = routeSignature
    setStepMinutes(automaticPreset.stepMinutes)
    setMaxHours(automaticPreset.maxHours)
    setState('idle')
    setProgress(null)
    setResult(null)
    setComparisonState('idle')
    setComparisons([])
    onResult(null)
  }, [automaticPreset.maxHours, automaticPreset.stepMinutes, onResult, routeSignature])

  useEffect(() => {
    const saved = restoredSettings.current
    if (!saved || settingsRestoreKey <= 0) return
    setStepMinutes(saved.stepMinutes)
    setMaxHours(saved.maxHours)
    setTidalCoefficient(saved.tidalCoefficient)
    setReferenceHighWater(saved.referenceHighWater)
    setPortHighWaters(saved.portHighWaters)
    const restoredModel = saved.weatherModel ?? 'best_match'
    setWeatherModel(restoredModel)
    setOffshoreWeatherModel(restoredModel)
  }, [settingsRestoreKey])

  useEffect(() => {
    onSettingsChange({ stepMinutes, maxHours, tidalCoefficient, referenceHighWater, portHighWaters, weatherModel })
  }, [maxHours, onSettingsChange, portHighWaters, referenceHighWater, stepMinutes, tidalCoefficient, weatherModel])

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

  const comparisonSummary = useMemo(() => {
    const successful = comparisons.filter((item) => item.result && item.result.bestRoute.length >= 2)
    if (successful.length < 2) return null
    const separations = successful.map((item) => item.meanSeparationNm).filter((value): value is number => value != null)
    const etas = successful.map((item) => item.result?.eta ? new Date(item.result.eta).getTime() : NaN).filter(Number.isFinite)
    const maxSeparation = separations.length ? Math.max(...separations) : null
    const etaSpreadMinutes = etas.length >= 2 ? (Math.max(...etas) - Math.min(...etas)) / 60_000 : null
    const agreement = (maxSeparation ?? 0) <= 5 && (etaSpreadMinutes ?? 0) <= 60
      ? 'Accord fort entre les modèles'
      : (maxSeparation ?? 0) <= 15 && (etaSpreadMinutes ?? 0) <= 180
        ? 'Accord moyen entre les modèles'
        : 'Divergence notable entre les modèles'
    return { successful: successful.length, maxSeparation, etaSpreadMinutes, agreement }
  }, [comparisons])

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

  function changeWeatherModel(model: OffshoreWeatherModel) {
    setWeatherModel(model)
    setOffshoreWeatherModel(model)
    setState('idle')
    setProgress(null)
    setResult(null)
    setComparisonState('idle')
    setComparisons([])
    onResult(null)
  }

  function invalidateCalculatedRoute() {
    setState('idle')
    setProgress(null)
    setResult(null)
    setComparisonState('idle')
    setComparisons([])
    onResult(null)
  }

  function routingContext() {
    const departure = new Date(`${departureDate}T${departureTime}:00`)
    if (!departureDate || !departureTime || !Number.isFinite(departure.getTime())) return null
    const genericHighWater = referenceHighWater ? new Date(referenceHighWater) : null
    const firstScheduled = Object.values(schedules).flat()[0] ?? null
    const highWater = genericHighWater && Number.isFinite(genericHighWater.getTime()) ? genericHighWater : firstScheduled
    const coefficient = Number(tidalCoefficient)
    return { departure, highWater, coefficient: Number.isFinite(coefficient) ? coefficient : null }
  }

  async function computeRoute(args: { departure: Date; maxNodes?: number; headingStep?: number; budgetMs: number; onProgress?: (progress: RouteProgress) => void }) {
    const context = routingContext()
    const results: IsochroneResult[] = []
    let legDeparture = args.departure
    for (let index = 1; index < points.length; index += 1) {
      const next = await computeIsochrones({
        start: points[index - 1],
        target: points[index],
        departure: legDeparture,
        polar,
        stepMinutes: Math.max(10, Number(stepMinutes) || 60),
        maxHours: Math.max(3, Number(maxHours) || 48),
        maxNodes: args.maxNodes,
        headingStep: args.headingStep,
        budgetMs: Math.max(4_000, Math.floor(args.budgetMs / Math.max(1, points.length - 1))),
        tidalCoefficient: context?.coefficient ?? null,
        referenceHighWater: context?.highWater ?? null,
        referenceHighWaterSchedules: schedules,
        onProgress: (progress) => args.onProgress?.({ ...progress, leg: index, legs: points.length - 1 }),
      })
      results.push(next)
      if (!next.reached || !next.eta) break
      legDeparture = new Date(next.eta)
    }
    return mergeLegResults(results)
  }

  async function run() {
    const context = routingContext()
    if (!context) return
    const searchBudgetMs = directDistance != null && directDistance >= 40 ? 45_000 : 25_000
    setOffshoreWeatherModel(weatherModel)
    setState('loading')
    setProgress({ phase: 'coast', leg: 1, legs: points.length - 1 })
    setResult(null)
    onResult(null)
    try {
      const next = await computeRoute({ departure: context.departure, budgetMs: searchBudgetMs, onProgress: setProgress })
      setResult(next)
      onResult(next)
      setState('ready')
    } catch {
      setState('error')
    }
  }

  async function compareModels() {
    const context = routingContext()
    if (!context) return
    const selectedModel = weatherModel
    setComparisonState('loading')
    setComparisons([])
    const collected: ModelComparison[] = []

    try {
      for (const model of OFFSHORE_WEATHER_MODELS) {
        setOffshoreWeatherModel(model.value)
        try {
          const next = await computeRoute({ departure: context.departure, maxNodes: 12, headingStep: 30, budgetMs: 9_000 })
          collected.push({ model: model.value, result: next, error: false, distanceNm: routeDistanceNm(next), durationHours: routeDurationHours(next), meanSeparationNm: null })
        } catch {
          collected.push({ model: model.value, result: null, error: true, distanceNm: null, durationHours: null, meanSeparationNm: null })
        }
        setComparisons([...collected])
      }

      const reference = collected.find((item) => item.model === selectedModel && item.result?.bestRoute.length && item.result.bestRoute.length >= 2)
        ?? collected.find((item) => item.result?.bestRoute.length && item.result.bestRoute.length >= 2)
        ?? null
      const enriched = collected.map((item) => ({
        ...item,
        meanSeparationNm: reference ? routeSeparationNm(reference.result, item.result) : null,
      }))
      setComparisons(enriched)
      setComparisonState(enriched.some((item) => item.result) ? 'ready' : 'error')
    } finally {
      setOffshoreWeatherModel(selectedModel)
    }
  }

  return <section className="offshore-card offshore-isochrone-card">
    <div className="offshore-card-heading">
      <div><span>05</span><div><small>Routage météo</small><h2>Isochrones</h2></div></div>
      <Route size={24} />
    </div>
    <div className="offshore-isochrone-controls">
      <label><span><Wind size={14} /> Modèle météo</span><select value={weatherModel} onChange={(e) => changeWeatherModel(e.target.value as OffshoreWeatherModel)}>{OFFSHORE_WEATHER_MODELS.map((model) => <option key={model.value} value={model.value}>{model.label}</option>)}</select></label>
      <label><span><Clock3 size={14} /> Pas de temps</span><select value={stepMinutes} onChange={(e) => { setStepMinutes(e.target.value); invalidateCalculatedRoute() }}><option value="10">10 min</option><option value="15">15 min</option><option value="30">30 min</option><option value="60">1 h</option><option value="120">2 h</option></select></label>
      <label><span>Horizon</span><select value={maxHours} onChange={(e) => { setMaxHours(e.target.value); invalidateCalculatedRoute() }}><option value="3">3 h</option><option value="6">6 h</option><option value="12">12 h</option><option value="24">24 h</option><option value="48">48 h</option><option value="72">72 h</option><option value="120">5 jours</option></select></label>
      <label><span><Anchor size={14} /> Coefficient marée</span><input type="number" min="20" max="120" value={tidalCoefficient} onChange={(e) => { setTidalCoefficient(e.target.value); invalidateCalculatedRoute() }} /></label>
      <label className="offshore-high-water"><span>PM générique de secours</span><input type="datetime-local" value={referenceHighWater} onChange={(e) => { setReferenceHighWater(e.target.value); invalidateCalculatedRoute() }} /></label>
      <button type="button" className="offshore-add" onClick={() => void run()} disabled={state === 'loading' || comparisonState === 'loading' || !departureDate || !departureTime}>
        {state === 'loading' ? <LoaderCircle size={17} className="current-spin" /> : <Compass size={17} />}
        {state === 'loading' ? 'Calcul des isochrones…' : 'Calculer le routage'}
      </button>
      <small>Vent utilisé : <strong>{offshoreWeatherModelLabel(weatherModel)}</strong>. Mer et houle restent issues d’Open-Meteo Marine ; le courant SHOM reste prioritaire quand il est disponible.</small>
      {directDistance != null && <small>{automaticPreset.label} · {fmtNumber(directDistance)} nm : réglage automatique {automaticPreset.stepMinutes} min / {automaticPreset.maxHours} h. Tu peux le modifier manuellement.</small>}
      {points.length > 2 && <small><strong>{points.length - 2} waypoint{points.length > 3 ? 's' : ''} imposé{points.length > 3 ? 's' : ''}</strong> : chaque tronçon est calculé dans l’ordre, avec report de l’heure d’arrivée sur le suivant.</small>}
      {state === 'loading' && <small>Calcul adaptatif : si la recherche devient longue, CoachBrief réduit automatiquement le nombre de branches explorées mais continue jusqu’à l’arrivée ou jusqu’à la fin complète de l’horizon choisi.</small>}
    </div>

    {state === 'loading' && progress && <div className="offshore-routing-progress" role="status" aria-live="polite">
      <div className="offshore-routing-progress-heading">
        <strong>{progress.phase === 'coast' ? 'Chargement des côtes…' : `Exploration : pas ${progress.completed} / ${progress.total}`}</strong>
        {progress.legs > 1 && <span>Tronçon {progress.leg} / {progress.legs}</span>}
      </div>
      <div className={`offshore-routing-progress-track${progress.phase === 'coast' ? ' is-indeterminate' : ''}`}
        role="progressbar" aria-label="Progression du routage" aria-valuemin={0}
        aria-valuemax={progress.phase === 'search' ? progress.total : undefined}
        aria-valuenow={progress.phase === 'search' ? progress.completed : undefined}
        aria-valuetext={progress.phase === 'coast' ? 'Chargement des données côtières' : `Pas ${progress.completed} sur ${progress.total}, tronçon ${progress.leg} sur ${progress.legs}`}>
        <span style={progress.phase === 'search' ? { width: `${100 * progress.completed / progress.total}%` } : undefined} />
      </div>
      <small>{progress.phase === 'coast' ? 'Le contrôle des traversées de terre est en préparation.' : 'La barre indique les pas explorés dans l’horizon choisi. Le calcul peut se terminer avant la fin de l’horizon.'}</small>
    </div>}

    <div className="offshore-model-compare">
      <div className="offshore-model-compare-heading">
        <div>
          <strong>Comparer les modèles météo</strong>
          <small>CoachBrief refait un routage allégé avec Best Match, ECMWF, GFS, ICON et Météo-France. Le but est de vérifier si la stratégie reste proche malgré l’incertitude météo.</small>
        </div>
        <div className="offshore-model-compare-actions">
          <button type="button" className="offshore-add" onClick={() => void compareModels()} disabled={comparisonState === 'loading' || state === 'loading' || !departureDate || !departureTime}>
            {comparisonState === 'loading' ? <LoaderCircle size={17} className="current-spin" /> : <Wind size={17} />}
            {comparisonState === 'loading' ? 'Comparaison en cours…' : comparisons.length ? 'Relancer la comparaison' : 'Comparer les 5 modèles'}
          </button>
        </div>
      </div>
      {comparisonState === 'loading' && <p className="offshore-source">Les modèles sont calculés l’un après l’autre pour éviter les conflits de source météo. Sur mobile, la comparaison complète peut prendre environ 30 à 45 s.</p>}
      {comparisonState === 'error' && <p className="offshore-analysis-error">Aucun des modèles n’a pu produire un routage exploitable avec ces paramètres.</p>}
      {comparisons.length > 0 && <div className="offshore-model-compare-grid">
        {comparisons.map((comparison) => <article key={comparison.model} className={`offshore-model-result${comparison.model === weatherModel ? ' is-reference' : ''}${comparison.error ? ' is-error' : ''}`}>
          <div className="offshore-model-result-head">
            <strong>{offshoreWeatherModelLabel(comparison.model)}</strong>
            {comparison.model === weatherModel && <small>modèle sélectionné</small>}
          </div>
          {comparison.result ? <>
            <div className="offshore-model-result-metrics">
              <span>Arrivée<b>{comparison.result.reached ? fmtTime(comparison.result.eta) : 'hors horizon'}</b></span>
              <span>Distance route<b>{comparison.distanceNm == null ? '—' : `${fmtNumber(comparison.distanceNm)} nm`}</b></span>
              <span>Durée calculée<b>{comparison.durationHours == null ? '—' : `${fmtNumber(comparison.durationHours)} h`}</b></span>
              <span>Écart moyen de route<b>{comparison.meanSeparationNm == null ? '—' : `${fmtNumber(comparison.meanSeparationNm)} nm`}</b></span>
            </div>
            <p>{comparison.result.reached ? 'Le modèle trouve une arrivée dans l’horizon demandé.' : 'Le moteur n’atteint pas l’arrivée dans l’horizon avec ce modèle.'}</p>
            {comparison.model !== weatherModel && <button type="button" className="offshore-add" onClick={() => changeWeatherModel(comparison.model)}>Choisir ce modèle</button>}
          </> : <p>Ce modèle n’a pas fourni assez de données pour ce routage.</p>}
        </article>)}
      </div>}
      {comparisonSummary && <div className="offshore-model-agreement">
        <strong>{comparisonSummary.agreement}</strong> · {comparisonSummary.successful} modèles exploitables
        {comparisonSummary.maxSeparation != null ? ` · écart de route max moyen ${fmtNumber(comparisonSummary.maxSeparation)} nm` : ''}
        {comparisonSummary.etaSpreadMinutes != null ? ` · dispersion ETA ${fmtNumber(comparisonSummary.etaSpreadMinutes, 0)} min` : ''}.
        <br />Un accord fort indique que plusieurs modèles conduisent à une stratégie proche ; une divergence notable invite à considérer plusieurs scénarios plutôt qu’une route unique.
      </div>}
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
              onChange={(e) => { setPortHighWaters((current) => ({ ...current, [atlasId]: e.target.value })); invalidateCalculatedRoute() }}
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
      <span>Modèle vent <strong>{offshoreWeatherModelLabel(weatherModel)}</strong></span>
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
      <p className="offshore-source">Ces waypoints sont liés à ce calcul météo. Relance le routage si l’heure de départ, le modèle météo, la polaire ou les conditions de courant changent.</p>
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
