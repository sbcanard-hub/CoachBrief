import { Compass, Gauge, History, LoaderCircle, Wind } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  buildCommunityKnowledgeConfidence,
  buildPersonalKnowledgeConfidence,
  loadCommunityKnowledgeCache,
} from '../knowledgeConfidence'
import { loadKnowledgePreferences, saveKnowledgePreferences } from '../knowledgePreferences'
import type { KnowledgeMode } from '../knowledgePreferences'
import { loadSavedBriefings } from '../savedBriefings'
import { buildSiteLearningProfile } from '../siteLearning'
import type { BriefingRequest } from '../types'
import { fetchWeatherForBriefing } from '../weather'
import type { LiveWeatherData } from '../weather'
import './siteLearning.css'
import { usePreferences, type Language } from '../preferences'

const learningCopy = {
  fr: { step: 'Historique local · apprentissage progressif', title: 'Mémoire du plan d’eau', source: 'Source de connaissance du plan d’eau', personal: 'Personnel', community: 'Base commune', mixed: 'Perso + commune', modes: ['Mémoire personnelle', 'Base commune', 'Perso + commune'], saved: 'Manches mémorisées', savedHelp: 'briefings sauvegardés avec météo', returns: 'Retours réels', returnsHelp: '1 = indication · 2–3 = tendance · 4–6 = confiance moyenne · 7+ = forte', common: 'Observations communes', commonHelp: '3–5 = signal · 6–12 = tendance · 13–25 = bonne confiance', commonCases: 'Cas communs comparables', commonCasesHelp: 'même secteur, force et contexte quand disponibles', personalCases: 'Cas perso comparables', personalCasesHelp: 'la similarité des conditions augmente le poids de l’historique', sector: 'Secteur le plus documenté', noHistory: 'pas encore de recul', briefings: 'briefing(s)', learns: 'Ce que CoachBrief apprend de votre expérience', comparing: 'comparaison en cours', speedBias: 'Biais force', directionBias: 'Biais direction', consistency: 'Régularité', recent: 'Retours récents', signals: 'Signaux terrain récurrents', notes: 'Notes terrain récentes', noNotes: 'Aucune note locale mémorisée pour l’instant.', commonBase: 'Base commune de connaissances', commonPending: 'Le mode communautaire est prêt dans l’interface et le modèle de données. Il sera alimenté dès que le compte cloud et le service partagé seront raccordés.', contribute: 'Contribuer anonymement à la base commune', contributeHelp: 'Ce choix est mémorisé, mais aucun retour n’est envoyé tant que le cloud CoachBrief n’est pas connecté.', note: 'Le score combine nombre de retours, similarité des conditions, régularité et récence. La mémoire personnelle reste prioritaire par défaut. La base commune est volontaire et séparée de vos notes privées.' },
  en: { step: 'Local history · progressive learning', title: 'Sailing-area memory', source: 'Sailing-area knowledge source', personal: 'Personal', community: 'Shared base', mixed: 'Personal + shared', modes: ['Personal memory', 'Shared base', 'Personal + shared'], saved: 'Stored races', savedHelp: 'briefings saved with weather data', returns: 'Actual results', returnsHelp: '1 = indication · 2–3 = trend · 4–6 = medium confidence · 7+ = strong', common: 'Shared observations', commonHelp: '3–5 = signal · 6–12 = trend · 13–25 = good confidence', commonCases: 'Comparable shared cases', commonCasesHelp: 'same sector, strength and context when available', personalCases: 'Comparable personal cases', personalCasesHelp: 'similar conditions increase the weight of history', sector: 'Best documented sector', noHistory: 'no history yet', briefings: 'briefing(s)', learns: 'What CoachBrief learns from your experience', comparing: 'comparing', speedBias: 'Speed bias', directionBias: 'Direction bias', consistency: 'Consistency', recent: 'Recent feedback', signals: 'Recurring field signals', notes: 'Recent field notes', noNotes: 'No local note stored yet.', commonBase: 'Shared knowledge base', commonPending: 'Shared mode is ready in the interface and data model. It will be populated when the cloud account and shared service are connected.', contribute: 'Contribute anonymously to the shared base', contributeHelp: 'This choice is saved, but nothing is sent until the CoachBrief cloud is connected.', note: 'The score combines feedback count, similarity of conditions, consistency and recency. Personal memory remains the default priority. The shared base is opt-in and separate from private notes.' },
  it: { step: 'Storico locale · apprendimento progressivo', title: 'Memoria del campo di regata', source: 'Fonte di conoscenza del campo di regata', personal: 'Personale', community: 'Base comune', mixed: 'Personale + comune', modes: ['Memoria personale', 'Base comune', 'Personale + comune'], saved: 'Prove memorizzate', savedHelp: 'briefing salvati con dati meteo', returns: 'Dati reali', returnsHelp: '1 = indicazione · 2–3 = tendenza · 4–6 = affidabilità media · 7+ = forte', common: 'Osservazioni comuni', commonHelp: '3–5 = segnale · 6–12 = tendenza · 13–25 = buona affidabilità', commonCases: 'Casi comuni comparabili', commonCasesHelp: 'stesso settore, intensità e contesto quando disponibili', personalCases: 'Casi personali comparabili', personalCasesHelp: 'condizioni simili aumentano il peso dello storico', sector: 'Settore più documentato', noHistory: 'nessuno storico', briefings: 'briefing', learns: 'Cosa impara CoachBrief dalla tua esperienza', comparing: 'confronto in corso', speedBias: 'Bias intensità', directionBias: 'Bias direzione', consistency: 'Regolarità', recent: 'Riscontri recenti', signals: 'Segnali ricorrenti sul campo', notes: 'Note recenti sul campo', noNotes: 'Nessuna nota locale memorizzata.', commonBase: 'Base comune di conoscenze', commonPending: 'La modalità comune è pronta nell’interfaccia e nel modello dati. Sarà alimentata quando account cloud e servizio condiviso saranno collegati.', contribute: 'Contribuisci anonimamente alla base comune', contributeHelp: 'La scelta è memorizzata, ma non viene inviato nulla finché il cloud CoachBrief non è collegato.', note: 'Il punteggio combina numero di riscontri, somiglianza delle condizioni, regolarità e recenza. La memoria personale resta prioritaria. La base comune è facoltativa e separata dalle note private.' },
  es: { step: 'Historial local · aprendizaje progresivo', title: 'Memoria del campo de regatas', source: 'Fuente de conocimiento del campo de regatas', personal: 'Personal', community: 'Base común', mixed: 'Personal + común', modes: ['Memoria personal', 'Base común', 'Personal + común'], saved: 'Pruebas memorizadas', savedHelp: 'briefings guardados con datos meteorológicos', returns: 'Datos reales', returnsHelp: '1 = indicación · 2–3 = tendencia · 4–6 = confianza media · 7+ = fuerte', common: 'Observaciones comunes', commonHelp: '3–5 = señal · 6–12 = tendencia · 13–25 = buena confianza', commonCases: 'Casos comunes comparables', commonCasesHelp: 'mismo sector, fuerza y contexto cuando estén disponibles', personalCases: 'Casos personales comparables', personalCasesHelp: 'la similitud de condiciones aumenta el peso del historial', sector: 'Sector mejor documentado', noHistory: 'sin historial todavía', briefings: 'briefing(s)', learns: 'Lo que CoachBrief aprende de tu experiencia', comparing: 'comparando', speedBias: 'Sesgo de fuerza', directionBias: 'Sesgo de dirección', consistency: 'Regularidad', recent: 'Datos recientes', signals: 'Señales de campo recurrentes', notes: 'Notas de campo recientes', noNotes: 'Todavía no hay notas locales guardadas.', commonBase: 'Base común de conocimientos', commonPending: 'El modo común está listo en la interfaz y el modelo de datos. Se alimentará cuando estén conectados la cuenta en la nube y el servicio compartido.', contribute: 'Contribuir anónimamente a la base común', contributeHelp: 'Esta opción se guarda, pero no se envía nada hasta conectar la nube de CoachBrief.', note: 'La puntuación combina cantidad de datos, similitud de condiciones, regularidad y antigüedad. La memoria personal sigue siendo prioritaria. La base común es voluntaria y está separada de tus notas privadas.' },
} as const

