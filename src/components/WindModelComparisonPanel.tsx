import { Check, CircleGauge, LoaderCircle, Navigation, Wind } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { WEATHER_MODELS } from '../weather'
import type { WindModelComparison } from '../weather'
import type { BriefingRequest, WeatherModelKey } from '../types'
import { MultiModelSynthesisPanel } from './MultiModelSynthesisPanel'
import './windModelComparison.css'
import { usePreferences, type Language } from '../preferences'

const comparisonCopy = {
  fr: { missingVenue: 'Lieu non renseigné', venueNotFound: 'Lieu introuvable pour comparer les modèles', unavailable: 'Indisponible pour cette échéance ou cette zone.', noRaceData: 'Pas de donnée à l’heure de la manche.', incomplete: 'Vent incomplet pour cette échéance.', connection: 'Connexion au modèle impossible.', notEnough: 'Pas assez de modèles disponibles pour mesurer l’accord.', strong: 'Accord fort entre les modèles.', fair: 'Accord correct, avec quelques écarts.', spread: 'Dispersion importante : le terrain et les observations locales prennent davantage de poids.', expected: 'Vent prévu de', to: 'à', meanDirection: 'Direction moyenne', comparisonUnavailable: 'Comparaison indisponible', step: 'Prévision de vent · plusieurs modèles', title: 'Comparer avant de choisir', activeModel: 'Modèle utilisé dans le briefing', intro: 'Le « Best Match » est une sélection automatique Open-Meteo, pas un modèle unique identifié. Les autres cartes correspondent à des modèles explicites et indépendants. Changer de modèle recalcule le vent, l’évolution horaire et les recommandations du briefing.', loading: 'Comparaison des modèles et de leur évolution horaire…', used: 'utilisé', grid: 'Maille', wind: 'Vent', gusts: 'Rafales', direction: 'Direction', useModel: 'Utiliser ce modèle', dataUnavailable: 'Données indisponibles.', overTime: 'Comparaison dans le temps', hourly: 'Évolution heure par heure · tous les modèles', hourlyLegend: 'Vent moyen · rafale · direction', hourlyLabel: 'Comparaison horaire des modèles de vent', model: 'Modèle', active: 'actif', gustShort: 'raf.', raw: 'Lecture brute :', detail: 'Évolution détaillée affichée plus bas :', detailEnd: 'Le tableau ci-dessus sert à comparer les modèles ; la grande section horaire du briefing n’en affiche volontairement qu’un à la fois.' },
  en: { missingVenue: 'Venue not entered', venueNotFound: 'Venue not found for model comparison', unavailable: 'Unavailable for this forecast range or area.', noRaceData: 'No data at race time.', incomplete: 'Incomplete wind data for this forecast.', connection: 'Unable to connect to the model.', notEnough: 'Not enough models are available to measure agreement.', strong: 'Strong agreement between models.', fair: 'Reasonable agreement, with some differences.', spread: 'Large spread: on-water and local observations carry more weight.', expected: 'Forecast wind from', to: 'to', meanDirection: 'Mean direction', comparisonUnavailable: 'Comparison unavailable', step: 'Wind forecast · multiple models', title: 'Compare before choosing', activeModel: 'Model used in the briefing', intro: 'Best Match is an automatic Open-Meteo selection, not one identified model. The other cards are explicit, independent models. Changing model recalculates the wind, hourly evolution and briefing recommendations.', loading: 'Comparing models and their hourly evolution…', used: 'used', grid: 'Grid', wind: 'Wind', gusts: 'Gusts', direction: 'Direction', useModel: 'Use this model', dataUnavailable: 'Data unavailable.', overTime: 'Comparison over time', hourly: 'Hourly evolution · all models', hourlyLegend: 'Mean wind · gust · direction', hourlyLabel: 'Hourly comparison of wind models', model: 'Model', active: 'active', gustShort: 'gust', raw: 'Raw reading:', detail: 'Detailed evolution shown below:', detailEnd: 'The table above compares the models; the large hourly briefing section deliberately displays only one at a time.' },
  it: { missingVenue: 'Luogo non inserito', venueNotFound: 'Luogo non trovato per confrontare i modelli', unavailable: 'Non disponibile per questa scadenza o area.', noRaceData: 'Nessun dato all’ora della prova.', incomplete: 'Dati vento incompleti per questa scadenza.', connection: 'Impossibile connettersi al modello.', notEnough: 'Non ci sono abbastanza modelli per misurare l’accordo.', strong: 'Forte accordo tra i modelli.', fair: 'Accordo discreto, con alcune differenze.', spread: 'Dispersione importante: rilievi in acqua e osservazioni locali hanno più peso.', expected: 'Vento previsto da', to: 'a', meanDirection: 'Direzione media', comparisonUnavailable: 'Confronto non disponibile', step: 'Previsione del vento · più modelli', title: 'Confronta prima di scegliere', activeModel: 'Modello usato nel briefing', intro: 'Best Match è una selezione automatica Open-Meteo, non un singolo modello identificato. Le altre schede corrispondono a modelli espliciti e indipendenti. Cambiare modello ricalcola vento, evoluzione oraria e raccomandazioni.', loading: 'Confronto dei modelli e della loro evoluzione oraria…', used: 'usato', grid: 'Griglia', wind: 'Vento', gusts: 'Raffiche', direction: 'Direzione', useModel: 'Usa questo modello', dataUnavailable: 'Dati non disponibili.', overTime: 'Confronto nel tempo', hourly: 'Evoluzione oraria · tutti i modelli', hourlyLegend: 'Vento medio · raffica · direzione', hourlyLabel: 'Confronto orario dei modelli di vento', model: 'Modello', active: 'attivo', gustShort: 'raff.', raw: 'Lettura grezza:', detail: 'Evoluzione dettagliata mostrata sotto:', detailEnd: 'La tabella confronta i modelli; la grande sezione oraria del briefing ne mostra volutamente uno solo alla volta.' },
  es: { missingVenue: 'Lugar no indicado', venueNotFound: 'Lugar no encontrado para comparar los modelos', unavailable: 'No disponible para este plazo o esta zona.', noRaceData: 'No hay datos a la hora de la prueba.', incomplete: 'Datos de viento incompletos para este plazo.', connection: 'No se pudo conectar con el modelo.', notEnough: 'No hay suficientes modelos disponibles para medir el acuerdo.', strong: 'Acuerdo fuerte entre los modelos.', fair: 'Acuerdo razonable, con algunas diferencias.', spread: 'Dispersión importante: las lecturas en el agua y las observaciones locales tienen más peso.', expected: 'Viento previsto de', to: 'a', meanDirection: 'Dirección media', comparisonUnavailable: 'Comparación no disponible', step: 'Previsión de viento · varios modelos', title: 'Comparar antes de elegir', activeModel: 'Modelo utilizado en el briefing', intro: 'Best Match es una selección automática de Open-Meteo, no un único modelo identificado. Las demás tarjetas corresponden a modelos explícitos e independientes. Cambiar de modelo recalcula el viento, la evolución horaria y las recomendaciones.', loading: 'Comparando los modelos y su evolución horaria…', used: 'utilizado', grid: 'Malla', wind: 'Viento', gusts: 'Rachas', direction: 'Dirección', useModel: 'Usar este modelo', dataUnavailable: 'Datos no disponibles.', overTime: 'Comparación temporal', hourly: 'Evolución horaria · todos los modelos', hourlyLegend: 'Viento medio · racha · dirección', hourlyLabel: 'Comparación horaria de modelos de viento', model: 'Modelo', active: 'activo', gustShort: 'racha', raw: 'Lectura bruta:', detail: 'Evolución detallada mostrada abajo:', detailEnd: 'La tabla anterior compara los modelos; la sección horaria grande del briefing muestra deliberadamente uno cada vez.' },
} as const

