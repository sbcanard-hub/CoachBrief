import { ShieldCheck } from 'lucide-react'
import type { TacticalCoherence } from '../tacticalCoherence'
import { usePreferences } from '../preferences'
import type { TranslationKey } from '../i18n/fr'
import './analysisCoherence.css'

export function AnalysisCoherence({ coherence, compact = false }: { coherence: TacticalCoherence; compact?: boolean }) {
  const { t, language } = usePreferences()
  const state = (value: TacticalCoherence['state']) => t(`coherenceState${value[0].toUpperCase()}${value.slice(1)}` as TranslationKey)
  const side = (value: string) => t(`coherenceSide${value[0].toUpperCase()}${value.slice(1)}` as TranslationKey)
  const confidence = (value: string) => t(`coherenceConfidence${value[0].toUpperCase()}${value.slice(1)}` as TranslationKey)
  const shown = coherence.factors.filter((factor) => factor.side !== 'neutral').slice(0, compact ? 5 : 7)
  const factorNames = ({
    fr: {},
    en: { Vent: 'Wind', Courant: 'Current', Vagues: 'Waves', Nuages: 'Clouds', Parcours: 'Course', 'Relief / côte': 'Terrain / coast', Adversaires: 'Competitors', 'Ligne de départ': 'Start line', 'Bascules relevées': 'Recorded shifts', 'Relevé terrain': 'Field reading' },
    it: { Vent: 'Vento', Courant: 'Corrente', Vagues: 'Onde', Nuages: 'Nuvole', Parcours: 'Percorso', 'Relief / côte': 'Rilievo / costa', Adversaires: 'Avversari', 'Ligne de départ': 'Linea di partenza', 'Bascules relevées': 'Rotazioni rilevate', 'Relevé terrain': 'Rilievo sul campo' },
    es: { Vent: 'Viento', Courant: 'Corriente', Vagues: 'Olas', Nuages: 'Nubes', Parcours: 'Recorrido', 'Relief / côte': 'Relieve / costa', Adversaires: 'Rivales', 'Ligne de départ': 'Línea de salida', 'Bascules relevées': 'Roles registrados', 'Relevé terrain': 'Lectura de campo' },
  }[language] as Record<string, string>)
  const localizedSummary = language === 'fr' ? coherence.summary : {
    en: coherence.state === 'strong' || coherence.state === 'medium' ? 'The available signals converge on the same tactical reading.' : coherence.state === 'shared' ? 'The signals are split: keep both sides available until an on-water reading confirms the choice.' : 'There is not enough consistent information to select one side reliably.',
    it: coherence.state === 'strong' || coherence.state === 'medium' ? 'I segnali disponibili convergono sulla stessa lettura tattica.' : coherence.state === 'shared' ? 'I segnali sono divisi: mantieni disponibili entrambi i lati finché un rilievo in acqua conferma la scelta.' : 'Le informazioni coerenti non bastano per scegliere un lato con affidabilità.',
    es: coherence.state === 'strong' || coherence.state === 'medium' ? 'Las señales disponibles convergen en la misma lectura táctica.' : coherence.state === 'shared' ? 'Las señales están divididas: mantén ambos lados disponibles hasta que una lectura en el agua confirme la elección.' : 'No hay suficiente información coherente para elegir un lado con fiabilidad.',
  }[language]
  return <section className={`analysis-coherence is-${coherence.state}${compact ? ' is-compact' : ''}`} aria-labelledby={`analysis-coherence-title${compact ? '-compact' : ''}`}>
    <header><div><small>{state(coherence.state)}</small><h2 id={`analysis-coherence-title${compact ? '-compact' : ''}`}>{t('analysisConsistency')}</h2></div><ShieldCheck /></header>
    <ul>{shown.map((factor) => <li key={`${factor.label}-${factor.side}`}><span>{factorNames[factor.label] || factor.label}</span><strong>{side(factor.side)}</strong></li>)}</ul>
    <p>{localizedSummary}</p><footer><b>{t('conclusion')} :</b> {coherence.preferredSide === 'neutral' ? state(coherence.state) : `${side(coherence.preferredSide)}, ${confidence(coherence.confidence)}`}.</footer>
  </section>
}
