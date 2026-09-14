import { useMemo, useState } from 'react'
import { CircleHelp, Search, X } from 'lucide-react'\nimport { Link } from 'react-router-dom'
import { usePreferences } from '../preferences'
import type { TranslationKey } from '../i18n/fr'\nimport { legalFooterCopy } from '../pages/legalFooter'

type HelpDialogProps = { open: boolean; onClose: () => void }
type HelpItem = { category: TranslationKey; question: TranslationKey; answer: TranslationKey; keywords: TranslationKey }

const item = (category: TranslationKey, id: string): HelpItem => ({
  category,
  question: `help${id}Question` as TranslationKey,
  answer: `help${id}Answer` as TranslationKey,
  keywords: `help${id}Keywords` as TranslationKey,
})

const HELP_ITEMS: HelpItem[] = [
  item('gettingStarted', 'Create'),
  item('briefings', 'Find'), item('briefings', 'LocalCloud'),
  item('syncing', 'SendCloud'), item('syncing', 'RestoreDevice'), item('syncing', 'AutoSync'), item('syncing', 'Missing'),
  item('backup', 'BackupDifference'), item('backup', 'Restore'),
  item('weatherSources', 'Weather'), item('weatherSources', 'Confidence'),
  item('route', 'Course'), item('mapPosition', 'Position'), item('importExport', 'Transfer'),
  item('printPdf', 'Pdf'), item('troubleshooting', 'OldData'), item('troubleshooting', 'Update'),
  item('helpNewTools', 'StartMode'), item('helpNewTools', 'ExpressReading'), item('helpNewTools', 'WindShifts'),
  item('helpNewTools', 'StartLine'), item('helpNewTools', 'WaterMemory'), item('helpNewTools', 'SmartBriefing'),
  item('helpNewTools', 'Coherence'), item('helpNewTools', 'Trajectory'), item('helpNewTools', 'Training'), item('helpNewTools', 'SailorJournal'),
  item('helpNewTools', 'Debrief'),
  item('helpTypicalJourney', 'Journey'),
]

function normalize(value: string, locale: string) {
  return value.toLocaleLowerCase(locale).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function HelpDialog({ open, onClose }: HelpDialogProps) {
  const [query, setQuery] = useState('')
  const { language, locale, t } = usePreferences()
  const filteredItems = useMemo(() => {
    const normalizedQuery = normalize(query.trim(), locale)
    if (!normalizedQuery) return HELP_ITEMS
    return HELP_ITEMS.filter((entry) => {
      const haystack = normalize(`${t(entry.category)} ${t(entry.question)} ${t(entry.answer)} ${t(entry.keywords)}`, locale)
      return normalizedQuery.split(/\s+/).every((word) => haystack.includes(word))
    })
  }, [locale, query, t])
  const categories = useMemo(() => {
    const grouped = new Map<TranslationKey, HelpItem[]>()
    filteredItems.forEach((entry) => grouped.set(entry.category, [...(grouped.get(entry.category) ?? []), entry]))
    return Array.from(grouped.entries())
  }, [filteredItems])

  if (!open) return null
  return <div className="help-overlay" role="presentation" onMouseDown={onClose}>
    <section className="help-dialog help-dialog--faq" role="dialog" aria-modal="true" aria-labelledby="coachbrief-help-title" onMouseDown={(event) => event.stopPropagation()}>
      <button className="help-close" type="button" onClick={onClose} aria-label={t('closeHelp')}><X size={20} /></button>
      <div className="help-heading"><CircleHelp size={24} /><div><p className="help-kicker">{t('helpFaq')}</p><h2 id="coachbrief-help-title">{t('helpHeading')}</h2></div></div>
      <section className="help-introduction" aria-labelledby="coachbrief-purpose-title">
        <h3 id="coachbrief-purpose-title">{t('purposeTitle')}</h3>
        <p><strong>{t('purposeStrong')}</strong>{' '}{t('purposeBody')}</p>
        <div className="help-steps" aria-labelledby="coachbrief-steps-title">
          <h3 id="coachbrief-steps-title">{t('howTo')}</h3>
          <ol>
            <li><strong>{t('prepareRace')}</strong><span>{t('prepareRaceHelp')}</span></li>
            <li><strong>{t('analyse')}</strong><span>{t('analyseHelp')}</span></li>
            <li><strong>{t('tactics')}</strong><span>{t('tacticsHelp')}</span></li>
            <li><strong>{t('createBriefing')}</strong><span>{t('createHelp')}</span></li>
          </ol>
        </div>
      </section>
      <label className="help-search"><Search size={18} aria-hidden="true" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('helpSearch')} aria-label={t('helpSearchLabel')} autoComplete="off" />{query && <button type="button" onClick={() => setQuery('')} aria-label={t('clearSearch')}><X size={16} /></button>}</label>
      <p className="help-result-count" aria-live="polite">{query ? `${filteredItems.length} ${t(filteredItems.length > 1 ? 'answersFound' : 'answerFound')}` : `${HELP_ITEMS.length} ${t('commonQuestions')}`}</p>
      {categories.length ? <div className="help-faq">{categories.map(([category, items]) => <section className="help-category" key={category}><h3>{t(category)}</h3><div className="help-faq-list">{items.map((entry) => <details key={entry.question} open={Boolean(query)}><summary>{t(entry.question)}</summary><p>{t(entry.answer)}</p></details>)}</div></section>)}</div> : <div className="help-empty"><strong>{t('noResult')}</strong><span>{t('noResultHelp')}</span></div>}
    </section>
  </div>
}
