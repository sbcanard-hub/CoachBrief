import { AlertTriangle, Compass, Gauge, TrendingDown, TrendingUp, Wind } from 'lucide-react'
import { buildMultiModelSynthesis } from '../modelSynthesis'
import type { WeatherModelKey } from '../types'
import './multiModelSynthesis.css'

type ModelPoint = {
  model: { key: WeatherModelKey; shortLabel: string }
  available: boolean
  speed: number | null
  direction: number | null
  hourly: Array<{ time: string; speed: number | null; direction: number | null }>
}

function strengthText(trend: ReturnType<typeof buildMultiModelSynthesis>['strengthTrend'], delta: number | null) {
  if (trend === 'renforcement') return `+${Math.abs(delta ?? 0).toFixed(1).replace('.', ',')} nd`
  if (trend === 'affaiblissement') return `−${Math.abs(delta ?? 0).toFixed(1).replace('.', ',')} nd`
  if (trend === 'stable') return 'Stable'
  return 'Incertain'
}

function rotationText(trend: ReturnType<typeof buildMultiModelSynthesis>['rotationTrend'], delta: number | null) {
  if (trend === 'droite') return `Droite +${Math.abs(Math.round(delta ?? 0))}°`
  if (trend === 'gauche') return `Gauche −${Math.abs(Math.round(delta ?? 0))}°`
  if (trend === 'partagée') return 'Partagée'
  if (trend === 'stable') return 'Stable'
  return 'Incertaine'
}

function directionText(value: number | null) {
  return value == null ? '—' : `${String(Math.round(value)).padStart(3, '0')}°`
}

export function MultiModelSynthesisPanel({ comparisons }: { comparisons: ModelPoint[] }) {
  const synthesis = buildMultiModelSynthesis(comparisons)
  const strengthIcon = synthesis.strengthTrend === 'renforcement'
    ? <TrendingUp size={18} />
    : synthesis.strengthTrend === 'affaiblissement'
      ? <TrendingDown size={18} />
      : <Wind size={18} />

  return <section className="multi-model-synthesis" aria-labelledby="multi-model-synthesis-title">
    <div className="multi-model-synthesis-heading">
      <div>
        <span className="step-label">Lecture coach · synthèse automatique</span>
        <h3 id="multi-model-synthesis-title">Ce que disent vraiment les modèles</h3>
      </div>
      <div className={`multi-model-confidence is-${synthesis.confidence.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}`}>
        <small>Confiance multi-modèles</small>
        <strong>{synthesis.confidence} · {synthesis.confidenceScore}/100</strong>
      </div>
    </div>

    <p className="multi-model-headline">{synthesis.headline}</p>

    <div className="multi-model-kpis">
      <article>
        <span><Gauge size={17} /></span>
        <div><small>Consensus</small><strong>{synthesis.consensusCount}/{synthesis.independentAvailable}</strong><p>modèles indépendants disponibles</p></div>
      </article>
      <article>
        <span><Wind size={17} /></span>
        <div><small>Vent central</small><strong>{synthesis.meanSpeed == null ? '—' : `${synthesis.meanSpeed.toFixed(1).replace('.0', '')} nd`}</strong><p>{synthesis.speedRange ? `${synthesis.speedRange[0].toString().replace('.', ',')} à ${synthesis.speedRange[1].toString().replace('.', ',')} nd` : 'plage indisponible'}</p></div>
      </article>
      <article>
        <span><Compass size={17} /></span>
        <div><small>Direction centrale</small><strong>{directionText(synthesis.meanDirection)}</strong><p>{synthesis.directionSpread == null ? 'dispersion indisponible' : `dispersion ±${Math.round(synthesis.directionSpread)}°`}</p></div>
      </article>
      <article>
        <span>{strengthIcon}</span>
        <div><small>Évolution force</small><strong>{strengthText(synthesis.strengthTrend, synthesis.strengthDelta)}</strong><p>{synthesis.strengthTrend}</p></div>
      </article>
      <article>
        <span><Compass size={17} /></span>
        <div><small>Rotation</small><strong>{rotationText(synthesis.rotationTrend, synthesis.rotationDelta)}</strong><p>sur la fenêtre sélectionnée</p></div>
      </article>
    </div>

    {synthesis.outliers.length > 0 && <div className="multi-model-outliers">
      <AlertTriangle size={17} />
      <p><strong>Modèle{ synthesis.outliers.length > 1 ? 's' : '' } isolé{ synthesis.outliers.length > 1 ? 's' : '' } :</strong> {synthesis.outliers.join(', ')}. À surveiller comme scénario alternatif plutôt que comme tendance principale.</p>
    </div>}

    <div className="multi-model-advice">
      <strong>Pour le briefing :</strong>
      <p>{synthesis.advice}</p>
    </div>

    <small className="multi-model-method">La majorité est calculée entre AROME, ECMWF, ICON‑EU et GFS. Best Match reste visible comme contrôle mais ne compte pas comme un vote indépendant.</small>
  </section>
}
