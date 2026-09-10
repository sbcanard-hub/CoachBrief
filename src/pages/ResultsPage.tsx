import { useEffect, useState } from 'react'
import {
  ArrowDownRight, ArrowLeft, ArrowUpRight, CalendarDays, ChevronDown, Clock3, CloudSun, Compass,
  Droplets, ExternalLink, Flag, Gauge, HelpCircle, Navigation, Radio, Sailboat, Thermometer, Waves, Wind,
} from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { bernotColumns, buildBernotRows, buildCoachRecommendations } from '../bernot'
import { CourseSizingPanel } from '../components/CourseSizingPanel'
import { aviationWeatherMetarUrl, nearbyMetarSources } from '../localSources'
import { fetchMetarCache, formatMetarGeneratedAt, observationForStation, signedDirectionDelta } from '../metar'
import type { MetarCache, MetarObservation } from '../metar'
import { buildCoachObservationSignal, observationImpactLabel } from '../observations'
import { fetchWeatherForBriefing } from '../weather'
import type { LiveWeatherData, WeatherHour } from '../weather'
import type { BriefingRequest } from '../types'

const mockHourlyForecast: WeatherHour[] = [
  { time: '09:00', speed: 7, gust: 10, direction: 45, temperature: 18 },
  { time: '10:00', speed: 9, gust: 13, direction: 65, temperature: 19 },
  { time: '11:00', speed: 11, gust: 15, direction: 80, temperature: 20 },
  { time: '12:00', speed: 13, gust: 17, direction: 90, temperature: 21 },
  { time: '13:00', speed: 14, gust: 18, direction: 105, temperature: 22 },
  { time: '14:00', speed: 13, gust: 17, direction: 110, temperature: 22 },
]

function formatDate(date?: string) {
  if (!date) return 'Samedi 6 septembre 2026'
  const parsed = new Date(`${date}T12:00:00`)
  return Number.isNaN(parsed.getTime()) ? date : new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(parsed)
}

function formatAxis(axis?: string) {
  const value = Number(axis)
  return Number.isFinite(value) ? `${String(Math.round(value)).padStart(3, '0')}°` : '080°'
}

function formatOffset(offset?: string) {
  const value = Number(offset)
  if (!Number.isFinite(value) || value === 0) return '0° · axe neutre'
  return `${value > 0 ? '+' : ''}${value}° · ${value > 0 ? 'droite' : 'gauche'}`
}

function formatDegrees(value: number) { return `${String(Math.round(value)).padStart(3, '0')}°` }
function formatDecimal(value: number, digits = 1) { return value.toFixed(digits).replace('.', ',') }
function directionLabel(value: number) {
  const labels = ['N', 'N-E', 'E', 'S-E', 'S', 'S-O', 'O', 'N-O']
  return labels[Math.round((((value % 360) + 360) % 360) / 45) % 8]
}
function clockMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number)
  return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0)
}
function isRaceHour(hour: string, raceTime: string) { return Math.abs(clockMinutes(hour) - clockMinutes(raceTime)) <= 30 }
function todayIso() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
function closestCurrentModelHour(hours: WeatherHour[]) {
  if (!hours.length) return null
  const now = new Date()
  const target = now.getHours() * 60 + now.getMinutes()
  let closest: WeatherHour | null = null
  let distance = Number.POSITIVE_INFINITY
  for (const hour of hours) {
    const candidateDistance = Math.abs(clockMinutes(hour.time) - target)
    if (candidateDistance < distance) {
      distance = candidateDistance
      closest = hour
    }
  }
  return distance <= 90 ? closest : null
}
function metarWindLabel(observation: MetarObservation) {
  const direction = observation.variableWind ? 'VRB' : observation.windDirection == null ? '—' : formatDegrees(observation.windDirection)
  const speed = observation.windSpeed == null ? '—' : `${observation.windSpeed} nd`
  const gust = observation.gust == null ? '' : ` · raf. ${observation.gust}`
  return `${direction} · ${speed}${gust}`
}
function signed(value: number, unit: string) {
  const rounded = Math.round(value)
  return `${rounded > 0 ? '+' : ''}${rounded}${unit}`
}