function localizedConfidence(score: number, language: Language) {
  const labels = {
    fr: ['signal faible', 'tendance à confirmer', 'confiance moyenne', 'confiance forte'],
    en: ['low signal', 'trend to confirm', 'medium confidence', 'high confidence'],
    it: ['segnale debole', 'tendenza da confermare', 'affidabilità media', 'affidabilità alta'],
    es: ['señal débil', 'tendencia por confirmar', 'confianza media', 'confianza alta'],
  }[language]
  return labels[score >= 75 ? 3 : score >= 58 ? 2 : score >= 35 ? 1 : 0]
}

function signedBias(value: number | null, unit: string, digits = 0) {
  if (value == null) return '—'
  const rendered = digits ? value.toFixed(digits).replace('.', ',') : String(Math.round(value))
  return `${value > 0 ? '+' : ''}${rendered}${unit}`
}

function combinedConfidence(personalScore: number, communityScore: number, hasCommunity: boolean) {
  if (!hasCommunity) return { score: personalScore, label: 'mixte en attente de données communes' }
  const score = Math.round(personalScore * 0.6 + communityScore * 0.4)
  const label = score >= 75 ? 'confiance forte' : score >= 58 ? 'confiance moyenne' : score >= 35 ? 'tendance à confirmer' : 'signal faible'
  return { score, label }
}

