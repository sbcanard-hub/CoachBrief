import { Gauge, Radio, Wind } from 'lucide-react'
import type { PlanSourceReliability, SourceReliabilityMetric } from '../calibration'
import './sourceConfidence.css'
import { usePreferences, type Language } from '../preferences'

type SourceConfidencePanelProps = {
  reliability: PlanSourceReliability | null
  currentMetarAvailable?: boolean
}

const sourceCopy = {
  fr: { names: { model: 'Open-Meteo', metar: 'METAR proche', coach: 'Relevé coach' }, notEnough: 'Recul insuffisant : ne pas hiérarchiser automatiquement.', moreWeight: 'L’historique donne davantage de poids à', close: 'Sources historiquement proches : les confronter aujourd’hui.', split: 'Historique encore partagé : confronter les sources aujourd’hui.', step: 'Retour d’expérience', title: 'Confiance historique des sources', subtitle: 'Historique du plan d’eau · aide à la décision', empty: 'Pas encore assez de retours post-course pour comparer les sources.', comparison: 'comparaison post-course', comparisons: 'comparaisons post-course', none: 'Aucune comparaison exploitable', distance: 'Distance moyenne', time: 'Écart horaire moyen', excluded: 'METAR hors ±90 min exclu(s)', noMetar: 'Pas de METAR actuel disponible dans le cache.', summary: 'Synthèse :', end: 'Le classement est historique : il ne change pas automatiquement la source météo du briefing.', confidence: ['Faible', 'Moyenne', 'Bonne'] },
  en: { names: { model: 'Open-Meteo', metar: 'Nearby METAR', coach: 'Coach reading' }, notEnough: 'Insufficient history: do not rank sources automatically.', moreWeight: 'Historical results give more weight to', close: 'Sources have performed similarly: compare them today.', split: 'History is still mixed: compare the sources today.', step: 'Feedback', title: 'Historical source confidence', subtitle: 'Sailing-area history · decision aid', empty: 'Not enough post-race feedback yet to compare sources.', comparison: 'post-race comparison', comparisons: 'post-race comparisons', none: 'No usable comparison', distance: 'Mean distance', time: 'Mean time difference', excluded: 'METAR reports outside ±90 min excluded', noMetar: 'No current METAR is available in the cache.', summary: 'Summary:', end: 'This is a historical ranking; it does not automatically change the briefing’s weather source.', confidence: ['Low', 'Medium', 'Good'] },
  it: { names: { model: 'Open-Meteo', metar: 'METAR vicino', coach: 'Rilievo coach' }, notEnough: 'Storico insufficiente: non classificare automaticamente le fonti.', moreWeight: 'Lo storico attribuisce più peso a', close: 'Prestazioni storiche simili: confrontare oggi le fonti.', split: 'Storico ancora diviso: confrontare oggi le fonti.', step: 'Esperienza', title: 'Affidabilità storica delle fonti', subtitle: 'Storico del campo di regata · aiuto alla decisione', empty: 'Non ci sono ancora abbastanza riscontri post-regata per confrontare le fonti.', comparison: 'confronto post-regata', comparisons: 'confronti post-regata', none: 'Nessun confronto utilizzabile', distance: 'Distanza media', time: 'Scarto orario medio', excluded: 'METAR fuori ±90 min esclusi', noMetar: 'Nessun METAR attuale disponibile nella cache.', summary: 'Sintesi:', end: 'La classifica è storica e non cambia automaticamente la fonte meteo del briefing.', confidence: ['Bassa', 'Media', 'Buona'] },
  es: { names: { model: 'Open-Meteo', metar: 'METAR cercano', coach: 'Lectura del entrenador' }, notEnough: 'Historial insuficiente: no clasificar automáticamente las fuentes.', moreWeight: 'El historial da más peso a', close: 'Resultados históricos similares: compara hoy las fuentes.', split: 'El historial sigue dividido: compara hoy las fuentes.', step: 'Experiencia', title: 'Confianza histórica de las fuentes', subtitle: 'Historial del campo de regatas · ayuda a la decisión', empty: 'Todavía no hay suficientes datos posteriores a la prueba para comparar las fuentes.', comparison: 'comparación posterior', comparisons: 'comparaciones posteriores', none: 'Ninguna comparación utilizable', distance: 'Distancia media', time: 'Diferencia horaria media', excluded: 'METAR fuera de ±90 min excluidos', noMetar: 'No hay ningún METAR actual disponible en la caché.', summary: 'Resumen:', end: 'La clasificación es histórica y no cambia automáticamente la fuente meteorológica del briefing.', confidence: ['Baja', 'Media', 'Buena'] },
} as const