export function ResultsPage() {
  const { state } = useLocation()
  const request = state as BriefingRequest | null
  const [openWhy, setOpenWhy] = useState<number | null>(null)
  const [liveWeather, setLiveWeather] = useState<LiveWeatherData | null>(null)
  const [weatherState, setWeatherState] = useState<'idle' | 'loading' | 'live' | 'fallback'>('idle')
  const [weatherError, setWeatherError] = useState('')
  const [metarCache, setMetarCache] = useState<MetarCache | null>(null)
  const [metarState, setMetarState] = useState<'loading' | 'ready' | 'unavailable'>('loading')

  useEffect(() => {
    if (!request?.location || !request.date) return
    let active = true
    setWeatherState('loading')
    setWeatherError('')
    fetchWeatherForBriefing(request)
      .then((data) => { if (active) { setLiveWeather(data); setWeatherState('live') } })
      .catch((error: unknown) => { if (active) { setLiveWeather(null); setWeatherState('fallback'); setWeatherError(error instanceof Error ? error.message : 'Météo réelle indisponible') } })
    return () => { active = false }
  }, [request])

  useEffect(() => {
    let active = true
    fetchMetarCache()
      .then((cache) => { if (active) { setMetarCache(cache); setMetarState('ready') } })
      .catch(() => { if (active) setMetarState('unavailable') })
    return () => { active = false }
  }, [])

  const location = request?.location || 'Antibes · Baie des Anges'
  const raceTime = request?.raceTime || request?.startTime || '11:00'
  const boatClass = request?.boatClass || 'Optimist'
  const courseType = request?.courseType || 'Banane'
  const courseAxis = formatAxis(request?.courseAxis)
  const startLineBias = request?.startLineBias || 'Neutre'
  const windwardOffset = formatOffset(request?.windwardOffset)
  const finishOrientation = request?.finishOrientation || 'Sous le vent'
  const coachObservation = buildCoachObservationSignal(request, liveWeather)
  const bernotRows = buildBernotRows(request, liveWeather?.scenario, coachObservation)
  const recommendations = buildCoachRecommendations(request, liveWeather?.scenario, coachObservation)
  const forecast = liveWeather?.hourly.length ? liveWeather.hourly : mockHourlyForecast
  const raceWeather = liveWeather?.race ?? { speed: 11, gust: 15, direction: 80, temperature: 20, humidity: 62, dewPoint: 14, pressure: 1018, cloudCover: 25 }
  const marine = liveWeather?.marine
  const pressureTrend = liveWeather?.pressureTrend ?? 'hausse'
  const weatherLabel = weatherState === 'live' ? 'Météo réelle · Open-Meteo' : weatherState === 'loading' ? 'Connexion météo en cours…' : 'Météo de démonstration'
  const sourceLatitude = liveWeather?.latitude ?? Number(request?.latitude)
  const sourceLongitude = liveWeather?.longitude ?? Number(request?.longitude)
  const courseAxisValue = Number.isFinite(Number(request?.courseAxis)) ? Number(request?.courseAxis) : raceWeather.direction
  const windwardOffsetValue = Number.isFinite(Number(request?.windwardOffset)) ? Number(request?.windwardOffset) : 0
  const localSources = Number.isFinite(sourceLatitude) && Number.isFinite(sourceLongitude)
    ? nearbyMetarSources(sourceLatitude, sourceLongitude).filter((source) => source.distance <= 250)
    : []
  const currentModelHour = request?.date === todayIso() && liveWeather ? closestCurrentModelHour(liveWeather.hourly) : null
  const windRotation = liveWeather ? signedDirectionDelta(liveWeather.scenario.windStart, liveWeather.scenario.windEnd) : 30
  const windRotationLabel = Math.abs(windRotation) < 2 ? 'Stable' : `${windRotation > 0 ? 'Droite' : 'Gauche'} · ${signed(windRotation, '°')}`

  return (
    <main className="results-page briefing-page">
      <Link className="back-link" to="/"><ArrowLeft size={17} /> Modifier les informations</Link>

      <section className="briefing-hero" aria-labelledby="briefing-title">
        <div>
          <span className="step-label">Briefing météo & tactique · {weatherLabel}</span>
          <h1 id="briefing-title">{location}</h1>
          <div className="event-meta">
            <span><CalendarDays size={15} /> {formatDate(request?.date)}</span><span><Clock3 size={15} /> Manche à {raceTime}</span>
            <span><Sailboat size={15} /> {boatClass}</span><span><Flag size={15} /> Parcours {courseType}</span>
          </div>
          {weatherState === 'live' && liveWeather && <p className="weather-source-note">Point météo : {liveWeather.placeName} · {liveWeather.latitude.toFixed(3)}, {liveWeather.longitude.toFixed(3)} · {liveWeather.timezone}</p>}
          {weatherState === 'fallback' && weatherError && <p className="weather-source-note is-warning">Météo réelle indisponible : {weatherError}. Affichage de la maquette.</p>}
        </div>
        <div className="hero-status"><span aria-hidden="true" /> {weatherState === 'live' ? 'Données chargées' : 'Briefing prêt'}</div>
      </section>

      <section className="tactical-overview" aria-label="Paramètres tactiques du parcours">
        <article><Compass /><div><small>Axe parcours</small><strong>{courseAxis}</strong></div></article>
        <article><Navigation /><div><small>Ligne favorable</small><strong>{startLineBias}</strong></div></article>
        <article><Wind /><div><small>Bouée au vent</small><strong>{windwardOffset}</strong></div></article>
        <article><Flag /><div><small>Arrivée</small><strong>{finishOrientation}</strong></div></article>
      </section>

      {coachObservation.hasObservation && <section className="coach-observation" aria-labelledby="coach-observation-title">
        <div className="coach-observation-heading">
          <div><Radio size={18} /><div><span className="step-label">Votre relevé</span><h2 id="coach-observation-title">Observation du coach</h2></div></div>
          <strong>{observationImpactLabel(coachObservation)}</strong>
        </div>
        <div className="coach-observation-grid">
          <article><small>Heure</small><strong>{coachObservation.observationTime || '—'}</strong>{coachObservation.modelHour && <span>modèle comparé : {coachObservation.modelHour.time}</span>}</article>
          <article><small>Vent</small><strong>{coachObservation.windSpeed == null ? '—' : `${formatDecimal(coachObservation.windSpeed)} nd`}</strong>{coachObservation.windSpeedDelta != null && <span>écart modèle {signed(coachObservation.windSpeedDelta, ' nd')}</span>}</article>
          <article><small>Direction</small><strong>{coachObservation.windDirection == null ? '—' : formatDegrees(coachObservation.windDirection)}</strong>{coachObservation.windDirectionDelta != null && <span>écart modèle {signed(coachObservation.windDirectionDelta, '°')}</span>}</article>
          <article><small>Rafale</small><strong>{coachObservation.gust == null ? '—' : `${formatDecimal(coachObservation.gust)} nd`}</strong>{coachObservation.gustDelta != null && <span>écart modèle {signed(coachObservation.gustDelta, ' nd')}</span>}</article>
          <article><small>Vagues</small><strong>{coachObservation.waveHeight == null ? '—' : `${formatDecimal(coachObservation.waveHeight)} m`}</strong>{coachObservation.waveHeightDelta != null && <span>écart modèle {coachObservation.waveHeightDelta > 0 ? '+' : ''}{formatDecimal(coachObservation.waveHeightDelta)} m</span>}</article>
          <article><small>Courant</small><strong>{coachObservation.currentVelocity == null ? '—' : `${formatDecimal(coachObservation.currentVelocity)} nd`}</strong>{coachObservation.currentDirection != null && <span>vers {formatDegrees(coachObservation.currentDirection)}</span>}</article>
          <article><small>Nébulosité</small><strong>{coachObservation.cloudCover == null ? '—' : `${Math.round(coachObservation.cloudCover)} %`}</strong></article>
          <article><small>Pression</small><strong>{coachObservation.pressure == null ? '—' : `${formatDecimal(coachObservation.pressure)} hPa`}</strong></article>
        </div>
        {coachObservation.notes && <p className="coach-observation-note"><strong>Note terrain :</strong> {coachObservation.notes}</p>}
        <p className="coach-observation-help">Le relevé du coach influence la hiérarchie Bernot. Un écart important avec le modèle augmente la priorité du vent et des effets locaux, sans transformer l’observation ponctuelle en prévision pour toute la manche.</p>
      </section>}

      {localSources.length > 0 && <section className="local-sources" aria-labelledby="local-sources-title">
        <div className="local-sources-heading">
          <div><Radio size={18} /><div><span className="step-label">Observations externes</span><h2 id="local-sources-title">Stations METAR proches</h2></div></div>
          <small>{metarState === 'loading' ? 'Chargement des observations…' : metarState === 'unavailable' ? 'Cache METAR indisponible' : `Cache : ${formatMetarGeneratedAt(metarCache?.generatedAt ?? null)}`}</small>
        </div>
        <div className="local-source-grid">{localSources.map((source) => {
          const observation = observationForStation(metarCache, source.id)
          const speedDelta = observation?.windSpeed != null && currentModelHour ? observation.windSpeed - currentModelHour.speed : null
          const directionDelta = observation?.windDirection != null && currentModelHour ? signedDirectionDelta(currentModelHour.direction, observation.windDirection) : null
          return <article key={source.id} className={`local-source-card${observation ? ' has-observation' : ''}`}>
            <a href={aviationWeatherMetarUrl(source.id)} target="_blank" rel="noreferrer" className="local-source-link" aria-label={`Ouvrir le METAR ${source.id}`}><ExternalLink size={15} /></a>
            <div className="local-source-title"><strong>{source.id}</strong><span>{source.name}</span></div>
            <small>{Math.round(source.distance)} km du plan d’eau{observation?.reportTime ? ` · ${observation.reportTime}` : ''}</small>
            {observation ? <>
              <div className="metar-reading"><span>Vent observé</span><strong>{metarWindLabel(observation)}</strong></div>
              <div className="metar-secondary">
                <span>{observation.temperature == null ? 'T° —' : `${observation.temperature}°C`}</span>
                <span>{observation.pressure == null ? 'QNH —' : `${observation.pressure} hPa`}</span>
              </div>
              {speedDelta != null && <div className="metar-comparison">Vs modèle maintenant : <strong>{signed(speedDelta, ' nd')}</strong>{directionDelta != null && <> · direction <strong>{signed(directionDelta, '°')}</strong></>}</div>}
              <p className="metar-raw">{observation.raw}</p>
            </> : <div className="metar-empty">Observation non disponible dans le dernier cache.</div>}
          </article>
        })}</div>
        <p className="local-source-note">Les METAR sont récupérés côté GitHub au déploiement, puis lus localement par CoachBrief. Ils décrivent les conditions observées aux aéroports : pour une régate aujourd’hui, l’écart au modèle est affiché lorsqu’une heure modèle proche de l’heure actuelle existe. Pour une date future, le METAR reste une référence d’observation et non une prévision.</p>
      </section>}

      <section className="weather-overview" aria-label="Conditions principales">
        <article className="wind-feature">
          <div className="card-kicker"><Wind size={17} /> Vent à la manche</div>
          <div className="wind-reading"><div><strong>{Math.round(raceWeather.speed)}</strong><span>nœuds<br />moyen</span></div><div className="wind-arrow" aria-hidden="true" style={{ transform: `rotate(${raceWeather.direction - 45}deg)` }}><Navigation size={48} /></div></div>
          <div className="wind-details"><span><small>Rafales</small><strong>{Math.round(raceWeather.gust)} nds</strong></span><span><small>Direction</small><strong>{formatDegrees(raceWeather.direction)} · {directionLabel(raceWeather.direction)}</strong></span></div>
        </article>
        <div className="conditions-grid">
          <article className="condition-card"><Thermometer /><div><small>Températures</small><strong>{Math.round(raceWeather.temperature)}°C <span>air</span></strong><p>{marine?.seaTemperature == null ? 'Mer —' : `${Math.round(marine.seaTemperature)}°C · eau`}</p></div></article>
          <article className="condition-card"><Gauge /><div><small>Pression</small><strong>{Math.round(raceWeather.pressure)} <span>hPa</span></strong><p className="trend-up">{pressureTrend === 'hausse' ? <ArrowUpRight /> : pressureTrend === 'baisse' ? <ArrowDownRight /> : <span>→</span>} {pressureTrend === 'hausse' ? 'En hausse' : pressureTrend === 'baisse' ? 'En baisse' : 'Stable'}</p></div></article>
          <article className="condition-card"><Droplets /><div><small>Point de rosée</small><strong>{Math.round(raceWeather.dewPoint)}°C</strong><p>Humidité {Math.round(raceWeather.humidity)} %</p></div></article>
          <article className="condition-card"><CloudSun /><div><small>Nébulosité</small><strong>{Math.round(raceWeather.cloudCover)} %</strong><p>{raceWeather.cloudCover < 30 ? 'Peu nuageux' : raceWeather.cloudCover < 70 ? 'Variable' : 'Très nuageux'}</p></div></article>
        </div>
      </section>

      <CourseSizingPanel boatClass={boatClass} courseType={courseType} windSpeed={raceWeather.speed} latitude={sourceLatitude} longitude={sourceLongitude} courseAxis={courseAxisValue} windwardOffset={windwardOffsetValue} />

      <section className="brief-section" aria-labelledby="evolution-title"><div className="section-heading"><div><span className="section-number">01</span><div><span className="step-label">Fenêtre de course</span><h2 id="evolution-title">Évolution heure par heure</h2></div></div><div className="legend"><span className="legend-average" /> Vent moyen <span className="legend-gust" /> Rafales</div></div>
        <div className="forecast-scroll" tabIndex={0} aria-label="Prévisions horaires"><div className="forecast-table" style={{ gridTemplateColumns: `repeat(${forecast.length}, minmax(130px, 1fr))` }}>{forecast.map((hour) => { const race = isRaceHour(hour.time, raceTime); return <article className={`forecast-hour${race ? ' is-race' : ''}`} key={hour.time}><div className="forecast-time">{hour.time}{race && <span>Manche</span>}</div><Navigation className="direction-arrow" size={27} aria-hidden="true" style={{ transform: `rotate(${hour.direction - 45}deg)` }} /><strong className="hour-speed">{Math.round(hour.speed)}<small> nds</small></strong><span className="hour-gust">raf. {Math.round(hour.gust)}</span><span className="hour-direction">{formatDegrees(hour.direction)} · {directionLabel(hour.direction)}</span><span className="hour-temperature">{Math.round(hour.temperature)}°</span></article> })}</div></div>
      </section>

      <section className="dynamics-grid" aria-label="Dynamique du vent et état de la mer">
        <article className="detail-panel"><div className="panel-icon"><Compass /></div><div><span className="step-label">Dynamique du vent</span><h2>Oscillation & rotation</h2></div><div className="metric-line"><span>Oscillation estimée</span><strong>± {liveWeather?.scenario.oscillation ?? 8}°</strong></div><div className="metric-line"><span>Tendance</span><strong className="rotation"><span aria-hidden="true">{Math.abs(windRotation) < 2 ? '→' : windRotation > 0 ? '↻' : '↺'}</span> {windRotationLabel}</strong></div><p>{liveWeather ? `Évolution calculée de ${formatDegrees(liveWeather.scenario.windStart)} à ${formatDegrees(liveWeather.scenario.windEnd)} sur la fenêtre choisie.` : 'Rotation progressive de 080° à 110° entre 11 h et 14 h.'}</p></article>
        <article className="detail-panel sea-panel"><div className="panel-icon"><Waves /></div><div><span className="step-label">Plan d'eau</span><h2>État de la mer</h2></div><div className="sea-measure"><strong>{marine?.waveHeight == null ? '—' : marine.waveHeight.toFixed(1).replace('.', ',')} {marine?.waveHeight == null ? '' : <small>m</small>}</strong><span>{marine?.waveDirection == null ? 'Donnée marine indisponible' : `Vagues depuis ${formatDegrees(marine.waveDirection)}`}<br />{marine?.wavePeriod == null ? '' : `Période ${marine.wavePeriod.toFixed(1).replace('.', ',')} s`}</span></div><div className="metric-line"><span>Courant modèle</span><strong>{marine?.currentVelocity == null ? '—' : `${marine.currentVelocity.toFixed(1).replace('.', ',')} nd · ${formatDegrees(marine.currentDirection ?? 0)}`}</strong></div><p>Les données marines servent au briefing tactique mais restent des données de modèle : elles ne remplacent pas les observations sur l’eau.</p></article>
      </section>

      <section className="bernot-section" aria-labelledby="bernot-title"><div className="section-heading"><div><span className="section-number">02</span><div><span className="step-label">Lecture du plan d’eau</span><h2 id="bernot-title">Les 7 piles de Bernot</h2></div></div><span className="bernot-help">Calcul dynamique · 1 = facteur prioritaire</span></div><div className="bernot-scroll" tabIndex={0} aria-label="Tableau des 7 piles de Bernot"><div className="bernot-board"><div className="bernot-head factor-head">Facteur</div>{bernotColumns.map((column) => <div className="bernot-head" key={column}>{column}</div>)}{bernotRows.map((row) => <div className="bernot-row" key={row.factor}><div className="bernot-factor"><span className="priority-badge">{row.priority}</span><div><strong>{row.factor}</strong><small>{row.note}</small></div></div>{bernotColumns.map((column) => <div className={`bernot-cell${row.zone === column ? ' is-selected' : ''}`} key={column}>{row.zone === column ? <><span className="zone-marker">●</span><small>tendance</small></> : <span aria-hidden="true">·</span>}</div>)}</div>)}</div></div><p className="bernot-note">La hiérarchie combine les paramètres de course, les modèles et, lorsqu’il est renseigné, le relevé terrain du coach.</p></section>

      <section className="coach-section" aria-labelledby="coach-title"><div className="coach-heading"><div><span className="step-label">L’essentiel pour le coach</span><h2 id="coach-title">Synthèse tactique</h2></div><span className="coach-badge">3 points calculés</span></div><div className="recommendations">{recommendations.map((recommendation, index) => { const isOpen = openWhy === index; return <article className="recommendation" key={recommendation.title}><span className="recommendation-number">0{index + 1}</span><div className="recommendation-content"><h3>{recommendation.title}</h3><p>{recommendation.text}</p><button className="why-button" type="button" aria-expanded={isOpen} aria-controls={`why-${index}`} onClick={() => setOpenWhy(isOpen ? null : index)}><HelpCircle size={15} /> Pourquoi <ChevronDown className={isOpen ? 'rotated' : ''} size={15} /></button><div className="why-answer" id={`why-${index}`} hidden={!isOpen}>{recommendation.why}</div></div></article> })}</div></section>

      <p className="data-note">Source modèle : Open-Meteo · Observations externes : METAR AviationWeather · Relevé terrain : saisie du coach · Les recommandations restent une aide au briefing à confronter aux conditions réelles.</p>
    </main>
  )
}
