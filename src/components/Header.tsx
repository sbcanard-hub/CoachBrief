import { BookmarkPlus, Check, FolderOpen, LoaderCircle, Sailboat } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { fetchWeatherForBriefing } from '../weather'
import { readCurrentCourseSnapshot, saveBriefing } from '../savedBriefings'
import type { BriefingRequest } from '../types'
import './headerActions.css'

export function Header() {
  const location = useLocation()
  const request = location.pathname === '/resultats' ? location.state as BriefingRequest | null : null
  const [saveState, setSaveState] = React.useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  async function saveCurrentBriefing() {
    if (!request || saveState === 'saving') return
    setSaveState('saving')
    try {
      let weather = null
      try {
        weather = await fetchWeatherForBriefing(request)
      } catch {
        // Le briefing peut être sauvegardé même si la météo ne répond pas au moment précis de l'enregistrement.
      }
      saveBriefing(request, weather, readCurrentCourseSnapshot())
      setSaveState('saved')
    } catch {
      setSaveState('error')
    }
  }

  return (
    <header className="site-header">
      <Link className="brand" to="/" aria-label="Retour à l'accueil CoachBrief">
        <span className="brand-mark"><Sailboat size={22} strokeWidth={1.8} /></span>
        <span>CoachBrief</span>
      </Link>

      <nav className="header-actions" aria-label="Navigation principale">
        <Link to="/briefings"><FolderOpen size={15} /> <span>Mes briefings</span></Link>
        {request && <button type="button" onClick={() => void saveCurrentBriefing()} disabled={saveState === 'saving'}>
          {saveState === 'saving' ? <LoaderCircle className="header-spin" size={15} /> : saveState === 'saved' ? <Check size={15} /> : <BookmarkPlus size={15} />}
          <span>{saveState === 'saving' ? 'Enregistrement…' : saveState === 'saved' ? 'Enregistré' : saveState === 'error' ? 'Réessayer' : 'Enregistrer'}</span>
        </button>}
        {!request && <span className="header-label">Météo de régate</span>}
      </nav>
    </header>
  )
}

import React from 'react'
