import { History, ShieldCheck } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { findSimilarLocalSituations } from '../localMemory'
import { usePreferences } from '../preferences'
import { loadSavedBriefings } from '../savedBriefings'
import type { BriefingRequest } from '../types'
import type { LiveWeatherData } from '../weather'
import './similarSituations.css'

const copy = {
  fr: { title: 'Situations similaires déjà observées', source: 'Historique local : tendance observée sur des situations similaires.', empty: 'Pas encore assez de données locales pour dégager une tendance fiable.', found: (n: number) => `${n} situations similaires retrouvées`, confidence: 'Niveau de confiance', history: 'Historique du plan d’eau', around: 'autour de', inSimilar: 'Dans des conditions similaires, le vent observé a eu tendance à', stronger: 'renforcer', weaker: 'faiblir', and: 'et à tourner', right: 'vers la droite', left: 'vers la gauche', stable: 'sans écart directionnel net' },
  en: { title: 'Similar situations previously observed', source: 'Local history: trend observed in similar situations.', empty: 'There is not yet enough local data to identify a reliable trend.', found: (n: number) => `${n} similar situations found`, confidence: 'Confidence', history: 'Sailing-area history', around: 'around', inSimilar: 'In similar conditions, observed wind tended to', stronger: 'strengthen', weaker: 'ease', and: 'and turn', right: 'to the right', left: 'to the left', stable: 'with no clear directional bias' },
  it: { title: 'Situazioni simili già osservate', source: 'Storico locale: tendenza osservata in situazioni simili.', empty: 'Non ci sono ancora dati locali sufficienti per una tendenza affidabile.', found: (n: number) => `${n} situazioni simili trovate`, confidence: 'Affidabilità', history: "Storico dell'area di regata", around: 'intorno alle', inSimilar: 'In condizioni simili, il vento osservato ha avuto la tendenza a', stronger: 'rinforzare', weaker: 'calare', and: 'e ruotare', right: 'verso destra', left: 'verso sinistra', stable: 'senza uno scarto direzionale netto' },
  es: { title: 'Situaciones similares ya observadas', source: 'Historial local: tendencia observada en situaciones similares.', empty: 'Todavía no hay suficientes datos locales para establecer una tendencia fiable.', found: (n: number) => `${n} situaciones similares encontradas`, confidence: 'Confianza', history: 'Historial del campo de regatas', around: 'alrededor de las', inSimilar: 'En condiciones similares, el viento observado tendió a', stronger: 'reforzarse', weaker: 'amainar', and: 'y girar', right: 'a la derecha', left: 'a la izquierda', stable: 'sin un sesgo direccional claro' },
} as const

function magnitudeRange(range: [number, number]) {
  const low = Math.min(Math.abs(range[0]), Math.abs(range[1])).toFixed(1).replace('.0', '')
  const high = Math.max(Math.abs(range[0]), Math.abs(range[1])).toFixed(1).replace('.0', '')
  return low === high ? low : `${low}–${high}`
}

export function SimilarSituations({ request, weather }: { request: BriefingRequest; weather: LiveWeatherData | null }) {
  const { language } = usePreferences()
  const labels = copy[language]
  const result = useMemo(() => findSimilarLocalSituations(loadSavedBriefings(), request, weather), [request, weather])
  const enough = result.matches.length >= 2 && (result.speedRange || result.directionRange)
  const speedMean = result.speedRange ? (result.speedRange[0] + result.speedRange[1]) / 2 : 0
  const directionMean = result.directionRange ? (result.directionRange[0] + result.directionRange[1]) / 2 : 0
  const time = request.raceTime || request.startTime
  const confidenceLabel = language === 'fr' ? result.confidence
    : result.confidence === 'bon' ? (language === 'en' ? 'good' : language === 'it' ? 'buona' : 'buena')
      : result.confidence === 'moyen' ? (language === 'en' ? 'medium' : language === 'it' ? 'media' : 'media')
        : (language === 'en' ? 'low' : language === 'it' ? 'bassa' : 'baja')

  return <section className="similar-situations" aria-labelledby="similar-situations-title">
    <div className="similar-situations-heading">
      <div><span className="step-label">{labels.source}</span><h2 id="similar-situations-title"><History size={20} /> {labels.title}</h2></div>
      <Link to="/historique-plan-eau" state={{ water: request }}><History size={15} /> {labels.history}</Link>
    </div>
    {!enough ? <p className="similar-situations-empty">{labels.empty}</p> : <>
      <div className="similar-situations-count"><strong>{labels.found(result.matches.length)}</strong><span><ShieldCheck size={14} /> {labels.confidence} : <b>{confidenceLabel}</b></span></div>
      <p className="similar-situations-summary">{labels.inSimilar}{result.speedRange && Math.abs(speedMean) >= .3 ? ` ${speedMean >= 0 ? labels.stronger : labels.weaker} ${magnitudeRange(result.speedRange)} nd` : ''}{result.speedRange && result.directionRange ? ` ${labels.and}` : result.directionRange ? ` ${labels.and}` : ''}{result.directionRange && Math.abs(directionMean) >= 3 ? ` ${magnitudeRange(result.directionRange)}° ${directionMean >= 0 ? labels.right : labels.left}` : ` ${labels.stable}`}{time ? ` ${labels.around} ${time}` : ''}.</p>
    </>}
    <p className="similar-situations-caution">{labels.source}</p>
  </section>
}
