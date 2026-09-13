import { useEffect, useLayoutEffect, useState } from 'react'
import {
  ArrowDownRight, ArrowUpRight, CalendarDays, ChevronDown, Clock3, CloudSun, Compass,
  Droplets, ExternalLink, Flag, Gauge, HelpCircle, Navigation, Radio, Sailboat, Thermometer, Waves, Wind,
} from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { bernotColumns, buildBernotRows, buildCoachRecommendations, buildStartModeAdvice } from '../bernot'
import { applyCalibrationToWeather, calibrationConfidence, calibrationForSituation } from '../calibration'
import { CourseSizingPanel } from '../components/CourseSizingPanel'
import { ExpressReading } from '../components/ExpressReading'
import { WindShiftRhythm } from '../components/WindShiftRhythm'
import { RecommendedTrajectory } from '../components/RecommendedTrajectory'
import { aviationWeatherMetarUrl, nearbyMetarSources } from '../localSources'
import { fetchMetarCache, formatMetarGeneratedAt, observationForStation, signedDirectionDelta } from '../metar'
import type { MetarCache, MetarObservation } from '../metar'
import { buildCoachObservationSignal, observationImpactLabel } from '../observations'
import { loadSavedBriefings, updateSavedBriefingRequest } from '../savedBriefings'
import { fetchWeatherForBriefing } from '../weather'
import type { LiveWeatherData, WeatherHour } from '../weather'
import type { BriefingRequest } from '../types'
import './resultsCalibration.css'
import { usePreferences } from '../preferences'
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
      .then((data) => { if (active) { setLiveWeather(data); setWeatherState('live') } })
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
  const correctedPreview = liveWeather && localCalibration ? applyCalibrationToWeather(liveWeather, localCalibration) : null
  const effectiveWeather = useLocalCalibration && correctedPreview ? correctedPreview : liveWeather
  const coachObservation = buildCoachObservationSignal(request, effectiveWeather)
  const bernotRows = buildBernotRows(request, effectiveWeather?.scenario, coachObservation)
  const tacticalWeather = effectiveWeather?.scenario ?? {
    windStart: 80, windEnd: 110, oscillation: 8, raceWindSpeed: 11,
    maxWindSpeed: 14, cloudCover: 25, waveHeight: 0.6,
  }
  const recommendations = buildCoachRecommendations(request, effectiveWeather?.scenario, coachObservation)
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
  const tacticalCoherence = buildTacticalCoherence(request, tacticalWeather, bernotRows, savedBriefings)
  const startAdvice = buildStartModeAdvice(request, tacticalWeather, bernotRows, tacticalCoherence)
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
            <span><Sailboat size={15} /> {boatClass}</span><span><Flag size={15} /> {t('course')} {courseType}</span>
          </div>
          {weatherState === 'live' && effectiveWeather && <p className="weather-source-note">{t('weatherPoint')} : {effectiveWeather.placeName} · {effectiveWeather.latitude.toFixed(3)}, {effectiveWeather.longitude.toFixed(3)} · {effectiveWeather.timezone}</p>}
          {weatherState === 'fallback' && weatherError && <p className="weather-source-note is-warning">{t('weatherUnavailable')} : {weatherError}. {t('showingDemo')}.</p>}
        </div>
        <div className="hero-status"><span aria-hidden="true" /> {weatherState === 'live' ? t('dataLoaded') : t('briefingReady')}</div>
      </section>

      <section className="tactical-overview" aria-label={t('tacticalCourseSettings')}>
        <article><Compass /><div><small>{t('courseAxis')}</small><strong>{courseAxis}</strong></div></article>
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
          <div className="local-calibration-heading"><h2 id="local-calibration-title">{t('localCorrectionSuggested')}</h2><span>{calibrationConfidence(localCalibration.sampleCount)}</span></div>
          <p><strong>{localCalibrationMatch.situationLabel}</strong> · {localCalibrationMatch.scope === 'situation' ? t('comparableRacesUsed', { count: localCalibrationMatch.situationSampleCount }) : t('globalHistoryFallback', { count: localCalibrationMatch.situationSampleCount, label: localCalibration.label })} {t('modelCalibrationSummary', { speed: calibrationSpeedText(localCalibration.meanSpeedBias), direction: calibrationDirectionText(localCalibration.meanDirectionBias) })}</p>
          <div className="local-calibration-metrics">
            <span>{t('speedBias')} <strong>{localCalibration.meanSpeedBias == null ? '—' : `${localCalibration.meanSpeedBias >= 0 ? '+' : ''}${formatDecimal(localCalibration.meanSpeedBias)} nd`}</strong></span>
            <span>{t('directionBias')} <strong>{localCalibration.meanDirectionBias == null ? '—' : `${localCalibration.meanDirectionBias >= 0 ? '+' : ''}${Math.round(localCalibration.meanDirectionBias)}°`}</strong></span>
            <span>{t('averageError')} <strong>{localCalibration.meanAbsSpeedError == null ? '—' : `${formatDecimal(localCalibration.meanAbsSpeedError)} nd`}{localCalibration.meanAbsDirectionError == null ? '' : ` · ${Math.round(localCalibration.meanAbsDirectionError)}°`}</strong></span>
          </div>
        </div>
        <div className="local-calibration-actions">
          <button type="button" className={useLocalCalibration ? 'is-active' : ''} disabled={!liveWeather} onClick={() => setUseLocalCalibration((value) => !value)}>{useLocalCalibration ? t('removeCorrection') : t('applyLocalCorrection')}</button>
          {liveWeather && correctedPreview && <small className="local-calibration-preview">{t('atRace')} : {Math.round(liveWeather.race.speed)} nd · {formatDegrees(liveWeather.race.direction)} → {Math.round(correctedPreview.race.speed)} nd · {formatDegrees(correctedPreview.race.direction)}</small>}
          <small>{useLocalCalibration ? t('correctionActive') : localCalibrationMatch.scope === 'situation' ? t('situationCorrection') : t('notEnoughSituationData')}</small>
        </div>
      </section>}

      {coachObservation.hasObservation && <section className="coach-observation" aria-labelledby="coach-observation-title">
        <div className="coach-observation-heading">
          <div><Radio size={18} /><div><span className="step-label">{t('yourReading')}</span><h2 id="coach-observation-title">{t('coachObservation')}</h2></div></div>
          <strong>{observationImpactLabel(coachObservation)}</strong>
        </div>
        <div className="coach-observation-grid">
          <article><small>{t('time')}</small><strong>{coachObservation.observationTime || '—'}</strong>{coachObservation.modelHour && <span>{t('comparedModel')} : {coachObservation.modelHour.time}</span>}</article>
          <article><small>{t('wind')}</small><strong>{coachObservation.windSpeed == null ? '—' : `${formatDecimal(coachObservation.windSpeed)} nd`}</strong>{coachObservation.windSpeedDelta != null && <span>{t('modelGap')} {signed(coachObservation.windSpeedDelta, ' nd')}</span>}</article>
          <article><small>{t('direction')}</small><strong>{coachObservation.windDirection == null ? '—' : formatDegrees(coachObservation.windDirection)}</strong>{coachObservation.windDirectionDelta != null && <span>{t('modelGap')} {signed(coachObservation.windDirectionDelta, '°')}</span>}</article>
          <article><small>{t('gust')}</small><strong>{coachObservation.gust == null ? '—' : `${formatDecimal(coachObservation.gust)} nd`}</strong>{coachObservation.gustDelta != null && <span>{t('modelGap')} {signed(coachObservation.gustDelta, ' nd')}</span>}</article>
          <article><small>{t('waves')}</small><strong>{coachObservation.waveHeight == null ? '—' : length(coachObservation.waveHeight)}</strong>{coachObservation.waveHeightDelta != null && <span>{t('modelGap')} {coachObservation.waveHeightDelta > 0 ? '+' : ''}{formatDecimal(coachObservation.waveHeightDelta)} m</span>}</article>
          <article><small>{t('current')}</small><strong>{coachObservation.currentVelocity == null ? '—' : `${formatDecimal(coachObservation.currentVelocity)} nd`}</strong>{coachObservation.currentDirection != null && <span>{t('towards')} {formatDegrees(coachObservation.currentDirection)}</span>}</article>
          <article><small>{t('cloudCover')}</small><strong>{coachObservation.cloudCover == null ? '—' : `${Math.round(coachObservation.cloudCover)} %`}</strong></article>
          <article><small>{t('pressure')}</small><strong>{coachObservation.pressure == null ? '—' : pressure(coachObservation.pressure, 1)}</strong></article>
        </div>
        {coachObservation.notes && <p className="coach-observation-note"><strong>{t('fieldNote')} :</strong> {coachObservation.notes}</p>}
        <p className="coach-observation-help">{t('observationHelp')}</p>
      </section>}

      {localSources.length > 0 && <section className="local-sources" aria-labelledby="local-sources-title">
        <div className="local-sources-heading">
          <div><Radio size={18} /><div><span className="step-label">{t('externalObservations')}</span><h2 id="local-sources-title">{t('nearbyMetarStations')}</h2></div></div>
          <small>{metarState === 'loading' ? t('loadingObservations') : metarState === 'unavailable' ? t('metarUnavailable') : `Cache : ${formatMetarGeneratedAt(metarCache?.generatedAt ?? null)}`}</small>
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
              <div className="metar-reading"><span>{t('observedWind')}</span><strong>{metarWindLabel(observation)}</strong></div>
              <div className="metar-secondary">
                <span>{observation.temperature == null ? 'T° —' : temperature(observation.temperature)}</span>
                <span>{observation.pressure == null ? 'QNH —' : pressure(observation.pressure)}</span>
              </div>
              {speedDelta != null && <div className="metar-comparison">{t('versusModelNow')} : <strong>{signed(speedDelta, ' nd')}</strong>{directionDelta != null && <> · {t('direction').toLowerCase()} <strong>{signed(directionDelta, '°')}</strong></>}</div>}
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
          <div className="wind-details"><span><small>{t('gusts')}</small><strong>{Math.round(raceWeather.gust)} nds</strong></span><span><small>{t('direction')}</small><strong>{formatDegrees(raceWeather.direction)} · {directionLabel(raceWeather.direction)}</strong></span></div>
        </article>
        <div className="conditions-grid">
          <article className="condition-card"><Thermometer /><div><small>{t('temperatures')}</small><strong>{temperature(raceWeather.temperature)} <span>{t('air')}</span></strong><p>{marine?.seaTemperature == null ? t('seaUnavailable') : `${temperature(marine.seaTemperature)} · ${t('water')}`}</p></div></article>
          <article className="condition-card"><Gauge /><div><small>{t('pressure')}</small><strong>{pressure(raceWeather.pressure)}</strong><p className="trend-up">{pressureTrend === 'hausse' ? <ArrowUpRight /> : pressureTrend === 'baisse' ? <ArrowDownRight /> : <span>→</span>} {pressureTrend === 'hausse' ? t('rising') : pressureTrend === 'baisse' ? t('falling') : t('stable')}</p></div></article>
          <article className="condition-card"><Droplets /><div><small>{t('dewPoint')}</small><strong>{temperature(raceWeather.dewPoint)}</strong><p>{t('humidity')} {Math.round(raceWeather.humidity)} %</p></div></article>
          <article className="condition-card"><CloudSun /><div><small>{t('cloudCover')}</small><strong>{Math.round(raceWeather.cloudCover)} %</strong><p>{raceWeather.cloudCover < 30 ? t('slightlyCloudy') : raceWeather.cloudCover < 70 ? t('variableClouds') : t('veryCloudy')}</p></div></article>
        </div>
      </section>

      <CourseSizingPanel boatClass={boatClass} courseType={courseType} windSpeed={raceWeather.speed} latitude={sourceLatitude} longitude={sourceLongitude} courseAxis={courseAxisValue} windwardOffset={windwardOffsetValue} />

      <section className="brief-section" aria-labelledby="evolution-title"><div className="section-heading"><div><span className="section-number">01</span><div><span className="step-label">{t('raceWindow')}</span><h2 id="evolution-title">{t('hourlyEvolution')}</h2></div></div><div className="legend"><span className="legend-average" /> {t('averageWind')} <span className="legend-gust" /> {t('gusts')}</div></div>
        <div className="forecast-scroll" tabIndex={0} aria-label={t('hourlyForecast')}><div className="forecast-table" style={{ gridTemplateColumns: `repeat(${forecast.length}, minmax(130px, 1fr))` }}>{forecast.map((hour) => { const race = isRaceHour(hour.time, raceTime); return <article className={`forecast-hour${race ? ' is-race' : ''}`} key={hour.time}><div className="forecast-time">{hour.time}{race && <span>{t('race')}</span>}</div><Navigation className="direction-arrow" size={27} aria-hidden="true" style={{ transform: `rotate(${hour.direction - 45}deg)` }} /><strong className="hour-speed">{Math.round(hour.speed)}<small> nds</small></strong><span className="hour-gust">raf. {Math.round(hour.gust)}</span><span className="hour-direction">{formatDegrees(hour.direction)} · {directionLabel(hour.direction)}</span><span className="hour-temperature">{Math.round(hour.temperature)}°</span></article> })}</div></div>
      </section>

      <section className="dynamics-grid" aria-label={t('windAndSeaDynamics')}>
        <article className="detail-panel"><div className="panel-icon"><Compass /></div><div><span className="step-label">{t('windDynamics')}</span><h2>{t('oscillationRotation')}</h2></div><div className="metric-line"><span>{t('estimatedOscillation')}</span><strong>± {effectiveWeather?.scenario.oscillation ?? 8}°</strong></div><div className="metric-line"><span>{t('trend')}</span><strong className="rotation"><span aria-hidden="true">{Math.abs(windRotation) < 2 ? '→' : windRotation > 0 ? '↻' : '↺'}</span> {windRotationLabel}</strong></div><p>{effectiveWeather ? t('calculatedEvolution', { start: formatDegrees(effectiveWeather.scenario.windStart), end: formatDegrees(effectiveWeather.scenario.windEnd) }) : t('demoRotation')}</p></article>
        <article className="detail-panel sea-panel"><div className="panel-icon"><Waves /></div><div><span className="step-label">{t('sailingArea')}</span><h2>{t('seaState')}</h2></div><div className="sea-measure"><strong>{marine?.waveHeight == null ? '—' : length(marine.waveHeight)} {''}</strong><span>{marine?.waveDirection == null ? t('marineUnavailable') : t('wavesFrom', { direction: formatDegrees(marine.waveDirection) })}<br />{marine?.wavePeriod == null ? '' : t('periodSeconds', { value: marine.wavePeriod.toFixed(1).replace('.', ',') })}</span></div><div className="metric-line"><span>{t('modelCurrent')}</span><strong>{marine?.currentVelocity == null ? '—' : `${marine.currentVelocity.toFixed(1).replace('.', ',')} nd · ${formatDegrees(marine.currentDirection ?? 0)}`}</strong></div><p>{t('marineDisclaimer')}</p></article>
      </section>

      <section className="bernot-section" aria-labelledby="bernot-title"><div className="section-heading"><div><span className="section-number">02</span><div><span className="step-label">{t('waterReading')}</span><h2 id="bernot-title">{t('bernot')}</h2></div></div><span className="bernot-help">{t('dynamicPriorityHelp')}</span></div><div className="bernot-scroll" tabIndex={0} aria-label={t('bernotTable')}><div className="bernot-board"><div className="bernot-head factor-head">{t('factor')}</div>{bernotColumns.map((column) => <div className="bernot-head" key={column}>{column}</div>)}{bernotRows.map((row) => <div className="bernot-row" key={row.factor}><div className="bernot-factor"><span className="priority-badge">{row.priority}</span><div><strong>{row.factor}</strong><small>{row.note}</small></div></div>{bernotColumns.map((column) => <div className={`bernot-cell${row.zone === column ? ' is-selected' : ''}`} key={column}>{row.zone === column ? <><span className="zone-marker">●</span><small>{t('trend')}</small></> : <span aria-hidden="true">·</span>}</div>)}</div>)}</div></div><p className="bernot-note">{t('bernotNote')}{useLocalCalibration ? ` ${t('historical')}` : ''}</p></section>

      <AnalysisCoherence coherence={tacticalCoherence} />

      <section className="coach-section" aria-labelledby="coach-title"><div className="coach-heading"><div><span className="step-label">{t('coachEssentials')}</span><h2 id="coach-title">{t('tacticalSummary')}</h2></div><span className="coach-badge">{t('threeCalculatedPoints')}</span></div><div className="recommendations">{recommendations.map((recommendation, index) => { const isOpen = openWhy === index; return <article className="recommendation" key={recommendation.title}><span className="recommendation-number">0{index + 1}</span><div className="recommendation-content"><h3>{recommendation.title}</h3><p>{recommendation.text}</p><button className="why-button" type="button" aria-expanded={isOpen} aria-controls={`why-${index}`} onClick={() => setOpenWhy(isOpen ? null : index)}><HelpCircle size={15} /> {t('why')} <ChevronDown className={isOpen ? 'rotated' : ''} size={15} /></button><div className="why-answer" id={`why-${index}`} hidden={!isOpen}>{recommendation.why}</div></div></article> })}</div></section>

      <RecommendedTrajectory request={request} rows={bernotRows} weather={tacticalWeather} coherence={tacticalCoherence} />

      <p className="data-note">{t('sourcesNote')}{useLocalCalibration ? ` · ${t('historicalCorrectionApplied')}` : ''} · {t('recommendationsDisclaimer')}</p>
    </main>
  )
}
