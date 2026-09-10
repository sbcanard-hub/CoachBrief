import { Compass, Gauge, LoaderCircle, Mountain, Waves, Wind } from 'lucide-react'
import { useEffect, useState } from 'react'
import { analyseLocalEffectsWithWater } from '../enhancedLocalEffects'
import type { EnhancedLocalEffectsAnalysis } from '../enhancedLocalEffects'
import { analyseLocalEffects, fetchTerrainSamples, localEffectBearingLabel } from '../localEffects'
import type { LocalEffectsAnalysis } from '../localEffects'
import type { BriefingRequest } from '../types'
import { fetchWaterGeometryProfile } from '../waterGeometry'
import { fetchWeatherForBriefing } from '../weather'
import './localEffects.css'

type LocalEffectsPanelProps = {
  request: BriefingRequest
}

type PanelState = 'loading' | 'ready' | 'error'
type DisplayAnalysis = LocalEffectsAnalysis | EnhancedLocalEffectsAnalysis

function levelLabel(level: 'faible' | 'modéré' | 'fort') {
  if (level === 'fort') return 'Effet marqué'
  if (level === 'modéré') return 'À surveiller'
  return 'Effet limité'
}

function isEnhanced(analysis: DisplayAnalysis): analysis is EnhancedLocalEffectsAnalysis {
  return 'waterGeometry' in analysis
}

function formatFetch(value: number | null) {
  if (value == null) return '—'
  if (value >= 17.5) return '≥ 18 km'
  return `${value < 10 ? value.toFixed(1).replace('.', ',') : Math.round(value)} km`
}

export function LocalEffectsPanel({ request }: LocalEffectsPanelProps) {
  const [state, setState] = useState<PanelState>('loading')
  const [analysis, setAnalysis] = useState<DisplayAnalysis | null>(null)
  const [error, setError] = useState('')
  const [geometryWarning, setGeometryWarning] = useState('')

  useEffect(() => {
    let active = true
    setState('loading')
    setError('')
    setGeometryWarning('')
    setAnalysis(null)

    void fetchWeatherForBriefing(request)
      .then(async (weather) => {
        const [terrain, waterGeometryResult] = await Promise.all([
          fetchTerrainSamples(weather.latitude, weather.longitude),
          fetchWaterGeometryProfile(weather.latitude, weather.longitude)
            .then((profile) => ({ profile, error: '' }))
            .catch((reason: unknown) => ({
              profile: null,
              error: reason instanceof Error ? reason.message : 'Géométrie du rivage indisponible',
            })),
        ])
        if (waterGeometryResult.profile) {
          return {
            result: analyseLocalEffectsWithWater(request, weather, terrain, waterGeometryResult.profile),
            geometryError: '',
          }
        }
        return {
          result: analyseLocalEffects(request, weather, terrain),
          geometryError: waterGeometryResult.error,
        }
      })
      .then(({ result, geometryError }) => {
        if (!active) return
        setAnalysis(result)
        setGeometryWarning(geometryError)
        setState('ready')
      })
      .catch((reason: unknown) => {
        if (!active) return
        setState('error')
        setError(reason instanceof Error ? reason.message : 'Analyse locale indisponible')
      })

    return () => { active = false }
  }, [
    request.location,
    request.latitude,
    request.longitude,
    request.date,
    request.raceTime,
    request.startTime,
    request.endTime,
    request.weatherModel,
  ])

  return <section className="local-effects-panel" aria-labelledby="local-effects-title">
    <div className="local-effects-heading">
      <div>
        <span className="step-label">Plan d’eau · relief + géométrie du rivage</span>
        <h2 id="local-effects-title">Effets locaux probables</h2>
      </div>
      {analysis && <div className="local-effects-confidence">
        <small>Confiance indicative</small>
        <strong>{analysis.confidence}/100 · {analysis.confidenceLabel}</strong>
      </div>}
    </div>

    {state === 'loading' && <div className="local-effects-loading"><LoaderCircle className="local-effects-spin" size={18} /> Analyse du relief, du rivage et des conditions du plan d’eau…</div>}
    {state === 'error' && <div className="local-effects-error">Analyse locale indisponible : {error}</div>}

    {state === 'ready' && analysis && <>
      {geometryWarning && <div className="local-effects-warning">Rivage non chargé : {geometryWarning}. L’analyse relief reste active.</div>}
      <div className="local-effects-metrics">
        <article><Mountain size={17} /><div><small>Relief au vent</small><strong>{analysis.exposureLabel}</strong><span>{analysis.upwindMaxElevation == null ? 'Altitude non disponible' : `max. ≈ ${Math.round(analysis.upwindMaxElevation)} m dans les 10 km`}</span></div></article>
        {isEnhanced(analysis) && <article><Waves size={17} /><div><small>Forme du plan d’eau</small><strong>{analysis.waterGeometry.shapeLabel}</strong><span>{analysis.waterGeometry.waterBodyType === 'côtier' ? 'zone côtière / maritime' : analysis.waterGeometry.waterBodyType === 'intérieur' ? 'lac, retenue ou plan d’eau intérieur' : 'type indéterminé'}</span></div></article>}
        {isEnhanced(analysis) && <article><Wind size={17} /><div><small>Fetch dans l’axe du vent</small><strong>{analysis.waterExposureLabel}</strong><span>distance d’eau détectée : {formatFetch(analysis.upwindFetchKm)}</span></div></article>}
        <article><Compass size={17} /><div><small>Secteur le plus ouvert</small><strong>{localEffectBearingLabel(analysis.openBearing)}</strong><span>{analysis.openBearingClarity >= .45 ? 'signal net' : analysis.openBearingClarity >= .2 ? 'signal partiel' : 'signal peu marqué'}</span></div></article>
        <article><Wind size={17} /><div><small>Canalisation</small><strong>{analysis.channelingLabel}</strong></div></article>
        <article><Waves size={17} /><div><small>Thermique</small><strong>{analysis.thermalLabel}</strong></div></article>
      </div>

      {isEnhanced(analysis) && <div className="local-water-geometry-summary">
        <Compass size={16} />
        <p><strong>Lecture de la forme du plan d’eau :</strong> {analysis.waterInteractionLabel}. Rivage le plus proche {analysis.waterGeometry.nearestShoreBearing == null ? 'non déterminé' : `vers ${localEffectBearingLabel(analysis.waterGeometry.nearestShoreBearing)}`} {analysis.waterGeometry.nearestShoreDistanceKm == null ? '' : `à environ ${formatFetch(analysis.waterGeometry.nearestShoreDistanceKm)}`}.</p>
      </div>}

      {analysis.effects.length > 0 && <div className="local-effects-grid">
        {analysis.effects.map((effect) => <article className={`local-effect-card level-${effect.level}`} key={effect.title}>
          <div className="local-effect-card-heading"><strong>{effect.title}</strong><span>{levelLabel(effect.level)}</span></div>
          <p>{effect.text}</p>
        </article>)}
      </div>}

      <div className="local-effects-advice"><Gauge size={16} /><p><strong>Lecture coach :</strong> {analysis.coachAdvice}</p></div>
      <p className="local-effects-note">{analysis.attribution} Couverture relief : {Math.round(analysis.elevationCoverage * 100)} %.
        {isEnhanced(analysis) ? ` Rivage détecté dans ${Math.round(analysis.waterGeometry.shorelineCoverage * 100)} % des 16 secteurs jusqu’à 18 km.` : ''} Ce moteur cherche des effets plausibles ; il ne remplace ni l’observation sur l’eau ni l’historique spécifique du site.</p>
    </>}
  </section>
}
