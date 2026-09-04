import { ArrowLeft, CloudSun, MapPin } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import type { BriefingRequest } from '../types'

export function ResultsPage() {
  const { state } = useLocation()
  const request = state as BriefingRequest | null

  return (
    <main className="results-page">
      <Link className="back-link" to="/"><ArrowLeft size={17} /> Modifier les informations</Link>
      <section className="results-heading">
        <span className="step-label">Votre briefing</span>
        <h1>{request?.location || 'Prochaine régate'}</h1>
        {request && <p><MapPin size={16} /> {request.date} · {request.startTime} — {request.endTime}</p>}
      </section>
      <section className="empty-state">
        <div className="weather-icon"><CloudSun size={38} strokeWidth={1.4} /></div>
        <h2>Les données météo arrivent bientôt</h2>
        <p>Cette page est prête à accueillir le vent, les rafales, la houle et les prévisions détaillées de votre zone de course.</p>
      </section>
    </main>
  )
}
