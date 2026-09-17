import { useEffect, useState } from 'react'
import { Activity, BookUser, BookmarkPlus, Check, CircleHelp, Flag, FolderOpen, LoaderCircle, Menu, Printer, Sailboat, Settings, X } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
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
import { SourceConfidencePanel } from './SourceConfidencePanel'
import { SettingsDialog } from './SettingsDialog'
import { usePreferences } from '../preferences'
import './headerActions.css'
import './readability.css'
import '../print.css'

const headerCopy = {
  fr: { home: "Retour à l'accueil CoachBrief", open: 'Ouvrir le menu Plus', close: 'Fermer le menu Plus', training: 'Entraînements', sailors: 'Carnet des coureurs', offshore: 'Course au large', edit: 'Modifier le briefing', print: 'Imprimer / PDF', printTitle: 'Imprimer la fiche ou l’enregistrer en PDF', saving: 'Enregistrement…', saved: 'Mis à jour', retry: 'Réessayer', save: 'Enregistrer' },
  en: { home: 'Back to CoachBrief home', open: 'Open More menu', close: 'Close More menu', training: 'Training', sailors: 'Sailor journal', offshore: 'Offshore racing', edit: 'Edit briefing', print: 'Print / PDF', printTitle: 'Print the sheet or save it as a PDF', saving: 'Saving…', saved: 'Updated', retry: 'Try again', save: 'Save' },
  it: { home: 'Torna alla home di CoachBrief', open: 'Apri il menu Altro', close: 'Chiudi il menu Altro', training: 'Allenamenti', sailors: 'Diario dei velisti', offshore: 'Regata d’altura', edit: 'Modifica briefing', print: 'Stampa / PDF', printTitle: 'Stampa la scheda o salvala in PDF', saving: 'Salvataggio…', saved: 'Aggiornato', retry: 'Riprova', save: 'Salva' },
  es: { home: 'Volver al inicio de CoachBrief', open: 'Abrir el menú Más', close: 'Cerrar el menú Más', training: 'Entrenamientos', sailors: 'Cuaderno de regatistas', offshore: 'Regata de altura', edit: 'Editar briefing', print: 'Imprimir / PDF', printTitle: 'Imprimir la ficha o guardarla en PDF', saving: 'Guardando…', saved: 'Actualizado', retry: 'Reintentar', save: 'Guardar' },
} as const

export function Header() {
  const location = useLocation()
  const navigate = useNavigate()
  const request = location.pathname === '/resultats' ? location.state as BriefingRequest | null : null
  const startMode = new URLSearchParams(location.search).get('mode') === 'depart'
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [menuOpen, setMenuOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { t, language } = usePreferences()
  const c = headerCopy[language]
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
      const saved = saveBriefing(request, weather, matchingCourse, undefined, metar)
      if (!request.savedBriefingId) {
        navigate(`${location.pathname}${location.search}`, {
          replace: true,
          state: { ...request, savedBriefingId: saved.id },
        })
      }
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
      <Link className="brand" to="/" aria-label={c.home}>
        <span className="brand-mark"><Sailboat size={22} strokeWidth={1.8} /></span>
        <span>CoachBrief</span>
      </Link>

      <button
        className="mobile-menu-button"
        type="button"
        aria-expanded={menuOpen}
        aria-controls="secondary-navigation"
        aria-label={menuOpen ? c.close : c.open}
        onClick={() => setMenuOpen((open) => !open)}
      >
        {menuOpen ? <X size={22} /> : <Menu size={22} />}
        <span>{t('more')}</span>
      </button>

      <nav id="main-navigation" className={`header-actions${request ? ' has-briefing-actions' : ''}`} aria-label={t('mainNavigation')}>
        {request && <Link className="results-edit-button" to="/" state={{ prefill: request, editing: true }}>
          ← {c.edit}
        </Link>}
        {request && !startMode && <Link className="start-mode-button" to={{ pathname: '/resultats', search: '?mode=depart' }} state={request}>
          <Flag size={15} /> <span>{t('startMode')}</span>
        </Link>}
        {!request && <span className="header-label">{location.pathname === '/large' ? c.offshore : t('weather')}</span>}
      </nav>
      <div id="secondary-navigation" className={`header-secondary${menuOpen ? ' is-open' : ''}`}>
        <Link to="/large" onClick={() => setMenuOpen(false)}><Sailboat size={15} /> <span>{c.offshore}</span></Link>
        <Link to="/briefings" onClick={() => setMenuOpen(false)}><FolderOpen size={15} /> <span>{t('briefings')}</span></Link>
        <Link to="/entrainements" onClick={() => setMenuOpen(false)}><Activity size={15} /> <span>{c.training}</span></Link>
        <Link to="/coureurs" onClick={() => setMenuOpen(false)}><BookUser size={15} /> <span>{c.sailors}</span></Link>
        {request && <button type="button" onClick={printCurrentBriefing} title={c.printTitle} aria-label={c.printTitle}>
          <Printer size={15} /> <span>{c.print}</span>
        </button>}
        {request && <button type="button" onClick={() => void saveCurrentBriefing()} disabled={saveState === 'saving'}>
          {saveState === 'saving' ? <LoaderCircle className="header-spin" size={15} /> : saveState === 'saved' ? <Check size={15} /> : <BookmarkPlus size={15} />}
          <span>{saveState === 'saving' ? c.saving : saveState === 'saved' ? c.saved : saveState === 'error' ? c.retry : c.save}</span>
        </button>}
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
    </>}
  </>
}
