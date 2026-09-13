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
import { SimilarSituations } from './components/SimilarSituations'
import type { BriefingRequest } from './types'
import { useEffect, useState } from 'react'
import { fetchWeatherForBriefing } from './weather'

function ResultsRoute() {
  const location = useLocation()
  const request = location.state as BriefingRequest | null
  const [memoryWeather, setMemoryWeather] = useState<Awaited<ReturnType<typeof fetchWeatherForBriefing>> | null>(null)
  const startMode = new URLSearchParams(location.search).get('mode') === 'depart'

  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [location.key])

  useEffect(() => {
    let active = true
    if (!request) return
    fetchWeatherForBriefing(request).then((weather) => { if (active) setMemoryWeather(weather) }).catch(() => { if (active) setMemoryWeather(null) })
    return () => { active = false }
  }, [request])

  return <>
    {!startMode && <WindModelComparisonPanel />}
    {!startMode && request && <SimilarSituations request={request} weather={memoryWeather} />}
    {!startMode && <SiteLearningPanel />}
    <ResultsPage />
  </>
}

function ScrollToTop() {
  const location = useLocation()
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [location.pathname, location.search])
  return null
}

export default function App() {
  const { t } = usePreferences()
  return (
    <div className="app-shell">
      <LocalizedDocument />
      <ScrollToTop />
      <Header />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/resultats" element={<ResultsRoute />} />
        <Route path="/briefings" element={<SavedBriefingsPage />} />
        <Route path="/historique-plan-eau" element={<SavedBriefingsPage />} />
      </Routes>
      <footer><span>CoachBrief © 2026</span><span>{t('footer')}</span></footer>
    </div>
  )
}
