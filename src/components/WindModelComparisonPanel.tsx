import { Check, CircleGauge, LoaderCircle, Navigation, Wind } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { fetchWindModelComparisons } from '../weather'
import type { WindModelComparison } from '../weather'
import type { BriefingRequest, WeatherModelKey } from '../types'
import './windModelComparison.css'

type ComparisonState = 'idle' | 'loading' | 'ready' | 'error'

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
  const [comparisons, setComparisons] = useState<WindModelComparison[]>([])
  const [comparisonState, setComparisonState] = useState<ComparisonState>('idle')
  const [error, setError] = useState('')
  const activeModel: WeatherModelKey = request?.weatherModel ?? 'best_match'

  useEffect(() => {
    if (!request?.location || !request.date) return
    let active = true
    setComparisonState('loading')
    setError('')

    void resolveCoordinates(request)
      .then(({ latitude, longitude }) => fetchWindModelComparisons(request, latitude, longitude))
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
  }, [request?.location, request?.latitude, request?.longitude, request?.date, request?.raceTime, request?.startTime])

  const activeComparison = comparisons.find((item) => item.model.key === activeModel)
  const summary = useMemo(() => agreementLabel(comparisons), [comparisons])

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
        <strong>{activeComparison?.model.label ?? (activeModel === 'best_match' ? 'Open-Meteo · Best Match' : activeModel)}</strong>
      </div>
    </div>

    <p className="wind-model-intro">Le « Best Match » est une sélection automatique Open-Meteo, pas un modèle unique identifié. Les autres cartes correspondent à des modèles explicites et indépendants. Changer de modèle recalcule le vent, l’évolution horaire et les recommandations du briefing.</p>

    {comparisonState === 'loading' && <div className="wind-model-loading"><LoaderCircle className="wind-model-spin" size={18} /> Comparaison des modèles à l’heure de la manche…</div>}
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
      <div className="wind-model-summary"><Wind size={16} /><p><strong>Lecture d’ensemble :</strong> {summary}</p></div>
    </>}
  </section>
}