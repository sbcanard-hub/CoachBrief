import { Compass, Gauge, LoaderCircle, Mountain, Waves, Wind } from 'lucide-react'
import { useEffect, useState } from 'react'
import { analyseLocalEffects, fetchTerrainSamples, localEffectBearingLabel } from '../localEffects'
import type { LocalEffectsAnalysis } from '../localEffects'
import type { BriefingRequest } from '../types'
import { fetchWeatherForBriefing } from '../weather'
import './localEffects.css'

type LocalEffectsPanelProps = {
  request: BriefingRequest
}

type PanelState = 'loading' | 'ready' | 'error'

function levelLabel(level: 'faible' | 'modéré' | 'fort') {
  if (level === 'fort') return 'Effet marqué'
  if (level === 'modéré') return 'À surveiller'
  return 'Effet limité'
}

export function LocalEffectsPanel({ request }: LocalEffectsPanelProps) {
  const [state, setState] = useState<PanelState>('loading')
  const [analysis, setAnalysis] = useState<LocalEffectsAnalysis | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setState('loading')
    setError('')
    setAnalysis(null)

    void fetchWeatherForBriefing(request)
      .then(async (weather) => {
        const terrain = await fetchTerrainSamples(weather.latitude, weather.longitude)
        return analyseLocalEffects(request, weather, terrain)
      })
      .then((result) => {
        if (!active) return
        setAnalysis(result)
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
        <span className="step-label">Plan d’eau · analyse automatique mondiale</span>
        <h2 id="local-effects-title">Effets locaux probables</h2>
      </div>
      {analysis && <div className="local-effects-confidence">
        <small>Confiance indicative</small>
        <strong>{analysis.confidence}/100 · {analysis.confidenceLabel}</strong>
      </div>}
    </div>

    {state === 'loading' && <div className="local-effects-loading"><LoaderCircle className="local-effects-spin" size={18} /> Analyse du relief et des conditions du plan d’eau…</div>}
    {state === 'error' && <div className="local-effects-error">Analyse locale indisponible : {error}</div>}

    {state === 'ready' && analysis && <>
      <div className="local-effects-metrics">
        <article><Mountain size={17} /><div><small>Relief au vent</small><strong>{analysis.exposureLabel}</strong><span>{analysis.upwindMaxElevation == null ? 'Altitude non disponible' : `max. ≈ ${Math.round(analysis.upwindMaxElevation)} m dans les 10 km`}</span></div></article>
        <article><Compass size={17} /><div><small>Secteur le plus ouvert</small><strong>{localEffectBearingLabel(analysis.openBearing)}</strong><span>{analysis.openBearingClarity >= .45 ? 'signal net' : analysis.openBearingClarity >= .2 ? 'signal partiel' : 'signal peu marqué'}</span></div></article>
        <article><Wind size={17} /><div><small>Canalisation</small><strong>{analysis.channelingLabel}</strong></div></article>
        <article><Waves size={17} /><div><small>Thermique</small><strong>{analysis.thermalLabel}</strong></div></article>
      </div>

      {analysis.effects.length > 0 && <div className="local-effects-grid">
        {analysis.effects.map((effect) => <article className={`local-effect-card level-${effect.level}`} key={effect.title}>
          <div className="local-effect-card-heading"><strong>{effect.title}</strong><span>{levelLabel(effect.level)}</span></div>
          <p>{effect.text}</p>
        </article>)}
      </div>}

      <div className="local-effects-advice"><Gauge size={16} /><p><strong>Lecture coach :</strong> {analysis.coachAdvice}</p></div>
      <p className="local-effects-note">{analysis.attribution} Couverture relief : {Math.round(analysis.elevationCoverage * 100)} %. Ce moteur cherche des effets plausibles ; il ne remplace ni l’observation sur l’eau ni l’historique spécifique du site.</p>
    </>}
  </section>
}
