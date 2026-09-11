import { Route, Routes } from 'react-router-dom'
import { Header } from './components/Header'
import { SiteLearningPanel } from './components/SiteLearningPanel'
import { WindModelComparisonPanel } from './components/WindModelComparisonPanel'
import { HomePage } from './pages/HomePage'
import { ResultsPage } from './pages/ResultsPage'
import { SavedBriefingsPage } from './pages/SavedBriefingsPage'
import { usePreferences } from './preferences'
import { LocalizedDocument } from './components/LocalizedDocument'

function ResultsRoute() {
  return <>
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
