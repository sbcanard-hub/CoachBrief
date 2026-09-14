import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Activity, Crosshair, FileUp, MapPin, MessageSquarePlus, Pause, Play, Plus, Sailboat, Square, Trash2 } from 'lucide-react'
import { usePreferences } from '../preferences'
import type { BoatClass } from '../types'
import {
  deleteTrainingSession,
  loadTrainingSessions,
  parseTrainingGpx,
  saveTrainingSession,
  trackAverageSpeedKnots,
  trackDistanceMetres,
  type TrainingBoatTrack,
  type TrainingGpsPoint,
  type TrainingEvent,
  type TrainingEventCategory,
  type TrainingEventImportance,
  type TrainingLocationMode,
  type TrainingSession,
} from '../training'
import './training.css'

const copy = {
  fr: {
    eyebrow: 'Apprentissage du plan d’eau', title: 'Entraînements', intro: 'Enregistrez les observations du coach et importez les traces GPX des bateaux pour comprendre précisément une zone de navigation.',
    prepare: 'Préparer la séance', name: 'Nom de la séance', namePlaceholder: 'ex. Optimist — bascules et virements', location: 'Zone de navigation', locationPlaceholder: 'ex. Baie d’Antibes', date: 'Date', boatClass: 'Classe', mode: 'Mode de localisation du coach',
    punctual: 'Relevés ponctuels', punctualHelp: 'Une position uniquement lorsque vous ajoutez un relevé.', continuous: 'GPS continu', continuousHelp: 'Une trace complète, plus précise mais plus énergivore.', smart: 'GPS intelligent', smartHelp: 'Un point par minute, puis un suivi resserré autour des relevés.',
    start: 'Démarrer l’entraînement', active: 'Séance en cours', paused: 'GPS en pause', gpsActive: 'GPS actif', gpsUnavailable: 'GPS indisponible', pause: 'Pause GPS', resume: 'Reprendre le GPS', finish: 'Terminer la séance',
    reading: 'Ajouter un relevé', wind: 'Vent', direction: 'Direction', note: 'Observation', notePlaceholder: 'pression, courant, dévent, bascule…', add: 'Ajouter maintenant',
    imports: 'Traces GPS des bateaux', import: 'Importer des fichiers GPX', importHelp: 'Sélectionnez plusieurs fichiers puis attribuez chaque trace à un bateau ou un coureur.', boat: 'Bateau / coureur', points: 'points', invalidGpx: 'Un fichier GPX n’a pas pu être lu.', remove: 'Retirer',
    map: 'Carte synchronisée', timeline: 'Lecture temporelle', mapEmpty: 'Démarrez le GPS du coach ou importez une trace GPX pour afficher la séance.', coach: 'Coach', distance: 'Distance', average: 'Vitesse moyenne', readings: 'Relevés', boats: 'Bateaux', history: 'Séances enregistrées', noHistory: 'Aucune séance enregistrée.', delete: 'Supprimer', confirmDelete: 'Supprimer cette séance ?', saved: 'Séance enregistrée', gpsPermission: 'Autorisez la localisation pour enregistrer la position du coach.',
    generalNotes: 'Note générale de séance', generalNotesPlaceholder: 'Objectifs, exercices réalisés, état de mer, conclusions générales…', event: 'Ajouter un événement', eventCategory: 'Catégorie', eventTarget: 'Bateau concerné', group: 'Tout le groupe', importance: 'Importance', normal: 'Normale', important: 'Importante', decisive: 'Décisive', annotation: 'Annotation', eventPlaceholder: 'Décrivez ce qui vient de se produire…', addEvent: 'Placer l’événement', events: 'Événements annotés', weatherEvent: 'Météo', tacticsEvent: 'Tactique', manoeuvreEvent: 'Manœuvre', speedEvent: 'Vitesse', incidentEvent: 'Incident', noPosition: 'position non disponible',
  },
  en: {
    eyebrow: 'Sailing-area learning', title: 'Training', intro: 'Record coach observations and import boat GPX tracks to understand a sailing area precisely.',
    prepare: 'Prepare the session', name: 'Session name', namePlaceholder: 'e.g. Optimist — shifts and tacks', location: 'Sailing area', locationPlaceholder: 'e.g. Antibes Bay', date: 'Date', boatClass: 'Class', mode: 'Coach location mode',
    punctual: 'Point readings', punctualHelp: 'One position only when you add a reading.', continuous: 'Continuous GPS', continuousHelp: 'A complete track, more precise but using more battery.', smart: 'Smart GPS', smartHelp: 'One point per minute, with denser tracking around readings.',
    start: 'Start training', active: 'Session in progress', paused: 'GPS paused', gpsActive: 'GPS active', gpsUnavailable: 'GPS unavailable', pause: 'Pause GPS', resume: 'Resume GPS', finish: 'Finish session',
    reading: 'Add a reading', wind: 'Wind', direction: 'Direction', note: 'Observation', notePlaceholder: 'pressure, current, wind shadow, shift…', add: 'Add now',
    imports: 'Boat GPS tracks', import: 'Import GPX files', importHelp: 'Select several files, then assign each track to a boat or sailor.', boat: 'Boat / sailor', points: 'points', invalidGpx: 'A GPX file could not be read.', remove: 'Remove',
    map: 'Synchronised map', timeline: 'Time playback', mapEmpty: 'Start the coach GPS or import a GPX track to display the session.', coach: 'Coach', distance: 'Distance', average: 'Average speed', readings: 'Readings', boats: 'Boats', history: 'Saved sessions', noHistory: 'No saved sessions.', delete: 'Delete', confirmDelete: 'Delete this session?', saved: 'Session saved', gpsPermission: 'Allow location access to record the coach position.',
    generalNotes: 'General session notes', generalNotesPlaceholder: 'Objectives, exercises, sea state, general conclusions…', event: 'Add an event', eventCategory: 'Category', eventTarget: 'Boat concerned', group: 'Whole group', importance: 'Importance', normal: 'Normal', important: 'Important', decisive: 'Decisive', annotation: 'Annotation', eventPlaceholder: 'Describe what has just happened…', addEvent: 'Place event', events: 'Annotated events', weatherEvent: 'Weather', tacticsEvent: 'Tactics', manoeuvreEvent: 'Manoeuvre', speedEvent: 'Speed', incidentEvent: 'Incident', noPosition: 'position unavailable',
  },
  it: {
    eyebrow: 'Apprendimento del campo di regata', title: 'Allenamenti', intro: 'Registra le osservazioni del coach e importa le tracce GPX delle barche per comprendere con precisione una zona di navigazione.',
    prepare: 'Prepara la sessione', name: 'Nome della sessione', namePlaceholder: 'es. Optimist — salti e virate', location: 'Zona di navigazione', locationPlaceholder: 'es. Baia di Antibes', date: 'Data', boatClass: 'Classe', mode: 'Modalità di localizzazione del coach',
    punctual: 'Rilevamenti puntuali', punctualHelp: 'Una posizione solo quando aggiungi un rilevamento.', continuous: 'GPS continuo', continuousHelp: 'Una traccia completa, più precisa ma con maggior consumo.', smart: 'GPS intelligente', smartHelp: 'Un punto al minuto, con tracciamento più fitto attorno ai rilevamenti.',
    start: 'Avvia allenamento', active: 'Sessione in corso', paused: 'GPS in pausa', gpsActive: 'GPS attivo', gpsUnavailable: 'GPS non disponibile', pause: 'Pausa GPS', resume: 'Riprendi GPS', finish: 'Termina sessione',
    reading: 'Aggiungi un rilevamento', wind: 'Vento', direction: 'Direzione', note: 'Osservazione', notePlaceholder: 'pressione, corrente, zona coperta, salto…', add: 'Aggiungi ora',
    imports: 'Tracce GPS delle barche', import: 'Importa file GPX', importHelp: 'Seleziona più file, poi assegna ogni traccia a una barca o a un velista.', boat: 'Barca / velista', points: 'punti', invalidGpx: 'Impossibile leggere un file GPX.', remove: 'Rimuovi',
    map: 'Mappa sincronizzata', timeline: 'Riproduzione temporale', mapEmpty: 'Avvia il GPS del coach o importa una traccia GPX per visualizzare la sessione.', coach: 'Coach', distance: 'Distanza', average: 'Velocità media', readings: 'Rilevamenti', boats: 'Barche', history: 'Sessioni salvate', noHistory: 'Nessuna sessione salvata.', delete: 'Elimina', confirmDelete: 'Eliminare questa sessione?', saved: 'Sessione salvata', gpsPermission: 'Consenti la localizzazione per registrare la posizione del coach.',
    generalNotes: 'Note generali della sessione', generalNotesPlaceholder: 'Obiettivi, esercizi svolti, stato del mare, conclusioni generali…', event: 'Aggiungi un evento', eventCategory: 'Categoria', eventTarget: 'Barca interessata', group: 'Tutto il gruppo', importance: 'Importanza', normal: 'Normale', important: 'Importante', decisive: 'Decisiva', annotation: 'Annotazione', eventPlaceholder: 'Descrivi ciò che è appena successo…', addEvent: 'Posiziona evento', events: 'Eventi annotati', weatherEvent: 'Meteo', tacticsEvent: 'Tattica', manoeuvreEvent: 'Manovra', speedEvent: 'Velocità', incidentEvent: 'Incidente', noPosition: 'posizione non disponibile',
  },
  es: {
    eyebrow: 'Aprendizaje del campo de regatas', title: 'Entrenamientos', intro: 'Registra las observaciones del entrenador e importa las trazas GPX de los barcos para conocer con precisión una zona de navegación.',
    prepare: 'Preparar la sesión', name: 'Nombre de la sesión', namePlaceholder: 'p. ej., Optimist — roles y viradas', location: 'Zona de navegación', locationPlaceholder: 'p. ej., Bahía de Antibes', date: 'Fecha', boatClass: 'Clase', mode: 'Modo de localización del entrenador',
    punctual: 'Mediciones puntuales', punctualHelp: 'Una posición solo cuando añades una medición.', continuous: 'GPS continuo', continuousHelp: 'Una traza completa, más precisa pero con mayor consumo.', smart: 'GPS inteligente', smartHelp: 'Un punto por minuto, con seguimiento más frecuente alrededor de las mediciones.',
    start: 'Iniciar entrenamiento', active: 'Sesión en curso', paused: 'GPS en pausa', gpsActive: 'GPS activo', gpsUnavailable: 'GPS no disponible', pause: 'Pausar GPS', resume: 'Reanudar GPS', finish: 'Terminar sesión',
    reading: 'Añadir una medición', wind: 'Viento', direction: 'Dirección', note: 'Observación', notePlaceholder: 'presión, corriente, desvente, role…', add: 'Añadir ahora',
    imports: 'Trazas GPS de los barcos', import: 'Importar archivos GPX', importHelp: 'Selecciona varios archivos y asigna cada traza a un barco o regatista.', boat: 'Barco / regatista', points: 'puntos', invalidGpx: 'No se ha podido leer un archivo GPX.', remove: 'Retirar',
    map: 'Mapa sincronizado', timeline: 'Reproducción temporal', mapEmpty: 'Inicia el GPS del entrenador o importa una traza GPX para mostrar la sesión.', coach: 'Entrenador', distance: 'Distancia', average: 'Velocidad media', readings: 'Mediciones', boats: 'Barcos', history: 'Sesiones guardadas', noHistory: 'No hay sesiones guardadas.', delete: 'Eliminar', confirmDelete: '¿Eliminar esta sesión?', saved: 'Sesión guardada', gpsPermission: 'Autoriza la ubicación para registrar la posición del entrenador.',
    generalNotes: 'Nota general de la sesión', generalNotesPlaceholder: 'Objetivos, ejercicios realizados, estado del mar, conclusiones generales…', event: 'Añadir un evento', eventCategory: 'Categoría', eventTarget: 'Barco afectado', group: 'Todo el grupo', importance: 'Importancia', normal: 'Normal', important: 'Importante', decisive: 'Decisiva', annotation: 'Anotación', eventPlaceholder: 'Describe lo que acaba de ocurrir…', addEvent: 'Situar el evento', events: 'Eventos anotados', weatherEvent: 'Meteo', tacticsEvent: 'Táctica', manoeuvreEvent: 'Maniobra', speedEvent: 'Velocidad', incidentEvent: 'Incidente', noPosition: 'posición no disponible',
  },
} as const

