import { useEffect } from 'react'
import { usePreferences } from '../preferences'

const copy = {
  fr: {
    category: 'Course au large',
    entries: [
      {
        question: 'À quoi sert le module Course au large ?',
        answer: 'Le module Course au large prépare une navigation qui évolue dans le temps et dans l’espace. Il combine départ, arrivée, waypoints, météo, courant, marée, polaire du bateau, état de mer et contraintes de navigation pour analyser une route complète.',
        keywords: 'course au large offshore route navigation météo courant marée polaire waypoints',
      },
      {
        question: 'Comment fonctionne le routage par isochrones ?',
        answer: 'CoachBrief fait progresser plusieurs routes possibles à chaque pas de temps. Chaque branche est évaluée avec le vent prévu, la polaire du bateau, le courant, l’état de mer et les contraintes terre/TSS. Les branches les plus intéressantes sont conservées jusqu’à l’arrivée ou jusqu’à la limite de calcul.',
        keywords: 'isochrones routage météo branches pas de temps vent polaire courant TSS terre',
      },
      {
        question: 'Que signifie « Route météo partielle » ?',
        answer: 'Cela signifie que le calcul n’a pas encore atteint l’arrivée dans l’horizon ou le budget de calcul disponible. La route affichée correspond alors à la meilleure branche trouvée au moment de l’arrêt. Elle ne doit pas être interprétée comme une route complète jusqu’à A.',
        keywords: 'route météo partielle calcul interrompu horizon budget arrivée meilleure branche',
      },
      {
        question: 'Pourquoi la route météo peut-elle être plus longue que la route directe ?',
        answer: 'Une route plus longue peut être plus rapide si elle permet un meilleur angle au vent, davantage de vitesse polaire, un courant plus favorable ou l’évitement d’une zone défavorable. Le bloc « Pourquoi cette route météo ? » affiche le cap, le TWA, le vent, la vitesse polaire, la vitesse sol et le courant le long de la route.',
        keywords: 'route directe détour météo TWA vitesse polaire courant pourquoi cette route',
      },
      {
        question: 'Le module Course au large change-t-il aussi de langue ?',
        answer: 'Oui. Les principaux libellés, résultats de routage et diagnostics du module Course au large suivent maintenant la langue choisie dans Réglages : français, anglais, italien ou espagnol. Les résultats ajoutés après un calcul sont eux aussi retraduits.',
        keywords: 'langue traduction français anglais italien espagnol réglages offshore',
      },
    ],
  },
  en: {
    category: 'Offshore racing',
    entries: [
      {
        question: 'What is the Offshore module for?',
        answer: 'The Offshore module prepares a passage that evolves over time and space. It combines start, finish, waypoints, weather, current, tides, boat polar, sea state and navigation constraints to analyse a complete route.',
        keywords: 'offshore route passage weather current tides polar waypoints',
      },
      {
        question: 'How does isochrone routing work?',
        answer: 'CoachBrief advances several possible routes at each time step. Every branch is evaluated using forecast wind, boat polar, current, sea state and land/TSS constraints. The most promising branches are retained until the finish or the calculation limit is reached.',
        keywords: 'isochrone routing branches time step wind polar current TSS land',
      },
      {
        question: 'What does “Partial weather route” mean?',
        answer: 'It means the calculation has not yet reached the finish within the selected horizon or available calculation budget. The displayed route is the best branch found when the calculation stopped, not a complete route to A.',
        keywords: 'partial weather route calculation stopped horizon budget finish best branch',
      },
      {
        question: 'Why can the weather route be longer than the direct route?',
        answer: 'A longer route can still be faster if it gives a better wind angle, more polar speed, a favourable current or avoids a poor area. The “Why this weather route?” block shows heading, TWA, wind, polar speed, speed over ground and current along the route.',
        keywords: 'direct route detour weather TWA polar speed current why route',
      },
      {
        question: 'Does the Offshore module also switch language?',
        answer: 'Yes. The main labels, routing results and diagnostics now follow the language selected in Settings: French, English, Italian or Spanish. Results added after a routing calculation are translated too.',
        keywords: 'language translation French English Italian Spanish settings offshore',
      },
    ],
  },
  it: {
    category: 'Regata d’altura',
    entries: [
      {
        question: 'A cosa serve il modulo Regata d’altura?',
        answer: 'Il modulo Regata d’altura prepara una navigazione che evolve nel tempo e nello spazio. Combina partenza, arrivo, waypoint, meteo, corrente, marea, polare della barca, stato del mare e vincoli di navigazione per analizzare una rotta completa.',
        keywords: 'regata altura offshore rotta navigazione meteo corrente marea polare waypoint',
      },
      {
        question: 'Come funziona il routing isocrono?',
        answer: 'CoachBrief fa avanzare più rotte possibili a ogni passo temporale. Ogni ramo viene valutato con vento previsto, polare, corrente, stato del mare e vincoli terra/TSS. I rami più interessanti vengono mantenuti fino all’arrivo o al limite di calcolo.',
        keywords: 'isocrone routing rami passo temporale vento polare corrente TSS terra',
      },
      {
        question: 'Cosa significa “Rotta meteo parziale”?',
        answer: 'Significa che il calcolo non ha ancora raggiunto l’arrivo entro l’orizzonte o il budget di calcolo disponibile. La rotta mostrata è il miglior ramo trovato al momento dell’arresto, non una rotta completa fino ad A.',
        keywords: 'rotta meteo parziale calcolo interrotto orizzonte budget arrivo ramo',
      },
      {
        question: 'Perché la rotta meteo può essere più lunga della rotta diretta?',
        answer: 'Una rotta più lunga può essere più veloce se offre un angolo al vento migliore, maggiore velocità di polare, corrente favorevole o evita una zona sfavorevole. Il blocco “Perché questa rotta meteo?” mostra rotta, TWA, vento, velocità polare, velocità sul fondo e corrente.',
        keywords: 'rotta diretta deviazione meteo TWA polare corrente perché rotta',
      },
      {
        question: 'Il modulo Regata d’altura cambia anche lingua?',
        answer: 'Sì. Le principali etichette, i risultati di routing e le diagnosi seguono ora la lingua scelta nelle Impostazioni: francese, inglese, italiano o spagnolo. Anche i risultati aggiunti dopo il calcolo vengono tradotti.',
        keywords: 'lingua traduzione francese inglese italiano spagnolo impostazioni offshore',
      },
    ],
  },
  es: {
    category: 'Regata de altura',
    entries: [
      {
        question: '¿Para qué sirve el módulo Regata de altura?',
        answer: 'El módulo Regata de altura prepara una navegación que evoluciona en el tiempo y en el espacio. Combina salida, llegada, waypoints, meteorología, corriente, marea, polar del barco, estado de la mar y restricciones de navegación para analizar una ruta completa.',
        keywords: 'regata altura offshore ruta navegación meteorología corriente marea polar waypoints',
      },
      {
        question: '¿Cómo funciona el routing por isócronas?',
        answer: 'CoachBrief hace avanzar varias rutas posibles en cada paso de tiempo. Cada rama se evalúa con el viento previsto, la polar, la corriente, el estado de la mar y las restricciones tierra/TSS. Se conservan las ramas más interesantes hasta la llegada o el límite de cálculo.',
        keywords: 'isócronas routing ramas paso tiempo viento polar corriente TSS tierra',
      },
      {
        question: '¿Qué significa “Ruta meteorológica parcial”?',
        answer: 'Significa que el cálculo todavía no ha alcanzado la llegada dentro del horizonte o del presupuesto de cálculo disponible. La ruta mostrada es la mejor rama encontrada cuando se detuvo el cálculo, no una ruta completa hasta A.',
        keywords: 'ruta meteorológica parcial cálculo detenido horizonte presupuesto llegada rama',
      },
      {
        question: '¿Por qué la ruta meteorológica puede ser más larga que la ruta directa?',
        answer: 'Una ruta más larga puede ser más rápida si ofrece mejor ángulo al viento, más velocidad de polar, corriente favorable o evita una zona desfavorable. El bloque “¿Por qué esta ruta meteorológica?” muestra rumbo, TWA, viento, velocidad polar, velocidad sobre el fondo y corriente.',
        keywords: 'ruta directa desvío meteorología TWA polar corriente por qué ruta',
      },
      {
        question: '¿El módulo Regata de altura también cambia de idioma?',
        answer: 'Sí. Las principales etiquetas, resultados de routing y diagnósticos siguen ahora el idioma elegido en Ajustes: francés, inglés, italiano o español. Los resultados añadidos después de un cálculo también se traducen.',
        keywords: 'idioma traducción francés inglés italiano español ajustes offshore',
      },
    ],
  },
} as const

