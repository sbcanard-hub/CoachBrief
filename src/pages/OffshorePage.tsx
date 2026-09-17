import { useCallback, useMemo, useState } from 'react'
import { Anchor, ArrowRight, CalendarDays, Clock3, Compass, Gauge, LoaderCircle, MapPin, Plus, Route, Sailboat, Trash2, Waves, Wind } from 'lucide-react'
import { OffshoreRouteMap } from '../components/OffshoreRouteMap'
import { OffshorePolarPanel } from '../components/OffshorePolarPanel'
import { OffshoreIsochronePanel } from '../components/OffshoreIsochronePanel'
import { buildOffshoreLegs, estimateOffshoreEtaHours, totalOffshoreDistance, type OffshorePoint } from '../offshore'
import { fetchOffshoreLegForecasts, type OffshoreLegForecast } from '../offshoreForecast'
import { DEMO_POLAR, type PolarTable } from '../offshorePolar'
import type { IsochroneResult } from '../offshoreIsochrone'
import './offshore.css'

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

export function OffshorePage() {
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

  const legs = useMemo(() => buildOffshoreLegs(points), [points])
  const totalDistance = useMemo(() => totalOffshoreDistance(legs), [legs])
  const etaHours = useMemo(() => estimateOffshoreEtaHours(totalDistance, Number(averageSpeed)), [totalDistance, averageSpeed])

  function invalidateRouteAnalysis() {
    setForecastState('idle')
    setForecasts([])
    setIsochrones(null)
  }

  function updatePoint(id: string, key: keyof OffshorePoint, value: string) {
    setPoints((current) => current.map((point) => point.id === id ? { ...point, [key]: value } : point))
    invalidateRouteAnalysis()
  }

  const updatePointCoordinates = useCallback((id: string, latitude: string, longitude: string) => {
    setPoints((current) => current.map((point) => point.id === id ? { ...point, latitude, longitude } : point))
    setForecastState('idle'); setForecasts([]); setIsochrones(null)
  }, [])

  function addWaypoint() {
    setPoints((current) => {
      const next = [...current]
      next.splice(Math.max(1, next.length - 1), 0, makePoint(`Waypoint ${Math.max(1, next.length - 1)}`))
      return next
    })
    invalidateRouteAnalysis()
  }

  function removePoint(id: string) {
    setPoints((current) => current.length <= 2 ? current : current.filter((point) => point.id !== id))
    invalidateRouteAnalysis()
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
      <div className="offshore-route-layout">
        <div>
          <div className="offshore-points">
            {points.map((point, index) => <article className="offshore-point" key={point.id}>
              <div className="offshore-point-index">{index === 0 ? 'D' : index === points.length - 1 ? 'A' : index}</div>
              <label><span>Nom</span><input value={point.name} onChange={(e) => updatePoint(point.id, 'name', e.target.value)} /></label>
              <label><span>Latitude</span><input inputMode="decimal" placeholder="48.390" value={point.latitude} onChange={(e) => updatePoint(point.id, 'latitude', e.target.value)} /></label>
              <label><span>Longitude</span><input inputMode="decimal" placeholder="-4.486" value={point.longitude} onChange={(e) => updatePoint(point.id, 'longitude', e.target.value)} /></label>
              {index > 0 && index < points.length - 1 && <button type="button" className="offshore-icon-button" onClick={() => removePoint(point.id)} aria-label={`Supprimer ${point.name}`}><Trash2 size={17} /></button>}
            </article>)}
          </div>
          <button type="button" className="offshore-add" onClick={addWaypoint}><Plus size={17} /> Ajouter un waypoint</button>
        </div>
        <div className="offshore-map-wrap">
          <div className="offshore-map-title"><MapPin size={16} /><strong>Carte de route</strong><span>{isochrones ? 'Route directe en pointillés · routage isochrone en trait plein.' : 'Déplace les marqueurs pour ajuster les points.'}</span></div>
          <OffshoreRouteMap points={points} onPointChange={updatePointCoordinates} isochrones={isochrones} />
        </div>
      </div>
    </section>

    <section className="offshore-summary">
      <div className="offshore-summary-main">
        <span>Route calculée</span>
        <strong>{formatNm(totalDistance)}</strong>
        <small>Durée indicative à {Number(averageSpeed) || 0} nd : {formatDuration(etaHours)}</small>
      </div>
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

    {legs.length > 0 && <OffshoreIsochronePanel start={legs[0].from} target={legs[legs.length - 1].to} departureDate={departureDate} departureTime={departureTime} polar={polar} onResult={setIsochrones} />}

    <section className="offshore-roadmap">
      <h2>Étapes suivantes du mode large</h2>
      <div className="offshore-roadmap-grid">
        <article><Wind /><strong>Routage multi-modèles</strong><p>Comparer le même isochrone avec plusieurs modèles météo et mesurer la robustesse de la route.</p></article>
        <article><Anchor /><strong>Courants fins</strong><p>Appliquer SHOM sur les zones couvertes et les effets bathymétriques le long de chaque option de route.</p></article>
        <article><Waves /><strong>Mer et houle</strong><p>Appliquer une pénalité de performance lorsque la mer de face ou de travers ralentit le bateau.</p></article>
        <article><Compass /><strong>Contraintes de navigation</strong><p>Écarter automatiquement la terre, les zones interdites, TSS et autres contraintes de route.</p></article>
      </div>
    </section>
  </main>
}
