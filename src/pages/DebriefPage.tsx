import { useMemo, useState } from 'react'
import { ArrowLeft, CheckCircle2, Printer, Save, Trash2 } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { buildDebriefComparison, calculatedDebriefQuality, extractLessons } from '../debriefAnalysis'
import { deleteRaceDebrief, loadSavedBriefings, saveRaceDebrief, type RaceDebrief } from '../savedBriefings'
import { usePreferences } from '../preferences'
import './debrief.css'

type Draft = Omit<RaceDebrief, 'updatedAt' | 'validatedAt'>
const emptyDraft: Draft = { actualStartTime: '', windSpeed: '', windDirection: '', gust: '', windEvolution: '', observedShifts: '', currentObserved: '', favouredLineSide: '', favouredCourseSide: '', winningTrajectory: '', strategyChange: '', seaConditions: '', keyEvents: '', coachNotes: '', actualRotation: '', actualOscillations: '', manualQuality: '', manualAssessment: '' }

export function DebriefPage() {
  const { id = '' } = useParams(); const navigate = useNavigate(); const { t, language } = usePreferences()
  const [item, setItem] = useState(() => loadSavedBriefings().find((briefing) => briefing.id === id) ?? null)
  const [draft, setDraft] = useState<Draft>(() => item?.debrief ? { ...item.debrief, validatedAt: undefined, updatedAt: undefined } : emptyDraft)
  const [status, setStatus] = useState('')
  const preview = useMemo<RaceDebrief>(() => ({ ...draft, updatedAt: item?.debrief?.updatedAt ?? new Date().toISOString(), validatedAt: item?.debrief?.validatedAt }), [draft, item])
  const windUnit = { fr: 'nd', en: 'kt', it: 'nodi', es: 'nudos' }[language]
  const comparisons = useMemo(() => item ? buildDebriefComparison(item, preview, windUnit) : [], [item, preview, windUnit])
  const automaticQuality = calculatedDebriefQuality(comparisons)
  const lessons = item ? extractLessons(item, preview) : []
  const update = (field: keyof Draft, value: string) => setDraft((current) => ({ ...current, [field]: value }))
  const save = (validate: boolean) => { if (!item) return; const saved = saveRaceDebrief(item.id, draft, validate); setItem(saved); setStatus(validate ? t('debriefValidated') : t('debriefDraftSaved')) }
  const remove = () => { if (!item || !window.confirm(t('deleteDebriefConfirm'))) return; deleteRaceDebrief(item.id); navigate('/briefings') }
  const printDebrief = () => {
    if (!item) return
    const previousTitle = document.title
    document.title = `CoachBrief - Debrief - ${item.request.location || item.name}${item.request.date ? ` - ${item.request.date}` : ''}`
    window.print()
    window.setTimeout(() => { document.title = previousTitle }, 300)
  }
  if (!item) return <main className="debrief-page"><p>{t('debriefNotFound')}</p><button onClick={() => navigate('/briefings')}>{t('backToBriefings')}</button></main>
  const fields: Array<[keyof Draft, string, 'input' | 'textarea' | 'select']> = [
    ['actualStartTime', t('actualStartTime'), 'input'], ['windSpeed', t('actualAverageWind'), 'input'], ['windDirection', t('actualAverageDirection'), 'input'], ['gust', t('actualGusts'), 'input'],
    ['windEvolution', t('actualWindEvolution'), 'textarea'], ['observedShifts', t('actualShifts'), 'textarea'], ['currentObserved', t('actualCurrent'), 'input'], ['favouredLineSide', t('actualFavouredLine'), 'select'],
    ['favouredCourseSide', t('actualFavouredCourse'), 'textarea'], ['winningTrajectory', t('winningTrajectory'), 'textarea'], ['strategyChange', t('strategyChange'), 'textarea'], ['seaConditions', t('seaConditions'), 'textarea'],
    ['keyEvents', t('keyEvents'), 'textarea'], ['coachNotes', t('freeCoachNote'), 'textarea'], ['actualRotation', t('actualRotation'), 'input'], ['actualOscillations', t('actualOscillations'), 'input'],
  ]
  const numericLimits: Partial<Record<keyof Draft, { min: number, max: number, step: number }>> = {
    windSpeed: { min: 0, max: 80, step: 0.1 },
    windDirection: { min: 0, max: 359, step: 1 },
    gust: { min: 0, max: 100, step: 0.1 },
    actualRotation: { min: -180, max: 180, step: 1 },
    actualOscillations: { min: 0, max: 180, step: 1 },
  }
  return <main className="debrief-page">
    <header className="debrief-hero"><div><button className="debrief-back" onClick={() => navigate('/briefings')}><ArrowLeft size={15}/>{t('backToBriefings')}</button><span>{t('attachedToBriefing')}</span><h1>{t('raceDebrief')}</h1><p>{item.name} · {item.request.location}</p></div><div className="debrief-actions"><button onClick={printDebrief}><Printer size={15}/>{t('print')}</button><button onClick={remove}><Trash2 size={15}/>{t('deleteDebrief')}</button></div></header>
    {status && <p className="debrief-status" role="status">{status}</p>}
    <section className="debrief-section"><h2>{t('whatHappened')}</h2><div className="debrief-fields">{fields.map(([field, label, kind]) => { const limits = numericLimits[field]; return <label key={field}><span>{label}</span>{kind === 'textarea' ? <textarea rows={3} value={draft[field]} onChange={(e) => update(field, e.target.value)}/> : kind === 'select' ? <select value={draft[field]} onChange={(e) => update(field, e.target.value)}><option value="">—</option><option value="Comité">{t('committee')}</option><option value="Neutre">{t('neutral')}</option><option value="Pin">Pin</option></select> : <input type={field === 'actualStartTime' ? 'time' : limits ? 'number' : 'text'} min={limits?.min} max={limits?.max} step={limits?.step} inputMode={limits ? 'decimal' : undefined} value={draft[field]} onChange={(e) => update(field, e.target.value)}/>}</label> })}</div></section>
    <section className="debrief-section"><h2>{t('forecastVsReality')}</h2><div className="comparison-grid">{comparisons.map((entry) => <article className={`comparison-${entry.verdict}`} key={entry.key}><strong>{t(`comparison${entry.key[0].toUpperCase()}${entry.key.slice(1)}` as Parameters<typeof t>[0])}</strong><span>{t('forecastLabel')}: {entry.forecast}</span><span>{t('realityLabel')}: {entry.actual}</span><small>{t(`verdict${entry.verdict[0].toUpperCase()}${entry.verdict.slice(1)}` as Parameters<typeof t>[0])}</small></article>)}</div>
      <div className="debrief-summary"><strong>{t('simpleSummary')}</strong><p><b>{t('weatherForecastSummary')} :</b> {t(comparisons.slice(0, 2).some(c => c.verdict === 'gap') ? 'verdictPartial' : 'verdictGood')}</p><p><b>{t('tacticalAnalysisSummary')} :</b> {t(comparisons.slice(2, 5).some(c => c.verdict === 'gap') ? 'verdictGap' : 'verdictPartial')}</p><p><b>{t('startLineSummary')} :</b> {comparisons.find(c => c.key === 'line')?.actual ?? '—'}</p><p><b>{t('trajectorySummary')} :</b> {draft.winningTrajectory || '—'}</p><p><b>{t('mainGapSummary')} :</b> {comparisons.find(c => c.verdict === 'gap') ? t(`comparison${comparisons.find(c => c.verdict === 'gap')!.key[0].toUpperCase()}${comparisons.find(c => c.verdict === 'gap')!.key.slice(1)}` as Parameters<typeof t>[0]) : t('noSignificantGap')}</p></div>
      <div className="quality"><div><span>{t('calculatedQuality')}</span><strong>{t(`quality${automaticQuality.split('-').map(x => x[0].toUpperCase()+x.slice(1)).join('')}` as Parameters<typeof t>[0])}</strong></div><label><span>{t('coachAssessment')}</span><select value={draft.manualQuality} onChange={(e) => update('manualQuality', e.target.value)}><option value="">{t('noManualOverride')}</option>{(['very-relevant','relevant','partly-relevant','not-very-relevant'] as const).map(q => <option key={q} value={q}>{t(`quality${q.split('-').map(x => x[0].toUpperCase()+x.slice(1)).join('')}` as Parameters<typeof t>[0])}</option>)}</select></label><label><span>{t('manualComment')}</span><textarea rows={2} value={draft.manualAssessment} onChange={(e) => update('manualAssessment', e.target.value)}/></label></div>
    </section>
    <section className="debrief-section lessons"><h2>{t('whatWeLearn')}</h2>{lessons.length ? <ol>{lessons.map((lesson) => <li key={lesson}>{lesson}</li>)}</ol> : <p>{t('lessonsNeedData')}</p>}</section>
    <footer className="debrief-save"><div>{item.debrief?.validatedAt ? <span><CheckCircle2 size={15}/>{t('addedToLocalMemory')}</span> : <span>{t('notInMemoryYet')}</span>}</div><button onClick={() => save(false)}><Save size={15}/>{t('saveDraft')}</button><button className="primary" onClick={() => save(true)}><CheckCircle2 size={15}/>{t('validateAndRemember')}</button></footer>
  </main>
}
