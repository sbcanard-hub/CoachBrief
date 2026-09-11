import { useMemo, useState } from 'react'
import { CircleHelp, Search, X } from 'lucide-react'

type HelpDialogProps = {
  open: boolean
  onClose: () => void
}

type HelpItem = {
  category: string
  question: string
  answer: string
  keywords: string
}

const HELP_ITEMS: HelpItem[] = [
  {
    category: 'Premiers pas',
    question: 'Comment créer un nouveau briefing ?',
    answer: 'Depuis l’accueil, renseignez le lieu, la date, l’heure, la classe et les paramètres de course, puis lancez le briefing. Vous pourrez ensuite l’enregistrer pour le retrouver dans Mes briefings.',
    keywords: 'nouveau créer accueil lieu date heure classe course briefing',
  },
  {
    category: 'Mes briefings',
    question: 'Où retrouver mes briefings enregistrés ?',
    answer: 'Ouvrez le menu puis Mes briefings. Les fiches enregistrées sur l’appareil et celles disponibles dans le cloud y sont regroupées.',
    keywords: 'retrouver ouvrir enregistrés mes briefings historique liste',
  },
  {
    category: 'Mes briefings',
    question: 'Quelle différence entre LOCAL et CLOUD ?',
    answer: 'LOCAL signifie que le briefing est stocké uniquement dans ce navigateur sur cet appareil. CLOUD signifie qu’il est enregistré dans votre espace Firebase privé et peut être récupéré sur un autre appareil connecté au même compte.',
    keywords: 'local cloud appareil navigateur firebase téléphone ordinateur différence',
  },
  {
    category: 'Synchronisation',
    question: 'Comment envoyer un briefing vers le cloud ?',
    answer: 'Connectez-vous, puis utilisez Sauvegarder dans le cloud depuis le menu. Le briefing doit ensuite apparaître avec l’indication CLOUD dans Mes briefings.',
    keywords: 'envoyer sauvegarder cloud synchroniser synchro connexion',
  },
  {
    category: 'Synchronisation',
    question: 'Comment récupérer mes briefings sur mon téléphone ou un autre ordinateur ?',
    answer: 'Connectez-vous avec le même compte sur le nouvel appareil, puis choisissez Restaurer depuis le cloud. Seuls les briefings déjà enregistrés dans le cloud peuvent être récupérés.',
    keywords: 'téléphone mobile ordinateur autre appareil restaurer cloud récupérer',
  },
  {
    category: 'Synchronisation',
    question: 'À quoi sert la synchronisation automatique ?',
    answer: 'Lorsqu’elle est activée, CoachBrief synchronise automatiquement les données cloud après les modifications. Vous pouvez la laisser désactivée si vous préférez choisir vous-même quand envoyer vos données.',
    keywords: 'automatique synchronisation synchro données cloud activer désactiver',
  },
  {
    category: 'Synchronisation',
    question: 'Pourquoi un briefing n’apparaît-il pas sur mon téléphone ?',
    answer: 'Vérifiez sur l’ordinateur que le briefing est marqué CLOUD et non LOCAL. Ensuite, sur le téléphone, vérifiez que vous êtes connecté au même compte et lancez Restaurer depuis le cloud.',
    keywords: 'n apparaît pas téléphone absent introuvable local cloud restaurer même compte',
  },
  {
    category: 'Sauvegarde',
    question: 'Quelle différence entre Sauvegarder les données et Sauvegarder dans le cloud ?',
    answer: 'Sauvegarder les données crée une sauvegarde utilisable localement. Sauvegarder dans le cloud envoie les données dans votre espace en ligne pour les retrouver sur plusieurs appareils.',
    keywords: 'sauvegarder données sauvegarde locale cloud différence export',
  },
  {
    category: 'Sauvegarde',
    question: 'À quoi sert Restaurer ?',
    answer: 'Restaurer permet de remettre en place une sauvegarde locale. Restaurer depuis le cloud récupère au contraire les données enregistrées dans votre espace en ligne.',
    keywords: 'restaurer sauvegarde données local cloud',
  },
  {
    category: 'Météo & sources',
    question: 'D’où viennent les informations météo ?',
    answer: 'CoachBrief combine plusieurs informations disponibles pour le briefing, notamment les prévisions, les observations METAR et les effets locaux lorsqu’ils sont disponibles. Le niveau de confiance affiché aide à interpréter les sources.',
    keywords: 'météo sources prévision metar observations confiance vent',
  },
  {
    category: 'Météo & sources',
    question: 'Que signifie le niveau de confiance des sources ?',
    answer: 'Il indique la cohérence et la qualité des informations utilisées pour le briefing. Plus les sources disponibles sont récentes et cohérentes entre elles, plus la confiance est élevée.',
    keywords: 'confiance fiabilité source météo cohérence qualité',
  },
  {
    category: 'Parcours',
    question: 'Comment utiliser le parcours et le plan d’eau ?',
    answer: 'Choisissez le type de parcours et les paramètres souhaités. Selon les fonctions disponibles, CoachBrief peut vous aider à visualiser le parcours, sa taille, son axe et la position du comité.',
    keywords: 'parcours banane trapèze triangle plan eau comité axe taille',
  },
  {
    category: 'Carte & position',
    question: 'Pourquoi CoachBrief demande-t-il ma position ?',
    answer: 'La position peut servir à centrer la carte et à faciliter le placement du plan d’eau ou du comité. Elle n’est utile que pour les fonctions qui dépendent de votre localisation.',
    keywords: 'position géolocalisation localisation carte comité GPS',
  },
  {
    category: 'Import / export',
    question: 'Puis-je transférer un briefing autrement que par le cloud ?',
    answer: 'Oui. Les fonctions d’import et d’export permettent de conserver ou transférer certaines données sans passer par la synchronisation cloud.',
    keywords: 'import export transférer fichier sauvegarde partager',
  },
  {
    category: 'Impression / PDF',
    question: 'Comment enregistrer un briefing en PDF ?',
    answer: 'Depuis un briefing affiché, utilisez Imprimer / PDF dans le menu. Dans la fenêtre d’impression de votre navigateur, choisissez l’option d’enregistrement au format PDF.',
    keywords: 'imprimer impression pdf enregistrer fiche',
  },
  {
    category: 'Dépannage',
    question: 'Que faire si une donnée semble ancienne ou incohérente ?',
    answer: 'Rechargez le briefing, vérifiez l’heure des observations et comparez les différentes sources affichées. Une observation ancienne ne doit pas être interprétée comme une mesure en temps réel.',
    keywords: 'ancienne incohérente actualiser recharger observation heure données erreur',
  },
  {
    category: 'Dépannage',
    question: 'Que faire si le site ne semble pas avoir pris en compte une mise à jour ?',
    answer: 'Rechargez la page. Sur mobile, vous pouvez aussi fermer puis rouvrir l’onglet. Si le site vient d’être mis à jour, GitHub Pages peut nécessiter un court délai avant d’afficher la nouvelle version.',
    keywords: 'mise à jour cache page recharger github pages nouvelle version',
  },
]