function localizedModelDetails(key: WeatherModelKey, language: Language, fallback: string, horizon: string) {
  const notes: Record<Language, Partial<Record<WeatherModelKey, string>>> = {
    fr: {},
    en: { best_match: 'Automatic Open-Meteo selection based on location and forecast range.', meteofrance_arome_france: 'Fine-grid model, especially useful on the French coast at short range.', ecmwf_ifs: 'High-resolution global reference, useful for synoptic trends and overall consistency.', icon_eu: 'Independent European model, useful for comparing wind rotations and gradients.', ncep_gfs_global: 'US global model, coarser locally but useful for checking the background trend.' },
    it: { best_match: 'Selezione automatica Open-Meteo in base al luogo e alla scadenza.', meteofrance_arome_france: 'Modello a griglia fine, particolarmente utile sulla costa francese a breve termine.', ecmwf_ifs: 'Riferimento globale ad alta risoluzione, utile per tendenza sinottica e coerenza generale.', icon_eu: 'Modello europeo indipendente, utile per confrontare rotazioni e gradienti del vento.', ncep_gfs_global: 'Modello globale statunitense, meno fine localmente ma utile per verificare la tendenza di fondo.' },
    es: { best_match: 'Selección automática de Open-Meteo según el lugar y el plazo.', meteofrance_arome_france: 'Modelo de malla fina, especialmente útil en la costa francesa a corto plazo.', ecmwf_ifs: 'Referencia global de alta resolución, útil para la tendencia sinóptica y la coherencia general.', icon_eu: 'Modelo europeo independiente, útil para comparar rotaciones y gradientes de viento.', ncep_gfs_global: 'Modelo global estadounidense, menos fino localmente pero útil para comprobar la tendencia de fondo.' },
  }
  const localizedHorizon = language === 'fr' ? horizon : horizon.replace(/\bj\b/g, language === 'en' ? 'days' : language === 'it' ? 'g' : 'días')
  return { note: notes[language][key] ?? fallback, horizon: localizedHorizon }
}

