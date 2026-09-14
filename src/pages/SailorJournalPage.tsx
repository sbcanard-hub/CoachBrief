import { type FormEvent, useMemo, useState } from 'react'
import { Anchor, BookOpen, Link2, Plus, Printer, Save, Trash2, UserPlus, Users } from 'lucide-react'
import { usePreferences } from '../preferences'
import {
  deleteSailorEntry,
  deleteSailorProfile,
  loadSailorJournal,
  saveSailorEntry,
  saveSailorProfile,
  type SailorNavigationEntry,
  type SailorNavigationKind,
  type SailorRating,
  type SailorRatings,
} from '../sailorJournal'
import { loadTrainingSessions } from '../training'
import type { BoatClass } from '../types'
import './sailorJournal.css'

const copy = {
  fr: {
    eyebrow: 'Suivi individuel', title: 'Carnet du coureur', intro: 'Constituez, navigation après navigation, un dossier privé réunissant le ressenti du coureur, l’analyse du coach et la connaissance des plans d’eau.', profiles: 'Coureurs', newProfile: 'Ajouter un coureur', firstName: 'Prénom', lastName: 'Nom', boatClass: 'Classe', age: 'Catégorie d’âge', club: 'Club', optional: 'facultatif', addProfile: 'Créer le profil', noProfiles: 'Ajoutez un premier coureur pour commencer son carnet.', deleteProfile: 'Supprimer le profil', confirmProfile: 'Supprimer ce profil et toutes ses fiches de navigation ?', private: 'Dossier privé du coach', entries: 'navigations',
    newEntry: 'Nouvelle fiche de navigation', training: 'Entraînement', regatta: 'Régate', type: 'Type', date: 'Date', location: 'Plan d’eau', locationPlaceholder: 'ex. Baie d’Antibes', entryTitle: 'Titre de la navigation', titlePlaceholder: 'ex. Travail des bascules', linkedSession: 'Séance CoachBrief associée', noSession: 'Aucune séance associée', linkedTrack: 'Trace GPX du coureur', noTrack: 'Aucune trace associée', linkHelp: 'Associer une séance récupère sa date, son plan d’eau et sa classe. Vous pouvez ensuite choisir la trace GPX correspondant au coureur.', selfAssessment: 'Auto-évaluation du coureur', start: 'Départ', speed: 'Vitesse', tactics: 'Tactique', strategy: 'Stratégie', manoeuvres: 'Manœuvres', ratingHelp: '1 = à travailler · 5 = très bien maîtrisé', conditions: 'Conditions rencontrées', conditionsPlaceholder: 'Vent, mer, courant, visibilité…', objectives: 'Objectifs de la navigation', objectivesPlaceholder: 'Ce que le coureur voulait travailler…', waterAnalysis: 'Analyse du plan d’eau', waterPlaceholder: 'Zones de pression, courant, dévents, côté favorable…', successes: 'Points réussis', improvements: 'Axes de progression', sailorNotes: 'Notes du coureur', coachNotes: 'Commentaire du coach', nextObjectives: 'Priorités pour la prochaine navigation', saveEntry: 'Ajouter au dossier', history: 'Dossier de progression', noEntries: 'Aucune navigation enregistrée pour ce coureur.', print: 'Imprimer / PDF', deleteEntry: 'Supprimer la fiche', confirmEntry: 'Supprimer cette fiche de navigation ?', linkedTo: 'Associée à', gpx: 'Trace GPX', overallAverage: 'Moyenne globale', sessionsCount: 'Fiches', locationsCount: 'Plans d’eau', latest: 'Dernière navigation', identityRequired: 'Le prénom et le nom sont obligatoires.', entryRequired: 'Le titre et le plan d’eau sont obligatoires.', saved: 'Fiche ajoutée au dossier.',
  },
  en: {
    eyebrow: 'Individual tracking', title: 'Sailor journal', intro: 'Build a private record, one sailing session at a time, combining the sailor’s feedback, the coach’s analysis and sailing-area knowledge.', profiles: 'Sailors', newProfile: 'Add a sailor', firstName: 'First name', lastName: 'Last name', boatClass: 'Class', age: 'Age category', club: 'Club', optional: 'optional', addProfile: 'Create profile', noProfiles: 'Add a first sailor to start their journal.', deleteProfile: 'Delete profile', confirmProfile: 'Delete this profile and all its sailing records?', private: 'Private coach record', entries: 'sessions',
    newEntry: 'New sailing record', training: 'Training', regatta: 'Regatta', type: 'Type', date: 'Date', location: 'Sailing area', locationPlaceholder: 'e.g. Antibes Bay', entryTitle: 'Session title', titlePlaceholder: 'e.g. Working on wind shifts', linkedSession: 'Linked CoachBrief session', noSession: 'No linked session', linkedTrack: 'Sailor GPX track', noTrack: 'No linked track', linkHelp: 'Linking a session retrieves its date, sailing area and class. You can then choose the GPX track belonging to the sailor.', selfAssessment: 'Sailor self-assessment', start: 'Start', speed: 'Speed', tactics: 'Tactics', strategy: 'Strategy', manoeuvres: 'Manoeuvres', ratingHelp: '1 = needs work · 5 = very well mastered', conditions: 'Conditions encountered', conditionsPlaceholder: 'Wind, sea, current, visibility…', objectives: 'Session objectives', objectivesPlaceholder: 'What the sailor wanted to work on…', waterAnalysis: 'Sailing-area analysis', waterPlaceholder: 'Pressure zones, current, wind shadows, favoured side…', successes: 'What went well', improvements: 'Areas for improvement', sailorNotes: 'Sailor notes', coachNotes: 'Coach comment', nextObjectives: 'Priorities for the next session', saveEntry: 'Add to record', history: 'Progress record', noEntries: 'No sailing record saved for this sailor.', print: 'Print / PDF', deleteEntry: 'Delete record', confirmEntry: 'Delete this sailing record?', linkedTo: 'Linked to', gpx: 'GPX track', overallAverage: 'Overall average', sessionsCount: 'Records', locationsCount: 'Sailing areas', latest: 'Latest session', identityRequired: 'First name and last name are required.', entryRequired: 'Title and sailing area are required.', saved: 'Record added to the journal.',
  },
  it: {
    eyebrow: 'Monitoraggio individuale', title: 'Diario del velista', intro: 'Crea, navigazione dopo navigazione, un dossier privato che riunisce le sensazioni del velista, l’analisi del coach e la conoscenza dei campi di regata.', profiles: 'Velisti', newProfile: 'Aggiungi un velista', firstName: 'Nome', lastName: 'Cognome', boatClass: 'Classe', age: 'Categoria d’età', club: 'Circolo', optional: 'facoltativo', addProfile: 'Crea profilo', noProfiles: 'Aggiungi il primo velista per iniziare il diario.', deleteProfile: 'Elimina profilo', confirmProfile: 'Eliminare questo profilo e tutte le sue schede?', private: 'Dossier privato del coach', entries: 'navigazioni',
    newEntry: 'Nuova scheda di navigazione', training: 'Allenamento', regatta: 'Regata', type: 'Tipo', date: 'Data', location: 'Campo di regata', locationPlaceholder: 'es. Baia di Antibes', entryTitle: 'Titolo della navigazione', titlePlaceholder: 'es. Lavoro sulle oscillazioni', linkedSession: 'Sessione CoachBrief associata', noSession: 'Nessuna sessione associata', linkedTrack: 'Traccia GPX del velista', noTrack: 'Nessuna traccia associata', linkHelp: 'Associando una sessione si recuperano data, campo e classe. Puoi quindi scegliere la traccia GPX del velista.', selfAssessment: 'Autovalutazione del velista', start: 'Partenza', speed: 'Velocità', tactics: 'Tattica', strategy: 'Strategia', manoeuvres: 'Manovre', ratingHelp: '1 = da migliorare · 5 = ottima padronanza', conditions: 'Condizioni incontrate', conditionsPlaceholder: 'Vento, mare, corrente, visibilità…', objectives: 'Obiettivi della navigazione', objectivesPlaceholder: 'Cosa voleva migliorare il velista…', waterAnalysis: 'Analisi del campo di regata', waterPlaceholder: 'Zone di pressione, corrente, ridosso, lato favorito…', successes: 'Punti riusciti', improvements: 'Aree di miglioramento', sailorNotes: 'Note del velista', coachNotes: 'Commento del coach', nextObjectives: 'Priorità per la prossima navigazione', saveEntry: 'Aggiungi al dossier', history: 'Dossier di progressione', noEntries: 'Nessuna navigazione salvata per questo velista.', print: 'Stampa / PDF', deleteEntry: 'Elimina scheda', confirmEntry: 'Eliminare questa scheda di navigazione?', linkedTo: 'Associata a', gpx: 'Traccia GPX', overallAverage: 'Media generale', sessionsCount: 'Schede', locationsCount: 'Campi', latest: 'Ultima navigazione', identityRequired: 'Nome e cognome sono obbligatori.', entryRequired: 'Titolo e campo di regata sono obbligatori.', saved: 'Scheda aggiunta al diario.',
  },
  es: {
    eyebrow: 'Seguimiento individual', title: 'Cuaderno del regatista', intro: 'Crea, navegación tras navegación, un expediente privado que reúne las sensaciones del regatista, el análisis del entrenador y el conocimiento de los campos de regata.', profiles: 'Regatistas', newProfile: 'Añadir regatista', firstName: 'Nombre', lastName: 'Apellido', boatClass: 'Clase', age: 'Categoría de edad', club: 'Club', optional: 'opcional', addProfile: 'Crear perfil', noProfiles: 'Añade un primer regatista para iniciar su cuaderno.', deleteProfile: 'Eliminar perfil', confirmProfile: '¿Eliminar este perfil y todas sus fichas de navegación?', private: 'Expediente privado del entrenador', entries: 'navegaciones',
    newEntry: 'Nueva ficha de navegación', training: 'Entrenamiento', regatta: 'Regata', type: 'Tipo', date: 'Fecha', location: 'Campo de regatas', locationPlaceholder: 'p. ej. Bahía de Antibes', entryTitle: 'Título de la navegación', titlePlaceholder: 'p. ej. Trabajo de roles', linkedSession: 'Sesión CoachBrief asociada', noSession: 'Ninguna sesión asociada', linkedTrack: 'Traza GPX del regatista', noTrack: 'Ninguna traza asociada', linkHelp: 'Al asociar una sesión se recuperan su fecha, campo y clase. Después puedes elegir la traza GPX del regatista.', selfAssessment: 'Autoevaluación del regatista', start: 'Salida', speed: 'Velocidad', tactics: 'Táctica', strategy: 'Estrategia', manoeuvres: 'Maniobras', ratingHelp: '1 = por trabajar · 5 = muy bien dominado', conditions: 'Condiciones encontradas', conditionsPlaceholder: 'Viento, mar, corriente, visibilidad…', objectives: 'Objetivos de la navegación', objectivesPlaceholder: 'Lo que quería trabajar el regatista…', waterAnalysis: 'Análisis del campo de regatas', waterPlaceholder: 'Zonas de presión, corriente, desventes, lado favorecido…', successes: 'Puntos logrados', improvements: 'Áreas de mejora', sailorNotes: 'Notas del regatista', coachNotes: 'Comentario del entrenador', nextObjectives: 'Prioridades para la próxima navegación', saveEntry: 'Añadir al expediente', history: 'Expediente de progresión', noEntries: 'No hay navegaciones guardadas para este regatista.', print: 'Imprimir / PDF', deleteEntry: 'Eliminar ficha', confirmEntry: '¿Eliminar esta ficha de navegación?', linkedTo: 'Asociada a', gpx: 'Traza GPX', overallAverage: 'Media global', sessionsCount: 'Fichas', locationsCount: 'Campos', latest: 'Última navegación', identityRequired: 'El nombre y el apellido son obligatorios.', entryRequired: 'El título y el campo de regatas son obligatorios.', saved: 'Ficha añadida al cuaderno.',
  },
} as const