function normalize(value: string) {
  return value.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function OffshoreHelpExtension() {
  const { language } = usePreferences()

  useEffect(() => {
    let cleanupSearch: (() => void) | null = null

    const install = () => {
      const faq = document.querySelector('.help-faq')
      const search = document.querySelector<HTMLInputElement>('.help-search input[type="search"]')
      if (!faq || !search) return

      faq.querySelector('[data-offshore-help="true"]')?.remove()
      cleanupSearch?.()

      const localized = copy[language]
      const section = document.createElement('section')
      section.className = 'help-category'
      section.dataset.offshoreHelp = 'true'
      const heading = document.createElement('h3')
      heading.textContent = localized.category
      section.appendChild(heading)
      const list = document.createElement('div')
      list.className = 'help-faq-list'

      const detailRows = localized.entries.map((entry) => {
        const details = document.createElement('details')
        const summary = document.createElement('summary')
        const paragraph = document.createElement('p')
        summary.textContent = entry.question
        paragraph.textContent = entry.answer
        details.append(summary, paragraph)
        list.appendChild(details)
        return { details, haystack: normalize(`${localized.category} ${entry.question} ${entry.answer} ${entry.keywords}`) }
      })
      section.appendChild(list)
      faq.appendChild(section)

      const applyFilter = () => {
        const words = normalize(search.value.trim()).split(/\s+/).filter(Boolean)
        let visible = 0
        detailRows.forEach(({ details, haystack }) => {
          const show = words.length === 0 || words.every((word) => haystack.includes(word))
          details.hidden = !show
          details.open = words.length > 0 && show
          if (show) visible += 1
        })
        section.hidden = visible === 0
      }
      search.addEventListener('input', applyFilter)
      cleanupSearch = () => search.removeEventListener('input', applyFilter)
      applyFilter()
    }

    install()
    const observer = new MutationObserver(install)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      cleanupSearch?.()
      document.querySelector('[data-offshore-help="true"]')?.remove()
    }
  }, [language])

  return null
}
