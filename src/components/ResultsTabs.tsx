import type { ReactNode } from 'react'
import { CloudSun, Compass, History, LayoutDashboard, ListChecks, Map, SunMedium } from 'lucide-react'
import { usePreferences, type Language } from '../preferences'
import './resultsTabs.css'

export type ResultsTab = 'forecast' | 'summary' | 'course' | 'weather' | 'tactics' | 'rounds' | 'history'

const labels: Record<Language, Record<ResultsTab, string>> = {
  fr: { forecast: 'Prévision', summary: 'Synthèse', course: 'Parcours', weather: 'Météo', tactics: 'Tactique', rounds: 'Manches', history: 'Historique' },
  en: { forecast: 'Forecast', summary: 'Summary', course: 'Course', weather: 'Weather', tactics: 'Tactics', rounds: 'Races', history: 'History' },
  it: { forecast: 'Previsione', summary: 'Sintesi', course: 'Percorso', weather: 'Meteo', tactics: 'Tattica', rounds: 'Prove', history: 'Storico' },
  es: { forecast: 'Previsión', summary: 'Resumen', course: 'Recorrido', weather: 'Meteo', tactics: 'Táctica', rounds: 'Mangas', history: 'Historial' },
}

const tabs = [
  { id: 'forecast' as const, icon: SunMedium },
  { id: 'summary' as const, icon: LayoutDashboard },
  { id: 'course' as const, icon: Map },
  { id: 'weather' as const, icon: CloudSun },
  { id: 'tactics' as const, icon: Compass },
  { id: 'rounds' as const, icon: ListChecks },
  { id: 'history' as const, icon: History },
]

export function ResultsTabNavigation({ activeTab, onChange }: { activeTab: ResultsTab; onChange: (tab: ResultsTab) => void }) {
  const { language } = usePreferences()
  return <nav className="results-tabs" role="tablist" aria-label={language === 'fr' ? 'Rubriques des résultats' : 'Results sections'}>
    {tabs.map(({ id, icon: Icon }) => <button key={id} type="button" role="tab" aria-selected={activeTab === id} className={activeTab === id ? 'is-active' : ''} onClick={() => {
      onChange(id)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      window.requestAnimationFrame(() => window.dispatchEvent(new CustomEvent('coachbrief:results-tab-shown', { detail: { tab: id } })))
      window.setTimeout(() => window.dispatchEvent(new CustomEvent('coachbrief:results-tab-shown', { detail: { tab: id } })), 250)
    }}><Icon size={18} aria-hidden="true" /><span>{labels[language][id]}</span></button>)}
  </nav>
}

export function ResultsTabPanel({ tab, activeTab, children }: { tab: ResultsTab; activeTab: ResultsTab; children: ReactNode }) {
  return <div className={`results-tab-panel results-tab-panel--${tab}${activeTab === tab ? ' is-active' : ''}`} role="tabpanel">{children}</div>
}
