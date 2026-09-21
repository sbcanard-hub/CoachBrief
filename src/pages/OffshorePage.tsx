import { useCallback, useEffect, useMemo, useState } from 'react'
import { Anchor, ArrowRight, CalendarDays, ChevronDown, ChevronUp, Clock3, Compass, Crosshair, FolderOpen, Gauge, GripVertical, LoaderCircle, MapPin, Plus, Route, Sailboat, Save, Trash2, Waves, Wind } from 'lucide-react'
import { OffshoreRouteMap } from '../components/OffshoreRouteMap'
import { OffshorePolarPanel } from '../components/OffshorePolarPanel'
import { OffshoreIsochronePanel } from '../components/OffshoreIsochronePanel'
import { OffshorePlaceSearch } from '../components/OffshorePlaceSearch'
import { OffshoreWaypointSearch } from '../components/OffshoreWaypointSearch'
import { buildOffshoreLegs, estimateOffshoreEtaHours, totalOffshoreDistance, validOffshorePoint, type OffshorePoint } from '../offshore'
import { fetchOffshoreLegForecasts, type OffshoreLegForecast } from '../offshoreForecast'
import type { OffshorePlaceResult } from '../offshoreGeocoding'
import { DEMO_POLAR, type PolarTable } from '../offshorePolar'
import type { IsochroneResult } from '../offshoreIsochrone'
import { deleteOffshoreSavedRoute, loadOffshoreSavedRoutes, saveOffshoreRoute, type OffshoreIsochroneSettings, type OffshoreSavedRoute } from '../offshoreSavedRoutes'
import { usePreferences } from '../preferences'
import './offshore.css'
import './offshoreWarnings.css'
import './offshoreWaypointReorder.css'

const OFFSHORE_AUTOSAVE_KEY = 'coachbrief:offshore-autosave:v1'

function makePoint(name = ''): OffshorePoint {
  return { id: crypto.randomUUID(), name, latitude: '', longitude: '' }
}

function formatNm(value: number) { return `${value.toFixed(value >= 100 ? 0 : 1).replace('.', ',')} nm` }
function formatBearing(value: number | null) { return value == null ? '—' : `${String(Math.round(value)).padStart(3, '0')}°` }
function formatNumber(value: number | null, digits = 1) { return value == null ? '—' : value.toFixed(digits).replace('.', ',') }
function formatDuration(hours: number | null) {
  if (hours == null) return '—'
  const totalMinutes = Math.round(hours * 60)
  const days = Math.floor(totalMinutes / 1440)
  const remainder = totalMinutes % 1440
  const h = Math.floor(remainder / 60)
  const m = remainder % 60
  return [days ? `${days} j` : '', h ? `${h} h` : '', `${m} min`].filter(Boolean).join(' ')
}
function formatEta(value: string) {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date) : '—'
}

function localDateAndTime(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  }
}

function routeDistanceNm(route: IsochroneResult['bestRoute']) {
  let total = 0
  const radiusNm = 3440.065
  const rad = (value: number) => value * Math.PI / 180
  for (let index = 1; index < route.length; index += 1) {
    const previous = route[index - 1]
    const current = route[index]
    const lat1 = rad(previous.latitude)
    const lat2 = rad(current.latitude)
    const dLat = lat2 - lat1
    const dLon = rad(current.longitude - previous.longitude)
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
    total += 2 * radiusNm * Math.asin(Math.min(1, Math.sqrt(a)))
  }
  return total
}

