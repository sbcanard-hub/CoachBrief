import { ShieldCheck } from 'lucide-react'
import type { TacticalCoherence } from '../tacticalCoherence'
import { usePreferences } from '../preferences'
import type { TranslationKey } from '../i18n/fr'
import './analysisCoherence.css'

export function AnalysisCoherence({ coherence, compact = false }: { coherence: TacticalCoherence; compact?: boolean }) {
  const { t } = usePreferences()
  const state = (value: TacticalCoherence['state']) => t(`coherenceState${value[0].toUpperCase()}${value.slice(1)}` as TranslationKey)
  const side = (value: string) => t(`coherenceSide${value[0].toUpperCase()}${value.slice(1)}` as TranslationKey)
  const confidence = (value: string) => t(`coherenceConfidence${value[0].toUpperCase()}${value.slice(1)}` as TranslationKey)
  const shown = coherence.factors.filter((factor) => factor.side !== 'neutral').slice(0, compact ? 5 : 7)
  return <section className={`analysis-coherence is-${coherence.state}${compact ? ' is-compact' : ''}`} aria-labelledby={`analysis-coherence-title${compact ? '-compact' : ''}`}>
    <header><div><small>{state(coherence.state)}</small><h2 id={`analysis-coherence-title${compact ? '-compact' : ''}`}>{t('analysisConsistency')}</h2></div><ShieldCheck /></header>
    <ul>{shown.map((factor) => <li key={`${factor.label}-${factor.side}`}><span>{factor.label}</span><strong>{side(factor.side)}</strong></li>)}</ul>
    <p>{coherence.summary}</p><footer><b>{t('conclusion')} :</b> {coherence.preferredSide === 'neutral' ? state(coherence.state) : `${side(coherence.preferredSide)}, ${confidence(coherence.confidence)}`}.</footer>
  </section>
}
