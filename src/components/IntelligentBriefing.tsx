import { useState } from 'react'
import { ListChecks, Sailboat } from 'lucide-react'
import type { IntelligentBriefing as Briefing } from '../intelligentBriefing'
import { usePreferences, type Language } from '../preferences'
import './intelligentBriefing.css'

const copy: Record<Language, { title: string; kicker: string; conditions: string; start: string; tactics: string; firstLeg: string; watch: string; confidence: string; runner: string; coach: string; runnerLabel: string }> = {
  fr: { title: 'Briefing intelligent', kicker: 'Synthèse automatique', conditions: 'Conditions', start: 'Départ', tactics: 'Tactique', firstLeg: 'Premier bord', watch: 'À surveiller', confidence: 'Confiance', runner: 'Version coureur', coach: 'Version coach', runnerLabel: 'Consignes coureur — 5 maximum' },
  en: { title: 'Smart briefing', kicker: 'Automatic summary', conditions: 'Conditions', start: 'Start', tactics: 'Tactics', firstLeg: 'First leg', watch: 'Watch', confidence: 'Confidence', runner: 'Sailor version', coach: 'Coach version', runnerLabel: 'Sailor instructions — maximum 5' },
  it: { title: 'Briefing intelligente', kicker: 'Sintesi automatica', conditions: 'Condizioni', start: 'Partenza', tactics: 'Tattica', firstLeg: 'Prima bolina', watch: 'Da sorvegliare', confidence: 'Affidabilità', runner: 'Versione atleta', coach: 'Versione coach', runnerLabel: 'Istruzioni atleta — massimo 5' },
  es: { title: 'Briefing inteligente', kicker: 'Resumen automático', conditions: 'Condiciones', start: 'Salida', tactics: 'Táctica', firstLeg: 'Primer bordo', watch: 'A vigilar', confidence: 'Confianza', runner: 'Versión regatista', coach: 'Versión entrenador', runnerLabel: 'Instrucciones para el regatista — máximo 5' },
}

export function IntelligentBriefing({ briefing, compact = false }: { briefing: Briefing; compact?: boolean }) {
  const { language } = usePreferences(); const c = copy[language]
  const [runner, setRunner] = useState(false)
  return <section className={`intelligent-briefing${compact ? ' is-compact' : ''}${briefing.shared ? ' is-shared' : ''}`} aria-labelledby={compact ? 'start-smart-title' : 'smart-title'}>
    <div className="intelligent-heading"><div><span>{c.kicker}</span><h2 id={compact ? 'start-smart-title' : 'smart-title'}>{c.title}</h2></div><button className="runner-toggle" type="button" aria-pressed={runner} onClick={() => setRunner((value) => !value)}>{runner ? <ListChecks size={17} /> : <Sailboat size={17} />}{runner ? c.coach : c.runner}</button></div>
    {runner ? <div className="runner-version" aria-live="polite"><strong>{c.runnerLabel}</strong><ol>{briefing.runner.map((item, index) => <li key={`${index}-${item}`}><span>{index + 1}</span>{item}</li>)}</ol></div> : <div className="intelligent-grid" aria-live="polite">
      <article><h3>{c.conditions}</h3><ul>{briefing.conditions.map((item) => <li key={item}>{item}</li>)}</ul></article>
      <article><h3>{c.start}</h3><p>{briefing.start}</p></article>
      <article><h3>{c.tactics}</h3><ul>{briefing.tactics.map((item) => <li key={item}>{item}</li>)}</ul></article>
      <article><h3>{c.firstLeg}</h3><p>{briefing.firstLeg}</p></article>
      <article className="is-watch"><h3>{c.watch}</h3><p>{briefing.watch}</p></article>
      <article className="is-confidence"><h3>{c.confidence}</h3><p>{briefing.confidence}</p></article>
    </div>}
  </section>
}
