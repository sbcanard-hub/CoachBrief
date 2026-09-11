import { Compass, Gauge, History, LoaderCircle, Wind } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  buildCommunityKnowledgeConfidence,
  buildPersonalKnowledgeConfidence,
  loadCommunityKnowledgeCache,
} from '../knowledgeConfidence'
import {
  knowledgeModeLabel,
  loadKnowledgePreferences,
  saveKnowledgePreferences,
} from '../knowledgePreferences'
import type { KnowledgeMode } from '../knowledgePreferences'
import { loadSavedBriefings } from '../savedBriefings'
import { buildSiteLearningProfile } from '../siteLearning'
import type { BriefingRequest } from '../types'
import { fetchWeatherForBriefing } from '../weather'
import type { LiveWeatherData } from '../weather'
import './siteLearning.css'

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
    ? { score: communityConfidence.score, label: communityConfidence.label }
    : preferences.mode === 'mixed'
      ? mixed
      : { score: personalConfidence.score, label: personalConfidence.label }

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

  return <section className="site-learning-panel" aria-labelledby="site-learning-title">
    <div className="site-learning-heading">
      <div>
        <span className="step-label">Historique local · apprentissage progressif</span>
        <h2 id="site-learning-title"><History size={20} /> Mémoire du plan d’eau</h2>
      </div>
      <div className="site-learning-confidence">
        <small>{knowledgeModeLabel(preferences.mode)}</small>
        <strong>{displayedConfidence.score}/100 · {displayedConfidence.label}</strong>
      </div>
    </div>

    <div className="knowledge-mode-switch" role="group" aria-label="Source de connaissance du plan d’eau">
      <button type="button" className={preferences.mode === 'personal' ? 'is-active' : ''} onClick={() => changeMode('personal')}>Personnel</button>
      <button type="button" className={preferences.mode === 'community' ? 'is-active' : ''} onClick={() => changeMode('community')}>Base commune</button>
      <button type="button" className={preferences.mode === 'mixed' ? 'is-active' : ''} onClick={() => changeMode('mixed')}>Perso + commune</button>
    </div>

    {preferences.mode !== 'community' && <div className="knowledge-score-detail">
      <strong>{personalConfidence.label}</strong>
      <span>{personalConfidence.explanation}</span>
    </div>}
    {preferences.mode !== 'personal' && <div className="knowledge-score-detail is-community">
      <strong>{communityConfidence.label}</strong>
      <span>{communityConfidence.explanation}</span>
    </div>}

    <div className="site-learning-metrics">
      {preferences.mode !== 'community' && <>
        <article><History size={17} /><div><small>Manches mémorisées</small><strong>{profile.savedCount}</strong><span>briefings sauvegardés avec météo</span></div></article>
        <article><Gauge size={17} /><div><small>Retours réels</small><strong>{profile.realityCount}</strong><span>1 = indication · 2–3 = tendance · 4–6 = confiance moyenne · 7+ = forte</span></div></article>
      </>}
      {preferences.mode !== 'personal' && <>
        <article><History size={17} /><div><small>Observations communes</small><strong>{communityConfidence.sampleCount}</strong><span>3–5 = signal · 6–12 = tendance · 13–25 = bonne confiance</span></div></article>
        <article><Gauge size={17} /><div><small>Cas communs comparables</small><strong>{communityConfidence.contextCount || communityConfidence.situationCount}</strong><span>même secteur, force et contexte quand disponibles</span></div></article>
      </>}
      <article><Wind size={17} /><div><small>Cas perso comparables</small><strong>{personalConfidence.contextCount || personalConfidence.situationCount}</strong><span>la similarité des conditions augmente le poids de l’historique</span></div></article>
      <article><Compass size={17} /><div><small>Secteur le plus documenté</small><strong>{profile.dominantSectorLabel}</strong><span>{profile.dominantSectorCount ? `${profile.dominantSectorCount} briefing${profile.dominantSectorCount > 1 ? 's' : ''}` : 'pas encore de recul'}</span></div></article>
    </div>

    {preferences.mode !== 'community' && <div className="site-learning-body">
      <div className="site-learning-lessons">
        <div className="site-learning-subheading"><h3>Ce que CoachBrief apprend de votre expérience</h3>{loading && <span><LoaderCircle className="site-learning-spin" size={14} /> comparaison en cours</span>}</div>
        <ul>{profile.lessons.map((lesson) => <li key={lesson}>{lesson}</li>)}</ul>
        {profile.realityCount >= 2 && <div className="site-learning-biases">
          <span>Biais force <strong>{signedBias(profile.meanSpeedBias, ' nd', 1)}</strong></span>
          <span>Biais direction <strong>{signedBias(profile.meanDirectionBias, '°')}</strong></span>
          <span>Régularité <strong>{personalConfidence.consistencyScore}/100</strong></span>
          <span>Retours récents <strong>{personalConfidence.recentCount}</strong></span>
        </div>}
        {profile.recurringSignals.length > 0 && <div className="site-learning-signals" aria-label="Signaux terrain récurrents">
          {profile.recurringSignals.map((signal) => <span key={signal.key}>{signal.label} · {signal.count}</span>)}
        </div>}
      </div>

      <aside className="site-learning-notes">
        <h3>Notes terrain récentes</h3>
        {profile.recentNotes.length ? profile.recentNotes.map((note) => <article key={`${note.date}-${note.text}`}><small>{note.date}</small><p>{note.text}</p></article>) : <p className="site-learning-empty">Aucune note locale mémorisée pour l’instant.</p>}
      </aside>
    </div>}

    {preferences.mode !== 'personal' && <div className="community-knowledge-block">
      <div>
        <h3>Base commune de connaissances</h3>
        {communityConfidence.sampleCount > 0
          ? <p>{communityConfidence.explanation}</p>
          : <p>Le mode communautaire est prêt dans l’interface et le modèle de données. Il deviendra alimenté automatiquement dès que le compte cloud et le service partagé seront raccordés.</p>}
      </div>
      <label className="community-contribution-toggle">
        <input type="checkbox" checked={preferences.contributeToCommunity} onChange={toggleContribution} />
        <span><strong>Contribuer anonymement à la base commune</strong><small>Ce choix est mémorisé, mais aucun retour n’est envoyé tant que le cloud CoachBrief n’est pas connecté.</small></span>
      </label>
    </div>}

    <p className="site-learning-note">Le score combine nombre de retours, similarité des conditions, régularité et récence. La mémoire personnelle reste prioritaire par défaut. La base commune est opt-in et restera séparée de vos notes privées.</p>
  </section>
}
