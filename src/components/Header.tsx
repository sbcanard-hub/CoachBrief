import { useEffect, useState } from 'react'
import { BookmarkPlus, Check, CircleHelp, FolderOpen, LoaderCircle, Menu, Printer, Sailboat, Settings, X } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { sourceReliabilityForRequest } from '../calibration'
import { nearbyMetarSources } from '../localSources'
import { fetchMetarCache, observationForStation } from '../metar'
import { fetchWeatherForBriefing } from '../weather'
import { loadSavedBriefings, readCurrentCourseSnapshot, saveBriefing } from '../savedBriefings'
import type { SavedMetarSnapshot } from '../savedBriefings'
import type { BriefingRequest } from '../types'
import { DataBackupActions } from './DataBackupActions'
import { AuthControl } from './AuthControl'
import { HelpDialog } from './HelpDialog'
import { LocalEffectsPanel } from './LocalEffectsPanel'
import { SourceConfidencePanel } from './SourceConfidencePanel'
import { SettingsDialog } from './SettingsDialog'
import { usePreferences } from '../preferences'
import './headerActions.css'
import './readability.css'
import '../print.css'

export function Header() {
  const location = useLocation()
  const request = location.pathname === '/resultats' ? location.state as BriefingRequest | null : null
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [menuOpen, setMenuOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { t } = usePreferences()
  const sourceReliability = sourceReliabilityForRequest(loadSavedBriefings(), request)

  useEffect(() => {
    const reset = window.setTimeout(() => {
      setSaveState('idle')
      setMenuOpen(false)
      setHelpOpen(false)
      setSettingsOpen(false)
    }, 0)
    return () => window.clearTimeout(reset)
  }, [location.key, location.pathname])

  async function captureNearestMetar(latitude: number, longitude: number): Promise<SavedMetarSnapshot | null> {
    try {
      const source = nearbyMetarSources(latitude, longitude, 1)[0]
      if (!source) return null
      const cache = await fetchMetarCache()
      const observation = observationForStation(cache, source.id)
      if (!observation) return null
      return {
        capturedAt: new Date().toISOString(),
        station: source.id,
        stationName: source.name,
        distanceKm: source.distance,
        reportTime: observation.reportTime,
        windSpeed: observation.windSpeed,
        windDirection: observation.windDirection,
        gust: observation.gust,
        raw: observation.raw,
      }
    } catch {
      return null
    }
  }

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
      const metar = weather ? await captureNearestMetar(weather.latitude, weather.longitude) : null
      const currentCourse = readCurrentCourseSnapshot()
      const matchingCourse = currentCourse?.courseType === request.courseType ? currentCourse : null
      saveBriefing(request, weather, matchingCourse, undefined, metar)
      setSaveState('saved')
    } catch {
      setSaveState('error')
    }
  }

  function printCurrentBriefing() {
    if (!request) return
    const previousTitle = document.title
    const cleanLocation = request.location?.trim() || 'Regate'
    document.title = `CoachBrief - ${cleanLocation}${request.date ? ` - ${request.date}` : ''}`
    window.print()
    window.setTimeout(() => { document.title = previousTitle }, 300)
  }

  return <>
    <header className="site-header">
      <Link className="brand" to="/" aria-label="Retour à l'accueil CoachBrief">
        <span className="brand-mark"><Sailboat size={22} strokeWidth={1.8} /></span>
        <span>CoachBrief</span>
      </Link>

      <button
        className="mobile-menu-button"
        type="button"
        aria-expanded={menuOpen}
        aria-controls="secondary-navigation"
        aria-label={menuOpen ? 'Fermer le menu Plus' : 'Ouvrir le menu Plus'}
        onClick={() => setMenuOpen((open) => !open)}
      >
        {menuOpen ? <X size={22} /> : <Menu size={22} />}
        <span>{t('more')}</span>
      </button>

      <nav id="main-navigation" className={`header-actions${request ? ' has-briefing-actions' : ''}`} aria-label="Navigation principale">
        {request && <Link className="results-edit-button" to="/" state={{ prefill: request, editing: true }}>
          ← Modifier le briefing
        </Link>}
        <Link to="/briefings"><FolderOpen size={15} /> <span>{t('briefings')}</span></Link>
        {request && <button type="button" onClick={printCurrentBriefing} title="Imprimer la fiche ou l’enregistrer en PDF" aria-label="Imprimer le briefing ou l’enregistrer en PDF">
          <Printer size={15} /> <span>Imprimer / PDF</span>
        </button>}
        {request && <button type="button" onClick={() => void saveCurrentBriefing()} disabled={saveState === 'saving'}>
          {saveState === 'saving' ? <LoaderCircle className="header-spin" size={15} /> : saveState === 'saved' ? <Check size={15} /> : <BookmarkPlus size={15} />}
          <span>{saveState === 'saving' ? 'Enregistrement…' : saveState === 'saved' ? 'Enregistré' : saveState === 'error' ? 'Réessayer' : 'Enregistrer'}</span>
        </button>}
        {!request && <span className="header-label">{t('weather')}</span>}
      </nav>
      <div id="secondary-navigation" className={`header-secondary${menuOpen ? ' is-open' : ''}`}>
        <button type="button" onClick={() => { setHelpOpen(true); setMenuOpen(false) }}>
          <CircleHelp size={15} /> <span>{t('help')}</span>
        </button>
        <button type="button" onClick={() => { setSettingsOpen(true); setMenuOpen(false) }}><Settings size={15} /> <span>{t('settings')}</span></button>
        <DataBackupActions />
        <AuthControl />
      </div>
    </header>
    <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    {request && <>
      <div className="header-confidence-wrap"><SourceConfidencePanel reliability={sourceReliability} /></div>
      <LocalEffectsPanel request={request} />
    </>}
  </>
}