const trackColours = ['#176f64', '#d8a400', '#5f4bb6', '#087e8b', '#b04a6f', '#3f6f9e']

function uniqueId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function TraceMap({ coach, boats, events, empty, cutoff }: { coach: TrainingGpsPoint[]; boats: TrainingBoatTrack[]; events: TrainingEvent[]; empty: string; cutoff: number }) {
  const positionedEvents = events.filter((event) => event.latitude != null && event.longitude != null)
  const eventPoints = positionedEvents.map((event) => ({ latitude: event.latitude!, longitude: event.longitude!, recordedAt: event.recordedAt }))
  const all = [...coach, ...boats.flatMap((track) => track.points), ...eventPoints]
  if (!all.length) return <div className="training-map training-map-empty">{empty}</div>
  const minLat = Math.min(...all.map((point) => point.latitude)); const maxLat = Math.max(...all.map((point) => point.latitude))
  const minLon = Math.min(...all.map((point) => point.longitude)); const maxLon = Math.max(...all.map((point) => point.longitude))
  const x = (lon: number) => 24 + (lon - minLon) / Math.max(maxLon - minLon, .00001) * 752
  const y = (lat: number) => 336 - (lat - minLat) / Math.max(maxLat - minLat, .00001) * 312
  const path = (points: TrainingGpsPoint[]) => points.map((point, index) => `${index ? 'L' : 'M'}${x(point.longitude).toFixed(1)},${y(point.latitude).toFixed(1)}`).join(' ')
  const visible = (points: TrainingGpsPoint[]) => points.filter((point) => Date.parse(point.recordedAt) <= cutoff)
  return <div className="training-map"><svg viewBox="0 0 800 360" role="img" aria-label="GPS tracks">
    <defs><pattern id="training-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#d6e4e0" strokeWidth="1" /></pattern></defs>
    <rect width="800" height="360" fill="url(#training-grid)" />
    {visible(coach).length > 1 && <path d={path(visible(coach))} fill="none" stroke={trackColours[0]} strokeWidth="4" strokeLinecap="round" />}
    {boats.map((track, index) => <path key={track.id} d={path(visible(track.points))} fill="none" stroke={trackColours[(index + 1) % trackColours.length]} strokeWidth="3" strokeLinecap="round" />)}
    {all.filter((point) => Date.parse(point.recordedAt) <= cutoff).map((point, index) => index % Math.max(1, Math.floor(all.length / 80)) === 0 && <circle key={`${point.recordedAt}-${index}`} cx={x(point.longitude)} cy={y(point.latitude)} r="2" fill="#173b36" />)}
    {positionedEvents.filter((event) => Date.parse(event.recordedAt) <= cutoff).map((event, index) => <g key={event.id}>
      <circle cx={x(event.longitude!)} cy={y(event.latitude!)} r={7 + event.importance * 2} fill={event.importance === 3 ? '#b04a6f' : event.importance === 2 ? '#d8a400' : '#5f4bb6'} stroke="white" strokeWidth="2"><title>{event.annotation}</title></circle>
      <text x={x(event.longitude!)} y={y(event.latitude!) + 3} textAnchor="middle" fill="white" fontSize="9" fontWeight="700">{index + 1}</text>
    </g>)}
  </svg></div>
}