export function SiteLearningPanel() {
  const { language } = usePreferences()
  const c = learningCopy[language]
  const { state } = useLocation()
  const request = state as BriefingRequest | null
  const [savedBriefings] = useState(() => loadSavedBriefings())
  const [communityCache] = useState(() => loadCommunityKnowledgeCache())
  const [preferences, setPreferences] = useState(() => loadKnowledgePreferences())
  const [weather, setWeather] = useState<LiveWeatherData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!request?.location || !request.date) {
      setWeather(null)
      return
    }
    let active = true
    setLoading(true)
    fetchWeatherForBriefing(request)
      .then((result) => { if (active) setWeather(result) })
      .catch(() => { if (active) setWeather(null) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [request])

  const profile = useMemo(
    () => request ? buildSiteLearningProfile(savedBriefings, request, weather) : null,
    [request, savedBriefings, weather],
  )
  const personalConfidence = useMemo(
    () => request ? buildPersonalKnowledgeConfidence(savedBriefings, request, weather) : null,
    [request, savedBriefings, weather],
  )
  const communityConfidence = useMemo(
    () => request ? buildCommunityKnowledgeConfidence(communityCache, request, weather) : null,
    [request, communityCache, weather],
  )

  if (!request || !profile || !personalConfidence || !communityConfidence) return null

  const mixed = combinedConfidence(personalConfidence.score, communityConfidence.score, communityConfidence.sampleCount > 0)
  const displayedConfidence = preferences.mode === 'community'
    ? { score: communityConfidence.score, label: localizedConfidence(communityConfidence.score, language) }
    : preferences.mode === 'mixed'
      ? { score: mixed.score, label: localizedConfidence(mixed.score, language) }
      : { score: personalConfidence.score, label: localizedConfidence(personalConfidence.score, language) }

  function changeMode(mode: KnowledgeMode) {
    const next = { ...preferences, mode }
    setPreferences(next)
    saveKnowledgePreferences(next)
  }

  function toggleContribution() {
    const next = { ...preferences, contributeToCommunity: !preferences.contributeToCommunity }
    setPreferences(next)
    saveKnowledgePreferences(next)
  }

  const localizedLessons = (() => {
    const main = {
      fr: profile.contextCount >= 2 ? `${profile.contextCount} manches très comparables existent déjà pour ce secteur, cette force, cette saison et ce créneau horaire.` : profile.situationCount >= 2 ? `${profile.situationCount} manches comparables existent pour le même secteur et la même plage de force.` : profile.realityCount ? `L’historique contient ${profile.realityCount} retour(s) réel(s), mais pas encore assez de cas similaires pour établir un comportement récurrent.` : 'La mémoire locale démarre : enregistrez le briefing puis renseignez le vent réellement observé après la manche.',
      en: profile.contextCount >= 2 ? `${profile.contextCount} highly comparable races already exist for this sector, strength, season and time of day.` : profile.situationCount >= 2 ? `${profile.situationCount} comparable races exist for the same wind sector and strength range.` : profile.realityCount ? `History contains ${profile.realityCount} actual result(s), but not enough similar cases yet to establish recurring behaviour.` : 'Local memory is starting: save the briefing, then enter the wind actually observed after the race.',
      it: profile.contextCount >= 2 ? `Esistono già ${profile.contextCount} prove molto comparabili per settore, intensità, stagione e fascia oraria.` : profile.situationCount >= 2 ? `Esistono ${profile.situationCount} prove comparabili per lo stesso settore e intervallo di vento.` : profile.realityCount ? `Lo storico contiene ${profile.realityCount} riscontro/i reali, ma non abbastanza casi simili per stabilire un comportamento ricorrente.` : 'La memoria locale sta iniziando: salva il briefing e inserisci il vento realmente osservato dopo la prova.',
      es: profile.contextCount >= 2 ? `Ya existen ${profile.contextCount} pruebas muy comparables para este sector, fuerza, estación y franja horaria.` : profile.situationCount >= 2 ? `Existen ${profile.situationCount} pruebas comparables para el mismo sector y rango de viento.` : profile.realityCount ? `El historial contiene ${profile.realityCount} dato(s) real(es), pero todavía no hay suficientes casos similares para establecer un comportamiento recurrente.` : 'La memoria local está empezando: guarda el briefing e introduce el viento realmente observado después de la prueba.',
    }[language]
    const result = [main]
    if (profile.meanSpeedBias != null && profile.realityCount >= 2 && Math.abs(profile.meanSpeedBias) >= .8) result.push({
      fr: `Le vent réel ressort en moyenne ${Math.abs(profile.meanSpeedBias).toFixed(1)} nd ${profile.meanSpeedBias > 0 ? 'plus fort' : 'plus faible'} que le modèle.`,
      en: `Actual wind averages ${Math.abs(profile.meanSpeedBias).toFixed(1)} kt ${profile.meanSpeedBias > 0 ? 'stronger' : 'weaker'} than the model.`,
      it: `Il vento reale risulta in media ${Math.abs(profile.meanSpeedBias).toFixed(1)} nd ${profile.meanSpeedBias > 0 ? 'più forte' : 'più debole'} del modello.`,
      es: `El viento real resulta de media ${Math.abs(profile.meanSpeedBias).toFixed(1)} nd ${profile.meanSpeedBias > 0 ? 'más fuerte' : 'más débil'} que el modelo.`,
    }[language])
    if (profile.meanDirectionBias != null && profile.realityCount >= 2 && Math.abs(profile.meanDirectionBias) >= 8) result.push({
      fr: `La direction réelle ressort en moyenne ${Math.round(Math.abs(profile.meanDirectionBias))}° plus à ${profile.meanDirectionBias > 0 ? 'droite' : 'gauche'} que le modèle.`,
      en: `Actual direction averages ${Math.round(Math.abs(profile.meanDirectionBias))}° farther ${profile.meanDirectionBias > 0 ? 'right' : 'left'} than the model.`,
      it: `La direzione reale risulta in media ${Math.round(Math.abs(profile.meanDirectionBias))}° più a ${profile.meanDirectionBias > 0 ? 'destra' : 'sinistra'} del modello.`,
      es: `La dirección real resulta de media ${Math.round(Math.abs(profile.meanDirectionBias))}° más a la ${profile.meanDirectionBias > 0 ? 'derecha' : 'izquierda'} que el modelo.`,
    }[language])
    return result
  })()

  const signalLabels: Record<string, string> = {
    droite: { fr: 'Bascules / avantage droite', en: 'Shifts / right-side advantage', it: 'Rotazioni / vantaggio destra', es: 'Roles / ventaja derecha' }[language],
    gauche: { fr: 'Bascules / avantage gauche', en: 'Shifts / left-side advantage', it: 'Rotazioni / vantaggio sinistra', es: 'Roles / ventaja izquierda' }[language],
    pression: { fr: 'Zones de pression', en: 'Pressure areas', it: 'Zone di pressione', es: 'Zonas de presión' }[language],
    molle: { fr: 'Molles / dévent', en: 'Lulls / wind shadow', it: 'Buchi / copertura', es: 'Calmas / desvente' }[language],
    thermique: { fr: 'Thermique', en: 'Thermal breeze', it: 'Termica', es: 'Térmica' }[language],
    courant: { fr: 'Courant', en: 'Current', it: 'Corrente', es: 'Corriente' }[language],
    rafale: { fr: 'Rafales / irrégularité', en: 'Gusts / variability', it: 'Raffiche / irregolarità', es: 'Rachas / irregularidad' }[language],
    nuage: { fr: 'Effet des nuages', en: 'Cloud effects', it: 'Effetto delle nuvole', es: 'Efecto de las nubes' }[language],
    vague: { fr: 'État de mer / vagues', en: 'Sea state / waves', it: 'Stato del mare / onde', es: 'Estado del mar / olas' }[language],
  }
  const sectorLabel = ({
    fr: {},
    en: { Nord: 'North', 'Nord-Est': 'North-east', Est: 'East', 'Sud-Est': 'South-east', Sud: 'South', 'Sud-Ouest': 'South-west', Ouest: 'West', 'Nord-Ouest': 'North-west' },
    it: { Nord: 'Nord', 'Nord-Est': 'Nord-est', Est: 'Est', 'Sud-Est': 'Sud-est', Sud: 'Sud', 'Sud-Ouest': 'Sud-ovest', Ouest: 'Ovest', 'Nord-Ouest': 'Nord-ovest' },
    es: { Nord: 'Norte', 'Nord-Est': 'Nordeste', Est: 'Este', 'Sud-Est': 'Sudeste', Sud: 'Sur', 'Sud-Ouest': 'Suroeste', Ouest: 'Oeste', 'Nord-Ouest': 'Noroeste' },
  }[language] as Record<string, string>)[profile.dominantSectorLabel] || profile.dominantSectorLabel

  return <section className="site-learning-panel" aria-labelledby="site-learning-title">
    <div className="site-learning-heading">
      <div>
        <span className="step-label">{c.step}</span>
        <h2 id="site-learning-title"><History size={20} /> {c.title}</h2>
      </div>
      <div className="site-learning-confidence">
        <small>{c.modes[preferences.mode === 'personal' ? 0 : preferences.mode === 'community' ? 1 : 2]}</small>
        <strong>{displayedConfidence.score}/100 · {displayedConfidence.label}</strong>
      </div>
    </div>

    <div className="knowledge-mode-switch" role="group" aria-label={c.source}>
      <button type="button" className={preferences.mode === 'personal' ? 'is-active' : ''} onClick={() => changeMode('personal')}>{c.personal}</button>
      <button type="button" className={preferences.mode === 'community' ? 'is-active' : ''} onClick={() => changeMode('community')}>{c.community}</button>
      <button type="button" className={preferences.mode === 'mixed' ? 'is-active' : ''} onClick={() => changeMode('mixed')}>{c.mixed}</button>
    </div>

    {preferences.mode !== 'community' && <div className="knowledge-score-detail">
      <strong>{localizedConfidence(personalConfidence.score, language)}</strong>
      <span>{personalConfidence.sampleCount} {c.returns.toLowerCase()} · {personalConfidence.situationCount} {c.personalCases.toLowerCase()} · {c.consistency.toLowerCase()} {personalConfidence.consistencyScore}/100</span>
    </div>}
    {preferences.mode !== 'personal' && <div className="knowledge-score-detail is-community">
      <strong>{localizedConfidence(communityConfidence.score, language)}</strong>
      <span>{communityConfidence.sampleCount} {c.common.toLowerCase()} · {communityConfidence.situationCount} {c.commonCases.toLowerCase()} · {c.consistency.toLowerCase()} {communityConfidence.consistencyScore}/100</span>
    </div>}

    <div className="site-learning-metrics">
      {preferences.mode !== 'community' && <>
        <article><History size={17} /><div><small>{c.saved}</small><strong>{profile.savedCount}</strong><span>{c.savedHelp}</span></div></article>
        <article><Gauge size={17} /><div><small>{c.returns}</small><strong>{profile.realityCount}</strong><span>{c.returnsHelp}</span></div></article>
      </>}
      {preferences.mode !== 'personal' && <>
        <article><History size={17} /><div><small>{c.common}</small><strong>{communityConfidence.sampleCount}</strong><span>{c.commonHelp}</span></div></article>
        <article><Gauge size={17} /><div><small>{c.commonCases}</small><strong>{communityConfidence.contextCount || communityConfidence.situationCount}</strong><span>{c.commonCasesHelp}</span></div></article>
      </>}
      <article><Wind size={17} /><div><small>{c.personalCases}</small><strong>{personalConfidence.contextCount || personalConfidence.situationCount}</strong><span>{c.personalCasesHelp}</span></div></article>
      <article><Compass size={17} /><div><small>{c.sector}</small><strong>{sectorLabel}</strong><span>{profile.dominantSectorCount ? `${profile.dominantSectorCount} ${c.briefings}` : c.noHistory}</span></div></article>
    </div>

    {preferences.mode !== 'community' && <div className="site-learning-body">
      <div className="site-learning-lessons">
        <div className="site-learning-subheading"><h3>{c.learns}</h3>{loading && <span><LoaderCircle className="site-learning-spin" size={14} /> {c.comparing}</span>}</div>
        <ul>{localizedLessons.map((lesson) => <li key={lesson}>{lesson}</li>)}</ul>
        {profile.realityCount >= 2 && <div className="site-learning-biases">
          <span>{c.speedBias} <strong>{signedBias(profile.meanSpeedBias, ' nd', 1)}</strong></span>
          <span>{c.directionBias} <strong>{signedBias(profile.meanDirectionBias, '°')}</strong></span>
          <span>{c.consistency} <strong>{personalConfidence.consistencyScore}/100</strong></span>
          <span>{c.recent} <strong>{personalConfidence.recentCount}</strong></span>
        </div>}
        {profile.recurringSignals.length > 0 && <div className="site-learning-signals" aria-label={c.signals}>
          {profile.recurringSignals.map((signal) => <span key={signal.key}>{signalLabels[signal.key] || signal.label} · {signal.count}</span>)}
        </div>}
      </div>

      <aside className="site-learning-notes">
        <h3>{c.notes}</h3>
        {profile.recentNotes.length ? profile.recentNotes.map((note) => <article key={`${note.date}-${note.text}`}><small>{note.date}</small><p>{note.text}</p></article>) : <p className="site-learning-empty">{c.noNotes}</p>}
      </aside>
    </div>}

    {preferences.mode !== 'personal' && <div className="community-knowledge-block">
      <div>
        <h3>{c.commonBase}</h3>
        {communityConfidence.sampleCount > 0
          ? <p>{communityConfidence.sampleCount} {c.common.toLowerCase()} · {communityConfidence.situationCount} {c.commonCases.toLowerCase()}</p>
          : <p>{c.commonPending}</p>}
      </div>
      <label className="community-contribution-toggle">
        <input type="checkbox" checked={preferences.contributeToCommunity} onChange={toggleContribution} />
        <span><strong>{c.contribute}</strong><small>{c.contributeHelp}</small></span>
      </label>
    </div>}

    <p className="site-learning-note">{c.note}</p>
  </section>
}
