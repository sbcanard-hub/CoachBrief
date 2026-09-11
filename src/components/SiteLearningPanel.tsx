import { Compass, Gauge, History, LoaderCircle, Wind } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
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

export function SiteLearningPanel() {
  const { state } = useLocation()
  const request = state as BriefingRequest | null
  const [savedBriefings] = useState(() => loadSavedBriefings())
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

  if (!request || !profile) return null

  return <section className="site-learning-panel" aria-labelledby="site-learning-title">
    <div className="site-learning-heading">
      <div>
        <span className="step-label">Historique local · apprentissage progressif</span>
        <h2 id="site-learning-title"><History size={20} /> Mémoire du plan d’eau</h2>
      </div>
      <div className="site-learning-confidence">
        <small>Confiance historique</small>
        <strong>{profile.confidence}/100 · {profile.confidenceLabel}</strong>
      </div>
    </div>

    <div className="site-learning-metrics">
      <article><History size={17} /><div><small>Manches mémorisées</small><strong>{profile.savedCount}</strong><span>briefings sauvegardés avec météo</span></div></article>
      <article><Gauge size={17} /><div><small>Retours réels</small><strong>{profile.realityCount}</strong><span>manches avec vent réellement renseigné</span></div></article>
      <article><Wind size={17} /><div><small>Cas comparables</small><strong>{profile.contextCount || profile.situationCount}</strong><span>{profile.contextCount ? 'même secteur, force, saison et horaire' : 'même secteur et même plage de force'}</span></div></article>
      <article><Compass size={17} /><div><small>Secteur le plus documenté</small><strong>{profile.dominantSectorLabel}</strong><span>{profile.dominantSectorCount ? `${profile.dominantSectorCount} briefing${profile.dominantSectorCount > 1 ? 's' : ''}` : 'pas encore de recul'}</span></div></article>
    </div>

    <div className="site-learning-body">
      <div className="site-learning-lessons">
        <div className="site-learning-subheading"><h3>Ce que CoachBrief apprend ici</h3>{loading && <span><LoaderCircle className="site-learning-spin" size={14} /> comparaison en cours</span>}</div>
        <ul>{profile.lessons.map((lesson) => <li key={lesson}>{lesson}</li>)}</ul>
        {profile.realityCount >= 2 && <div className="site-learning-biases">
          <span>Biais force <strong>{signedBias(profile.meanSpeedBias, ' nd', 1)}</strong></span>
          <span>Biais direction <strong>{signedBias(profile.meanDirectionBias, '°')}</strong></span>
        </div>}
        {profile.recurringSignals.length > 0 && <div className="site-learning-signals" aria-label="Signaux terrain récurrents">
          {profile.recurringSignals.map((signal) => <span key={signal.key}>{signal.label} · {signal.count}</span>)}
        </div>}
      </div>

      <aside className="site-learning-notes">
        <h3>Notes terrain récentes</h3>
        {profile.recentNotes.length ? profile.recentNotes.map((note) => <article key={`${note.date}-${note.text}`}><small>{note.date}</small><p>{note.text}</p></article>) : <p className="site-learning-empty">Aucune note locale mémorisée pour l’instant.</p>}
      </aside>
    </div>

    <p className="site-learning-note">Cette mémoire est construite uniquement à partir de vos briefings sauvegardés et de vos retours terrain. Elle reste stockée dans ce navigateur ; elle n’est pas présentée comme une vérité météo et ne remplace pas l’observation du jour.</p>
  </section>
}
