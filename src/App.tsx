import { ArrowLeft } from 'lucide-react'
import { Link, Route, Routes, useLocation } from 'react-router-dom'
import { Header } from './components/Header'
import { SiteLearningPanel } from './components/SiteLearningPanel'
import { WindModelComparisonPanel } from './components/WindModelComparisonPanel'
import { HomePage } from './pages/HomePage'
import { ResultsPage } from './pages/ResultsPage'
import { SavedBriefingsPage } from './pages/SavedBriefingsPage'
import { usePreferences } from './preferences'
import { LocalizedDocument } from './components/LocalizedDocument'
import type { BriefingRequest } from './types'

function ResultsRoute() {
  const request = useLocation().state as BriefingRequest | null

  return <>
    {request && <nav className="results-edit-navigation" aria-label="Navigation du briefing">
      <Link className="back-link" to="/" state={{ prefill: request, editing: true }}>
        <ArrowLeft size={17} /> Modifier le briefing
      </Link>
    </nav>}
    <WindModelComparisonPanel />
    <SiteLearningPanel />
    <ResultsPage />
  </>
}

export default function App() {
  const { t } = usePreferences()
  return (
    <div className="app-shell">
      <LocalizedDocument />
      <Header />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/resultats" element={<ResultsRoute />} />
        <Route path="/briefings" element={<SavedBriefingsPage />} />
      </Routes>
      <footer><span>CoachBrief © 2026</span><span>{t('footer')}</span></footer>
    </div>
  )
}
