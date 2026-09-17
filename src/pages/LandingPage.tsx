import { ArrowRight, BookOpen, Compass, FolderOpen, Sailboat, Sparkles, Waves } from 'lucide-react'
import { Link } from 'react-router-dom'
import { usePreferences } from '../preferences'

const copy: Record<string, {
  eyebrow: string
  title: string
  lead: string
  intro: string
  chooseTitle: string
  chooseCopy: string
  race: string
  raceCopy: string
  training: string
  trainingCopy: string
  offshore: string
  offshoreCopy: string
  data: string
  dataCopy: string
  open: string
  fieldTitle: string
  fieldCopy: string
  footerPhrase: string
}> = {
  fr: {
    eyebrow: 'Météo · Tactique · Analyse',
    title: 'Bienvenue sur CoachBrief',
    lead: 'Ton assistant pour préparer, analyser et progresser en voile.',
    intro: 'Avant une régate, pendant un entraînement ou pour une navigation plus engagée, retrouve au même endroit les bons repères météo, tactiques et terrain. CoachBrief t’aide à transformer les données et tes observations en décisions simples, utiles et concrètes.',
    chooseTitle: 'Choisis ton module',
    chooseCopy: 'Chaque espace a été pensé pour un besoin précis. Va directement à l’outil qui correspond à ta séance, ta régate ou ta navigation.',
    race: 'Régate & briefing',
    raceCopy: 'Prépare ta manche avec méthode : météo, parcours, cadrans, effets locaux, stratégie et débrief.',
    training: 'Entraînement',
    trainingCopy: 'Organise, observe et progresse : zone de navigation, GPS, annotations terrain et suivi des coureurs.',
    offshore: 'Course au large',
    offshoreCopy: 'Anticipe la route et les options : polaires, météo, courant, marées et calcul d’isochrones.',
    data: 'Mes données',
    dataCopy: 'Retrouve ton historique en un instant : briefings sauvegardés, débriefs, entraînements et dossiers coureurs.',
    open: 'Ouvrir',
    fieldTitle: 'Un outil de terrain',
    fieldCopy: 'CoachBrief a été imaginé pour aller à l’essentiel : mieux lire une situation, mieux préparer une journée et mieux exploiter ce que tu observes sur l’eau.',
    footerPhrase: 'Pensé pour la voile légère, l’entraînement et la régate, avec une approche simple, pratique et directement exploitable sur le terrain.',
  },
  en: {
    eyebrow: 'Weather · Tactics · Analysis',
    title: 'Welcome to CoachBrief',
    lead: 'Your assistant to prepare, analyse and improve on the water.',
    intro: 'Before a race, during training or for a more demanding offshore passage, find your key weather, tactical and on-the-water references in one place. CoachBrief turns data and observations into simple, useful decisions.',
    chooseTitle: 'Choose your module',
    chooseCopy: 'Each space is designed for a specific need. Go straight to the tool that matches your session, race or navigation.',
    race: 'Race & briefing',
    raceCopy: 'Prepare your race methodically: weather, course, quadrants, local effects, strategy and debrief.',
    training: 'Training',
    trainingCopy: 'Plan, observe and improve: sailing area, GPS, field notes and sailor follow-up.',
    offshore: 'Offshore',
    offshoreCopy: 'Anticipate routes and options: polars, weather, current, tides and isochrone routing.',
    data: 'My data',
    dataCopy: 'Find your history at a glance: saved briefings, debriefs, training sessions and sailor files.',
    open: 'Open',
    fieldTitle: 'Built for the water',
    fieldCopy: 'CoachBrief was designed to keep things practical: read situations better, prepare each day more clearly and make better use of what you observe on the water.',
    footerPhrase: 'Designed for dinghy sailing, training and racing, with a simple, practical approach that can be used directly on the water.',
  },
  de: {
    eyebrow: 'Wetter · Taktik · Analyse',
    title: 'Willkommen bei CoachBrief',
    lead: 'Dein Assistent zum Vorbereiten, Analysieren und Weiterentwickeln im Segeln.',
    intro: 'Vor einer Regatta, im Training oder bei anspruchsvollerer Offshore-Navigation findest du Wetter, Taktik und Beobachtungen an einem Ort. CoachBrief macht aus Daten und Beobachtungen klare, nützliche Entscheidungen.',
    chooseTitle: 'Wähle dein Modul',
    chooseCopy: 'Jeder Bereich ist für einen konkreten Bedarf gedacht. Öffne direkt das passende Werkzeug für Training, Regatta oder Navigation.',
    race: 'Regatta & Briefing',
    raceCopy: 'Bereite deine Wettfahrt strukturiert vor: Wetter, Kurs, Quadranten, lokale Effekte, Strategie und Debriefing.',
    training: 'Training',
    trainingCopy: 'Planen, beobachten und verbessern: Segelgebiet, GPS, Notizen und Seglerbetreuung.',
    offshore: 'Offshore',
    offshoreCopy: 'Route und Optionen vorausdenken: Polaren, Wetter, Strömung, Gezeiten und Isochronen.',
    data: 'Meine Daten',
    dataCopy: 'Verlauf schnell wiederfinden: gespeicherte Briefings, Debriefings, Trainings und Seglerakten.',
    open: 'Öffnen',
    fieldTitle: 'Ein Werkzeug für die Praxis',
    fieldCopy: 'CoachBrief konzentriert sich auf das Wesentliche: Situationen besser lesen, den Tag klarer vorbereiten und Beobachtungen auf dem Wasser besser nutzen.',
    footerPhrase: 'Für Jollen, Training und Regatta gedacht – einfach, praktisch und direkt auf dem Wasser nutzbar.',
  },
  it: {
    eyebrow: 'Meteo · Tattica · Analisi',
    title: 'Benvenuto su CoachBrief',
    lead: 'Il tuo assistente per preparare, analizzare e migliorare in vela.',
    intro: 'Prima di una regata, durante un allenamento o per una navigazione d’altura più impegnativa, ritrova nello stesso posto i riferimenti meteo, tattici e di campo. CoachBrief trasforma dati e osservazioni in decisioni semplici e concrete.',
    chooseTitle: 'Scegli il tuo modulo',
    chooseCopy: 'Ogni spazio è pensato per un’esigenza precisa. Vai direttamente allo strumento adatto alla tua sessione, regata o navigazione.',
    race: 'Regata & briefing',
    raceCopy: 'Prepara la prova con metodo: meteo, percorso, quadranti, effetti locali, strategia e debrief.',
    training: 'Allenamento',
    trainingCopy: 'Organizza, osserva e migliora: zona di navigazione, GPS, note sul campo e monitoraggio atleti.',
    offshore: 'Altura',
    offshoreCopy: 'Anticipa rotta e opzioni: polari, meteo, corrente, maree e isocrone.',
    data: 'I miei dati',
    dataCopy: 'Ritrova subito lo storico: briefing salvati, debrief, allenamenti e schede atleti.',
    open: 'Apri',
    fieldTitle: 'Uno strumento da campo',
    fieldCopy: 'CoachBrief nasce per andare all’essenziale: leggere meglio una situazione, preparare meglio la giornata e sfruttare meglio ciò che osservi in acqua.',
    footerPhrase: 'Pensato per vela leggera, allenamento e regata, con un approccio semplice, pratico e utilizzabile direttamente sul campo.',
  },
  es: {
    eyebrow: 'Meteo · Táctica · Análisis',
    title: 'Bienvenido a CoachBrief',
    lead: 'Tu asistente para preparar, analizar y progresar en vela.',
    intro: 'Antes de una regata, durante un entrenamiento o para una navegación de altura más exigente, reúne en un mismo lugar las referencias meteorológicas, tácticas y de campo. CoachBrief convierte datos y observaciones en decisiones simples y útiles.',
    chooseTitle: 'Elige tu módulo',
    chooseCopy: 'Cada espacio está pensado para una necesidad concreta. Ve directamente a la herramienta adecuada para tu sesión, regata o navegación.',
    race: 'Regata & briefing',
    raceCopy: 'Prepara la prueba con método: meteo, recorrido, cuadrantes, efectos locales, estrategia y debrief.',
    training: 'Entrenamiento',
    trainingCopy: 'Organiza, observa y mejora: zona de navegación, GPS, notas de campo y seguimiento de regatistas.',
    offshore: 'Altura',
    offshoreCopy: 'Anticipa la ruta y las opciones: polares, meteo, corriente, mareas e isócronas.',
    data: 'Mis datos',
    dataCopy: 'Recupera tu historial en un instante: briefings guardados, debriefs, entrenamientos y fichas de regatistas.',
    open: 'Abrir',
    fieldTitle: 'Una herramienta de campo',
    fieldCopy: 'CoachBrief fue pensado para ir a lo esencial: leer mejor una situación, preparar mejor el día y aprovechar mejor lo que observas en el agua.',
    footerPhrase: 'Pensado para vela ligera, entrenamiento y regata, con un enfoque simple, práctico y directamente útil en el agua.',
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
        <p className="module-home__lead">{c.lead}</p>
        <p className="module-home__intro">{c.intro}</p>
      </section>

      <section className="module-home__choice-heading">
        <div>
          <span className="module-home__choice-kicker"><Sparkles size={15} /> CoachBrief</span>
          <h2>{c.chooseTitle}</h2>
          <p>{c.chooseCopy}</p>
        </div>
      </section>

      <section className="module-grid" aria-label={c.chooseTitle}>
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

      <section className="module-home__field-note">
        <span className="module-home__field-icon"><Sailboat size={25} /></span>
        <div>
          <h2>{c.fieldTitle}</h2>
          <p>{c.fieldCopy}</p>
        </div>
      </section>

      <p className="module-home__closing">{c.footerPhrase}</p>
    </main>
  )
}
