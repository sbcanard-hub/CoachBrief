import { useLayoutEffect } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router-dom'
import { Header } from './components/Header'
import { SiteLearningPanel } from './components/SiteLearningPanel'
import { WindModelComparisonPanel } from './components/WindModelComparisonPanel'
import { ForecastPanel } from './components/ForecastPanel'
import { HomePage } from './pages/HomePage'
import { ResultsPage } from './pages/ResultsPage'
import { SavedBriefingsPage } from './pages/SavedBriefingsPage'
import { DebriefPage } from './pages/DebriefPage'
import { TrainingPage } from './pages/TrainingPage'
import { SailorJournalPage } from './pages/SailorJournalPage'
import { LegalPage } from './pages/LegalPage'
import { AboutPage } from './pages/AboutPage'
import { legalFooterCopy } from './pages/legalFooter'
import { usePreferences } from './preferences'
import { SimilarSituations } from './components/SimilarSituations'
import { HistoricalRaces } from './components/HistoricalRaces'
import { LocalEffectsPanel } from './components/LocalEffectsPanel'
import { ResultsTabNavigation, ResultsTabPanel, type ResultsTab } from './components/ResultsTabs'
import type { BriefingRequest } from './types'
import { useEffect, useState } from 'react'
import { fetchWeatherForBriefing } from './weather'

function ResultsRoute() {
  const location = useLocation()
  const request = location.state as BriefingRequest | null
  const [memoryWeather, setMemoryWeather] = useState<Awaited<ReturnType<typeof fetchWeatherForBriefing>> | null>(null)
  const [activeTab, setActiveTab] = useState<ResultsTab>('forecast')
  const startMode = new URLSearchParams(location.search).get('mode') === 'depart'

  useLayoutEffect(() => {
    window.scrollTo(0, 0)
    setActiveTab('forecast')
  }, [location.key])

  useEffect(() => {
    let active = true
    if (!request) return
    fetchWeatherForBriefing(request).then((weather) => { if (active) setMemoryWeather(weather) }).catch(() => { if (active) setMemoryWeather(null) })
    return () => { active = false }
  }, [request])

  return <>
    {!startMode && <ResultsTabNavigation activeTab={activeTab} onChange={setActiveTab} />}
    {!startMode && <ResultsTabPanel tab="forecast" activeTab={activeTab}>
      {request && <ForecastPanel request={request} weather={memoryWeather} />}
    </ResultsTabPanel>}
    {!startMode && <ResultsTabPanel tab="weather" activeTab={activeTab}>
      <WindModelComparisonPanel />
      {request && <LocalEffectsPanel request={request} />}
    </ResultsTabPanel>}
    {!startMode && <ResultsTabPanel tab="history" activeTab={activeTab}>
      {request && <SimilarSituations request={request} weather={memoryWeather} />}
      {request && <HistoricalRaces request={request} weather={memoryWeather} />}
      <SiteLearningPanel />
    </ResultsTabPanel>}
    <ResultsPage key={`${location.key}:${request?.courseType ?? 'none'}`} activeTab={activeTab} />
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
  const { language, t } = usePreferences()
  const legal = legalFooterCopy[language]
  return (
    <div className="app-shell">
      <ScrollToTop />
      <Header />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/resultats" element={<ResultsRoute />} />
        <Route path="/briefings" element={<SavedBriefingsPage />} />
        <Route path="/briefings/:id/debrief" element={<DebriefPage />} />
        <Route path="/entrainements" element={<TrainingPage />} />
        <Route path="/coureurs" element={<SailorJournalPage />} />
        <Route path="/historique-plan-eau" element={<SavedBriefingsPage />} />
        <Route path="/a-propos" element={<AboutPage />} />
        <Route path="/mentions-legales" element={<LegalPage document="legal" />} />
        <Route path="/confidentialite" element={<LegalPage document="privacy" />} />
        <Route path="/conditions-utilisation" element={<LegalPage document="terms" />} />
      </Routes>
      <footer className="site-footer">
        <div><span>© 2026 CoachBrief — Sébastien Canard. {legal.rights}</span><span>{t('footer')}</span></div>
        <nav aria-label={legal.navigation}>
          <Link to="/a-propos">{legal.about}</Link>
          <Link to="/mentions-legales">{legal.legal}</Link>
          <Link to="/confidentialite">{legal.privacy}</Link>
          <Link to="/conditions-utilisation">{legal.terms}</Link>
        </nav>
      </footer>
    </div>
  )
}
