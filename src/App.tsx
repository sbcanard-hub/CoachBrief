import { Route, Routes } from 'react-router-dom'
import { Header } from './components/Header'
import { HomePage } from './pages/HomePage'
import { ResultsPage } from './pages/ResultsPage'

export default function App() {
  return (
    <div className="app-shell">
      <Header />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/resultats" element={<ResultsPage />} />
      </Routes>
      <footer><span>CoachBrief © 2026</span><span>Conçu pour ceux qui regardent l'horizon.</span></footer>
    </div>
  )
}
