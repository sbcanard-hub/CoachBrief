import { Gauge, Radio, Wind } from 'lucide-react'
import type { PlanSourceReliability, SourceReliabilityMetric } from '../calibration'
import './sourceConfidence.css'

type SourceConfidencePanelProps = {
  reliability: PlanSourceReliability | null
  currentMetarAvailable?: boolean
}

const SOURCE_NAMES: Record<SourceReliabilityMetric['key'], string> = {
  model: 'Open-Meteo',
  metar: 'METAR proche',
  coach: 'Relevé coach',
}

function SourceIcon({ source }: { source: SourceReliabilityMetric['key'] }) {
  if (source === 'metar') return <Radio size={15} />
  if (source === 'coach') return <Gauge size={15} />
  return <Wind size={15} />
}

function summaryFor(metrics: SourceReliabilityMetric[]) {
  const ranked = metrics
    .filter((metric) => metric.confidenceScore != null)
    .sort((a, b) => (b.confidenceScore ?? -1) - (a.confidenceScore ?? -1))

  if (ranked.length < 2 || ranked.filter((metric) => metric.sampleCount >= 2).length < 2) {
    return 'Recul insuffisant : ne pas hiérarchiser automatiquement.'
  }

  const first = ranked[0]
  const second = ranked[1]
  const gap = (first.confidenceScore ?? 0) - (second.confidenceScore ?? 0)

  if ((first.confidenceScore ?? 0) >= 70 && gap >= 10) {
    return `L’historique donne davantage de poids à ${SOURCE_NAMES[first.key]}.`
  }
  if (gap < 10) return 'Sources historiquement proches : les confronter aujourd’hui.'
  return 'Historique encore partagé : confronter les sources aujourd’hui.'
}

export function SourceConfidencePanel({ reliability, currentMetarAvailable }: SourceConfidencePanelProps) {
  const metrics = reliability?.metrics ?? []
  const ranked = metrics
    .filter((metric) => metric.confidenceScore != null)
    .sort((a, b) => (b.confidenceScore ?? -1) - (a.confidenceScore ?? -1))
  const rankByKey = new Map(ranked.map((metric, index) => [metric.key, index + 1]))
  const hasHistory = metrics.some((metric) => metric.sampleCount > 0)

  return <section className="source-confidence-panel" aria-labelledby="source-confidence-title">
    <div className="source-confidence-heading">
      <div>
        <span className="step-label">Retour d’expérience</span>
        <h2 id="source-confidence-title">Confiance historique des sources</h2>
      </div>
      <small>Historique du plan d’eau · aide à la décision</small>
    </div>

    {!hasHistory ? <p className="source-confidence-empty">Pas encore assez de retours post-course pour comparer les sources.</p> : <>
      <div className="source-confidence-grid">
        {metrics.map((metric) => {
          const rank = rankByKey.get(metric.key)
          return <article className="source-confidence-card" key={metric.key}>
            <div className="source-confidence-name">
              <span className="source-confidence-icon"><SourceIcon source={metric.key} /></span>
              <div><strong>{SOURCE_NAMES[metric.key]}</strong><small>{metric.confidenceLabel}</small></div>
              {rank && <span className="source-confidence-rank">#{rank}</span>}
            </div>
            <div className="source-confidence-score">
              <strong>{metric.confidenceScore == null ? '—' : metric.confidenceScore}</strong><span>/100</span>
            </div>
            <p>{metric.sampleCount ? `${metric.sampleCount} comparaison${metric.sampleCount > 1 ? 's' : ''} post-course` : 'Aucune comparaison exploitable'}</p>
            {metric.key === 'metar' && <div className="source-confidence-meta">
              {metric.meanDistanceKm != null && <small>Distance moyenne : {Math.round(metric.meanDistanceKm)} km</small>}
              {metric.meanTimeGapMinutes != null && <small>Écart horaire moyen : {Math.round(metric.meanTimeGapMinutes)} min</small>}
              {metric.excludedTimeMismatchCount > 0 && <small>{metric.excludedTimeMismatchCount} METAR hors ±90 min exclu{metric.excludedTimeMismatchCount > 1 ? 's' : ''}</small>}
              {currentMetarAvailable === false && <small>Pas de METAR actuel disponible dans le cache.</small>}
            </div>}
          </article>
        })}
      </div>
      <p className="source-confidence-summary"><strong>Synthèse :</strong> {summaryFor(metrics)} Le classement est historique : il ne change pas automatiquement la source météo du briefing.</p>
    </>}
  </section>
}