function SourceIcon({ source }: { source: SourceReliabilityMetric['key'] }) {
  if (source === 'metar') return <Radio size={15} />
  if (source === 'coach') return <Gauge size={15} />
  return <Wind size={15} />
}

function summaryFor(metrics: SourceReliabilityMetric[], language: Language) {
  const c = sourceCopy[language]
  const ranked = metrics
    .filter((metric) => metric.confidenceScore != null)
    .sort((a, b) => (b.confidenceScore ?? -1) - (a.confidenceScore ?? -1))

  if (ranked.length < 2 || ranked.filter((metric) => metric.sampleCount >= 2).length < 2) {
    return c.notEnough
  }

  const first = ranked[0]
  const second = ranked[1]
  const gap = (first.confidenceScore ?? 0) - (second.confidenceScore ?? 0)

  if ((first.confidenceScore ?? 0) >= 70 && gap >= 10) {
    return `${c.moreWeight} ${c.names[first.key]}.`
  }
  if (gap < 10) return c.close
  return c.split
}

export function SourceConfidencePanel({ reliability, currentMetarAvailable }: SourceConfidencePanelProps) {
  const { language } = usePreferences()
  const c = sourceCopy[language]
  const metrics = reliability?.metrics ?? []
  const ranked = metrics
    .filter((metric) => metric.confidenceScore != null)
    .sort((a, b) => (b.confidenceScore ?? -1) - (a.confidenceScore ?? -1))
  const rankByKey = new Map(ranked.map((metric, index) => [metric.key, index + 1]))
  const hasHistory = metrics.some((metric) => metric.sampleCount > 0)

  return <section className="source-confidence-panel" aria-labelledby="source-confidence-title">
    <div className="source-confidence-heading">
      <div>
        <span className="step-label">{c.step}</span>
        <h2 id="source-confidence-title">{c.title}</h2>
      </div>
      <small>{c.subtitle}</small>
    </div>

    {!hasHistory ? <p className="source-confidence-empty">{c.empty}</p> : <>
      <div className="source-confidence-grid">
        {metrics.map((metric) => {
          const rank = rankByKey.get(metric.key)
          return <article className="source-confidence-card" key={metric.key}>
            <div className="source-confidence-name">
              <span className="source-confidence-icon"><SourceIcon source={metric.key} /></span>
              <div><strong>{c.names[metric.key]}</strong><small>{c.confidence[metric.confidenceScore == null || metric.confidenceScore < 45 ? 0 : metric.confidenceScore < 70 ? 1 : 2]}</small></div>
              {rank && <span className="source-confidence-rank">#{rank}</span>}
            </div>
            <div className="source-confidence-score">
              <strong>{metric.confidenceScore == null ? '—' : metric.confidenceScore}</strong><span>/100</span>
            </div>
            <p>{metric.sampleCount ? `${metric.sampleCount} ${metric.sampleCount > 1 ? c.comparisons : c.comparison}` : c.none}</p>
            {metric.key === 'metar' && <div className="source-confidence-meta">
              {metric.meanDistanceKm != null && <small>{c.distance}: {Math.round(metric.meanDistanceKm)} km</small>}
              {metric.meanTimeGapMinutes != null && <small>{c.time}: {Math.round(metric.meanTimeGapMinutes)} min</small>}
              {metric.excludedTimeMismatchCount > 0 && <small>{metric.excludedTimeMismatchCount} {c.excluded}</small>}
              {currentMetarAvailable === false && <small>{c.noMetar}</small>}
            </div>}
          </article>
        })}
      </div>
      <p className="source-confidence-summary"><strong>{c.summary}</strong> {summaryFor(metrics, language)} {c.end}</p>
    </>}
  </section>
}
