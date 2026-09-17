import { ArrowRight, BookOpen, Compass, FolderOpen, Sailboat, Waves } from 'lucide-react'
import { Link } from 'react-router-dom'
import { usePreferences } from '../preferences'

const copy: Record<string, {
  eyebrow: string
  title: string
  intro: string
  race: string
  raceCopy: string
  training: string
  trainingCopy: string
  offshore: string
  offshoreCopy: string
  data: string
  dataCopy: string
  open: string
}> = {
  fr: {
    eyebrow: 'CoachBrief · Choisir un module',
    title: 'Que veux-tu préparer ?',
    intro: 'Accède directement à l’outil adapté à ta séance, ta régate ou ta navigation au large.',
    race: 'Régate & briefing',
    raceCopy: 'Météo, parcours, cadrans, effets locaux, stratégie, briefing et débrief.',
    training: 'Entraînement',
    trainingCopy: 'Zone de navigation, GPS, annotations terrain et suivi des coureurs.',
    offshore: 'Course au large',
    offshoreCopy: 'Route, polaires, météo, courant, marées et calcul d’isochrones.',
    data: 'Mes données',
    dataCopy: 'Briefings sauvegardés, historique et dossiers coureurs.',
    open: 'Ouvrir',
  },
  en: {
    eyebrow: 'CoachBrief · Choose a module',
    title: 'What do you want to prepare?',
    intro: 'Go straight to the tool for your training session, race or offshore navigation.',
    race: 'Race & briefing',
    raceCopy: 'Weather, course, quadrants, local effects, strategy, briefing and debrief.',
    training: 'Training',
    trainingCopy: 'Sailing area, GPS, field notes and sailor follow-up.',
    offshore: 'Offshore',
    offshoreCopy: 'Route, polars, weather, current, tides and isochrone routing.',
    data: 'My data',
    dataCopy: 'Saved briefings, history and sailor files.',
    open: 'Open',
  },
  de: {
    eyebrow: 'CoachBrief · Modul wählen',
    title: 'Was möchtest du vorbereiten?',
    intro: 'Öffne direkt das passende Werkzeug für Training, Regatta oder Offshore-Navigation.',
    race: 'Regatta & Briefing',
    raceCopy: 'Wetter, Kurs, Quadranten, lokale Effekte, Strategie, Briefing und Debriefing.',
    training: 'Training',
    trainingCopy: 'Segelgebiet, GPS, Beobachtungen und Seglerbetreuung.',
    offshore: 'Offshore',
    offshoreCopy: 'Route, Polaren, Wetter, Strömung, Gezeiten und Isochronen.',
    data: 'Meine Daten',
    dataCopy: 'Gespeicherte Briefings, Verlauf und Seglerakten.',
    open: 'Öffnen',
  },
  it: {
    eyebrow: 'CoachBrief · Scegli un modulo',
    title: 'Cosa vuoi preparare?',
    intro: 'Vai direttamente allo strumento adatto per allenamento, regata o navigazione d’altura.',
    race: 'Regata & briefing',
    raceCopy: 'Meteo, percorso, quadranti, effetti locali, strategia, briefing e debrief.',
    training: 'Allenamento',
    trainingCopy: 'Zona di navigazione, GPS, note sul campo e monitoraggio atleti.',
    offshore: 'Altura',
    offshoreCopy: 'Rotta, polari, meteo, corrente, maree e isocrone.',
    data: 'I miei dati',
    dataCopy: 'Briefing salvati, storico e schede atleti.',
    open: 'Apri',
  },
  es: {
    eyebrow: 'CoachBrief · Elegir un módulo',
    title: '¿Qué quieres preparar?',
    intro: 'Accede directamente a la herramienta adecuada para entrenamiento, regata o navegación de altura.',
    race: 'Regata & briefing',
    raceCopy: 'Meteo, recorrido, cuadrantes, efectos locales, estrategia, briefing y debrief.',
    training: 'Entrenamiento',
    trainingCopy: 'Zona de navegación, GPS, notas de campo y seguimiento de regatistas.',
    offshore: 'Altura',
    offshoreCopy: 'Ruta, polares, meteo, corriente, mareas e isócronas.',
    data: 'Mis datos',
    dataCopy: 'Briefings guardados, historial y fichas de regatistas.',
    open: 'Abrir',
  },
}

export function LandingPage() {
  const { language } = usePreferences()
  const c = copy[language] ?? copy.fr
  const modules = [
    { to: '/regate', icon: Sailboat, title: c.race, text: c.raceCopy, featured: true },
    { to: '/entrainements', icon: Compass, title: c.training, text: c.trainingCopy },
    { to: '/large', icon: Waves, title: c.offshore, text: c.offshoreCopy },
    { to: '/briefings', icon: FolderOpen, title: c.data, text: c.dataCopy },
  ]

  return (
    <main className="module-home">
      <section className="module-home__hero">
        <div className="module-home__eyebrow"><BookOpen size={16} /> {c.eyebrow}</div>
        <h1>{c.title}</h1>
        <p>{c.intro}</p>
      </section>

      <section className="module-grid" aria-label={c.eyebrow}>
        {modules.map(({ to, icon: Icon, title, text, featured }) => (
          <Link key={to} to={to} className={`module-card${featured ? ' module-card--featured' : ''}`}>
            <span className="module-card__icon"><Icon size={28} /></span>
            <div className="module-card__content">
              <h2>{title}</h2>
              <p>{text}</p>
            </div>
            <span className="module-card__action">{c.open} <ArrowRight size={17} /></span>
          </Link>
        ))}
      </section>
    </main>
  )
}