export function OffshorePage() {
  const { language } = usePreferences()
  const displayPointName = (name: string) => name === 'Départ'
    ? ({ fr: 'Départ', en: 'Start', it: 'Partenza', es: 'Salida' })[language]
    : name === 'Arrivée' ? ({ fr: 'Arrivée', en: 'Finish', it: 'Arrivo', es: 'Llegada' })[language] : name
  const [raceName, setRaceName] = useState('')
  const [departureDate, setDepartureDate] = useState('')
  const [departureTime, setDepartureTime] = useState('')
  const [boatName, setBoatName] = useState('')
  const [boatType, setBoatType] = useState('Monocoque')
  const [averageSpeed, setAverageSpeed] = useState('7')
  const [points, setPoints] = useState<OffshorePoint[]>([makePoint('Départ'), makePoint('Arrivée')])
  const [forecasts, setForecasts] = useState<OffshoreLegForecast[]>([])
  const [forecastState, setForecastState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [polar, setPolar] = useState<PolarTable>(DEMO_POLAR)
  const [isochrones, setIsochrones] = useState<IsochroneResult | null>(null)
  const [isochroneSettings, setIsochroneSettings] = useState<OffshoreIsochroneSettings | null>(null)
  const [isochroneSettingsRestoreKey, setIsochroneSettingsRestoreKey] = useState(0)
  const [draggedWaypointId, setDraggedWaypointId] = useState<string | null>(null)
  const [geolocationState, setGeolocationState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [geolocationMessage, setGeolocationMessage] = useState('')
  const [savedRoutes, setSavedRoutes] = useState<OffshoreSavedRoute[]>(() => loadOffshoreSavedRoutes())
  const [currentSavedRouteId, setCurrentSavedRouteId] = useState<string | null>(null)
  const [selectedSavedRouteId, setSelectedSavedRouteId] = useState('')
  const [savedRouteName, setSavedRouteName] = useState('')
  const [saveMessage, setSaveMessage] = useState('')
  const [autoSave, setAutoSave] = useState(() => {
    try { return window.localStorage.getItem(OFFSHORE_AUTOSAVE_KEY) === '1' } catch { return false }
  })

  const legs = useMemo(() => buildOffshoreLegs(points), [points])
  const totalDistance = useMemo(() => totalOffshoreDistance(legs), [legs])
  const etaHours = useMemo(() => estimateOffshoreEtaHours(totalDistance, Number(averageSpeed)), [totalDistance, averageSpeed])
  const routeStart = points[0]
  const routeTarget = points[points.length - 1]
  const routeEndpointsReady = Boolean(routeStart && routeTarget && validOffshorePoint(routeStart) && validOffshorePoint(routeTarget))
  const allRoutePointsReady = routeEndpointsReady && points.every(validOffshorePoint)
  const hasValidIsochroneRoute = Boolean(isochrones && isochrones.bestRoute.length >= 2)
  const isochroneMetrics = useMemo(() => {
    if (!isochrones || isochrones.bestRoute.length < 2) return null
    const route = isochrones.bestRoute
    const firstTime = new Date(route[0].time).getTime()
    const lastTime = new Date(route[route.length - 1].time).getTime()
    const durationHours = Number.isFinite(firstTime) && Number.isFinite(lastTime) && lastTime >= firstTime
      ? (lastTime - firstTime) / 3_600_000
      : null
    const distanceNm = routeDistanceNm(route)
    return {
      distanceNm,
      durationHours,
      eta: isochrones.eta ?? route[route.length - 1].time,
      deltaNm: distanceNm - totalDistance,
      reached: isochrones.reached,
    }
  }, [isochrones, totalDistance])

  function invalidateRouteAnalysis() {
    setForecastState('idle')
    setForecasts([])
    setIsochrones(null)
  }

  function routeSnapshot() {
    return {
      raceName,
      departureDate,
      departureTime,
      boatName,
      boatType,
      averageSpeed,
      points,
      forecasts,
      polar,
      isochrones,
      isochroneSettings: isochroneSettings ?? undefined,
    }
  }

  function saveCurrentRoute(saveAs = false, silent = false) {
    const fallbackName = raceName.trim() || `${points[0]?.name || 'Départ'} → ${points[points.length - 1]?.name || 'Arrivée'}`
    const saved = saveOffshoreRoute(routeSnapshot(), {
      id: currentSavedRouteId,
      name: savedRouteName.trim() || fallbackName,
      saveAs,
    })
    setCurrentSavedRouteId(saved.id)
    setSelectedSavedRouteId(saved.id)
    setSavedRouteName(saved.name)
    setSavedRoutes(loadOffshoreSavedRoutes())
    if (!silent) setSaveMessage(saveAs ? 'Nouvelle copie enregistrée.' : 'Route enregistrée.')
    return saved
  }

  function openSavedRoute() {
    const saved = savedRoutes.find((item) => item.id === selectedSavedRouteId)
    if (!saved) return
    setRaceName(saved.raceName)
    setDepartureDate(saved.departureDate)
    setDepartureTime(saved.departureTime)
    setBoatName(saved.boatName)
    setBoatType(saved.boatType)
    setAverageSpeed(saved.averageSpeed)
    setPoints(saved.points)
    setForecasts(saved.forecasts)
    setForecastState(saved.forecasts.length ? 'ready' : 'idle')
    setPolar(saved.polar)
    setIsochrones(saved.isochrones)
    setIsochroneSettings(saved.isochroneSettings ?? null)
    setIsochroneSettingsRestoreKey((value) => value + 1)
    setCurrentSavedRouteId(saved.id)
    setSavedRouteName(saved.name)
    setGeolocationState('idle')
    setGeolocationMessage('')
    setSaveMessage(`Route « ${saved.name} » ouverte${saved.isochroneSettings ? ' avec ses réglages de routage' : ''}.`)
  }

  function removeSavedRoute() {
    if (!selectedSavedRouteId) return
    deleteOffshoreSavedRoute(selectedSavedRouteId)
    if (currentSavedRouteId === selectedSavedRouteId) setCurrentSavedRouteId(null)
    setSelectedSavedRouteId('')
    setSavedRoutes(loadOffshoreSavedRoutes())
    setSaveMessage('Route supprimée de cet appareil.')
  }

  useEffect(() => {
    try { window.localStorage.setItem(OFFSHORE_AUTOSAVE_KEY, autoSave ? '1' : '0') } catch { /* stockage indisponible */ }
  }, [autoSave])

  useEffect(() => {
    if (!autoSave || !currentSavedRouteId) return
    const timeout = window.setTimeout(() => saveCurrentRoute(false, true), 800)
    return () => window.clearTimeout(timeout)
  }, [autoSave, currentSavedRouteId, raceName, departureDate, departureTime, boatName, boatType, averageSpeed, points, forecasts, polar, isochrones, isochroneSettings])

  function updatePoint(id: string, key: keyof OffshorePoint, value: string) {
    setPoints((current) => current.map((point) => point.id === id ? { ...point, [key]: value } : point))
    invalidateRouteAnalysis()
  }

  const updatePointCoordinates = useCallback((id: string, latitude: string, longitude: string) => {
    setPoints((current) => current.map((point) => point.id === id ? { ...point, latitude, longitude } : point))
    setForecastState('idle'); setForecasts([]); setIsochrones(null)
  }, [])

  function useCurrentDeparturePosition() {
    if (!('geolocation' in navigator)) {
      setGeolocationState('error')
      setGeolocationMessage('La géolocalisation n’est pas disponible sur cet appareil.')
      return
    }

    setGeolocationState('loading')
    setGeolocationMessage('Recherche de ta position…')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords
        const now = localDateAndTime(new Date())
        setPoints((current) => current.map((point, index) => index === 0 ? {
          ...point,
          name: 'Ma position',
          latitude: latitude.toFixed(6),
          longitude: longitude.toFixed(6),
        } : point))
        if (!departureDate) setDepartureDate(now.date)
        if (!departureTime) setDepartureTime(now.time)
        invalidateRouteAnalysis()
        setGeolocationState('ready')
        setGeolocationMessage(`Départ placé sur ta position · précision ± ${Math.max(1, Math.round(accuracy))} m · date et heure de départ prêtes`)
      },
      (error) => {
        setGeolocationState('error')
        if (error.code === error.PERMISSION_DENIED) setGeolocationMessage('Autorise la localisation dans le navigateur pour utiliser ta position de départ.')
        else if (error.code === error.TIMEOUT) setGeolocationMessage('La localisation a pris trop de temps. Réessaie dans un endroit avec une meilleure réception GPS.')
        else setGeolocationMessage('Impossible de récupérer ta position pour le moment.')
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 15_000 },
    )
  }

  function addWaypoint() {
    setPoints((current) => {
      const next = [...current]
      next.splice(Math.max(1, next.length - 1), 0, makePoint(`Waypoint ${Math.max(1, next.length - 1)}`))
      return next
    })
    invalidateRouteAnalysis()
  }

  function addNamedWaypoint(place: OffshorePlaceResult) {
    setPoints((current) => {
      const next = [...current]
      next.splice(Math.max(1, next.length - 1), 0, {
        id: crypto.randomUUID(),
        name: place.name,
        latitude: place.latitude.toFixed(6),
        longitude: place.longitude.toFixed(6),
      })
      return next
    })
    invalidateRouteAnalysis()
  }

  function removePoint(id: string) {
    setPoints((current) => current.length <= 2 ? current : current.filter((point) => point.id !== id))
    invalidateRouteAnalysis()
  }

  function moveWaypoint(id: string, direction: -1 | 1) {
    setPoints((current) => {
      const index = current.findIndex((point) => point.id === id)
      if (index <= 0 || index >= current.length - 1) return current
      const target = index + direction
      if (target <= 0 || target >= current.length - 1) return current
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
    invalidateRouteAnalysis()
  }

  function dropWaypoint(targetId: string) {
    if (!draggedWaypointId || draggedWaypointId === targetId) return
    setPoints((current) => {
      const from = current.findIndex((point) => point.id === draggedWaypointId)
      const to = current.findIndex((point) => point.id === targetId)
      if (from <= 0 || to <= 0 || from >= current.length - 1 || to >= current.length - 1) return current
      const next = [...current]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
    setDraggedWaypointId(null)
    invalidateRouteAnalysis()
  }

  function applyPlace(place: OffshorePlaceResult, endpoint: 'departure' | 'arrival') {
    setPoints((current) => current.map((point, index) => {
      const targetIndex = endpoint === 'departure' ? 0 : current.length - 1
      if (index !== targetIndex) return point
      return {
        ...point,
        name: place.name,
        latitude: place.latitude.toFixed(6),
        longitude: place.longitude.toFixed(6),
      }
    }))
    invalidateRouteAnalysis()
    if (endpoint === 'departure') {
      setGeolocationState('idle')
      setGeolocationMessage('')
    }
  }

  async function analyseRoute() {
    const speed = Number(averageSpeed)
    if (!departureDate || !departureTime || !legs.length || !Number.isFinite(speed) || speed <= 0) return
    const departure = new Date(`${departureDate}T${departureTime}:00`)
    if (!Number.isFinite(departure.getTime())) return
    setForecastState('loading')
    try {
      const result = await fetchOffshoreLegForecasts(legs, departure, speed)
      setForecasts(result)
      setForecastState('ready')
    } catch {
      setForecasts([])
      setForecastState('error')
    }
  }

  return <main className="offshore-page">
    <section className="offshore-hero">
      <div className="offshore-kicker"><Route size={17} /> CoachBrief · Course au large</div>
      <h1>Préparer une route qui évolue <em>dans le temps et dans l’espace</em></h1>
      <p>Cette interface est séparée du petit parcours : on raisonne ici en route, tronçons, météo évolutive, courant, état de mer, caps, détroits et timing de passage.</p>
    </section>

    <section className="offshore-card">
      <div className="offshore-card-heading">
        <div><span>00</span><div><small>Sauvegarde</small><h2>Mes routes au large</h2></div></div>
        <Save size={24} />
      </div>
      <div className="offshore-grid offshore-grid-3">
        <label><span>Nom de la route</span><input value={savedRouteName} onChange={(e) => setSavedRouteName(e.target.value)} placeholder={raceName || 'Ex. Antibes → Calvi'} /></label>
        <label><span>Routes enregistrées</span><select value={selectedSavedRouteId} onChange={(e) => setSelectedSavedRouteId(e.target.value)}><option value="">Choisir une route…</option>{savedRoutes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label><span>Sauvegarde automatique</span><select value={autoSave ? 'on' : 'off'} onChange={(e) => setAutoSave(e.target.value === 'on')}><option value="off">Manuelle</option><option value="on">Automatique</option></select></label>
      </div>
      <div className="offshore-analysis-action">
        <div>
          <strong>{currentSavedRouteId ? 'Route liée à une sauvegarde' : 'Nouvelle préparation'}</strong>
          <p>Enregistre le bateau, D/A et waypoints, l’analyse météo, la polaire active, les réglages d’isochrones et le dernier routage calculé.</p>
          {saveMessage && <small className="offshore-source">{saveMessage}</small>}
        </div>
        <div className="offshore-waypoint-actions">
          <button type="button" className="offshore-add" onClick={() => saveCurrentRoute(false)}><Save size={16} /> Enregistrer</button>
          <button type="button" className="offshore-add" onClick={() => saveCurrentRoute(true)}><Plus size={16} /> Enregistrer sous</button>
          <button type="button" className="offshore-add" onClick={openSavedRoute} disabled={!selectedSavedRouteId}><FolderOpen size={16} /> Ouvrir</button>
          <button type="button" className="offshore-icon-button" onClick={removeSavedRoute} disabled={!selectedSavedRouteId} aria-label="Supprimer la route sélectionnée" title="Supprimer"><Trash2 size={17} /></button>
        </div>
      </div>
      <p className="offshore-help">Ces routes sont enregistrées sur l’appareil. Elles sont aussi incluses dans la sauvegarde globale CoachBrief : si la synchronisation Firebase est activée, elles suivent la même sauvegarde cloud que les briefings.</p>
    </section>

    <section className="offshore-card">
      <div className="offshore-card-heading">
        <div><span>01</span><div><small>Course</small><h2>Départ et bateau</h2></div></div>
        <Sailboat size={24} />
      </div>
      <div className="offshore-grid offshore-grid-3">
        <label><span>Nom de la course</span><input value={raceName} onChange={(e) => setRaceName(e.target.value)} placeholder="Ex. Fastnet, Spi Ouest offshore…" /></label>
        <label><span><CalendarDays size={15} /> Date de départ</span><input type="date" value={departureDate} onChange={(e) => { setDepartureDate(e.target.value); invalidateRouteAnalysis() }} /></label>
        <label><span><Clock3 size={15} /> Heure de départ</span><input type="time" value={departureTime} onChange={(e) => { setDepartureTime(e.target.value); invalidateRouteAnalysis() }} /></label>
        <label><span>Nom du bateau</span><input value={boatName} onChange={(e) => setBoatName(e.target.value)} placeholder="Nom ou numéro" /></label>
        <label><span>Type de bateau</span><select value={boatType} onChange={(e) => setBoatType(e.target.value)}><option>Monocoque</option><option>Multicoque</option><option>Mini 6.50</option><option>Class40</option><option>IRC / ORC</option><option>Autre</option></select></label>
        <label><span><Gauge size={15} /> Vitesse moyenne de travail</span><div className="offshore-unit"><input type="number" min="0.5" step="0.1" value={averageSpeed} onChange={(e) => { setAverageSpeed(e.target.value); setForecastState('idle'); setForecasts([]) }} /><b>nd</b></div></label>
      </div>
      <p className="offshore-help">La vitesse moyenne sert au premier échantillonnage des tronçons. Le routage isochrone utilise ensuite la polaire active du bateau.</p>
    </section>

    <section className="offshore-card">
      <div className="offshore-card-heading">
        <div><span>02</span><div><small>Route</small><h2>Départ, waypoints et arrivée</h2></div></div>
        <MapPin size={24} />
      </div>
      <div className="offshore-place-search-grid">
        <OffshorePlaceSearch title="Départ" marker="D" placeholder="Ex. Antibes ou Port Vauban…" onSelect={(place) => applyPlace(place, 'departure')} />
        <OffshorePlaceSearch title="Arrivée" marker="A" placeholder="Ex. Lorient ou Port de La Trinité…" onSelect={(place) => applyPlace(place, 'arrival')} />
      </div>
      <div className="offshore-analysis-action">
        <div>
          <strong>Départ depuis ta position actuelle</strong>
          <p>Sur le bateau ou au port, CoachBrief peut placer directement D à la position GPS du téléphone.</p>
          {geolocationMessage && <small className={geolocationState === 'error' ? 'offshore-analysis-error' : 'offshore-source'}>{geolocationMessage}</small>}
        </div>
        <button type="button" className="offshore-add" onClick={useCurrentDeparturePosition} disabled={geolocationState === 'loading'}>
          {geolocationState === 'loading' ? <LoaderCircle size={17} className="current-spin" /> : <Crosshair size={17} />}
          {geolocationState === 'loading' ? 'Localisation…' : 'Utiliser ma position'}
        </button>
      </div>
      <p className="offshore-help offshore-route-search-help">La recherche place automatiquement D ou A. Les coordonnées restent modifiables à la main, les marqueurs peuvent être déplacés sur la carte et les waypoints intermédiaires restent indépendants.</p>
      <OffshoreWaypointSearch onSelect={addNamedWaypoint} />
      <div className="offshore-route-layout">
        <div>
          <div className="offshore-points">
            {points.map((point, index) => {
              const isWaypoint = index > 0 && index < points.length - 1
              return <article
                className={`offshore-point${draggedWaypointId === point.id ? ' is-dragging' : ''}`}
                key={point.id}
                draggable={isWaypoint}
                onDragStart={() => { if (isWaypoint) setDraggedWaypointId(point.id) }}
                onDragEnd={() => setDraggedWaypointId(null)}
                onDragOver={(e) => { if (isWaypoint && draggedWaypointId) e.preventDefault() }}
                onDrop={() => { if (isWaypoint) dropWaypoint(point.id) }}
              >
                <div className="offshore-point-index">{index === 0 ? 'D' : index === points.length - 1 ? 'A' : index}</div>
                <label><span>Nom</span><input value={displayPointName(point.name)} onChange={(e) => updatePoint(point.id, 'name', e.target.value)} /></label>
                <label><span>Latitude</span><input inputMode="decimal" placeholder="48.390" value={point.latitude} onChange={(e) => updatePoint(point.id, 'latitude', e.target.value)} /></label>
                <label><span>Longitude</span><input inputMode="decimal" placeholder="-4.486" value={point.longitude} onChange={(e) => updatePoint(point.id, 'longitude', e.target.value)} /></label>
                {isWaypoint && <div className="offshore-waypoint-actions">
                  <button type="button" className="offshore-drag-handle" aria-label={`Déplacer ${point.name} par glisser-déposer`} title="Glisser pour réordonner"><GripVertical size={17} /></button>
                  <button type="button" className="offshore-icon-button" onClick={() => moveWaypoint(point.id, -1)} disabled={index === 1} aria-label={`Monter ${point.name}`}><ChevronUp size={17} /></button>
                  <button type="button" className="offshore-icon-button" onClick={() => moveWaypoint(point.id, 1)} disabled={index === points.length - 2} aria-label={`Descendre ${point.name}`}><ChevronDown size={17} /></button>
                  <button type="button" className="offshore-icon-button" onClick={() => removePoint(point.id)} aria-label={`Supprimer ${point.name}`}><Trash2 size={17} /></button>
                </div>}
              </article>
            })}
          </div>
          {points.length > 3 && <p className="offshore-reorder-help">Glisse les waypoints pour changer l’ordre de passage. Sur téléphone, utilise les flèches ↑ ↓.</p>}
          <button type="button" className="offshore-add" onClick={addWaypoint}><Plus size={17} /> Ajouter un waypoint manuel</button>
        </div>
        <div className="offshore-map-wrap">
          <div className="offshore-map-title"><MapPin size={16} /><strong>Carte de route</strong><span>{hasValidIsochroneRoute ? 'Route directe en pointillés · routage isochrone en trait plein.' : isochrones ? 'Route directe en pointillés · aucun routage maritime valide.' : 'Déplace les marqueurs pour ajuster les points.'}</span></div>
          <OffshoreRouteMap points={points} onPointChange={updatePointCoordinates} isochrones={isochrones} />
          {isochrones && !hasValidIsochroneRoute && <p className="offshore-analysis-error">Aucun routage maritime valide trouvé avec ces paramètres. La ligne en pointillés représente uniquement la distance géométrique directe entre D et A ; elle n’est pas une route navigable.</p>}
        </div>
      </div>
    </section>

    <section className="offshore-summary">
      <div className="offshore-summary-main">
        <span>Distance directe D → A</span>
        <strong>{formatNm(totalDistance)}</strong>
        <small>Temps théorique à {Number(averageSpeed) || 0} nd : {formatDuration(etaHours)} · hors contraintes de navigation</small>
      </div>
      {isochroneMetrics && <div className="offshore-summary-main">
        <span>{isochroneMetrics.reached ? 'Route météo calculée' : 'Route météo partielle'}</span>
        <strong>{formatNm(isochroneMetrics.distanceNm)}</strong>
        <small>
          {isochroneMetrics.durationHours != null ? `Durée : ${formatDuration(isochroneMetrics.durationHours)}` : 'Durée indisponible'}
          {isochroneMetrics.reached ? ` · ETA : ${formatEta(isochroneMetrics.eta)}` : ''}
          {Math.abs(isochroneMetrics.deltaNm) >= 0.1 ? ` · écart vs directe : ${isochroneMetrics.deltaNm >= 0 ? '+' : ''}${formatNumber(isochroneMetrics.deltaNm)} nm` : ''}
        </small>
      </div>}
      <div><Compass size={20} /><span>{legs.length} tronçon{legs.length > 1 ? 's' : ''}</span></div>
      <div><Wind size={20} /><span>Météo au passage</span></div>
      <div><Waves size={20} /><span>Mer + houle au passage</span></div>
      <div><Anchor size={20} /><span>Courant au passage</span></div>
    </section>

    {legs.length > 0 && <section className="offshore-card">
      <div className="offshore-card-heading">
        <div><span>03</span><div><small>Découpage tactique</small><h2>Tronçons de route et conditions estimées</h2></div></div>
        <Route size={24} />
      </div>
      <div className="offshore-analysis-action">
        <p>CoachBrief échantillonne les conditions au milieu de chaque tronçon à son heure estimée de passage.</p>
        <button type="button" className="offshore-add" onClick={() => void analyseRoute()} disabled={forecastState === 'loading' || !departureDate || !departureTime}>
          {forecastState === 'loading' ? <LoaderCircle size={17} className="current-spin" /> : <Wind size={17} />}
          {forecastState === 'loading' ? 'Analyse en cours…' : forecasts.length ? 'Actualiser l’analyse' : 'Analyser la route'}
        </button>
      </div>
      {forecastState === 'error' && <p className="offshore-analysis-error">Les données météo ou marines n’ont pas pu être récupérées. La géométrie de route reste disponible.</p>}
      <div className="offshore-legs">
        {legs.map((leg) => {
          const forecast = forecasts.find((item) => item.legIndex === leg.index) ?? null
          return <article key={`${leg.from.id}-${leg.to.id}`} className={forecast ? 'has-forecast' : ''}>
            <div className="offshore-leg-route"><strong>{leg.from.name}</strong><ArrowRight size={17} /><strong>{leg.to.name}</strong></div>
            <div><span>Distance</span><b>{formatNm(leg.distanceNm)}</b></div>
            <div><span>Route directe</span><b>{formatBearing(leg.bearing)}</b></div>
            <div><span>Passage estimé</span><b>{forecast ? formatEta(forecast.eta) : 'À calculer'}</b></div>
            {forecast && <div className="offshore-leg-forecast">
              <span><Wind size={14} /> Vent <b>{formatNumber(forecast.windSpeed)} nd · {formatBearing(forecast.windDirection)}</b>{forecast.windGust != null && <small>raf. {formatNumber(forecast.windGust)} nd</small>}</span>
              <span><Waves size={14} /> Mer <b>{formatNumber(forecast.waveHeight)} m · {formatBearing(forecast.waveDirection)}</b>{forecast.wavePeriod != null && <small>{formatNumber(forecast.wavePeriod, 0)} s</small>}</span>
              <span><Anchor size={14} /> Courant <b>{formatNumber(forecast.currentSpeed)} nd · {formatBearing(forecast.currentDirection)}</b></span>
            </div>}
          </article>
        })}
      </div>
      {forecasts.length > 0 && <p className="offshore-source">Source actuelle : Open-Meteo Forecast + Marine. La polaire et le routage permettent maintenant de dépasser l’hypothèse d’une vitesse constante.</p>}
    </section>}

    {legs.length > 0 && <OffshorePolarPanel legs={legs} forecasts={forecasts} polar={polar} onPolarChange={(next) => { setPolar(next); setIsochrones(null) }} />}

    {routeEndpointsReady && !allRoutePointsReady && <section className="offshore-card offshore-route-warning">
      <strong>Waypoint incomplet</strong>
      <p>Renseigne ou supprime chaque waypoint intermédiaire avant de calculer le routage. Aucun point imposé ne sera ignoré silencieusement.</p>
    </section>}

    {allRoutePointsReady && <OffshoreIsochronePanel
      points={points}
      departureDate={departureDate}
      departureTime={departureTime}
      polar={polar}
      settings={isochroneSettings}
      settingsRestoreKey={isochroneSettingsRestoreKey}
      onSettingsChange={setIsochroneSettings}
      onResult={setIsochrones}
    />}

    <section className="offshore-roadmap">
      <h2>Capacités du mode large</h2>
      <div className="offshore-roadmap-grid">
        <article><Wind /><strong>Multi-modèles</strong><p>Compare Best Match, ECMWF, GFS, ICON et Météo-France pour mesurer la robustesse de la stratégie.</p></article>
        <article><Anchor /><strong>Courants et marées</strong><p>Utilise les atlas SHOM disponibles, les coefficients et les pleines mers des ports de référence.</p></article>
        <article><Waves /><strong>Mer et houle</strong><p>Applique une perte de performance lorsque la mer ralentit le bateau sur la route calculée.</p></article>
        <article><Compass /><strong>Route navigable</strong><p>Écarte les branches traversant la terre, signale les TSS et respecte les waypoints imposés.</p></article>
      </div>
    </section>
  </main>
}