const defaultRatings: SailorRatings = { start: 3, speed: 3, tactics: 3, strategy: 3, manoeuvres: 3 }
const classes: BoatClass[] = ['Optimist', '420', 'ILCA']
const uniqueId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const ratingFields = ['start', 'speed', 'tactics', 'strategy', 'manoeuvres'] as const

function entryAverage(entry: SailorNavigationEntry) {
  const values = Object.values(entry.ratings)
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function SailorJournalPage() {
  const { language } = usePreferences()
  const c = copy[language]
  const [journal, setJournal] = useState(loadSailorJournal)
  const [selectedId, setSelectedId] = useState(() => loadSailorJournal().profiles[0]?.id || '')
  const [profileError, setProfileError] = useState(false)
  const [entryError, setEntryError] = useState(false)
  const [saved, setSaved] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [profileClass, setProfileClass] = useState<BoatClass>('Optimist')
  const [ageCategory, setAgeCategory] = useState('')
  const [club, setClub] = useState('')
  const [kind, setKind] = useState<SailorNavigationKind>('training')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [entryClass, setEntryClass] = useState<BoatClass>('Optimist')
  const [linkedSessionId, setLinkedSessionId] = useState('')
  const [linkedTrackId, setLinkedTrackId] = useState('')
  const [ratings, setRatings] = useState<SailorRatings>({ ...defaultRatings })
  const [conditions, setConditions] = useState('')
  const [objectives, setObjectives] = useState('')
  const [waterAnalysis, setWaterAnalysis] = useState('')
  const [successes, setSuccesses] = useState('')
  const [improvements, setImprovements] = useState('')
  const [sailorNotes, setSailorNotes] = useState('')
  const [coachNotes, setCoachNotes] = useState('')
  const [nextObjectives, setNextObjectives] = useState('')
  const sessions = useMemo(() => loadTrainingSessions(), [])
  const selected = journal.profiles.find((profile) => profile.id === selectedId) || null
  const selectedSession = sessions.find((session) => session.id === linkedSessionId) || null
  const entries = journal.entries.filter((entry) => entry.sailorId === selectedId)
    .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt))
  const overall = entries.length ? entries.reduce((sum, entry) => sum + entryAverage(entry), 0) / entries.length : 0
  const locations = new Set(entries.map((entry) => entry.location.trim().toLocaleLowerCase()).filter(Boolean)).size

  function refresh(preferredId = selectedId) {
    const next = loadSailorJournal()
    setJournal(next)
    setSelectedId(next.profiles.some((profile) => profile.id === preferredId) ? preferredId : next.profiles[0]?.id || '')
  }

  function addProfile(event: FormEvent) {
    event.preventDefault()
    setProfileError(false)
    if (!firstName.trim() || !lastName.trim()) { setProfileError(true); return }
    const now = new Date().toISOString()
    const id = uniqueId('sailor')
    saveSailorProfile({ id, firstName: firstName.trim(), lastName: lastName.trim(), boatClass: profileClass, ageCategory: ageCategory.trim(), club: club.trim(), createdAt: now, updatedAt: now })
    setFirstName(''); setLastName(''); setAgeCategory(''); setClub(''); setEntryClass(profileClass); refresh(id)
  }

  function selectSession(id: string) {
    setLinkedSessionId(id)
    setLinkedTrackId('')
    const session = sessions.find((item) => item.id === id)
    if (!session) return
    setDate(session.date); setLocation(session.location); setEntryClass(session.boatClass)
    if (!title.trim()) setTitle(session.name)
  }

  function resetEntry() {
    setKind('training'); setDate(new Date().toISOString().slice(0, 10)); setTitle(''); setLocation('')
    setEntryClass(selected?.boatClass || 'Optimist'); setLinkedSessionId(''); setLinkedTrackId('')
    setRatings({ ...defaultRatings }); setConditions(''); setObjectives(''); setWaterAnalysis('')
    setSuccesses(''); setImprovements(''); setSailorNotes(''); setCoachNotes(''); setNextObjectives('')
  }

  function addEntry(event: FormEvent) {
    event.preventDefault()
    setEntryError(false); setSaved(false)
    if (!selected || !title.trim() || !location.trim()) { setEntryError(true); return }
    const now = new Date().toISOString()
    saveSailorEntry({ id: uniqueId('navigation'), sailorId: selected.id, kind, date, title: title.trim(), location: location.trim(), boatClass: entryClass, conditions: conditions.trim(), objectives: objectives.trim(), waterAnalysis: waterAnalysis.trim(), successes: successes.trim(), improvements: improvements.trim(), sailorNotes: sailorNotes.trim(), coachNotes: coachNotes.trim(), nextObjectives: nextObjectives.trim(), ratings, ...(linkedSessionId ? { linkedTrainingSessionId: linkedSessionId } : {}), ...(linkedTrackId ? { linkedBoatTrackId: linkedTrackId } : {}), createdAt: now, updatedAt: now })
    refresh(selected.id); resetEntry(); setSaved(true)
  }

  function printDossier() {
    const previous = document.title
    if (selected) document.title = `CoachBrief - ${selected.firstName} ${selected.lastName}`
    window.print()
    window.setTimeout(() => { document.title = previous }, 300)
  }

  const textFields = [
    ['conditions', c.conditions, c.conditionsPlaceholder, conditions, setConditions],
    ['objectives', c.objectives, c.objectivesPlaceholder, objectives, setObjectives],
    ['waterAnalysis', c.waterAnalysis, c.waterPlaceholder, waterAnalysis, setWaterAnalysis],
    ['successes', c.successes, '', successes, setSuccesses],
    ['improvements', c.improvements, '', improvements, setImprovements],
    ['sailorNotes', c.sailorNotes, '', sailorNotes, setSailorNotes],
    ['coachNotes', c.coachNotes, '', coachNotes, setCoachNotes],
    ['nextObjectives', c.nextObjectives, '', nextObjectives, setNextObjectives],
  ] as const

  return <main className="sailor-journal-page">
    <header className="journal-heading"><div><span className="step-label">{c.eyebrow}</span><h1>{c.title}</h1><p>{c.intro}</p></div><BookOpen size={46} /></header>
    <section className="journal-layout">
      <aside className="journal-card profiles-panel">
        <h2><Users size={19} />{c.profiles}</h2>
        <div className="profile-list">{journal.profiles.map((profile) => <button type="button" className={profile.id === selectedId ? 'is-selected' : ''} key={profile.id} onClick={() => { setSelectedId(profile.id); setEntryClass(profile.boatClass); setSaved(false) }}><strong>{profile.firstName} {profile.lastName}</strong><span>{profile.boatClass}{profile.club ? ` · ${profile.club}` : ''}</span><small>{journal.entries.filter((entry) => entry.sailorId === profile.id).length} {c.entries}</small></button>)}</div>
        {!journal.profiles.length && <p className="journal-empty">{c.noProfiles}</p>}
        <details className="new-profile" open={!journal.profiles.length}><summary><UserPlus size={17} />{c.newProfile}</summary><form onSubmit={addProfile}>
          <label className="field"><span>{c.firstName}</span><input value={firstName} onChange={(event) => setFirstName(event.target.value)} /></label>
          <label className="field"><span>{c.lastName}</span><input value={lastName} onChange={(event) => setLastName(event.target.value)} /></label>
          <label className="field"><span>{c.boatClass}</span><select value={profileClass} onChange={(event) => setProfileClass(event.target.value as BoatClass)}>{classes.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label className="field"><span>{c.age} · {c.optional}</span><input value={ageCategory} onChange={(event) => setAgeCategory(event.target.value)} /></label>
          <label className="field"><span>{c.club} · {c.optional}</span><input value={club} onChange={(event) => setClub(event.target.value)} /></label>
          {profileError && <p className="field-help is-warning">{c.identityRequired}</p>}<button type="submit"><Plus size={16} />{c.addProfile}</button>
        </form></details>
      </aside>
      <div className="journal-main">{selected && <>
        <section className="journal-card profile-heading"><div><span>{c.private}</span><h2>{selected.firstName} {selected.lastName}</h2><p>{selected.boatClass}{selected.ageCategory ? ` · ${selected.ageCategory}` : ''}{selected.club ? ` · ${selected.club}` : ''}</p></div><div className="journal-actions"><button type="button" className="secondary" onClick={printDossier}><Printer size={16} />{c.print}</button><button type="button" className="danger icon-only" aria-label={c.deleteProfile} title={c.deleteProfile} onClick={() => { if (window.confirm(c.confirmProfile)) { deleteSailorProfile(selected.id); refresh('') } }}><Trash2 size={17} /></button></div></section>
        <section className="journal-stats"><div><strong>{entries.length}</strong><span>{c.sessionsCount}</span></div><div><strong>{overall ? `${overall.toFixed(1)}/5` : '—'}</strong><span>{c.overallAverage}</span></div><div><strong>{locations}</strong><span>{c.locationsCount}</span></div><div><strong>{entries[0]?.date ? new Date(`${entries[0].date}T12:00:00`).toLocaleDateString(language) : '—'}</strong><span>{c.latest}</span></div></section>
        <section className="journal-card entry-form-card"><h2><Anchor size={19} />{c.newEntry}</h2><form onSubmit={addEntry}>
          <div className="journal-grid compact"><label className="field"><span>{c.type}</span><select value={kind} onChange={(event) => setKind(event.target.value as SailorNavigationKind)}><option value="training">{c.training}</option><option value="regatta">{c.regatta}</option></select></label><label className="field"><span>{c.date}</span><input type="date" required value={date} onChange={(event) => setDate(event.target.value)} /></label><label className="field"><span>{c.boatClass}</span><select value={entryClass} onChange={(event) => setEntryClass(event.target.value as BoatClass)}>{classes.map((value) => <option key={value}>{value}</option>)}</select></label></div>
          <div className="journal-grid"><label className="field"><span>{c.entryTitle}</span><input value={title} placeholder={c.titlePlaceholder} onChange={(event) => setTitle(event.target.value)} /></label><label className="field"><span>{c.location}</span><input value={location} placeholder={c.locationPlaceholder} onChange={(event) => setLocation(event.target.value)} /></label></div>
          <fieldset className="journal-link"><legend><Link2 size={16} />{c.linkedSession}</legend><div className="journal-grid"><label className="field"><span>{c.linkedSession}</span><select value={linkedSessionId} onChange={(event) => selectSession(event.target.value)}><option value="">{c.noSession}</option>{sessions.map((session) => <option key={session.id} value={session.id}>{session.date} · {session.name}</option>)}</select></label><label className="field"><span>{c.linkedTrack}</span><select disabled={!selectedSession?.boatTracks.length} value={linkedTrackId} onChange={(event) => setLinkedTrackId(event.target.value)}><option value="">{c.noTrack}</option>{selectedSession?.boatTracks.map((track) => <option key={track.id} value={track.id}>{track.boatName} · {track.fileName}</option>)}</select></label></div><small>{c.linkHelp}</small></fieldset>
          <fieldset className="journal-ratings"><legend>{c.selfAssessment}</legend><div>{ratingFields.map((field) => <label key={field}><span>{c[field]}</span><select value={ratings[field]} onChange={(event) => setRatings((current) => ({ ...current, [field]: Number(event.target.value) as SailorRating }))}>{[1, 2, 3, 4, 5].map((value) => <option value={value} key={value}>{value}</option>)}</select></label>)}</div><small>{c.ratingHelp}</small></fieldset>
          <div className="journal-text-grid">{textFields.map(([id, label, placeholder, value, setter]) => <label className={id === 'waterAnalysis' || id === 'sailorNotes' || id === 'coachNotes' ? 'field field-wide' : 'field'} key={id}><span>{label}</span><textarea rows={id === 'waterAnalysis' ? 4 : 3} value={value} placeholder={placeholder} onChange={(event) => setter(event.target.value)} /></label>)}</div>
          {entryError && <p className="field-help is-warning">{c.entryRequired}</p>}{saved && <p className="journal-saved">{c.saved}</p>}<div className="journal-actions"><button type="submit"><Save size={16} />{c.saveEntry}</button></div>
        </form></section>
        <section className="journal-card journal-history"><div className="history-heading"><h2><BookOpen size={19} />{c.history}</h2><button type="button" className="secondary" onClick={printDossier}><Printer size={16} />{c.print}</button></div>{!entries.length && <p className="journal-empty">{c.noEntries}</p>}{entries.map((entry) => {
          const session = sessions.find((item) => item.id === entry.linkedTrainingSessionId)
          const track = session?.boatTracks.find((item) => item.id === entry.linkedBoatTrackId)
          return <details className="journal-entry" key={entry.id}><summary><div><span>{entry.kind === 'training' ? c.training : c.regatta}</span><strong>{entry.title}</strong><small>{new Date(`${entry.date}T12:00:00`).toLocaleDateString(language)} · {entry.location} · {entry.boatClass}</small></div><b>{entryAverage(entry).toFixed(1)}/5</b></summary><div className="entry-content"><div className="entry-ratings">{ratingFields.map((field) => <span key={field}>{c[field]} <strong>{entry.ratings[field]}/5</strong></span>)}</div>{session && <p className="linked-entry"><Link2 size={14} />{c.linkedTo} {session.name}{track ? ` · ${c.gpx}: ${track.boatName}` : ''}</p>}{textFields.map(([id, label]) => entry[id] ? <section key={id}><h3>{label}</h3><p>{entry[id]}</p></section> : null)}<button type="button" className="delete-entry" onClick={() => { if (window.confirm(c.confirmEntry)) { deleteSailorEntry(entry.id); refresh(selected.id) } }}><Trash2 size={15} />{c.deleteEntry}</button></div></details>
        })}</section>
      </>}</div>
    </section>
  </main>
}