type ComparisonState = 'idle' | 'loading' | 'ready' | 'error'

type WindTimelineHour = {
  time: string
  speed: number | null
  gust: number | null
  direction: number | null
}

type WindModelTimelineComparison = WindModelComparison & {
  hourly: WindTimelineHour[]
}

type WindForecastResponse = {
  timezone?: string
  hourly?: {
    time: string[]
    wind_speed_10m: Array<number | null>
    wind_direction_10m: Array<number | null>
    wind_gusts_10m: Array<number | null>
  }
}

function validCoordinate(value: string | undefined) {
  if (!value?.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

async function resolveCoordinates(request: BriefingRequest, language: Language) {
  const c = comparisonCopy[language]
  const latitude = validCoordinate(request.latitude)
  const longitude = validCoordinate(request.longitude)
  if (latitude != null && longitude != null) return { latitude, longitude }

  const location = request.location.trim()
  if (!location) throw new Error(c.missingVenue)
  const simplified = location
    .replace(/^baie\s+d['’]*/i, '')
    .replace(/^baie\s+de\s+/i, '')
    .replace(/^port\s+d['’]*/i, '')
    .replace(/^port\s+de\s+/i, '')
    .trim()
  const candidates = Array.from(new Set([location, simplified])).filter((value) => value.length >= 2)

  for (const name of candidates) {
    const params = new URLSearchParams({ name, count: '1', language: 'fr', format: 'json' })
    try {
      const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`)
      if (!response.ok) continue
      const data = await response.json() as { results?: Array<{ latitude: number; longitude: number }> }
      const point = data.results?.[0]
      if (point && Number.isFinite(point.latitude) && Number.isFinite(point.longitude)) {
        return { latitude: point.latitude, longitude: point.longitude }
      }
    } catch {
      // On essaie le nom suivant avant d'abandonner.
    }
  }
  throw new Error(c.venueNotFound)
}

function formatDegrees(value: number | null) {
  if (value == null) return '—'
  return `${String(Math.round(value)).padStart(3, '0')}°`
}

function formatSpeed(value: number | null) {
  if (value == null) return '—'
  return `${value.toFixed(1).replace('.0', '')} nd`
}

function minutesFromIso(value: string) {
  const time = value.split('T')[1] ?? '00:00'
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function minutesFromClock(value: string | undefined, fallback: number) {
  if (!value) return fallback
  const [hours, minutes] = value.split(':').map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return fallback
  return hours * 60 + minutes
}

function nearestIndex(times: string[], clock: string | undefined) {
  const target = minutesFromClock(clock, 12 * 60)
  let bestIndex = 0
  let bestDistance = Number.POSITIVE_INFINITY
  times.forEach((time, index) => {
    const distance = Math.abs(minutesFromIso(time) - target)
    if (distance < bestDistance) {
      bestDistance = distance
      bestIndex = index
    }
  })
  return bestIndex
}

function safeNumber(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function buildHourlyTimeline(forecast: WindForecastResponse, request: BriefingRequest) {
  if (!forecast.hourly?.time.length) return []
  const startMinutes = minutesFromClock(request.startTime, 0)
  const endMinutes = minutesFromClock(request.endTime, 24 * 60 - 1)
  const selectedIndexes = forecast.hourly.time
    .map((time, index) => ({ index, minute: minutesFromIso(time) }))
    .filter(({ minute }) => minute >= startMinutes && minute <= endMinutes)
    .map(({ index }) => index)
  const indexes = selectedIndexes.length ? selectedIndexes : forecast.hourly.time.map((_, index) => index)

  return indexes.map((index) => ({
    time: forecast.hourly?.time[index].split('T')[1] ?? forecast.hourly?.time[index] ?? '',
    speed: safeNumber(forecast.hourly?.wind_speed_10m[index]),
    gust: safeNumber(forecast.hourly?.wind_gusts_10m[index]),
    direction: safeNumber(forecast.hourly?.wind_direction_10m[index]),
  }))
}

async function fetchComparisonsWithTimeline(
  request: BriefingRequest,
  latitude: number,
  longitude: number,
  language: Language,
): Promise<WindModelTimelineComparison[]> {
  const c = comparisonCopy[language]
  if (!request.date || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return []
  const raceTime = request.raceTime || request.startTime

  return Promise.all(WEATHER_MODELS.map(async (model): Promise<WindModelTimelineComparison> => {
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      hourly: 'wind_speed_10m,wind_direction_10m,wind_gusts_10m',
      start_date: request.date,
      end_date: request.date,
      timezone: 'auto',
      wind_speed_unit: 'kn',
    })
    if (model.key !== 'best_match') params.set('models', model.key)

    try {
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`)
      if (!response.ok) {
        return { model, available: false, speed: null, gust: null, direction: null, timezone: null, hourly: [], error: c.unavailable }
      }
      const forecast = await response.json() as WindForecastResponse
      if (!forecast.hourly?.time.length) {
        return { model, available: false, speed: null, gust: null, direction: null, timezone: forecast.timezone ?? null, hourly: [], error: c.noRaceData }
      }
      const raceIndex = nearestIndex(forecast.hourly.time, raceTime)
      const speed = safeNumber(forecast.hourly.wind_speed_10m[raceIndex])
      const gust = safeNumber(forecast.hourly.wind_gusts_10m[raceIndex])
      const direction = safeNumber(forecast.hourly.wind_direction_10m[raceIndex])
      const hourly = buildHourlyTimeline(forecast, request)
      if (speed == null || direction == null) {
        return { model, available: false, speed, gust, direction, timezone: forecast.timezone ?? null, hourly, error: c.incomplete }
      }
      return { model, available: true, speed, gust, direction, timezone: forecast.timezone ?? null, hourly }
    } catch {
      return { model, available: false, speed: null, gust: null, direction: null, timezone: null, hourly: [], error: c.connection }
    }
  }))
}

function circularMean(values: number[]) {
  if (!values.length) return null
  const radians = values.map((value) => value * Math.PI / 180)
  const x = radians.reduce((sum, value) => sum + Math.cos(value), 0) / values.length
  const y = radians.reduce((sum, value) => sum + Math.sin(value), 0) / values.length
  if (Math.abs(x) < 1e-9 && Math.abs(y) < 1e-9) return null
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
}

function angleGap(a: number, b: number) {
  return Math.abs(((a - b + 540) % 360) - 180)
}

function agreementLabel(comparisons: WindModelComparison[], language: Language) {
  const c = comparisonCopy[language]
  const available = comparisons.filter((item) => item.available && item.speed != null && item.direction != null)
  if (available.length < 2) return c.notEnough
  const speeds = available.map((item) => item.speed as number)
  const directions = available.map((item) => item.direction as number)
  const meanDirection = circularMean(directions)
  const speedSpread = Math.max(...speeds) - Math.min(...speeds)
  const directionSpread = meanDirection == null ? 180 : Math.max(...directions.map((value) => angleGap(value, meanDirection)))
  const agreement = speedSpread <= 2 && directionSpread <= 10
    ? c.strong
    : speedSpread <= 4 && directionSpread <= 20
      ? c.fair
      : c.spread
  const directionText = meanDirection == null ? '' : ` ${c.meanDirection} ≈ ${formatDegrees(meanDirection)}, ±${Math.round(directionSpread)}°.`
  return `${agreement} ${c.expected} ${formatSpeed(Math.min(...speeds))} ${c.to} ${formatSpeed(Math.max(...speeds))}.${directionText}`
}

export function WindModelComparisonPanel() {
  const { language } = usePreferences()
  const c = comparisonCopy[language]
  const { state } = useLocation()
  const navigate = useNavigate()
  const request = state as BriefingRequest | null
  const [comparisons, setComparisons] = useState<WindModelTimelineComparison[]>([])
  const [comparisonState, setComparisonState] = useState<ComparisonState>('idle')
  const [error, setError] = useState('')
  const activeModel: WeatherModelKey = request?.weatherModel ?? 'best_match'

  useEffect(() => {
    if (!request?.location || !request.date) return
    let active = true
    setComparisonState('loading')
    setError('')

    void resolveCoordinates(request, language)
      .then(({ latitude, longitude }) => fetchComparisonsWithTimeline(request, latitude, longitude, language))
      .then((items) => {
        if (!active) return
        setComparisons(items)
        setComparisonState('ready')
      })
      .catch((reason: unknown) => {
        if (!active) return
        setComparisons([])
        setComparisonState('error')
        setError(reason instanceof Error ? reason.message : c.comparisonUnavailable)
      })

    return () => { active = false }
  }, [request?.location, request?.latitude, request?.longitude, request?.date, request?.raceTime, request?.startTime, request?.endTime])

  const activeComparison = comparisons.find((item) => item.model.key === activeModel)
  const activeModelLabel = activeComparison?.model.label ?? WEATHER_MODELS.find((model) => model.key === activeModel)?.label ?? 'Open-Meteo · Best Match'
  const summary = useMemo(() => agreementLabel(comparisons, language), [comparisons, language])
  const timelineHours = useMemo(() => {
    const source = comparisons.find((item) => item.hourly.length)?.hourly ?? []
    return source.map((hour) => hour.time)
  }, [comparisons])

  if (!request) return null

  function selectModel(model: WeatherModelKey) {
    if (!request) return
    if (model === activeModel) return
    const comparison = comparisons.find((item) => item.model.key === model)
    const modelAxis = request.courseAxisMode === 'model_wind' && comparison?.direction != null
      ? String(Math.round(comparison.direction)).padStart(3, '0')
      : request.courseAxis
    navigate('/resultats', { replace: true, state: { ...request, weatherModel: model, courseAxis: modelAxis } })
  }

  return <section className="wind-model-comparison" aria-labelledby="wind-model-comparison-title">
    <div className="wind-model-heading">
      <div>
        <span className="step-label">{c.step}</span>
        <h2 id="wind-model-comparison-title">{c.title}</h2>
      </div>
      <div className="active-weather-model">
        <small>{c.activeModel}</small>
        <strong>{activeModelLabel}</strong>
      </div>
    </div>

    <p className="wind-model-intro">{c.intro}</p>

    {comparisonState === 'loading' && <div className="wind-model-loading"><LoaderCircle className="wind-model-spin" size={18} /> {c.loading}</div>}
    {comparisonState === 'error' && <div className="wind-model-error">{c.comparisonUnavailable}: {error}</div>}

    {comparisonState === 'ready' && <>
      <div className="wind-model-grid">
        {comparisons.map((item) => {
          const selected = item.model.key === activeModel
          const details = localizedModelDetails(item.model.key, language, item.model.note, item.model.horizon)
          return <article className={`wind-model-card${selected ? ' is-active' : ''}${!item.available ? ' is-unavailable' : ''}`} key={item.model.key}>
            <div className="wind-model-card-heading">
              <div><strong>{item.model.shortLabel}</strong><span>{item.model.provider}</span></div>
              {selected && <span className="wind-model-active-badge"><Check size={12} /> {c.used}</span>}
            </div>
            <div className="wind-model-meta"><span>{c.grid} {item.model.resolution}</span><span>{details.horizon}</span></div>
            {item.available ? <>
              <div className="wind-model-reading">
                <div><small>{c.wind}</small><strong>{formatSpeed(item.speed)}</strong></div>
                <div><small>{c.gusts}</small><strong>{formatSpeed(item.gust)}</strong></div>
                <div><small>{c.direction}</small><strong>{formatDegrees(item.direction)}</strong></div>
              </div>
              <p>{details.note}</p>
              <button type="button" className={selected ? 'is-selected' : ''} disabled={selected} onClick={() => selectModel(item.model.key)}>
                {selected ? <><Check size={14} /> {c.activeModel}</> : <><Navigation size={14} /> {c.useModel}</>}
              </button>
            </> : <>
              <div className="wind-model-unavailable"><CircleGauge size={17} /><span>{item.error || c.dataUnavailable}</span></div>
              <p>{details.note}</p>
            </>}
          </article>
        })}
      </div>

      {timelineHours.length > 0 && <div className="wind-model-timeline-block">
        <div className="wind-model-timeline-heading">
          <div>
            <small>{c.overTime}</small>
            <h3>{c.hourly}</h3>
          </div>
          <span>{c.hourlyLegend}</span>
        </div>
        <div className="wind-model-timeline-scroll" tabIndex={0} aria-label={c.hourlyLabel}>
          <div className="wind-model-timeline" style={{ gridTemplateColumns: `140px repeat(${timelineHours.length}, minmax(118px, 1fr))` }}>
            <div className="wind-model-timeline-corner">{c.model}</div>
            {timelineHours.map((time) => <div className="wind-model-timeline-time" key={time}>{time}</div>)}
            {comparisons.map((item) => {
              const selected = item.model.key === activeModel
              return <div className="wind-model-timeline-row" key={item.model.key} style={{ display: 'contents' }}>
                <div className={`wind-model-timeline-model${selected ? ' is-active' : ''}`}>
                  <strong>{item.model.shortLabel}</strong>
                  {selected && <span><Check size={11} /> {c.active}</span>}
                </div>
                {timelineHours.map((time) => {
                  const hour = item.hourly.find((entry) => entry.time === time)
                  return <div className={`wind-model-timeline-cell${selected ? ' is-active' : ''}`} key={`${item.model.key}-${time}`}>
                    {hour ? <>
                      <strong>{formatSpeed(hour.speed)}</strong>
                      <span>{c.gustShort} {formatSpeed(hour.gust)}</span>
                      <small>{formatDegrees(hour.direction)}</small>
                    </> : <span className="wind-model-timeline-empty">—</span>}
                  </div>
                })}
              </div>
            })}
          </div>
        </div>
      </div>}

      <MultiModelSynthesisPanel comparisons={comparisons} />

      <div className="wind-model-summary"><Wind size={16} /><p><strong>{c.raw}</strong> {summary}</p></div>
      <div className="wind-model-active-explainer">
        <Check size={15} />
        <p><strong>{c.detail}</strong> <b>{activeModelLabel}</b>. {c.detailEnd}</p>
      </div>
    </>}
  </section>
}
