import { useLayoutEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { Header } from './components/Header'
import { SiteLearningPanel } from './components/SiteLearningPanel'
import { WindModelComparisonPanel } from './components/WindModelComparisonPanel'
import { HomePage } from './pages/HomePage'
import { ResultsPage } from './pages/ResultsPage'
import { SavedBriefingsPage } from './pages/SavedBriefingsPage'
import { usePreferences } from './preferences'
import { LocalizedDocument } from './components/LocalizedDocument'

function ResultsRoute() {
  const location = useLocation()

  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [location.key])

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
