import { useEffect, useMemo, useState } from 'react'
import { Activity, Anchor, Compass, Gauge, LoaderCircle, Waves } from 'lucide-react'
import type { BriefingRequest } from '../types'
import { analyseTidalCurrent, fetchBathymetryCurrentContext } from '../currentAnalysis'
import type { BathymetryCurrentContext, TidalCurrentAnalysis } from '../currentAnalysis'
import { fetchCurrentSeries } from '../currentMarine'
import './currentAnalysisPanel.css'

type Props = { request: BriefingRequest | null }

type State = 'idle' | 'loading' | 'ready'

function clock(value: string | null) {
  if (!value) return '—'
  return value.includes('T') ? value.split('T')[1]?.slice(0, 5) ?? value : value.slice(0, 5)
}

function fmt(value: number | null, digits = 1) {
  return value == null ? '—' : value.toFixed(digits).replace('.', ',')
}

function compass(value: number | null) {
  if (value == null) return '—'
  return `${String(Math.round(value)).padStart(3, '0')}°`
}

export function CurrentAnalysisPanel({ request }: Props) {
  const [state, setState] = useState<State>('idle')
  const [analysis, setAnalysis] = useState<TidalCurrentAnalysis | null>(null)
  const [bathymetry, setBathymetry] = useState<BathymetryCurrentContext | null>(null)
  const latitude = Number(request?.latitude)
  const longitude = Number(request?.longitude)
  const courseAxis = Number(request?.courseAxis)
  const raceTime = request?.raceTime || request?.startTime || '12:00'
  const valid = Boolean(request?.date && Number.isFinite(latitude) && Number.isFinite(longitude))

  useEffect(() => {
    let active = true
    if (!valid || !request) { setState('idle'); setAnalysis(null); setBathymetry(null); return }
    setState('loading')
    void fetchCurrentSeries(latitude, longitude, request.date)
      .then(async (hours) => {
        const current = analyseTidalCurrent(hours, raceTime, Number.isFinite(courseAxis) ? courseAxis : 0, latitude, longitude)
        const bottom = await fetchBathymetryCurrentContext(latitude, longitude, current.raceDirection)
        return { current, bottom }
      })
      .then(({ current, bottom }) => {
        if (!active) return
        setAnalysis(current)
        setBathymetry(bottom)
        setState('ready')
      })
      .catch(() => {
        if (!active) return
        setAnalysis(null)
        setBathymetry(null)
        setState('ready')
      })
    return () => { active = false }
  }, [valid, request?.date, raceTime, courseAxis, latitude, longitude])

  const importance = useMemo(() => {
    if (!analysis) return 'indéterminée'
    const bathyBonus = bathymetry?.influence === 'fort' ? 2 : bathymetry?.influence === 'modéré' ? 1 : 0
    const score = analysis.tacticalWeight + bathyBonus
    return score >= 7 ? 'forte' : score >= 4 ? 'moyenne' : 'faible'
  }, [analysis, bathymetry])

  return <section className="current-analysis-panel" aria-labelledby="current-analysis-title">
    <div className="current-analysis-heading">
      <div><span className="step-label">Marée · courant · bathymétrie</span><h2 id="current-analysis-title">Analyse tactique du courant</h2></div>
      {analysis && <strong className={`current-importance importance-${importance}`}>Importance {importance}</strong>}
    </div>

    {state === 'loading' && <div className="current-analysis-loading"><LoaderCircle size={18} className="current-spin" /> Analyse de la phase du courant et des lignes de fond…</div>}
    {state === 'idle' && <p className="current-analysis-empty">Position précise et date nécessaires pour analyser le courant.</p>}
    {state === 'ready' && !analysis && <p className="current-analysis-empty">Courant horaire indisponible pour ce point.</p>}

    {analysis && <>
      <div className="current-analysis-metrics">
        <article><Waves size={18} /><div><small>À l’heure de la manche</small><strong>{fmt(analysis.raceSpeed)} nd · {compass(analysis.raceDirection)}</strong><span>{analysis.phase}</span></div></article>
        <article><Activity size={18} /><div><small>Évolution</small><strong>{analysis.trendText}</strong><span>{analysis.maxTime ? `Maximum ≈ ${fmt(analysis.maxSpeed)} nd vers ${clock(analysis.maxTime)}` : 'Maximum non déterminé'}</span></div></article>
        <article><Gauge size={18} /><div><small>Étale / renverse</small><strong>{analysis.nextSlackTime ? `Étale vers ${clock(analysis.nextSlackTime)}` : 'Pas d’étale détectée ensuite'}</strong><span>{analysis.nextReversalTime ? `Renverse vers ${clock(analysis.nextReversalTime)}` : 'Renverse non détectée dans la journée'}</span></div></article>
        <article><Compass size={18} /><div><small>Composante travers parcours</small><strong>{analysis.crossCourse == null ? '—' : `${analysis.crossCourse > 0 ? '+' : ''}${fmt(analysis.crossCourse)} nd`}</strong><span>Permet d’évaluer le côté poussé par le courant.</span></div></article>
      </div>

      <div className="current-analysis-bottom">
        <div className="current-analysis-bottom-heading"><Anchor size={18} /><strong>Influence des lignes de fond</strong></div>
        {!bathymetry?.available && <p>Bathymétrie insuffisante pour comparer les vitesses de courant selon les profondeurs.</p>}
        {bathymetry?.available && <>
          <div className="bottom-metrics">
            <span>Profondeur centre <strong>{fmt(bathymetry.centreDepth, 0)} m</strong></span>
            <span>Zone la moins profonde <strong>{fmt(bathymetry.minDepth, 0)} m</strong></span>
            <span>Zone la plus profonde <strong>{fmt(bathymetry.maxDepth, 0)} m</strong></span>
            <span>Couloir profond vers <strong>{compass(bathymetry.deepestBearing)}</strong></span>
          </div>
          <p><strong>Effet bathymétrique {bathymetry.influence} :</strong> {bathymetry.note}</p>
        </>}
      </div>

      <div className="current-source-note">
        <p><strong>Sources :</strong> courant horaire Open-Meteo Marine ; bathymétrie EMODnet DTM.</p>
        {analysis.shomAtlasRelevant && <p><strong>Zone SHOM détectée :</strong> {analysis.shomRegionLabel}. Le moteur signale cette couverture afin de privilégier à terme les atlas de courants de marée SHOM pour la référence locale fine.</p>}
        <p>Les effets du fond sont présentés comme une lecture tactique indicative : profondeur, frottement, chenaux, pointes et resserrements peuvent modifier localement la vitesse et la direction du courant, mais ils ne remplacent pas une mesure sur l’eau.</p>
      </div>
    </>}
  </section>
}
