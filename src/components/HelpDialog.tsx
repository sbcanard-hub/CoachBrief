import { useMemo, useState } from 'react'
import { CircleHelp, Search, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { usePreferences } from '../preferences'
import type { TranslationKey } from '../i18n/fr'
import { legalFooterCopy } from '../pages/legalFooter'

type HelpDialogProps = { open: boolean; onClose: () => void }
type HelpItem = { category: TranslationKey; question: TranslationKey; answer: TranslationKey; keywords: TranslationKey }
type ResolvedHelpItem = { category: string; question: string; answer: string; keywords: string }

const item = (category: TranslationKey, id: string): HelpItem => ({
  category,
  question: `help${id}Question` as TranslationKey,
  answer: `help${id}Answer` as TranslationKey,
  keywords: `help${id}Keywords` as TranslationKey,
})

const HELP_ITEMS: HelpItem[] = [
  item('gettingStarted', 'Create'),
  item('briefings', 'Find'), item('briefings', 'Edit'), item('briefings', 'LocalCloud'),
  item('syncing', 'SendCloud'), item('syncing', 'RestoreDevice'), item('syncing', 'AutoSync'), item('syncing', 'Missing'),
  item('backup', 'BackupDifference'), item('backup', 'Restore'),
  item('weatherSources', 'Weather'), item('weatherSources', 'Confidence'),
  item('route', 'Course'), item('mapPosition', 'Position'), item('importExport', 'Transfer'),
  item('printPdf', 'Pdf'), item('troubleshooting', 'OldData'), item('troubleshooting', 'Update'),
  item('helpNewTools', 'StartMode'), item('helpNewTools', 'ExpressReading'), item('helpNewTools', 'WindShifts'),
  item('helpNewTools', 'StartLine'), item('helpNewTools', 'WaterMemory'), item('helpNewTools', 'HistoricalTracks'), item('helpNewTools', 'SmartBriefing'),
  item('helpNewTools', 'ResultsTabs'), item('helpNewTools', 'Coherence'), item('helpNewTools', 'Trajectory'),
  item('helpNewTools', 'Training'), item('helpNewTools', 'SailorJournal'), item('helpNewTools', 'Debrief'),
  item('helpTypicalJourney', 'Journey'),
]

const LATEST_HELP: Record<'fr' | 'en' | 'it' | 'es', ResolvedHelpItem[]> = {
  fr: [
    {
      category: 'Dernières nouveautés',
      question: 'Où trouver les manches M1, M2, M3… ?',
      answer: 'Sur la page Résultats, ouvrez l’onglet « Manches ». La page s’ouvre par défaut sur « Prévision » afin de garder l’analyse météo en premier. L’onglet « Manches » contient le module « Manches de la journée », la création de M1, M2, M3… et la vue « Journée de régate ».',
      keywords: 'onglet manches M1 M2 M3 résultats prévision journée régate emplacement',
    },
    {
      category: 'Dernières nouveautés',
      question: 'Comment utiliser plusieurs manches dans la même journée ?',
      answer: 'Dans l’onglet « Manches » des résultats, M1 est créée automatiquement. Utilisez « Ajouter une manche » pour créer M2, M3… Chaque manche conserve son heure, son vent observé, sa direction, ses rafales, ses notes et son débrief. Le lieu, la classe, le parcours et la météo générale restent communs à toute la journée.',
      keywords: 'manche manches M1 M2 M3 ajouter journée heure vent notes débrief régate onglet',
    },
    {
      category: 'Dernières nouveautés',
      question: 'À quoi sert « Analyser cette manche » ?',
      answer: 'Le bouton reprend les données de la manche active et relance l’analyse CoachBrief avec son heure et ses observations, sans modifier le briefing général de la journée. Vous pouvez ainsi comparer une manche réellement courue avec les conditions prévues et les autres manches.',
      keywords: 'analyser manche active heure observations briefing général comparer',
    },
    {
      category: 'Dernières nouveautés',
      question: 'Que montre la vue « Journée de régate » ?',
      answer: 'Dans l’onglet « Manches », la vue compare M1, M2, M3… dans un même tableau : heure, vent, direction, rafales, notes et débrief. Elle résume aussi l’évolution entre la première et la dernière manche, notamment un renforcement ou un mollissement du vent et une rotation vers la droite ou la gauche.',
      keywords: 'journée régate onglet manches tableau comparaison évolution vent rotation droite gauche renforcement mollissement',
    },
    {
      category: 'Dernières nouveautés',
      question: 'Comment fonctionne le parcours IODA dans CoachBrief ?',
      answer: 'Choisissez « IODA · Optimist » dans le parcours. Le même parcours est repris dans l’analyse des résultats. La carte affiche les marques 1, 2, la porte 3S/3P et le second près vers l’arrivée avec des virements adaptés au côté tactique. Les bouées peuvent être déplacées, avec des commandes de déplacement global, tout en évitant de les positionner à terre.',
      keywords: 'IODA Optimist parcours bouée 1 2 3S 3P porte second près virements déplacement terre',
    },
    {
      category: 'Dernières nouveautés',
      question: 'Que contient l’onglet Prévision ?',
      answer: 'La page Résultats s’ouvre par défaut sur « Prévision ». Cet onglet rassemble la situation générale, le contexte synoptique, la topographie, les fronts possibles, les températures air/eau, la stabilité de la masse d’air, le caractère terre/mer du vent, le vent en altitude, le midi solaire et la lecture des cadrans thermiques Q1 à Q4.',
      keywords: 'prévision défaut page résultats synoptique topographie fronts température eau air stabilité vent altitude midi solaire cadrans thermique Q1 Q2 Q3 Q4',
    },
    {
      category: 'Dépannage',
      question: 'Pourquoi la météo fonctionne-t-elle maintenant aussi en Wi-Fi ?',
      answer: 'En production, CoachBrief fait passer les appels Open-Meteo par un relais serveur CoachBrief. Cela évite qu’un blocage ou une limitation du réseau local empêche directement le téléphone d’interroger le service météo. Si le relais est indisponible, l’application conserve un repli direct.',
      keywords: 'wifi météo Open-Meteo relais serveur réseau blocage 5G connexion',
    },
  ],
  en: [
    {
      category: 'Latest features',
      question: 'Where can I find R1, R2, R3…?',
      answer: 'On the Results page, open the “Races” tab. Results opens on “Forecast” by default so the weather analysis stays first. The “Races” tab contains the races-of-the-day module, R1/R2/R3 management and the Race day view.',
      keywords: 'races tab R1 R2 R3 results forecast race day location',
    },
    {
      category: 'Latest features',
      question: 'How do I use several races in the same day?',
      answer: 'In the “Races” tab, R1 is created automatically. Use “Add race” to create R2, R3… Each race keeps its own time, observed wind, direction, gusts, notes and debrief, while venue, class, course and general forecast remain shared for the whole day.',
      keywords: 'race races R1 R2 R3 add day time wind notes debrief regatta tab',
    },
    {
      category: 'Latest features',
      question: 'What does “Analyse this race” do?',
      answer: 'It takes the active race data and reruns CoachBrief using that race time and observations without changing the day’s general briefing. This makes it easier to compare a sailed race with the forecast and with the other races.',
      keywords: 'analyse race active time observations general briefing compare',
    },
    {
      category: 'Latest features',
      question: 'What is the “Race day” view for?',
      answer: 'Inside the “Races” tab, it compares R1, R2, R3… in one table with time, wind, direction, gusts, notes and debrief. It also summarises the evolution from the first to the last race, including strengthening or easing wind and a right or left shift.',
      keywords: 'race day races tab table comparison evolution wind shift right left strengthening easing',
    },
    {
      category: 'Latest features',
      question: 'How does the IODA course work in CoachBrief?',
      answer: 'Select “IODA · Optimist” as the course. The same course is used in the Results analysis. The map shows marks 1 and 2, the 3S/3P gate and the second beat to the finish with tacks adapted to the tactical side. Marks can be moved, including global movement controls, while preventing them from ending up on land.',
      keywords: 'IODA Optimist course mark 1 2 3S 3P gate second beat tacks move land',
    },
    {
      category: 'Latest features',
      question: 'What is included in the Forecast tab?',
      answer: 'Results opens on “Forecast” by default. The tab groups the general situation, synoptic context, topography, possible fronts, air/water temperatures, atmospheric stability, land/sea wind character, upper-level wind, solar noon and thermal quadrants Q1 to Q4.',
      keywords: 'forecast default results synoptic topography fronts air water temperature stability upper wind solar noon thermal quadrants Q1 Q2 Q3 Q4',
    },
    {
      category: 'Troubleshooting',
      question: 'Why does weather now work over Wi-Fi too?',
      answer: 'In production, CoachBrief routes Open-Meteo requests through a CoachBrief server relay. This prevents a local network block or limitation from directly stopping the phone from reaching the weather service. If the relay is unavailable, the app keeps a direct fallback.',
      keywords: 'wifi weather Open-Meteo relay server network block 5G connection',
    },
  ],
  it: [
    {
      category: 'Ultime novità',
      question: 'Dove trovo P1, P2, P3…?',
      answer: 'Nella pagina Risultati, apri la scheda “Prove”. I Risultati si aprono per impostazione predefinita su “Previsione”, così l’analisi meteo resta in primo piano. La scheda “Prove” contiene le prove della giornata, P1/P2/P3 e la vista Giornata di regata.',
      keywords: 'prove scheda P1 P2 P3 risultati previsione giornata regata posizione',
    },
    {
      category: 'Ultime novità',
      question: 'Come si usano più prove nella stessa giornata?',
      answer: 'Nella scheda “Prove”, P1 viene creata automaticamente. Usa “Aggiungi prova” per creare P2, P3… Ogni prova conserva ora, vento osservato, direzione, raffica, note e debrief, mentre luogo, classe, percorso e previsione generale restano comuni alla giornata.',
      keywords: 'prova prove P1 P2 P3 aggiungi giornata ora vento note debrief regata scheda',
    },
    {
      category: 'Ultime novità',
      question: 'A cosa serve “Analizza questa prova”?',
      answer: 'Riprende i dati della prova attiva e rilancia CoachBrief usando la sua ora e le sue osservazioni senza modificare il briefing generale della giornata. Permette così di confrontare la prova disputata con la previsione e con le altre prove.',
      keywords: 'analizza prova attiva ora osservazioni briefing generale confronto',
    },
    {
      category: 'Ultime novità',
      question: 'Cosa mostra la vista “Giornata di regata”?',
      answer: 'Nella scheda “Prove”, confronta P1, P2, P3… in una tabella con ora, vento, direzione, raffiche, note e debrief. Riassume anche l’evoluzione tra la prima e l’ultima prova, compresi aumento o calo del vento e rotazione a destra o a sinistra.',
      keywords: 'giornata regata prove scheda tabella confronto evoluzione vento rotazione destra sinistra aumento calo',
    },
    {
      category: 'Ultime novità',
      question: 'Come funziona il percorso IODA in CoachBrief?',
      answer: 'Seleziona “IODA · Optimist” come percorso. Lo stesso percorso viene ripreso nell’analisi dei Risultati. La mappa mostra le boe 1 e 2, il cancello 3S/3P e la seconda bolina verso l’arrivo con bordi adattati al lato tattico. Le boe possono essere spostate, anche globalmente, evitando che finiscano a terra.',
      keywords: 'IODA Optimist percorso boa 1 2 3S 3P cancello seconda bolina bordi spostamento terra',
    },
    {
      category: 'Ultime novità',
      question: 'Cosa contiene la scheda Previsione?',
      answer: 'I Risultati si aprono per impostazione predefinita su “Previsione”. La scheda riunisce situazione generale, quadro sinottico, topografia, possibili fronti, temperature aria/acqua, stabilità atmosferica, carattere terra/mare del vento, vento in quota, mezzogiorno solare e quadranti termici Q1-Q4.',
      keywords: 'previsione predefinita risultati sinottico topografia fronti temperatura aria acqua stabilità vento quota mezzogiorno solare quadranti termici Q1 Q2 Q3 Q4',
    },
    {
      category: 'Risoluzione problemi',
      question: 'Perché ora il meteo funziona anche in Wi-Fi?',
      answer: 'In produzione, CoachBrief fa passare le richieste Open-Meteo attraverso un relay server CoachBrief. In questo modo un blocco o limite della rete locale non impedisce direttamente al telefono di raggiungere il servizio meteo. Se il relay non è disponibile, resta un collegamento diretto di riserva.',
      keywords: 'wifi meteo Open-Meteo relay server rete blocco 5G connessione',
    },
  ],
  es: [
    {
      category: 'Últimas novedades',
      question: '¿Dónde encuentro M1, M2, M3…?',
      answer: 'En la página Resultados, abre la pestaña “Mangas”. Resultados se abre por defecto en “Previsión” para mantener primero el análisis meteorológico. La pestaña “Mangas” contiene las mangas del día, M1/M2/M3 y la vista Jornada de regata.',
      keywords: 'mangas pestaña M1 M2 M3 resultados previsión jornada regata ubicación',
    },
    {
      category: 'Últimas novedades',
      question: '¿Cómo se usan varias mangas en el mismo día?',
      answer: 'En la pestaña “Mangas”, M1 se crea automáticamente. Usa “Añadir manga” para crear M2, M3… Cada manga conserva su hora, viento observado, dirección, racha, notas y debrief, mientras lugar, clase, recorrido y previsión general siguen siendo comunes a toda la jornada.',
      keywords: 'manga mangas M1 M2 M3 añadir jornada hora viento notas debrief regata pestaña',
    },
    {
      category: 'Últimas novedades',
      question: '¿Para qué sirve “Analizar esta manga”?',
      answer: 'Toma los datos de la manga activa y vuelve a ejecutar CoachBrief con su hora y sus observaciones sin modificar el briefing general de la jornada. Así puedes comparar una manga navegada con la previsión y con las demás mangas.',
      keywords: 'analizar manga activa hora observaciones briefing general comparar',
    },
    {
      category: 'Últimas novedades',
      question: '¿Qué muestra la vista “Jornada de regata”?',
      answer: 'Dentro de la pestaña “Mangas”, compara M1, M2, M3… en una tabla con hora, viento, dirección, rachas, notas y debrief. También resume la evolución entre la primera y la última manga, incluido aumento o disminución del viento y giro a la derecha o a la izquierda.',
      keywords: 'jornada regata mangas pestaña tabla comparación evolución viento giro derecha izquierda aumento disminución',
    },
    {
      category: 'Últimas novedades',
      question: '¿Cómo funciona el recorrido IODA en CoachBrief?',
      answer: 'Selecciona “IODA · Optimist” como recorrido. El mismo recorrido se utiliza en el análisis de Resultados. El mapa muestra las balizas 1 y 2, la puerta 3S/3P y la segunda ceñida hacia la llegada con bordos adaptados al lado táctico. Las balizas se pueden mover, también de forma global, evitando que terminen en tierra.',
      keywords: 'IODA Optimist recorrido baliza 1 2 3S 3P puerta segunda ceñida bordos mover tierra',
    },
    {
      category: 'Últimas novedades',
      question: '¿Qué incluye la pestaña Previsión?',
      answer: 'Resultados se abre por defecto en “Previsión”. La pestaña reúne situación general, contexto sinóptico, topografía, posibles frentes, temperaturas de aire/agua, estabilidad atmosférica, carácter tierra/mar del viento, viento en altura, mediodía solar y cuadrantes térmicos Q1-Q4.',
      keywords: 'previsión defecto resultados sinóptico topografía frentes temperatura aire agua estabilidad viento altura mediodía solar cuadrantes térmicos Q1 Q2 Q3 Q4',
    },
    {
      category: 'Resolución de problemas',
      question: '¿Por qué ahora la meteorología funciona también por Wi-Fi?',
      answer: 'En producción, CoachBrief enruta las peticiones Open-Meteo a través de un relé de servidor CoachBrief. Así, un bloqueo o limitación de la red local no impide directamente que el teléfono acceda al servicio meteorológico. Si el relé no está disponible, la aplicación mantiene una conexión directa de respaldo.',
      keywords: 'wifi meteorología Open-Meteo relé servidor red bloqueo 5G conexión',
    },
  ],
}

function normalize(value: string, locale: string) {
  return value.toLocaleLowerCase(locale).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function HelpDialog({ open, onClose }: HelpDialogProps) {
  const [query, setQuery] = useState('')
  const { language, locale, t } = usePreferences()
  const allItems = useMemo<ResolvedHelpItem[]>(() => [
    ...HELP_ITEMS.map((entry) => ({ category: t(entry.category), question: t(entry.question), answer: t(entry.answer), keywords: t(entry.keywords) })),
    ...LATEST_HELP[language],
  ], [language, t])
  const filteredItems = useMemo(() => {
    const normalizedQuery = normalize(query.trim(), locale)
    if (!normalizedQuery) return allItems
    return allItems.filter((entry) => {
      const haystack = normalize(`${entry.category} ${entry.question} ${entry.answer} ${entry.keywords}`, locale)
      return normalizedQuery.split(/\s+/).every((word) => haystack.includes(word))
    })
  }, [allItems, locale, query])
  const categories = useMemo(() => {
    const grouped = new Map<string, ResolvedHelpItem[]>()
    filteredItems.forEach((entry) => grouped.set(entry.category, [...(grouped.get(entry.category) ?? []), entry]))
    return Array.from(grouped.entries())
  }, [filteredItems])

  if (!open) return null
  return <div className="help-overlay" role="presentation" onMouseDown={onClose}>
    <section className="help-dialog help-dialog--faq" role="dialog" aria-modal="true" aria-labelledby="coachbrief-help-title" onMouseDown={(event) => event.stopPropagation()}>
      <button className="help-close" type="button" onClick={onClose} aria-label={t('closeHelp')}><X size={20} /></button>
      <div className="help-heading"><CircleHelp size={24} /><div><p className="help-kicker">{t('helpFaq')}</p><h2 id="coachbrief-help-title">{t('helpHeading')}</h2></div></div>
      <section className="help-introduction" aria-labelledby="coachbrief-purpose-title">
        <h3 id="coachbrief-purpose-title">{t('purposeTitle')}</h3>
        <p><strong>{t('purposeStrong')}</strong>{' '}{t('purposeBody')}</p>
        <div className="help-steps" aria-labelledby="coachbrief-steps-title">
          <h3 id="coachbrief-steps-title">{t('howTo')}</h3>
          <ol>
            <li><strong>{t('prepareRace')}</strong><span>{t('prepareRaceHelp')}</span></li>
            <li><strong>{t('analyse')}</strong><span>{t('analyseHelp')}</span></li>
            <li><strong>{t('tactics')}</strong><span>{t('tacticsHelp')}</span></li>
            <li><strong>{t('createBriefing')}</strong><span>{t('createHelp')}</span></li>
          </ol>
        </div>
        <p><Link to="/a-propos" onClick={onClose}>{legalFooterCopy[language].about} →</Link></p>
      </section>
      <label className="help-search"><Search size={18} aria-hidden="true" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('helpSearch')} aria-label={t('helpSearchLabel')} autoComplete="off" />{query && <button type="button" onClick={() => setQuery('')} aria-label={t('clearSearch')}><X size={16} /></button>}</label>
      <p className="help-result-count" aria-live="polite">{query ? `${filteredItems.length} ${t(filteredItems.length > 1 ? 'answersFound' : 'answerFound')}` : `${allItems.length} ${t('commonQuestions')}`}</p>
      {categories.length ? <div className="help-faq">{categories.map(([category, items]) => <section className="help-category" key={category}><h3>{category}</h3><div className="help-faq-list">{items.map((entry) => <details key={entry.question} open={Boolean(query)}><summary>{entry.question}</summary><p>{entry.answer}</p></details>)}</div></section>)}</div> : <div className="help-empty"><strong>{t('noResult')}</strong><span>{t('noResultHelp')}</span></div>}
    </section>
  </div>
}
