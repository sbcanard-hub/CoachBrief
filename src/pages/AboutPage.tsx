import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { usePreferences } from '../preferences'
import './legal.css'

const copies = {
  fr: {
    back: 'Retour à CoachBrief',
    eyebrow: 'À propos',
    title: 'À propos de CoachBrief',
    introduction: 'Un outil né de plus de vingt ans d’expérience sur l’eau, au service des entraîneurs et des coureurs.',
    profileTitle: 'Qui suis-je ?',
    profile: 'Je m’appelle Sébastien Canard. Directeur d’école de voile et entraîneur, j’accompagne des coureurs en Optimist depuis plus de vingt ans. J’ai également été entraîneur national lors de championnats d’Europe et de championnats du monde en Optimist et en 420.',
    whyTitle: 'Pourquoi ai-je créé CoachBrief ?',
    why: 'Au fil des entraînements et des régates, les informations utiles sont nombreuses : prévisions météo, observations sur l’eau, particularités du plan d’eau, réglages du parcours, relevés GPS, analyses et débriefings. J’ai créé CoachBrief pour les réunir dans un même outil clair, pratique et utilisable aussi bien à terre que sur l’eau.',
    purposeTitle: 'Faire progresser l’analyse',
    purpose: 'L’objectif est d’aider les entraîneurs et les coureurs à mieux comprendre les conditions rencontrées, à conserver la mémoire de chaque navigation et à construire leur progression de régate en régate.',
    philosophyTitle: 'Une aide à la décision',
    philosophy: 'CoachBrief ne remplace ni l’observation du terrain, ni l’expérience, ni les décisions du coach. Il les complète en structurant les informations et en facilitant leur comparaison avant, pendant et après la navigation.',
  },
  en: {
    back: 'Back to CoachBrief',
    eyebrow: 'About',
    title: 'About CoachBrief',
    introduction: 'A tool born from more than twenty years of experience on the water, created for coaches and sailors.',
    profileTitle: 'Who am I?',
    profile: 'My name is Sébastien Canard. As a sailing school director and coach, I have worked with Optimist sailors for more than twenty years. I have also served as a national coach at European and World Championships in Optimist and 420.',
    whyTitle: 'Why did I create CoachBrief?',
    why: 'Training sessions and regattas involve a great deal of useful information: weather forecasts, on-water observations, sailing-area characteristics, course settings, GPS readings, analyses and debriefs. I created CoachBrief to bring all of this together in one clear, practical tool that can be used ashore and on the water.',
    purposeTitle: 'Improving analysis',
    purpose: 'The aim is to help coaches and sailors better understand the conditions they encounter, preserve the knowledge gained from each sailing session and build progress from one regatta to the next.',
    philosophyTitle: 'Decision support',
    philosophy: 'CoachBrief does not replace real-world observation, experience or the coach’s decisions. It complements them by structuring information and making it easier to compare before, during and after sailing.',
  },
  it: {
    back: 'Torna a CoachBrief',
    eyebrow: 'Chi siamo',
    title: 'A proposito di CoachBrief',
    introduction: 'Uno strumento nato da oltre vent’anni di esperienza in acqua, al servizio di allenatori e velisti.',
    profileTitle: 'Chi sono?',
    profile: 'Mi chiamo Sébastien Canard. Direttore di una scuola vela e allenatore, seguo velisti Optimist da oltre vent’anni. Sono stato anche allenatore nazionale in occasione di Campionati Europei e Campionati del Mondo in Optimist e 420.',
    whyTitle: 'Perché ho creato CoachBrief?',
    why: 'Durante allenamenti e regate le informazioni utili sono numerose: previsioni meteo, osservazioni in acqua, caratteristiche del campo, regolazioni del percorso, rilevamenti GPS, analisi e debrief. Ho creato CoachBrief per riunirle in uno strumento chiaro, pratico e utilizzabile sia a terra sia in acqua.',
    purposeTitle: 'Migliorare l’analisi',
    purpose: 'L’obiettivo è aiutare allenatori e velisti a comprendere meglio le condizioni incontrate, conservare la memoria di ogni navigazione e costruire la propria progressione regata dopo regata.',
    philosophyTitle: 'Un aiuto alle decisioni',
    philosophy: 'CoachBrief non sostituisce l’osservazione sul campo, l’esperienza o le decisioni dell’allenatore. Le completa strutturando le informazioni e facilitandone il confronto prima, durante e dopo la navigazione.',
  },
  es: {
    back: 'Volver a CoachBrief',
    eyebrow: 'Acerca de',
    title: 'Acerca de CoachBrief',
    introduction: 'Una herramienta nacida de más de veinte años de experiencia en el agua, al servicio de entrenadores y regatistas.',
    profileTitle: '¿Quién soy?',
    profile: 'Me llamo Sébastien Canard. Como director de una escuela de vela y entrenador, acompaño a regatistas de Optimist desde hace más de veinte años. También he sido entrenador nacional en Campeonatos de Europa y Campeonatos del Mundo de Optimist y 420.',
    whyTitle: '¿Por qué creé CoachBrief?',
    why: 'En los entrenamientos y las regatas se utiliza mucha información: previsiones meteorológicas, observaciones en el agua, particularidades del campo, ajustes del recorrido, datos GPS, análisis y debriefs. Creé CoachBrief para reunirla en una herramienta clara, práctica y utilizable tanto en tierra como en el agua.',
    purposeTitle: 'Mejorar el análisis',
    purpose: 'El objetivo es ayudar a entrenadores y regatistas a comprender mejor las condiciones encontradas, conservar la experiencia de cada navegación y construir su progresión regata tras regata.',
    philosophyTitle: 'Una ayuda para decidir',
    philosophy: 'CoachBrief no sustituye la observación del terreno, la experiencia ni las decisiones del entrenador. Las complementa estructurando la información y facilitando su comparación antes, durante y después de navegar.',
  },
} as const

export function AboutPage() {
  const { language } = usePreferences()
  const c = copies[language]

  return <main className="legal-page">
    <Link className="legal-back" to="/"><ArrowLeft size={15} />{c.back}</Link>
    <header>
      <p>{c.eyebrow}</p>
      <h1>{c.title}</h1>
      <span>{c.introduction}</span>
    </header>
    <div className="legal-sections">
      <section><h2>{c.profileTitle}</h2><p>{c.profile}</p></section>
      <section><h2>{c.whyTitle}</h2><p>{c.why}</p></section>
      <section><h2>{c.purposeTitle}</h2><p>{c.purpose}</p></section>
      <section><h2>{c.philosophyTitle}</h2><p>{c.philosophy}</p></section>
    </div>
  </main>
}
