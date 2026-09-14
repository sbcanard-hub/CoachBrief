import { useEffect, useLayoutEffect, useState } from 'react'
import {
  ArrowDownRight, ArrowUpRight, CalendarDays, ChevronDown, Clock3, CloudSun, Compass,
  Droplets, ExternalLink, Flag, Gauge, HelpCircle, Navigation, Radio, Sailboat, Thermometer, Waves, Wind,
} from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { bernotColumns, buildBernotRows, buildCoachRecommendations, buildStartModeAdvice } from '../bernot'
import type { BernotRow, CoachRecommendation, WeatherScenario } from '../bernot'
import { applyCalibrationToWeather, calibrationForSituation } from '../calibration'
import { CourseSizingPanel } from '../components/CourseSizingPanel'
import { TerrainAnalysisPanel } from '../components/TerrainAnalysisPanel'
import { ExpressReading } from '../components/ExpressReading'
import { WindShiftRhythm } from '../components/WindShiftRhythm'
import { RecommendedTrajectory } from '../components/RecommendedTrajectory'
import { aviationWeatherMetarUrl, nearbyMetarSources } from '../localSources'
import { fetchMetarCache, observationForStation, signedDirectionDelta } from '../metar'
import type { MetarCache, MetarObservation } from '../metar'
import { buildCoachObservationSignal, observationImpactLabel } from '../observations'
import { loadSavedBriefings, updateSavedBriefingRequest } from '../savedBriefings'
import { fetchWeatherForBriefing } from '../weather'
import type { LiveWeatherData, WeatherHour } from '../weather'
import type { BriefingRequest } from '../types'
import './resultsCalibration.css'
import { usePreferences, type Language } from '../preferences'
import { StartMode } from './StartMode'
import { StartLineAnalysis } from '../components/StartLineAnalysis'
import { IntelligentBriefing } from '../components/IntelligentBriefing'
import { buildIntelligentBriefing } from '../intelligentBriefing'
import { buildTacticalCoherence } from '../tacticalCoherence'
import { AnalysisCoherence } from '../components/AnalysisCoherence'

const mockHourlyForecast: WeatherHour[] = [
  { time: '09:00', speed: 7, gust: 10, direction: 45, temperature: 18 },
  { time: '10:00', speed: 9, gust: 13, direction: 65, temperature: 19 },
  { time: '11:00', speed: 11, gust: 15, direction: 80, temperature: 20 },
  { time: '12:00', speed: 13, gust: 17, direction: 90, temperature: 21 },
  { time: '13:00', speed: 14, gust: 18, direction: 105, temperature: 22 },
  { time: '14:00', speed: 13, gust: 17, direction: 110, temperature: 22 },
]

function formatDate(date?: string, locale = 'fr-FR') {
  if (!date) return new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date('2026-09-06T12:00:00'))
  const parsed = new Date(`${date}T12:00:00`)
  return Number.isNaN(parsed.getTime()) ? date : new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(parsed)
}

function formatAxis(axis?: string) {
  const value = Number(axis)
  return Number.isFinite(value) ? `${String(Math.round(value)).padStart(3, '0')}°` : '080°'
}

