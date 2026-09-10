import { Check, CircleGauge, LoaderCircle, Navigation, Wind } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { WEATHER_MODELS } from '../weather'
import type { WindModelComparison } from '../weather'
import type { BriefingRequest, WeatherModelKey } from '../types'
import { MultiModelSynthesisPanel } from './MultiModelSynthesisPanel'
import './windModelComparison.css'

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

async function resolveCoordinates(request: BriefingRequest) {
  const latitude = validCoordinate(request.latitude)
  const longitude = validCoordinate(request.longitude)
  if (latitude != null && longitude != null) return { latitude, longitude }

  const location = request.location.trim()
  if (!location) throw new Error('Lieu non renseigné')
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
  throw new Error('Lieu introuvable pour comparer les modèles')
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
): Promise<WindModelTimelineComparison[]> {
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
        return { model, available: false, speed: null, gust: null, direction: null, timezone: null, hourly: [], error: 'Indisponible pour cette échéance ou cette zone.' }
      }
      const forecast = await response.json() as WindForecastResponse
      if (!forecast.hourly?.time.length) {
        return { model, available: false, speed: null, gust: null, direction: null, timezone: forecast.timezone ?? null, hourly: [], error: 'Pas de donnée à l’heure de la manche.' }
      }
      const raceIndex = nearestIndex(forecast.hourly.time, raceTime)
      const speed = safeNumber(forecast.hourly.wind_speed_10m[raceIndex])
      const gust = safeNumber(forecast.hourly.wind_gusts_10m[raceIndex])
      const direction = safeNumber(forecast.hourly.wind_direction_10m[raceIndex])
      const hourly = buildHourlyTimeline(forecast, request)
      if (speed == null || direction == null) {
        return { model, available: false, speed, gust, direction, timezone: forecast.timezone ?? null, hourly, error: 'Vent incomplet pour cette échéance.' }
      }
      return { model, available: true, speed, gust, direction, timezone: forecast.timezone ?? null, hourly }
    } catch {
      return { model, available: false, speed: null, gust: null, direction: null, timezone: null, hourly: [], error: 'Connexion au modèle impossible.' }
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

function agreementLabel(comparisons: WindModelComparison[]) {
  const available = comparisons.filter((item) => item.available && item.speed != null && item.direction != null)
  if (available.length < 2) return 'Pas assez de modèles disponibles pour mesurer l’accord.'
  const speeds = available.map((item) => item.speed as number)
  const directions = available.map((item) => item.direction as number)
  const meanDirection = circularMean(directions)
  const speedSpread = Math.max(...speeds) - Math.min(...speeds)
  const directionSpread = meanDirection == null ? 180 : Math.max(...directions.map((value) => angleGap(value, meanDirection)))
  const agreement = speedSpread <= 2 && directionSpread <= 10
    ? 'Accord fort entre les modèles.'
    : speedSpread <= 4 && directionSpread <= 20
      ? 'Accord correct, avec quelques écarts.'
      : 'Dispersion importante : le terrain et les observations locales prennent davantage de poids.'
  const directionText = meanDirection == null ? '' : ` Direction moyenne ≈ ${formatDegrees(meanDirection)}, dispersion ±${Math.round(directionSpread)}°.`
  return `${agreement} Vent prévu de ${formatSpeed(Math.min(...speeds))} à ${formatSpeed(Math.max(...speeds))}.${directionText}`
}

export function WindModelComparisonPanel() {
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

    void resolveCoordinates(request)
      .then(({ latitude, longitude }) => fetchComparisonsWithTimeline(request, latitude, longitude))
      .then((items) => {
        if (!active) return
        setComparisons(items)
        setComparisonState('ready')
      })
      .catch((reason: unknown) => {
        if (!active) return
        setComparisons([])
        setComparisonState('error')
        setError(reason instanceof Error ? reason.message : 'Comparaison indisponible')
      })

    return () => { active = false }
  }, [request?.location, request?.latitude, request?.longitude, request?.date, request?.raceTime, request?.startTime, request?.endTime])

  const activeComparison = comparisons.find((item) => item.model.key === activeModel)
  const activeModelLabel = activeComparison?.model.label ?? WEATHER_MODELS.find((model) => model.key === activeModel)?.label ?? 'Open-Meteo · Best Match'
  const summary = useMemo(() => agreementLabel(comparisons), [comparisons])
  const timelineHours = useMemo(() => {
    const source = comparisons.find((item) => item.hourly.length)?.hourly ?? []
    return source.map((hour) => hour.time)
  }, [comparisons])

  if (!request) return null

  function selectModel(model: WeatherModelKey) {
    if (model === activeModel) return
    navigate('/resultats', { replace: true, state: { ...request, weatherModel: model } })
  }

  return <section className="wind-model-comparison" aria-labelledby="wind-model-comparison-title">
    <div className="wind-model-heading">
      <div>
        <span className="step-label">Prévision de vent · plusieurs modèles</span>
        <h2 id="wind-model-comparison-title">Comparer avant de choisir</h2>
      </div>
      <div className="active-weather-model">
        <small>Modèle utilisé dans le briefing</small>
        <strong>{activeModelLabel}</strong>
      </div>
    </div>

    <p className="wind-model-intro">Le « Best Match » est une sélection automatique Open-Meteo, pas un modèle unique identifié. Les autres cartes correspondent à des modèles explicites et indépendants. Changer de modèle recalcule le vent, l’évolution horaire et les recommandations du briefing.</p>

    {comparisonState === 'loading' && <div className="wind-model-loading"><LoaderCircle className="wind-model-spin" size={18} /> Comparaison des modèles et de leur évolution horaire…</div>}
    {comparisonState === 'error' && <div className="wind-model-error">Comparaison indisponible : {error}</div>}

    {comparisonState === 'ready' && <>
      <div className="wind-model-grid">
        {comparisons.map((item) => {
          const selected = item.model.key === activeModel
          return <article className={`wind-model-card${selected ? ' is-active' : ''}${!item.available ? ' is-unavailable' : ''}`} key={item.model.key}>
            <div className="wind-model-card-heading">
              <div><strong>{item.model.shortLabel}</strong><span>{item.model.provider}</span></div>
              {selected && <span className="wind-model-active-badge"><Check size={12} /> utilisé</span>}
            </div>
            <div className="wind-model-meta"><span>Maille {item.model.resolution}</span><span>{item.model.horizon}</span></div>
            {item.available ? <>
              <div className="wind-model-reading">
                <div><small>Vent</small><strong>{formatSpeed(item.speed)}</strong></div>
                <div><small>Rafales</small><strong>{formatSpeed(item.gust)}</strong></div>
                <div><small>Direction</small><strong>{formatDegrees(item.direction)}</strong></div>
              </div>
              <p>{item.model.note}</p>
              <button type="button" className={selected ? 'is-selected' : ''} disabled={selected} onClick={() => selectModel(item.model.key)}>
                {selected ? <><Check size={14} /> Modèle utilisé</> : <><Navigation size={14} /> Utiliser ce modèle</>}
              </button>
            </> : <>
              <div className="wind-model-unavailable"><CircleGauge size={17} /><span>{item.error || 'Données indisponibles.'}</span></div>
              <p>{item.model.note}</p>
            </>}
          </article>
        })}
      </div>

      {timelineHours.length > 0 && <div className="wind-model-timeline-block">
        <div className="wind-model-timeline-heading">
          <div>
            <small>Comparaison dans le temps</small>
            <h3>Évolution heure par heure · tous les modèles</h3>
          </div>
          <span>Vent moyen · rafale · direction</span>
        </div>
        <div className="wind-model-timeline-scroll" tabIndex={0} aria-label="Comparaison horaire des modèles de vent">
          <div className="wind-model-timeline" style={{ gridTemplateColumns: `140px repeat(${timelineHours.length}, minmax(118px, 1fr))` }}>
            <div className="wind-model-timeline-corner">Modèle</div>
            {timelineHours.map((time) => <div className="wind-model-timeline-time" key={time}>{time}</div>)}
            {comparisons.map((item) => {
              const selected = item.model.key === activeModel
              return <div className="wind-model-timeline-row" key={item.model.key} style={{ display: 'contents' }}>
                <div className={`wind-model-timeline-model${selected ? ' is-active' : ''}`}>
                  <strong>{item.model.shortLabel}</strong>
                  {selected && <span><Check size={11} /> actif</span>}
                </div>
                {timelineHours.map((time) => {
                  const hour = item.hourly.find((entry) => entry.time === time)
                  return <div className={`wind-model-timeline-cell${selected ? ' is-active' : ''}`} key={`${item.model.key}-${time}`}>
                    {hour ? <>
                      <strong>{formatSpeed(hour.speed)}</strong>
                      <span>raf. {formatSpeed(hour.gust)}</span>
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

      <div className="wind-model-summary"><Wind size={16} /><p><strong>Lecture brute :</strong> {summary}</p></div>
      <div className="wind-model-active-explainer">
        <Check size={15} />
        <p><strong>Évolution détaillée affichée plus bas :</strong> elle utilise actuellement <b>{activeModelLabel}</b>. Le tableau ci-dessus sert à comparer les modèles ; la grande section horaire du briefing n’en affiche volontairement qu’un à la fois.</p>
      </div>
    </>}
  </section>
}
