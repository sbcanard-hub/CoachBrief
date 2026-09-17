import { ArrowRight, BookOpen, Compass, FolderOpen, Sailboat, Sparkles, Waves, Wind } from 'lucide-react'
import { Link } from 'react-router-dom'
import { usePreferences } from '../preferences'

const copy: Record<string, {
  eyebrow: string
  title: string
  lead: string
  intro: string
  signature: string
  chooseTitle: string
  chooseCopy: string
  race: string
  raceKicker: string
  raceCopy: string
  training: string
  trainingKicker: string
  trainingCopy: string
  offshore: string
  offshoreKicker: string
  offshoreCopy: string
  data: string
  dataKicker: string
  dataCopy: string
  open: string
  fieldTitle: string
  fieldCopy: string
  footerPhrase: string
}> = {
  fr: {
    eyebrow: 'Météo · Tactique · Analyse',
    title: 'Bienvenue sur CoachBrief',
    lead: 'Préparer. Observer. Comprendre. Décider.',
    intro: 'De la régate à la course au large, CoachBrief t’aide à transformer la météo, le terrain et tes observations en décisions concrètes sur l’eau.',
    signature: 'La météo donne des informations. Le terrain donne des indices. À toi d’en faire une stratégie.',
    chooseTitle: 'Choisis ton module',
    chooseCopy: 'Chaque espace a été pensé pour un besoin précis. Va directement à l’outil qui correspond à ta séance, ta régate ou ta navigation.',
    race: 'Régate & briefing',
    raceKicker: 'Préparer une manche',
    raceCopy: 'Météo, parcours, cadrans, effets locaux, stratégie et débrief réunis dans un même fil de préparation.',
    training: 'Entraînement',
    trainingKicker: 'Observer et progresser',
    trainingCopy: 'Zone de navigation, GPS, annotations terrain et suivi des coureurs pour capitaliser séance après séance.',
    offshore: 'Course au large',
    offshoreKicker: 'Anticiper la route',
    offshoreCopy: 'Polaires, météo, courant, marées et isochrones pour préparer une navigation qui évolue dans le temps.',
    data: 'Mes données',
    dataKicker: 'Retrouver son historique',
    dataCopy: 'Briefings sauvegardés, débriefs, entraînements et dossiers coureurs accessibles rapidement.',
    open: 'Ouvrir',
    fieldTitle: 'Un outil pensé pour le terrain',
    fieldCopy: 'CoachBrief est conçu pour rester lisible au bord de l’eau comme sur un écran de bureau : moins de dispersion, davantage de repères utiles au bon moment.',
    footerPhrase: 'Pensé pour la voile légère, l’entraînement, la régate et la navigation au large, avec une approche simple, pratique et directement exploitable sur l’eau.',
  },
  en: {
    eyebrow: 'Weather · Tactics · Analysis',
    title: 'Welcome to CoachBrief',
    lead: 'Prepare. Observe. Understand. Decide.',
    intro: 'From dinghy racing to offshore sailing, CoachBrief helps turn weather, local effects and your observations into practical decisions on the water.',
    signature: 'Weather provides information. The water gives clues. Your job is to turn them into strategy.',
    chooseTitle: 'Choose your module',
    chooseCopy: 'Each space is designed for a specific need. Go straight to the tool that matches your session, race or navigation.',
    race: 'Race & briefing',
    raceKicker: 'Prepare the race',
    raceCopy: 'Weather, course, quadrants, local effects, strategy and debrief in one preparation flow.',
    training: 'Training',
    trainingKicker: 'Observe and improve',
    trainingCopy: 'Sailing area, GPS, field notes and sailor follow-up to build knowledge session after session.',
    offshore: 'Offshore',
    offshoreKicker: 'Anticipate the route',
    offshoreCopy: 'Polars, weather, current, tides and isochrones for a route that evolves through time.',
    data: 'My data',
    dataKicker: 'Find your history',
    dataCopy: 'Saved briefings, debriefs, training sessions and sailor files within easy reach.',
    open: 'Open',
    fieldTitle: 'Built for the water',
    fieldCopy: 'CoachBrief is designed to stay clear on the dock, on the coach boat or on a desktop: fewer distractions and more useful references at the right time.',
    footerPhrase: 'Designed for dinghy sailing, training, racing and offshore navigation, with a simple, practical approach you can use directly on the water.',
  },
  de: {
    eyebrow: 'Wetter · Taktik · Analyse',
    title: 'Willkommen bei CoachBrief',
    lead: 'Vorbereiten. Beobachten. Verstehen. Entscheiden.',
    intro: 'Von der Regatta bis zur Offshore-Navigation hilft CoachBrief dabei, Wetter, Revier und Beobachtungen in konkrete Entscheidungen auf dem Wasser zu verwandeln.',
    signature: 'Das Wetter liefert Informationen. Das Revier liefert Hinweise. Daraus entsteht deine Strategie.',
    chooseTitle: 'Wähle dein Modul',
    chooseCopy: 'Jeder Bereich ist für einen konkreten Bedarf gedacht. Öffne direkt das passende Werkzeug für Training, Regatta oder Navigation.',
    race: 'Regatta & Briefing',
    raceKicker: 'Eine Wettfahrt vorbereiten',
    raceCopy: 'Wetter, Kurs, Quadranten, lokale Effekte, Strategie und Debriefing in einem Ablauf.',
    training: 'Training',
    trainingKicker: 'Beobachten und verbessern',
    trainingCopy: 'Segelgebiet, GPS, Notizen und Seglerbetreuung, um aus jeder Einheit zu lernen.',
    offshore: 'Offshore',
    offshoreKicker: 'Die Route vorausdenken',
    offshoreCopy: 'Polaren, Wetter, Strömung, Gezeiten und Isochronen für eine Route, die sich mit der Zeit entwickelt.',
    data: 'Meine Daten',
    dataKicker: 'Verlauf wiederfinden',
    dataCopy: 'Gespeicherte Briefings, Debriefings, Trainings und Seglerakten schnell verfügbar.',
    open: 'Öffnen',
    fieldTitle: 'Für die Praxis gedacht',
    fieldCopy: 'CoachBrief bleibt am Wasser wie am Computer klar lesbar: weniger Ablenkung und mehr nützliche Hinweise im richtigen Moment.',
    footerPhrase: 'Für Jollen, Training, Regatta und Offshore-Navigation gedacht – einfach, praktisch und direkt auf dem Wasser nutzbar.',
  },
  it: {
    eyebrow: 'Meteo · Tattica · Analisi',
    title: 'Benvenuto su CoachBrief',
    lead: 'Preparare. Osservare. Capire. Decidere.',
    intro: 'Dalla regata alla navigazione d’altura, CoachBrief aiuta a trasformare meteo, campo di regata e osservazioni in decisioni concrete in acqua.',
    signature: 'Il meteo dà informazioni. Il campo dà indizi. Sta a te trasformarli in strategia.',
    chooseTitle: 'Scegli il tuo modulo',
    chooseCopy: 'Ogni spazio è pensato per un’esigenza precisa. Vai direttamente allo strumento adatto alla tua sessione, regata o navigazione.',
    race: 'Regata & briefing',
    raceKicker: 'Preparare una prova',
    raceCopy: 'Meteo, percorso, quadranti, effetti locali, strategia e debrief in un unico flusso.',
    training: 'Allenamento',
    trainingKicker: 'Osservare e migliorare',
    trainingCopy: 'Zona di navigazione, GPS, note sul campo e monitoraggio atleti per imparare da ogni sessione.',
    offshore: 'Altura',
    offshoreKicker: 'Anticipare la rotta',
    offshoreCopy: 'Polari, meteo, corrente, maree e isocrone per una rotta che evolve nel tempo.',
    data: 'I miei dati',
    dataKicker: 'Ritrovare lo storico',
    dataCopy: 'Briefing salvati, debrief, allenamenti e schede atleti sempre a portata di mano.',
    open: 'Apri',
    fieldTitle: 'Pensato per il campo',
    fieldCopy: 'CoachBrief resta leggibile a terra, sul gommone o al computer: meno dispersione e più riferimenti utili al momento giusto.',
    footerPhrase: 'Pensato per vela leggera, allenamento, regata e altura, con un approccio semplice, pratico e direttamente utile in acqua.',
  },
  es: {
    eyebrow: 'Meteo · Táctica · Análisis',
    title: 'Bienvenido a CoachBrief',
    lead: 'Preparar. Observar. Comprender. Decidir.',
    intro: 'De la regata a la navegación de altura, CoachBrief ayuda a convertir la meteo, el campo y tus observaciones en decisiones concretas sobre el agua.',
    signature: 'La meteo aporta información. El campo aporta pistas. Tú las conviertes en estrategia.',
    chooseTitle: 'Elige tu módulo',
    chooseCopy: 'Cada espacio está pensado para una necesidad concreta. Ve directamente a la herramienta adecuada para tu sesión, regata o navegación.',
    race: 'Regata & briefing',
    raceKicker: 'Preparar una prueba',
    raceCopy: 'Meteo, recorrido, cuadrantes, efectos locales, estrategia y debrief en un mismo flujo.',
    training: 'Entrenamiento',
    trainingKicker: 'Observar y progresar',
    trainingCopy: 'Zona de navegación, GPS, notas de campo y seguimiento de regatistas para aprender sesión tras sesión.',
    offshore: 'Altura',
    offshoreKicker: 'Anticipar la ruta',
    offshoreCopy: 'Polares, meteo, corriente, mareas e isócronas para una ruta que evoluciona con el tiempo.',
    data: 'Mis datos',
    dataKicker: 'Recuperar el historial',
    dataCopy: 'Briefings guardados, debriefs, entrenamientos y fichas de regatistas siempre a mano.',
    open: 'Abrir',
    fieldTitle: 'Pensado para el agua',
    fieldCopy: 'CoachBrief está pensado para seguir siendo claro en el puerto, en la neumática o en el ordenador: menos dispersión y más referencias útiles.',
    footerPhrase: 'Pensado para vela ligera, entrenamiento, regata y navegación de altura, con un enfoque simple, práctico y útil directamente en el agua.',
  },
}