function formatOffset(offset: string | undefined, neutral: string, right: string, left: string) {
  const value = Number(offset)
  if (!Number.isFinite(value) || value === 0) return `0° · ${neutral}`
  return `${value > 0 ? '+' : ''}${value}° · ${value > 0 ? right : left}`
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
function metarWindLabel(observation: MetarObservation, gustLabel: string, windUnit: string) {
  const direction = observation.variableWind ? 'VRB' : observation.windDirection == null ? '—' : formatDegrees(observation.windDirection)
  const speed = observation.windSpeed == null ? '—' : `${observation.windSpeed} ${windUnit}`
  const gust = observation.gust == null ? '' : ` · ${gustLabel} ${observation.gust}`
  return `${direction} · ${speed}${gust}`
}
function signed(value: number, unit: string) {
  const rounded = Math.round(value)
  return `${rounded > 0 ? '+' : ''}${rounded}${unit}`
}

const bernotNames: Record<Language, Record<string, string>> = {
  fr: { Vent: 'Vent', Courant: 'Courant', Vagues: 'Vagues', 'Relief / côte': 'Relief / côte', Nuages: 'Nuages', 'Axe parcours': 'Parcours', Adversaires: 'Adversaires', Gauche: 'Gauche', 'Centre G.': 'Centre G.', Centre: 'Centre', 'Centre D.': 'Centre D.', Droite: 'Droite' },
  en: { Vent: 'Wind', Courant: 'Current', Vagues: 'Waves', 'Relief / côte': 'Terrain / coast', Nuages: 'Clouds', 'Axe parcours': 'Course', Adversaires: 'Competitors', Gauche: 'Left', 'Centre G.': 'Centre-left', Centre: 'Centre', 'Centre D.': 'Centre-right', Droite: 'Right' },
  it: { Vent: 'Vento', Courant: 'Corrente', Vagues: 'Onde', 'Relief / côte': 'Rilievo / costa', Nuages: 'Nuvole', 'Axe parcours': 'Percorso', Adversaires: 'Avversari', Gauche: 'Sinistra', 'Centre G.': 'Centro-sinistra', Centre: 'Centro', 'Centre D.': 'Centro-destra', Droite: 'Destra' },
  es: { Vent: 'Viento', Courant: 'Corriente', Vagues: 'Olas', 'Relief / côte': 'Relieve / costa', Nuages: 'Nubes', 'Axe parcours': 'Recorrido', Adversaires: 'Rivales', Gauche: 'Izquierda', 'Centre G.': 'Centro-izquierda', Centre: 'Centro', 'Centre D.': 'Centro-derecha', Droite: 'Derecha' },
}

function localizedBernotRows(rows: BernotRow[], language: Language, weather: WeatherScenario, request: BriefingRequest): BernotRow[] {
  if (language === 'fr') return rows
  const notes: Record<Exclude<Language, 'fr'>, Record<string, string>> = {
    en: { Vent: `Model trend from ${Math.round(weather.windStart)}° to ${Math.round(weather.windEnd)}°; estimated oscillation ±${weather.oscillation}°.`, Courant: 'Use measured or model current and check its cross-course component.', Vagues: 'Sea state affects speed, control and the chosen tack.', 'Relief / côte': `Confirm local coastal and terrain effects at ${request.location}.`, Nuages: `${Math.round(weather.cloudCover)}% cloud cover; monitor pressure changes.`, 'Axe parcours': `Course axis ${request.courseAxis || '—'}° and windward-mark offset ${request.windwardOffset || 0}°.`, Adversaires: 'Keep clear air and account for fleet density.' },
    it: { Vent: `Tendenza da ${Math.round(weather.windStart)}° a ${Math.round(weather.windEnd)}°; oscillazione stimata ±${weather.oscillation}°.`, Courant: 'Usa la corrente rilevata o prevista e controlla la componente trasversale.', Vagues: 'Lo stato del mare influenza velocità, controllo e bordo scelto.', 'Relief / côte': `Conferma gli effetti locali di costa e rilievo a ${request.location}.`, Nuages: `Nuvolosità ${Math.round(weather.cloudCover)}%; controlla le variazioni di pressione.`, 'Axe parcours': `Asse ${request.courseAxis || '—'}° e scarto della boa al vento ${request.windwardOffset || 0}°.`, Adversaires: 'Mantieni aria libera e considera la densità della flotta.' },
    es: { Vent: `Tendencia de ${Math.round(weather.windStart)}° a ${Math.round(weather.windEnd)}°; oscilación estimada ±${weather.oscillation}°.`, Courant: 'Usa la corriente observada o prevista y comprueba su componente transversal.', Vagues: 'El estado del mar afecta a la velocidad, el control y el bordo elegido.', 'Relief / côte': `Confirma los efectos locales de costa y relieve en ${request.location}.`, Nuages: `${Math.round(weather.cloudCover)}% de nubosidad; vigila los cambios de presión.`, 'Axe parcours': `Eje ${request.courseAxis || '—'}° y desvío de la boya de barlovento ${request.windwardOffset || 0}°.`, Adversaires: 'Mantén viento libre y considera la densidad de la flota.' },
  }
  return rows.map((row) => ({ ...row, factor: bernotNames[language][row.factor] || row.factor, note: notes[language][row.factor] || row.note }))
}

function localizedRecommendations(items: CoachRecommendation[], language: Language): CoachRecommendation[] {
  if (language === 'fr') return items
  const copy = {
    en: [{ title: 'Read the overall wind trend', text: 'Keep a route that benefits from the modelled rotation without committing to an edge too early.', why: 'The broad trend gives the strategy; on-water shifts determine the timing.' }, { title: 'Protect the start exit', text: 'Balance the favoured end with speed, traffic and the route to the intended side.', why: 'A small line advantage can be lost immediately in disturbed air or without an exit lane.' }, { title: 'Confirm the priority on the water', text: 'Compare the first readings with the model and keep an alternative route available.', why: 'Local effects can alter timing, strength and direction at short range.' }],
    it: [{ title: 'Leggere la tendenza generale', text: 'Mantieni una rotta che sfrutti la rotazione prevista senza chiuderti troppo presto su un bordo.', why: 'La tendenza generale indica la strategia; le rotazioni reali determinano il momento.' }, { title: 'Proteggere l’uscita dalla partenza', text: 'Bilancia l’estremità favorita con velocità, traffico e rotta verso il lato scelto.', why: 'Un piccolo vantaggio di linea si perde subito in aria sporca o senza via di uscita.' }, { title: 'Confermare la priorità in acqua', text: 'Confronta i primi rilievi con il modello e mantieni una rotta alternativa.', why: 'Gli effetti locali possono modificare rapidamente tempi, intensità e direzione.' }],
    es: [{ title: 'Leer la tendencia general', text: 'Mantén una ruta que aproveche la rotación prevista sin cerrarte demasiado pronto en un extremo.', why: 'La tendencia general orienta la estrategia; los roles reales determinan el momento.' }, { title: 'Proteger la salida de la línea', text: 'Equilibra el extremo favorecido con velocidad, tráfico y ruta hacia el lado elegido.', why: 'Una pequeña ventaja de línea se pierde enseguida con viento sucio o sin vía de escape.' }, { title: 'Confirmar la prioridad en el agua', text: 'Compara las primeras lecturas con el modelo y mantén una ruta alternativa.', why: 'Los efectos locales pueden modificar rápidamente el momento, la fuerza y la dirección.' }],
  }[language]
  return items.map((_, index) => copy[Math.min(index, copy.length - 1)])
}
export function ResultsPage() {
  const { language, locale, temperature, pressure, distance, length, t } = usePreferences()
  const calibrationSpeedText = (value: number | null) => value == null
    ? t('speedNotCalibrated')
    : Math.abs(value) < 0.2 ? t('speedCentred') : t(value > 0 ? 'speedUnderestimated' : 'speedOverestimated', { value: formatDecimal(Math.abs(value)) })
  const calibrationDirectionText = (value: number | null) => value == null
    ? t('directionNotCalibrated')
    : Math.abs(value) < 2 ? t('directionCentred') : t(value > 0 ? 'directionTooLeft' : 'directionTooRight', { value: Math.round(Math.abs(value)) })
  const locationState = useLocation()
  const navigate = useNavigate()
  const { state } = locationState
  const [request, setRequest] = useState<BriefingRequest | null>(() => state as BriefingRequest | null)
  const [openWhy, setOpenWhy] = useState<number | null>(null)
  const [liveWeather, setLiveWeather] = useState<LiveWeatherData | null>(null)
  const [weatherState, setWeatherState] = useState<'idle' | 'loading' | 'live' | 'fallback'>('idle')
  const [weatherError, setWeatherError] = useState('')
  const [metarCache, setMetarCache] = useState<MetarCache | null>(null)
  const [metarState, setMetarState] = useState<'loading' | 'ready' | 'unavailable'>('loading')
  const [savedBriefings] = useState(() => loadSavedBriefings())
  const [useLocalCalibration, setUseLocalCalibration] = useState(false)

  useEffect(() => { setRequest(state as BriefingRequest | null) }, [state])

  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    if (!request?.location || !request.date) return
    let active = true
    setWeatherState('loading')
    setWeatherError('')
    setUseLocalCalibration(false)
    fetchWeatherForBriefing(request)
      .then((data) => {
        if (!active) return
        setLiveWeather(data)
        setWeatherState('live')
        if (request.courseAxisMode === 'model_wind') {
          const modelAxis = String(Math.round(data.race.direction)).padStart(3, '0')
          if (request.courseAxis !== modelAxis) {
            const next = { ...request, courseAxis: modelAxis }
            setRequest(next)
            updateSavedBriefingRequest(next)
            navigate(`${locationState.pathname}${locationState.search}`, { state: next, replace: true })
          }
        }
      })
      .catch((error: unknown) => { if (active) { setLiveWeather(null); setWeatherState('fallback'); setWeatherError(error instanceof Error ? error.message : t('weatherUnavailable')) } })
    return () => { active = false }
  }, [request, t])

  useEffect(() => {
    let active = true
    fetchMetarCache()
      .then((cache) => { if (active) { setMetarCache(cache); setMetarState('ready') } })
      .catch(() => { if (active) setMetarState('unavailable') })
    return () => { active = false }
  }, [])

  if (!request) {
    const emptyCopy = {
      fr: ["Aucun briefing chargé", "Créez un nouveau briefing ou ouvrez une régate enregistrée.", "Nouveau briefing", "Mes briefings"],
      en: ["No briefing loaded", "Create a new briefing or open a saved race.", "New briefing", "My briefings"],
      it: ["Nessun briefing caricato", "Crea un nuovo briefing o apri una regata salvata.", "Nuovo briefing", "I miei briefing"],
      es: ["No hay ningún briefing cargado", "Crea un nuevo briefing o abre una regata guardada.", "Nuevo briefing", "Mis briefings"],
    }[language]
    return <main className="results-page briefing-page"><section className="saved-briefings-empty"><h1>{emptyCopy[0]}</h1><p>{emptyCopy[1]}</p><div className="saved-briefing-actions"><button type="button" className="primary" onClick={() => navigate('/')}>{emptyCopy[2]}</button><button type="button" onClick={() => navigate('/briefings')}>{emptyCopy[3]}</button></div></section></main>
  }

  const location = request?.location || 'Antibes · Baie des Anges'
  const raceTime = request?.raceTime || request?.startTime || '11:00'
  const boatClass = request?.boatClass || 'Optimist'
  const courseType = request?.courseType || 'Banane'
  const courseAxis = formatAxis(request?.courseAxis)
  const startLineBias = request?.startLineBias === 'Comité' ? t('committee') : request?.startLineBias === 'Pin' ? 'Pin' : t('neutral')
  const windwardOffset = formatOffset(request?.windwardOffset, t('neutralAxis'), t('right'), t('left'))
  const finishOrientation = request?.finishOrientation === 'Au vent' ? t('windward') : request?.finishOrientation === 'Travers' ? t('beamReach') : t('leeward')
  const localCalibrationMatch = calibrationForSituation(savedBriefings, request, liveWeather)
  const localCalibration = localCalibrationMatch?.calibration ?? null
  const localCalibrationConfidence = localCalibration ? ({
    fr: localCalibration.sampleCount >= 6 ? 'bonne confiance' : localCalibration.sampleCount >= 3 ? 'confiance moyenne' : 'premiers retours',
    en: localCalibration.sampleCount >= 6 ? 'good confidence' : localCalibration.sampleCount >= 3 ? 'medium confidence' : 'early feedback',
    it: localCalibration.sampleCount >= 6 ? 'buona affidabilità' : localCalibration.sampleCount >= 3 ? 'affidabilità media' : 'primi riscontri',
    es: localCalibration.sampleCount >= 6 ? 'buena confianza' : localCalibration.sampleCount >= 3 ? 'confianza media' : 'primeros datos',
  }[language]) : ''
  const correctedPreview = liveWeather && localCalibration ? applyCalibrationToWeather(liveWeather, localCalibration) : null
  const effectiveWeather = useLocalCalibration && correctedPreview ? correctedPreview : liveWeather
  const coachObservation = buildCoachObservationSignal(request, effectiveWeather)
  const rawBernotRows = buildBernotRows(request, effectiveWeather?.scenario, coachObservation)
  const tacticalWeather = effectiveWeather?.scenario ?? {
    windStart: 80, windEnd: 110, oscillation: 8, raceWindSpeed: 11,
    maxWindSpeed: 14, cloudCover: 25, waveHeight: 0.6,
  }
  const rawRecommendations = buildCoachRecommendations(request, effectiveWeather?.scenario, coachObservation)
  const bernotRows = localizedBernotRows(rawBernotRows, language, tacticalWeather, request)
  const recommendations = localizedRecommendations(rawRecommendations, language)
  const forecast = effectiveWeather?.hourly.length ? effectiveWeather.hourly : mockHourlyForecast
  const raceWeather = effectiveWeather?.race ?? { speed: 11, gust: 15, direction: 80, temperature: 20, humidity: 62, dewPoint: 14, pressure: 1018, cloudCover: 25 }
  const marine = effectiveWeather?.marine
  const pressureTrend = effectiveWeather?.pressureTrend ?? 'hausse'
  const weatherLabel = weatherState === 'live'
    ? useLocalCalibration ? t('weatherLocalCorrection') : t('weatherLive')
    : weatherState === 'loading' ? t('weatherConnecting') : t('weatherDemo')
  const sourceLatitude = effectiveWeather?.latitude ?? Number(request?.latitude)
  const sourceLongitude = effectiveWeather?.longitude ?? Number(request?.longitude)
  const courseAxisValue = Number.isFinite(Number(request?.courseAxis)) ? Number(request?.courseAxis) : raceWeather.direction
  const windwardOffsetValue = Number.isFinite(Number(request?.windwardOffset)) ? Number(request?.windwardOffset) : 0
  const localSources = Number.isFinite(sourceLatitude) && Number.isFinite(sourceLongitude)
    ? nearbyMetarSources(sourceLatitude, sourceLongitude).filter((source) => source.distance <= 250)
    : []
  const currentModelHour = request?.date === todayIso() && effectiveWeather ? closestCurrentModelHour(effectiveWeather.hourly) : null
  const windRotation = effectiveWeather ? signedDirectionDelta(effectiveWeather.scenario.windStart, effectiveWeather.scenario.windEnd) : 30
  const windRotationLabel = Math.abs(windRotation) < 2 ? t('stable') : `${windRotation > 0 ? t('right') : t('left')} · ${signed(windRotation, '°')}`
  const startMode = new URLSearchParams(locationState.search).get('mode') === 'depart'
  const tacticalCoherence = buildTacticalCoherence(request, tacticalWeather, rawBernotRows, savedBriefings)
  const startAdvice = buildStartModeAdvice(request, tacticalWeather, rawBernotRows, tacticalCoherence)
  const intelligentBriefing = buildIntelligentBriefing({ request, scenario: tacticalWeather, rows: bernotRows, observation: coachObservation, savedBriefings, localCorrectionApplied: useLocalCalibration, language, formatLength: (metres) => length(metres, 0), coherence: tacticalCoherence })

  function updateExpressReadings(readings: NonNullable<BriefingRequest['expressReadings']>) {
    if (!request) return
    const latest = readings.at(-1)
    const next: BriefingRequest = {
      ...request, expressReadings: readings,
      observationTime: latest ? new Date(latest.recordedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '',
      observedWindSpeed: latest?.windSpeed ?? '', observedWindDirection: latest?.windDirection ?? '', observedGust: latest?.gust ?? '',
      observedCurrentSpeed: latest?.currentSpeed ?? '', observedCurrentDirection: latest?.currentDirection ?? '', observedPressure: latest?.pressure ?? '',
      observedCloudCover: latest?.cloudCover ?? '', observationNotes: latest?.notes ?? '',
    }
    setRequest(next)
    updateSavedBriefingRequest(next)
    navigate(`${locationState.pathname}${locationState.search}`, { state: next, replace: true })
  }

  function updateRequest(next: BriefingRequest) {
    setRequest(next)
    updateSavedBriefingRequest(next)
    navigate(`${locationState.pathname}${locationState.search}`, { state: next, replace: true })
  }

  if (startMode) return <StartMode
    request={request}
    weather={effectiveWeather}
    scenario={tacticalWeather}
    rows={bernotRows}
    advice={startAdvice}
    observation={coachObservation}
    intelligentBriefing={intelligentBriefing}
    coherence={tacticalCoherence}
    onReadingsChange={updateExpressReadings}
    onRequestChange={updateRequest}
    onBack={() => navigate('/resultats', { state: request, replace: true })}
  />

  return (
    <main className="results-page briefing-page">
      <section className="briefing-hero" aria-labelledby="briefing-title">
        <div>
          <span className="step-label">{t('briefingWeatherTactics')} · {weatherLabel}</span>
          <h1 id="briefing-title">{location}</h1>
          <div className="event-meta">
            <span><CalendarDays size={15} /> {formatDate(request?.date, locale)}</span><span><Clock3 size={15} /> {t('raceAt')} {raceTime}</span>
            <span><Sailboat size={15} /> {boatClass}</span><span><Flag size={15} /> {t('course')} {t(courseType === 'Banane' ? 'courseBanana' : courseType === 'Trapèze' ? 'courseTrapezoid' : 'courseTriangle')}</span>
          </div>
          {weatherState === 'live' && effectiveWeather && <p className="weather-source-note">{t('weatherPoint')} : {effectiveWeather.placeName} · {effectiveWeather.latitude.toFixed(3)}, {effectiveWeather.longitude.toFixed(3)} · {effectiveWeather.timezone}</p>}
          {weatherState === 'fallback' && weatherError && <p className="weather-source-note is-warning">{t('weatherUnavailable')} : {weatherError}. {t('showingDemo')}.</p>}
        </div>
        <div className="hero-status"><span aria-hidden="true" /> {weatherState === 'live' ? t('dataLoaded') : t('briefingReady')}</div>
      </section>

      <section className="tactical-overview" aria-label={t('tacticalCourseSettings')}>
        <article><Compass /><div><small>{t('courseAxis')}</small><strong>{courseAxis}</strong><small>{t(request.courseAxisMode === 'model_wind' ? 'courseAxisSourceModel' : 'courseAxisSourceManual')}</small></div></article>
        <article><Navigation /><div><small>{t('favouredLine')}</small><strong>{startLineBias}</strong></div></article>
        <article><Wind /><div><small>{t('windwardMark')}</small><strong>{windwardOffset}</strong></div></article>
        <article><Flag /><div><small>{t('finish')}</small><strong>{finishOrientation}</strong></div></article>
      </section>

      <IntelligentBriefing briefing={intelligentBriefing} />

      <ExpressReading request={request} weather={effectiveWeather} onChange={updateExpressReadings} />
      <WindShiftRhythm readings={request?.expressReadings} />

      <StartLineAnalysis request={request} windDirection={raceWeather.direction} currentSpeed={coachObservation.currentVelocity ?? marine?.currentVelocity} currentDirection={coachObservation.currentDirection ?? marine?.currentDirection} />

      {localCalibration && localCalibrationMatch && <section className={`local-calibration-suggestion${useLocalCalibration ? ' is-applied' : ''}`} aria-labelledby="local-calibration-title">
        <div className="local-calibration-copy">
          <div className="local-calibration-heading"><h2 id="local-calibration-title">{t('localCorrectionSuggested')}</h2><span>{localCalibrationConfidence}</span></div>
          <p><strong>{language === 'fr' ? localCalibrationMatch.situationLabel : request.location}</strong> · {localCalibrationMatch.scope === 'situation' ? t('comparableRacesUsed', { count: localCalibrationMatch.situationSampleCount }) : t('globalHistoryFallback', { count: localCalibrationMatch.situationSampleCount, label: localCalibration.label })} {t('modelCalibrationSummary', { speed: calibrationSpeedText(localCalibration.meanSpeedBias), direction: calibrationDirectionText(localCalibration.meanDirectionBias) })}</p>
          <div className="local-calibration-metrics">
            <span>{t('speedBias')} <strong>{localCalibration.meanSpeedBias == null ? '—' : `${localCalibration.meanSpeedBias >= 0 ? '+' : ''}${formatDecimal(localCalibration.meanSpeedBias)} ${t('windUnit')}`}</strong></span>
            <span>{t('directionBias')} <strong>{localCalibration.meanDirectionBias == null ? '—' : `${localCalibration.meanDirectionBias >= 0 ? '+' : ''}${Math.round(localCalibration.meanDirectionBias)}°`}</strong></span>
            <span>{t('averageError')} <strong>{localCalibration.meanAbsSpeedError == null ? '—' : `${formatDecimal(localCalibration.meanAbsSpeedError)} ${t('windUnit')}`}{localCalibration.meanAbsDirectionError == null ? '' : ` · ${Math.round(localCalibration.meanAbsDirectionError)}°`}</strong></span>
          </div>
        </div>
        <div className="local-calibration-actions">
          <button type="button" className={useLocalCalibration ? 'is-active' : ''} disabled={!liveWeather} onClick={() => setUseLocalCalibration((value) => !value)}>{useLocalCalibration ? t('removeCorrection') : t('applyLocalCorrection')}</button>
          {liveWeather && correctedPreview && <small className="local-calibration-preview">{t('atRace')} : {Math.round(liveWeather.race.speed)} {t('windUnit')} · {formatDegrees(liveWeather.race.direction)} → {Math.round(correctedPreview.race.speed)} {t('windUnit')} · {formatDegrees(correctedPreview.race.direction)}</small>}
          <small>{useLocalCalibration ? t('correctionActive') : localCalibrationMatch.scope === 'situation' ? t('situationCorrection') : t('notEnoughSituationData')}</small>
        </div>
      </section>}

      {coachObservation.hasObservation && <section className="coach-observation" aria-labelledby="coach-observation-title">
        <div className="coach-observation-heading">
          <div><Radio size={18} /><div><span className="step-label">{t('yourReading')}</span><h2 id="coach-observation-title">{t('coachObservation')}</h2></div></div>
          <strong>{language === 'fr' ? observationImpactLabel(coachObservation) : Math.abs(coachObservation.windSpeedDelta ?? 0) >= 4 || Math.abs(coachObservation.windDirectionDelta ?? 0) >= 20 ? ({ en: 'Significant field/model difference', it: 'Scarto importante campo/modello', es: 'Diferencia importante campo/modelo' }[language]) : Math.abs(coachObservation.windSpeedDelta ?? 0) >= 2 || Math.abs(coachObservation.windDirectionDelta ?? 0) >= 10 ? ({ en: 'Field/model difference to monitor', it: 'Scarto campo/modello da monitorare', es: 'Diferencia campo/modelo por vigilar' }[language]) : ({ en: 'Field reading close to model', it: 'Rilievo vicino al modello', es: 'Lectura cercana al modelo' }[language])}</strong>
        </div>
        <div className="coach-observation-grid">
          <article><small>{t('time')}</small><strong>{coachObservation.observationTime || '—'}</strong>{coachObservation.modelHour && <span>{t('comparedModel')} : {coachObservation.modelHour.time}</span>}</article>
          <article><small>{t('wind')}</small><strong>{coachObservation.windSpeed == null ? '—' : `${formatDecimal(coachObservation.windSpeed)} ${t('windUnit')}`}</strong>{coachObservation.windSpeedDelta != null && <span>{t('modelGap')} {signed(coachObservation.windSpeedDelta, ` ${t('windUnit')}`)}</span>}</article>
          <article><small>{t('direction')}</small><strong>{coachObservation.windDirection == null ? '—' : formatDegrees(coachObservation.windDirection)}</strong>{coachObservation.windDirectionDelta != null && <span>{t('modelGap')} {signed(coachObservation.windDirectionDelta, '°')}</span>}</article>
          <article><small>{t('gust')}</small><strong>{coachObservation.gust == null ? '—' : `${formatDecimal(coachObservation.gust)} ${t('windUnit')}`}</strong>{coachObservation.gustDelta != null && <span>{t('modelGap')} {signed(coachObservation.gustDelta, ` ${t('windUnit')}`)}</span>}</article>
          <article><small>{t('waves')}</small><strong>{coachObservation.waveHeight == null ? '—' : length(coachObservation.waveHeight)}</strong>{coachObservation.waveHeightDelta != null && <span>{t('modelGap')} {coachObservation.waveHeightDelta > 0 ? '+' : ''}{formatDecimal(coachObservation.waveHeightDelta)} m</span>}</article>
          <article><small>{t('current')}</small><strong>{coachObservation.currentVelocity == null ? '—' : `${formatDecimal(coachObservation.currentVelocity)} ${t('windUnit')}`}</strong>{coachObservation.currentDirection != null && <span>{t('towards')} {formatDegrees(coachObservation.currentDirection)}</span>}</article>
          <article><small>{t('cloudCover')}</small><strong>{coachObservation.cloudCover == null ? '—' : `${Math.round(coachObservation.cloudCover)} %`}</strong></article>
          <article><small>{t('pressure')}</small><strong>{coachObservation.pressure == null ? '—' : pressure(coachObservation.pressure, 1)}</strong></article>
        </div>
        {coachObservation.notes && <p className="coach-observation-note"><strong>{t('fieldNote')} :</strong> {coachObservation.notes}</p>}
        <p className="coach-observation-help">{t('observationHelp')}</p>
      </section>}

      {localSources.length > 0 && <section className="local-sources" aria-labelledby="local-sources-title">
        <div className="local-sources-heading">
          <div><Radio size={18} /><div><span className="step-label">{t('externalObservations')}</span><h2 id="local-sources-title">{t('nearbyMetarStations')}</h2></div></div>
          <small>{metarState === 'loading' ? t('loadingObservations') : metarState === 'unavailable' ? t('metarUnavailable') : `Cache: ${metarCache?.generatedAt ? new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(metarCache.generatedAt)) : t('unavailable')}`}</small>
        </div>
        <div className="local-source-grid">{localSources.map((source) => {
          const observation = observationForStation(metarCache, source.id)
          const speedDelta = observation?.windSpeed != null && currentModelHour ? observation.windSpeed - currentModelHour.speed : null
          const directionDelta = observation?.windDirection != null && currentModelHour ? signedDirectionDelta(currentModelHour.direction, observation.windDirection) : null
          return <article key={source.id} className={`local-source-card${observation ? ' has-observation' : ''}`}>
            <a href={aviationWeatherMetarUrl(source.id)} target="_blank" rel="noreferrer" className="local-source-link" aria-label={t('openMetar', { station: source.id })}><ExternalLink size={15} /></a>
            <div className="local-source-title"><strong>{source.id}</strong><span>{source.name}</span></div>
            <small>{distance(source.distance)} {t('fromSailingArea')}{observation?.reportTime ? ` · ${observation.reportTime}` : ''}</small>
            {observation ? <>
              <div className="metar-reading"><span>{t('observedWind')}</span><strong>{metarWindLabel(observation, t('gust').toLowerCase(), t('windUnit'))}</strong></div>
              <div className="metar-secondary">
                <span>{observation.temperature == null ? 'T° —' : temperature(observation.temperature)}</span>
                <span>{observation.pressure == null ? 'QNH —' : pressure(observation.pressure)}</span>
              </div>
              {speedDelta != null && <div className="metar-comparison">{t('versusModelNow')} : <strong>{signed(speedDelta, ` ${t('windUnit')}`)}</strong>{directionDelta != null && <> · {t('direction').toLowerCase()} <strong>{signed(directionDelta, '°')}</strong></>}</div>}
              <p className="metar-raw">{observation.raw}</p>
            </> : <div className="metar-empty">{t('observationUnavailable')}</div>}
          </article>
        })}</div>
        <p className="local-source-note">{t('metarExplanation')}</p>
      </section>}

      <section className="weather-overview" aria-label={t('mainConditions')}>
        <article className="wind-feature">
          <div className="card-kicker"><Wind size={17} /> {t('raceWind')}</div>
          <div className="wind-reading"><div><strong>{Math.round(raceWeather.speed)}</strong><span>{t('knots')}<br />{t('average')}</span></div><div className="wind-arrow" aria-hidden="true" style={{ transform: `rotate(${raceWeather.direction - 45}deg)` }}><Navigation size={48} /></div></div>
          <div className="wind-details"><span><small>{t('gusts')}</small><strong>{Math.round(raceWeather.gust)} {t('windUnit')}</strong></span><span><small>{t('direction')}</small><strong>{formatDegrees(raceWeather.direction)} · {directionLabel(raceWeather.direction)}</strong></span></div>
        </article>
        <div className="conditions-grid">
          <article className="condition-card"><Thermometer /><div><small>{t('temperatures')}</small><strong>{temperature(raceWeather.temperature)} <span>{t('air')}</span></strong><p>{marine?.seaTemperature == null ? t('seaUnavailable') : `${temperature(marine.seaTemperature)} · ${t('water')}`}</p></div></article>
          <article className="condition-card"><Gauge /><div><small>{t('pressure')}</small><strong>{pressure(raceWeather.pressure)}</strong><p className="trend-up">{pressureTrend === 'hausse' ? <ArrowUpRight /> : pressureTrend === 'baisse' ? <ArrowDownRight /> : <span>→</span>} {pressureTrend === 'hausse' ? t('rising') : pressureTrend === 'baisse' ? t('falling') : t('stable')}</p></div></article>
          <article className="condition-card"><Droplets /><div><small>{t('dewPoint')}</small><strong>{temperature(raceWeather.dewPoint)}</strong><p>{t('humidity')} {Math.round(raceWeather.humidity)} %</p></div></article>
          <article className="condition-card"><CloudSun /><div><small>{t('cloudCover')}</small><strong>{Math.round(raceWeather.cloudCover)} %</strong><p>{raceWeather.cloudCover < 30 ? t('slightlyCloudy') : raceWeather.cloudCover < 70 ? t('variableClouds') : t('veryCloudy')}</p></div></article>
        </div>
      </section>

      <CourseSizingPanel boatClass={boatClass} courseType={courseType} windSpeed={raceWeather.speed} latitude={sourceLatitude} longitude={sourceLongitude} courseAxis={courseAxisValue} windwardOffset={windwardOffsetValue} />

      <TerrainAnalysisPanel terrain={effectiveWeather?.terrain} />

      <section className="brief-section" aria-labelledby="evolution-title"><div className="section-heading"><div><span className="section-number">01</span><div><span className="step-label">{t('raceWindow')}</span><h2 id="evolution-title">{t('hourlyEvolution')}</h2></div></div><div className="legend"><span className="legend-average" /> {t('averageWind')} <span className="legend-gust" /> {t('gusts')}</div></div>
        <div className="forecast-scroll" tabIndex={0} aria-label={t('hourlyForecast')}><div className="forecast-table" style={{ gridTemplateColumns: `repeat(${forecast.length}, minmax(130px, 1fr))` }}>{forecast.map((hour) => { const race = isRaceHour(hour.time, raceTime); return <article className={`forecast-hour${race ? ' is-race' : ''}`} key={hour.time}><div className="forecast-time">{hour.time}{race && <span>{t('race')}</span>}</div><Navigation className="direction-arrow" size={27} aria-hidden="true" style={{ transform: `rotate(${hour.direction - 45}deg)` }} /><strong className="hour-speed">{Math.round(hour.speed)}<small> {t('windUnit')}</small></strong><span className="hour-gust">{t('gust').toLowerCase()} {Math.round(hour.gust)}</span><span className="hour-direction">{formatDegrees(hour.direction)} · {directionLabel(hour.direction)}</span><span className="hour-temperature">{Math.round(hour.temperature)}°</span></article> })}</div></div>
      </section>

      <section className="dynamics-grid" aria-label={t('windAndSeaDynamics')}>
        <article className="detail-panel"><div className="panel-icon"><Compass /></div><div><span className="step-label">{t('windDynamics')}</span><h2>{t('oscillationRotation')}</h2></div><div className="metric-line"><span>{t('estimatedOscillation')}</span><strong>± {effectiveWeather?.scenario.oscillation ?? 8}°</strong></div><div className="metric-line"><span>{t('trend')}</span><strong className="rotation"><span aria-hidden="true">{Math.abs(windRotation) < 2 ? '→' : windRotation > 0 ? '↻' : '↺'}</span> {windRotationLabel}</strong></div><p>{effectiveWeather ? t('calculatedEvolution', { start: formatDegrees(effectiveWeather.scenario.windStart), end: formatDegrees(effectiveWeather.scenario.windEnd) }) : t('demoRotation')}</p></article>
        <article className="detail-panel sea-panel"><div className="panel-icon"><Waves /></div><div><span className="step-label">{t('sailingArea')}</span><h2>{t('seaState')}</h2></div><div className="sea-measure"><strong>{marine?.waveHeight == null ? '—' : length(marine.waveHeight)} {''}</strong><span>{marine?.waveDirection == null ? t('marineUnavailable') : t('wavesFrom', { direction: formatDegrees(marine.waveDirection) })}<br />{marine?.wavePeriod == null ? '' : t('periodSeconds', { value: marine.wavePeriod.toFixed(1).replace('.', ',') })}</span></div><div className="metric-line"><span>{t('modelCurrent')}</span><strong>{marine?.currentVelocity == null ? '—' : `${marine.currentVelocity.toFixed(1).replace('.', ',')} ${t('windUnit')} · ${formatDegrees(marine.currentDirection ?? 0)}`}</strong></div><p>{t('marineDisclaimer')}</p></article>
      </section>

      <section className="bernot-section" aria-labelledby="bernot-title"><div className="section-heading"><div><span className="section-number">02</span><div><span className="step-label">{t('waterReading')}</span><h2 id="bernot-title">{t('bernot')}</h2></div></div><span className="bernot-help">{t('dynamicPriorityHelp')}</span></div><div className="bernot-scroll" tabIndex={0} aria-label={t('bernotTable')}><div className="bernot-board"><div className="bernot-head factor-head">{t('factor')}</div>{bernotColumns.map((column) => <div className="bernot-head" key={column}>{bernotNames[language][column] || column}</div>)}{bernotRows.map((row, rowIndex) => <div className="bernot-row" key={row.factor}><div className="bernot-factor"><span className="priority-badge">{row.priority}</span><div><strong>{row.factor}</strong><small>{row.note}</small></div></div>{bernotColumns.map((column) => <div className={`bernot-cell${rawBernotRows[rowIndex]?.zone === column ? ' is-selected' : ''}`} key={column}>{rawBernotRows[rowIndex]?.zone === column ? <><span className="zone-marker">●</span><small>{t('trend')}</small></> : <span aria-hidden="true">·</span>}</div>)}</div>)}</div></div><p className="bernot-note">{t('bernotNote')}{useLocalCalibration ? ` ${t('historical')}` : ''}</p></section>

      <AnalysisCoherence coherence={tacticalCoherence} />

      <section className="coach-section" aria-labelledby="coach-title"><div className="coach-heading"><div><span className="step-label">{t('coachEssentials')}</span><h2 id="coach-title">{t('tacticalSummary')}</h2></div><span className="coach-badge">{t('threeCalculatedPoints')}</span></div><div className="recommendations">{recommendations.map((recommendation, index) => { const isOpen = openWhy === index; return <article className="recommendation" key={recommendation.title}><span className="recommendation-number">0{index + 1}</span><div className="recommendation-content"><h3>{recommendation.title}</h3><p>{recommendation.text}</p><button className="why-button" type="button" aria-expanded={isOpen} aria-controls={`why-${index}`} onClick={() => setOpenWhy(isOpen ? null : index)}><HelpCircle size={15} /> {t('why')} <ChevronDown className={isOpen ? 'rotated' : ''} size={15} /></button><div className="why-answer" id={`why-${index}`} hidden={!isOpen}>{recommendation.why}</div></div></article> })}</div></section>

      <RecommendedTrajectory request={request} rows={bernotRows} weather={tacticalWeather} coherence={tacticalCoherence} />

      <p className="data-note">{t('sourcesNote')}{useLocalCalibration ? ` · ${t('historicalCorrectionApplied')}` : ''} · {t('recommendationsDisclaimer')}</p>
    </main>
  )
}
