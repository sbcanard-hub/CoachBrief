import { Route, Routes } from 'react-router-dom'
import { Header } from './components/Header'
import { SiteLearningPanel } from './components/SiteLearningPanel'
import { WindModelComparisonPanel } from './components/WindModelComparisonPanel'
import { HomePage } from './pages/HomePage'
import { ResultsPage } from './pages/ResultsPage'
import { SavedBriefingsPage } from './pages/SavedBriefingsPage'

export default function App() {
  return (
    <div className="app-shell">
      <Header />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/resultats" element={<><WindModelComparisonPanel /><SiteLearningPanel /><ResultsPage /></>} />
        <Route path="/briefings" element={<SavedBriefingsPage />} />
      </Routes>
      <footer><span>CoachBrief © 2026</span><span>Conçu pour ceux qui regardent l'horizon.</span></footer>
    </div>
  )
}