function normalize(value: string) {
  return value
    .toLocaleLowerCase('fr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function HelpDialog({ open, onClose }: HelpDialogProps) {
  const [query, setQuery] = useState('')

  const filteredItems = useMemo(() => {
    const normalizedQuery = normalize(query.trim())
    if (!normalizedQuery) return HELP_ITEMS

    return HELP_ITEMS.filter((item) => {
      const haystack = normalize(`${item.category} ${item.question} ${item.answer} ${item.keywords}`)
      return normalizedQuery
        .split(/\s+/)
        .every((word) => haystack.includes(word))
    })
  }, [query])

  const categories = useMemo(() => {
    const grouped = new Map<string, HelpItem[]>()
    filteredItems.forEach((item) => {
      const current = grouped.get(item.category) ?? []
      current.push(item)
      grouped.set(item.category, current)
    })
    return Array.from(grouped.entries())
  }, [filteredItems])

  if (!open) return null

  return <div className="help-overlay" role="presentation" onMouseDown={onClose}>
    <section
      className="help-dialog help-dialog--faq"
      role="dialog"
      aria-modal="true"
      aria-labelledby="coachbrief-help-title"
      onMouseDown={(event) => event.stopPropagation()}
    >
      <button className="help-close" type="button" onClick={onClose} aria-label="Fermer l’aide">
        <X size={20} />
      </button>

      <div className="help-heading">
        <CircleHelp size={24} />
        <div>
          <p className="help-kicker">Aide & FAQ</p>
          <h2 id="coachbrief-help-title">Comment pouvons-nous vous aider ?</h2>
        </div>
      </div>

      <section className="help-introduction" aria-labelledby="coachbrief-purpose-title">
        <h3 id="coachbrief-purpose-title">À quoi sert CoachBrief&nbsp;?</h3>
        <p>
          <strong>CoachBrief est un outil d’aide à la préparation des briefings météo et tactiques avant une régate.</strong>{' '}
          Il permet de regrouper au même endroit les informations utiles sur le vent, la météo, le plan d’eau,
          le parcours et les éléments tactiques afin de préparer un briefing simple, structuré et exploitable par
          un entraîneur ou un régatier.
        </p>

        <div className="help-steps" aria-labelledby="coachbrief-steps-title">
          <h3 id="coachbrief-steps-title">Comment utiliser CoachBrief&nbsp;?</h3>
          <ol>
            <li>
              <strong>Préparer la régate</strong>
              <span>Renseigner le lieu, la date, la classe de bateau et l’heure de la manche.</span>
            </li>
            <li>
              <strong>Analyser les conditions</strong>
              <span>Compléter les informations météo, vent, pression, nuages, température, courant et effets de côte.</span>
            </li>
            <li>
              <strong>Construire l’analyse tactique</strong>
              <span>Utiliser la carte, le parcours et les 7 piles de Bernot pour hiérarchiser les éléments importants du jour.</span>
            </li>
            <li>
              <strong>Créer le briefing</strong>
              <span>Générer une synthèse claire des conditions et des recommandations à transmettre aux coureurs.</span>
            </li>
          </ol>
        </div>
      </section>

      <label className="help-search">
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher : téléphone, météo, parcours, PDF…"
          aria-label="Rechercher dans l’aide"
          autoComplete="off"
        />
        {query && <button type="button" onClick={() => setQuery('')} aria-label="Effacer la recherche"><X size={16} /></button>}
      </label>

      <p className="help-result-count" aria-live="polite">
        {query ? `${filteredItems.length} réponse${filteredItems.length > 1 ? 's' : ''} trouvée${filteredItems.length > 1 ? 's' : ''}` : `${HELP_ITEMS.length} questions fréquentes`}
      </p>

      {categories.length > 0 ? <div className="help-faq">
        {categories.map(([category, items]) => <section className="help-category" key={category}>
          <h3>{category}</h3>
          <div className="help-faq-list">
            {items.map((item) => <details key={item.question} open={Boolean(query)}>
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>)}
          </div>
        </section>)}
      </div> : <div className="help-empty">
        <strong>Aucun résultat</strong>
        <span>Essayez un mot plus simple, par exemple « cloud », « téléphone », « météo » ou « PDF ».</span>
      </div>}
    </section>
  </div>
}