export function TrainingPage() {
  const { language } = usePreferences(); const c = copy[language]
  const [sessions, setSessions] = useState(loadTrainingSessions)
  const [session, setSession] = useState<TrainingSession | null>(null)
  const [name, setName] = useState(''); const [location, setLocation] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10)); const [boatClass, setBoatClass] = useState<BoatClass>('Optimist')
  const [mode, setMode] = useState<TrainingLocationMode>('punctual'); const [paused, setPaused] = useState(false)
  const [gpsError, setGpsError] = useState(false); const [importError, setImportError] = useState(false)
  const [windSpeed, setWindSpeed] = useState(''); const [windDirection, setWindDirection] = useState(''); const [notes, setNotes] = useState('')
  const [eventCategory, setEventCategory] = useState<TrainingEventCategory>('weather'); const [eventTarget, setEventTarget] = useState('group')
  const [eventImportance, setEventImportance] = useState<TrainingEventImportance>(1); const [eventAnnotation, setEventAnnotation] = useState('')
  const watchRef = useRef<number | null>(null); const smartTimerRef = useRef<number | null>(null); const lastContinuousRef = useRef(0)
  const smartBurstRef = useRef<number[]>([]); const [playback, setPlayback] = useState(100)

  const stopGps = () => {
    if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current)
    if (smartTimerRef.current != null) window.clearInterval(smartTimerRef.current)
    smartBurstRef.current.forEach((timer) => window.clearTimeout(timer)); smartBurstRef.current = []
    watchRef.current = null; smartTimerRef.current = null
  }
  useEffect(() => () => stopGps(), [])

  const appendPosition = (position: GeolocationPosition, force = false) => {
    const now = Date.now()
    if (!force && now - lastContinuousRef.current < 10_000) return
    lastContinuousRef.current = now; setGpsError(false)
    const point: TrainingGpsPoint = { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, recordedAt: new Date(position.timestamp).toISOString() }
    setSession((current) => current ? { ...current, coachTrack: [...current.coachTrack, point] } : current)
  }

  const captureOnce = (force = true) => new Promise<TrainingGpsPoint | null>((resolve) => {
    if (!navigator.geolocation) { setGpsError(true); resolve(null); return }
    navigator.geolocation.getCurrentPosition((position) => {
      appendPosition(position, force)
      resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, recordedAt: new Date(position.timestamp).toISOString() })
    }, () => { setGpsError(true); resolve(null) }, { enableHighAccuracy: true, timeout: 12_000, maximumAge: 5_000 })
  })

  const startGps = (selectedMode: TrainingLocationMode) => {
    stopGps(); setPaused(false); setGpsError(false)
    if (selectedMode === 'punctual') return
    if (!navigator.geolocation) { setGpsError(true); return }
    if (selectedMode === 'continuous') {
      watchRef.current = navigator.geolocation.watchPosition((position) => appendPosition(position), () => setGpsError(true), { enableHighAccuracy: true, maximumAge: 2_000 })
    } else {
      void captureOnce(); smartTimerRef.current = window.setInterval(() => { void captureOnce() }, 60_000)
    }
  }

  function startSession(event: FormEvent) {
    event.preventDefault()
    const next: TrainingSession = { id: uniqueId('training'), name: name.trim(), location: location.trim(), date, boatClass, locationMode: mode, startedAt: new Date().toISOString(), sessionNotes: '', coachTrack: [], readings: [], boatTracks: [], events: [] }
    setSession(next); startGps(mode)
  }

  async function addReading(event: FormEvent) {
    event.preventDefault(); if (!session) return
    const position = mode === 'punctual' || mode === 'smart' ? await captureOnce(true) : session.coachTrack.at(-1) || null
    const reading = { id: uniqueId('reading'), recordedAt: new Date().toISOString(), latitude: position?.latitude, longitude: position?.longitude, windSpeed, windDirection, notes }
    setSession((current) => current ? { ...current, readings: [...current.readings, reading] } : current)
    if (mode === 'smart') smartBurstRef.current.push(...[10_000, 20_000, 30_000, 60_000, 120_000].map((delay) => window.setTimeout(() => { void captureOnce(true) }, delay)))
    setWindSpeed(''); setWindDirection(''); setNotes('')
  }

  async function importTracks(event: ChangeEvent<HTMLInputElement>) {
    if (!session || !event.target.files) return
    setImportError(false); const imported: TrainingBoatTrack[] = []
    for (const file of Array.from(event.target.files)) {
      try { const parsed = parseTrainingGpx(await file.text()); imported.push({ id: uniqueId('track'), boatName: parsed.name, fileName: file.name, points: parsed.points }) }
      catch { setImportError(true) }
    }
    setSession((current) => current ? { ...current, boatTracks: [...current.boatTracks, ...imported] } : current); event.target.value = ''
  }

  async function addEvent(event: FormEvent) {
    event.preventDefault(); if (!session || !eventAnnotation.trim()) return
    const recordedAt = new Date().toISOString()
    const selectedTrack = eventTarget === 'group' ? null : session.boatTracks.find((track) => track.id === eventTarget)
    const trackPosition = selectedTrack?.points.reduce<TrainingGpsPoint | null>((closest, point) => !closest || Math.abs(Date.parse(point.recordedAt) - Date.parse(recordedAt)) < Math.abs(Date.parse(closest.recordedAt) - Date.parse(recordedAt)) ? point : closest, null)
    const coachPosition = trackPosition || (mode === 'punctual' || mode === 'smart' ? await captureOnce(true) : session.coachTrack.at(-1) || null)
    const annotation: TrainingEvent = { id: uniqueId('event'), recordedAt, latitude: coachPosition?.latitude, longitude: coachPosition?.longitude, boatTrackId: eventTarget, category: eventCategory, importance: eventImportance, annotation: eventAnnotation.trim() }
    setSession((current) => current ? { ...current, events: [...current.events, annotation] } : current)
    setEventAnnotation('')
  }

  function finishSession() {
    if (!session) return; stopGps()
    const finished = { ...session, endedAt: new Date().toISOString() }; saveTrainingSession(finished)
    setSessions(loadTrainingSessions()); setSession(null); setPaused(false)
  }

  function togglePause() {
    if (!session) return
    if (paused) startGps(session.locationMode); else stopGps()
    setPaused(!paused)
  }

  const coachDistance = useMemo(() => session ? trackDistanceMetres(session.coachTrack) : 0, [session])
  const timeBounds = useMemo(() => {
    const times = session ? [...session.coachTrack, ...session.boatTracks.flatMap((track) => track.points), ...session.events].map((point) => Date.parse(point.recordedAt)).filter(Number.isFinite) : []
    return { start: times.length ? Math.min(...times) : 0, end: times.length ? Math.max(...times) : 0 }
  }, [session])
  const cutoff = timeBounds.start + (timeBounds.end - timeBounds.start) * playback / 100
  return <main className="training-page">
    <header className="training-heading"><div><span className="step-label">{c.eyebrow}</span><h1>{c.title}</h1><p>{c.intro}</p></div><Activity size={46} color="#176f64" /></header>
    {!session ? <>
      <section className="training-card"><h2>{c.prepare}</h2><form onSubmit={startSession}>
        <div className="training-grid">
          <label className="field"><span>{c.name}</span><input required value={name} placeholder={c.namePlaceholder} onChange={(event) => setName(event.target.value)} /></label>
          <label className="field"><span>{c.location}</span><input required value={location} placeholder={c.locationPlaceholder} onChange={(event) => setLocation(event.target.value)} /></label>
          <label className="field"><span>{c.date}</span><input required type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
          <label className="field"><span>{c.boatClass}</span><select value={boatClass} onChange={(event) => setBoatClass(event.target.value as BoatClass)}><option>Optimist</option><option>420</option><option>ILCA</option></select></label>
        </div>
        <h2>{c.mode}</h2><div className="location-mode">
          {(['punctual', 'continuous', 'smart'] as const).map((value) => <label key={value}><input type="radio" checked={mode === value} onChange={() => setMode(value)} /><strong>{c[value]}</strong><small>{c[`${value}Help` as const]}</small></label>)}
        </div><div className="training-actions"><button type="submit"><Play size={17} />{c.start}</button></div>
      </form></section>
      <section className="training-card"><h2>{c.history}</h2><div className="training-history">{!sessions.length && <p>{c.noHistory}</p>}{sessions.map((item) => <article key={item.id}><div><strong>{item.name}</strong><br /><small>{item.location} · {item.date} · {item.boatClass} · {item.boatTracks.length} {c.boats.toLowerCase()}</small></div><button className="icon-button" type="button" aria-label={c.delete} onClick={() => { if (window.confirm(c.confirmDelete)) { deleteTrainingSession(item.id); setSessions(loadTrainingSessions()) } }}><Trash2 size={17} /></button></article>)}</div></section>
    </> : <>
      <section className="training-card"><div className="training-status"><span className="recording"><Activity size={13} /> {c.active}</span><span>{paused ? c.paused : session.locationMode === 'punctual' ? c.punctual : c.gpsActive}</span><span>{session.name}</span></div>
        {gpsError && <p className="field-help is-warning">{c.gpsPermission}</p>}
        <div className="training-summary"><div><strong>{(coachDistance / 1000).toFixed(2)} km</strong>{c.distance}</div><div><strong>{trackAverageSpeedKnots(session.coachTrack).toFixed(1)} nd</strong>{c.average}</div><div><strong>{session.readings.length}</strong>{c.readings}</div><div><strong>{session.events.length}</strong>{c.events}</div><div><strong>{session.boatTracks.length}</strong>{c.boats}</div></div>
        <label className="field field-wide"><span>{c.generalNotes}</span><textarea rows={3} value={session.sessionNotes} placeholder={c.generalNotesPlaceholder} onChange={(event) => setSession((current) => current ? { ...current, sessionNotes: event.target.value } : current)} /></label>
        <div className="training-actions">{session.locationMode !== 'punctual' && <button className="secondary" type="button" onClick={togglePause}>{paused ? <Play size={16} /> : <Pause size={16} />}{paused ? c.resume : c.pause}</button>}<button className="danger" type="button" onClick={finishSession}><Square size={15} />{c.finish}</button></div>
      </section>
      <section className="training-card"><h2><Crosshair size={18} /> {c.reading}</h2><form className="training-reading-form" onSubmit={addReading}>
        <label className="field"><span>{c.wind}</span><input type="number" min="0" step="0.1" value={windSpeed} onChange={(event) => setWindSpeed(event.target.value)} /></label>
        <label className="field"><span>{c.direction}</span><input type="number" min="0" max="359" value={windDirection} onChange={(event) => setWindDirection(event.target.value)} /></label>
        <label className="field field-wide"><span>{c.note}</span><input value={notes} placeholder={c.notePlaceholder} onChange={(event) => setNotes(event.target.value)} /></label>
        <div className="training-actions"><button type="submit"><Plus size={16} />{c.add}</button></div>
      </form></section>
      <section className="training-card"><h2><MessageSquarePlus size={18} /> {c.event}</h2><form className="training-event-form" onSubmit={addEvent}>
        <label className="field"><span>{c.eventCategory}</span><select value={eventCategory} onChange={(event) => setEventCategory(event.target.value as TrainingEventCategory)}><option value="weather">{c.weatherEvent}</option><option value="tactics">{c.tacticsEvent}</option><option value="manoeuvre">{c.manoeuvreEvent}</option><option value="speed">{c.speedEvent}</option><option value="incident">{c.incidentEvent}</option></select></label>
        <label className="field"><span>{c.eventTarget}</span><select value={eventTarget} onChange={(event) => setEventTarget(event.target.value)}><option value="group">{c.group}</option>{session.boatTracks.map((track) => <option key={track.id} value={track.id}>{track.boatName}</option>)}</select></label>
        <label className="field"><span>{c.importance}</span><select value={eventImportance} onChange={(event) => setEventImportance(Number(event.target.value) as TrainingEventImportance)}><option value="1">{c.normal}</option><option value="2">{c.important}</option><option value="3">{c.decisive}</option></select></label>
        <label className="field field-wide"><span>{c.annotation}</span><input required value={eventAnnotation} placeholder={c.eventPlaceholder} onChange={(event) => setEventAnnotation(event.target.value)} /></label>
        <div className="training-actions"><button type="submit"><Plus size={16} />{c.addEvent}</button></div>
      </form>
      {session.events.length > 0 && <div className="training-events"><h3>{c.events}</h3>{session.events.map((item, index) => <article key={item.id}><span className={`training-event-marker importance-${item.importance}`}>{index + 1}</span><div><strong>{c[`${item.category}Event` as const]} · {item.boatTrackId === 'group' ? c.group : session.boatTracks.find((track) => track.id === item.boatTrackId)?.boatName || c.boat}</strong><small>{new Date(item.recordedAt).toLocaleTimeString(language)} · {item.latitude == null ? c.noPosition : `${item.latitude.toFixed(5)}, ${item.longitude!.toFixed(5)}`}</small><p>{item.annotation}</p></div><button className="icon-button" type="button" aria-label={c.remove} onClick={() => setSession((current) => current ? { ...current, events: current.events.filter((event) => event.id !== item.id) } : current)}><Trash2 size={16} /></button></article>)}</div>}
      </section>
      <section className="training-card"><h2><Sailboat size={18} /> {c.imports}</h2><p>{c.importHelp}</p><div className="training-actions"><label className="training-upload-label"><FileUp size={16} />{c.import}<input type="file" accept=".gpx,application/gpx+xml" multiple onChange={importTracks} /></label></div>{importError && <p className="field-help is-warning">{c.invalidGpx}</p>}
        <div className="training-tracks">{session.boatTracks.map((track) => <div className="training-track" key={track.id}><input aria-label={c.boat} value={track.boatName} onChange={(event) => setSession((current) => current ? { ...current, boatTracks: current.boatTracks.map((item) => item.id === track.id ? { ...item, boatName: event.target.value } : item) } : current)} /><span>{track.fileName} · {track.points.length} {c.points}</span><strong>{(trackDistanceMetres(track.points) / 1000).toFixed(2)} km</strong><button className="icon-button" type="button" aria-label={c.remove} onClick={() => setSession((current) => current ? { ...current, boatTracks: current.boatTracks.filter((item) => item.id !== track.id) } : current)}><Trash2 size={16} /></button></div>)}</div>
      </section>
      <section className="training-card"><h2><MapPin size={18} /> {c.map}</h2><TraceMap coach={session.coachTrack} boats={session.boatTracks} events={session.events} empty={c.mapEmpty} cutoff={cutoff} />
        {(session.coachTrack.length > 1 || session.boatTracks.length > 0 || session.events.length > 0) && <label className="field"><span>{c.timeline} · {new Date(cutoff).toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span><input type="range" min="0" max="100" value={playback} onChange={(event) => setPlayback(Number(event.target.value))} /></label>}
        <div className="training-legend"><span><i style={{ background: trackColours[0] }} />{c.coach}</span>{session.boatTracks.map((track, index) => <span key={track.id}><i style={{ background: trackColours[(index + 1) % trackColours.length] }} />{track.boatName}</span>)}</div></section>
    </>}
  </main>
}
