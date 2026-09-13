import { ShieldCheck } from 'lucide-react'
import type { TacticalCoherence } from '../tacticalCoherence'
import { usePreferences, type Language } from '../preferences'
import './analysisCoherence.css'

const copy: Record<Language, { title: string; state: Record<TacticalCoherence['state'], string>; side: Record<string, string>; conclusion: string; confidence: Record<string, string> }> = {
  fr: { title: 'Cohérence de l’analyse', state: { strong: 'Convergence forte', medium: 'Convergence moyenne', shared: 'Analyse partagée', insufficient: 'Informations insuffisantes' }, side: { left: 'gauche', right: 'droite', neutral: 'neutre' }, conclusion: 'Conclusion', confidence: { high: 'forte', medium: 'moyenne', low: 'faible' } },
  en: { title: 'Analysis consistency', state: { strong: 'Strong convergence', medium: 'Medium convergence', shared: 'Split analysis', insufficient: 'Insufficient information' }, side: { left: 'left', right: 'right', neutral: 'neutral' }, conclusion: 'Conclusion', confidence: { high: 'high', medium: 'medium', low: 'low' } },
  it: { title: 'Coerenza dell’analisi', state: { strong: 'Convergenza forte', medium: 'Convergenza media', shared: 'Analisi divisa', insufficient: 'Informazioni insufficienti' }, side: { left: 'sinistra', right: 'destra', neutral: 'neutro' }, conclusion: 'Conclusione', confidence: { high: 'alta', medium: 'media', low: 'bassa' } },
  es: { title: 'Coherencia del análisis', state: { strong: 'Convergencia fuerte', medium: 'Convergencia media', shared: 'Análisis dividido', insufficient: 'Información insuficiente' }, side: { left: 'izquierda', right: 'derecha', neutral: 'neutro' }, conclusion: 'Conclusión', confidence: { high: 'alta', medium: 'media', low: 'baja' } },
}
export function AnalysisCoherence({ coherence, compact = false }: { coherence: TacticalCoherence; compact?: boolean }) {
  const { language } = usePreferences(); const c = copy[language]
  const shown = coherence.factors.filter((factor) => factor.side !== 'neutral').slice(0, compact ? 5 : 7)
  return <section className={`analysis-coherence is-${coherence.state}${compact ? ' is-compact' : ''}`} aria-labelledby={`analysis-coherence-title${compact ? '-compact' : ''}`}>
    <header><div><small>{c.state[coherence.state]}</small><h2 id={`analysis-coherence-title${compact ? '-compact' : ''}`}>{c.title}</h2></div><ShieldCheck /></header>
    <ul>{shown.map((factor) => <li key={`${factor.label}-${factor.side}`}><span>{factor.label}</span><strong>{c.side[factor.side]}</strong></li>)}</ul>
    <p>{coherence.summary}</p><footer><b>{c.conclusion} :</b> {coherence.preferredSide === 'neutral' ? c.state[coherence.state] : `${c.side[coherence.preferredSide]}, ${c.confidence[coherence.confidence]}`}.</footer>
  </section>
}