export function LandingPage() {
  const { language } = usePreferences()
  const c = copy[language] ?? copy.fr
  const modules = [
    { to: '/regate', icon: Sailboat, title: c.race, kicker: c.raceKicker, text: c.raceCopy, featured: true },
    { to: '/entrainements', icon: Compass, title: c.training, kicker: c.trainingKicker, text: c.trainingCopy },
    { to: '/large', icon: Waves, title: c.offshore, kicker: c.offshoreKicker, text: c.offshoreCopy },
    { to: '/briefings', icon: FolderOpen, title: c.data, kicker: c.dataKicker, text: c.dataCopy },
  ]

  return (
    <main className="module-home">
      <section className="module-home__hero">
        <div className="module-home__hero-content">
          <div className="module-home__eyebrow"><BookOpen size={16} /> {c.eyebrow}</div>
          <h1>{c.title}</h1>
          <p className="module-home__lead">{c.lead}</p>
          <p className="module-home__intro">{c.intro}</p>
          <div className="module-home__signature"><Wind size={18} /><span>{c.signature}</span></div>
        </div>
        <div className="module-home__hero-mark" aria-hidden="true">
          <div className="module-home__hero-ring module-home__hero-ring--outer" />
          <div className="module-home__hero-ring module-home__hero-ring--inner" />
          <Compass size={52} strokeWidth={1.5} />
          <span>CB</span>
        </div>
      </section>

      <section className="module-home__choice-heading">
        <div>
          <span className="module-home__choice-kicker"><Sparkles size={15} /> CoachBrief</span>
          <h2>{c.chooseTitle}</h2>
          <p>{c.chooseCopy}</p>
        </div>
      </section>

      <section className="module-grid" aria-label={c.chooseTitle}>
        {modules.map(({ to, icon: Icon, title, kicker, text, featured }) => (
          <Link key={to} to={to} className={`module-card${featured ? ' module-card--featured' : ''}`}>
            <div className="module-card__topline">
              <span className="module-card__icon"><Icon size={28} /></span>
              <span className="module-card__kicker">{kicker}</span>
            </div>
            <div className="module-card__content">
              <h2>{title}</h2>
              <p>{text}</p>
            </div>
            <span className="module-card__action">{c.open} <ArrowRight size={17} /></span>
          </Link>
        ))}
      </section>

      <section className="module-home__field-note">
        <span className="module-home__field-icon"><Sailboat size={25} /></span>
        <div>
          <span className="module-home__field-kicker">CoachBrief</span>
          <h2>{c.fieldTitle}</h2>
          <p>{c.fieldCopy}</p>
        </div>
      </section>

      <p className="module-home__closing">{c.footerPhrase}</p>
    </main>
  )
}
