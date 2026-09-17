import { useEffect, useMemo, useState } from 'react'
import { Activity, Anchor, Compass, Gauge, LoaderCircle, Waves } from 'lucide-react'
import type { BriefingRequest } from '../types'
import { analyseTidalCurrent, fetchBathymetryCurrentContext } from '../currentAnalysis'
import type { BathymetryCurrentContext, TidalCurrentAnalysis } from '../currentAnalysis'
import { fetchCurrentSeries } from '../currentMarine'
import { shomCurrentAvailability } from '../shomCurrent'
import { fetchShomCurrentSeries } from '../shomCurrentGrid'
import './currentAnalysisPanel.css'

type Props = { request: BriefingRequest | null }
type State = 'idle' | 'loading' | 'ready'
type CurrentSource = 'shom' | 'open-meteo' | 'none'

function clock(value: string | null) {
  if (!value) return '—'
  return value.includes('T') ? value.split('T')[1]?.slice(0, 5) ?? value : value.slice(0, 5)
}
function fmt(value: number | null, digits = 1) { return value == null ? '—' : value.toFixed(digits).replace('.', ',') }
function compass(value: number | null) { return value == null ? '—' : `${String(Math.round(value)).padStart(3, '0')}°` }

export function CurrentAnalysisPanel({ request }: Props) {
  const [state, setState] = useState<State>('idle')
  const [analysis, setAnalysis] = useState<TidalCurrentAnalysis | null>(null)
  const [bathymetry, setBathymetry] = useState<BathymetryCurrentContext | null>(null)
  const [coefficient, setCoefficient] = useState('70')
  const [referenceHighWaterTime, setReferenceHighWaterTime] = useState('')
  const [currentSource, setCurrentSource] = useState<CurrentSource>('none')
  const [sourceNote, setSourceNote] = useState('')
  const latitude = Number(request?.latitude)
  const longitude = Number(request?.longitude)
  const courseAxis = Number(request?.courseAxis)
  const raceTime = request?.raceTime || request?.startTime || '12:00'
  const valid = Boolean(request?.date && Number.isFinite(latitude) && Number.isFinite(longitude))
  const shom = useMemo(() => valid ? shomCurrentAvailability(latitude, longitude) : null, [valid, latitude, longitude])

  useEffect(() => {
    let active = true
    if (!valid || !request) { setState('idle'); setAnalysis(null); setBathymetry(null); setCurrentSource('none'); return }
    setState('loading')

    void (async () => {
      const coefficientValue = Number(coefficient)
      const canUseShom = Boolean(shom?.atlas && referenceHighWaterTime && Number.isFinite(coefficientValue))
      const shomResult = canUseShom
        ? await fetchShomCurrentSeries(latitude, longitude, coefficientValue, referenceHighWaterTime)
        : null
      const hours = shomResult?.hours.length
        ? shomResult.hours
        : await fetchCurrentSeries(latitude, longitude, request.date)
      const source: CurrentSource = shomResult?.hours.length ? 'shom' : hours.length ? 'open-meteo' : 'none'
      const note = shomResult?.hours.length
        ? shomResult.note
        : shomResult?.note || (shom?.atlas
          ? 'Atlas SHOM détecté, mais jeu de données local ou paramètres de marée incomplets : repli Open-Meteo Marine.'
          : 'Courant fourni par Open-Meteo Marine.')
      const current = analyseTidalCurrent(hours, raceTime, Number.isFinite(courseAxis) ? courseAxis : 0, latitude, longitude)
      const bottom = await fetchBathymetryCurrentContext(latitude, longitude, current.raceDirection)
      return { current, bottom, source, note }
    })()
      .then(({ current, bottom, source, note }) => {
        if (!active) return
        setAnalysis(current); setBathymetry(bottom); setCurrentSource(source); setSourceNote(note); setState('ready')
      })
      .catch(() => {
        if (!active) return
        setAnalysis(null); setBathymetry(null); setCurrentSource('none'); setSourceNote('Analyse du courant indisponible.'); setState('ready')
      })
    return () => { active = false }
  }, [valid, request?.date, raceTime, courseAxis, latitude, longitude, coefficient, referenceHighWaterTime, shom?.atlas?.id])

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

    {shom?.atlas && <div className="shom-current-controls">
      <div>
        <strong>Données SHOM fines</strong>
        <p>Renseignez le coefficient du jour et l’heure de pleine mer du port de référence ({shom.atlas.referencePort}). Si les tuiles NetCDF de l’atlas sont présentes dans CoachBrief, elles deviennent prioritaires sur Open-Meteo.</p>
      </div>
      <label>Coefficient<input inputMode="numeric" min="20" max="120" value={coefficient} onChange={(event) => setCoefficient(event.target.value)} /></label>
      <label>PM {shom.atlas.referencePort}<input type="time" value={referenceHighWaterTime} onChange={(event) => setReferenceHighWaterTime(event.target.value)} /></label>
    </div>}

    {state === 'loading' && <div className="current-analysis-loading"><LoaderCircle size={18} className="current-spin" /> Analyse de la phase du courant et des lignes de fond…</div>}
    {state === 'idle' && <p className="current-analysis-empty">Position précise et date nécessaires pour analyser le courant.</p>}
    {state === 'ready' && !analysis && <p className="current-analysis-empty">Courant horaire indisponible pour ce point.</p>}

    {analysis && <>
      <div className="current-source-badge"><strong>{currentSource === 'shom' ? 'Source active : SHOM' : currentSource === 'open-meteo' ? 'Source active : Open-Meteo Marine' : 'Source courant indisponible'}</strong><span>{sourceNote}</span></div>

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

      {shom?.atlas && <div className="current-analysis-bottom">
        <div className="current-analysis-bottom-heading"><Compass size={18} /><strong>Référence SHOM détectée</strong></div>
        <div className="bottom-metrics">
          <span>Atlas <strong>{shom.atlas.label}</strong></span>
          <span>Port de référence <strong>{shom.atlas.referencePort}</strong></span>
          <span>Maille <strong>{shom.atlas.spatialResolution}</strong></span>
          <span>Pas temporel <strong>{shom.atlas.temporalResolution}</strong></span>
        </div>
        <p>{shom.note} Les vecteurs u/v sont interpolés entre les états de référence coefficient 45 et 95 lorsqu’un jeu NetCDF préparé est disponible. La phase est recalée sur l’heure de pleine mer saisie ci-dessus.</p>
        <a href={shom.atlas.productUrl} target="_blank" rel="noreferrer">Ouvrir la fiche de l’atlas SHOM</a>
      </div>}

      <div className="current-source-note">
        <p><strong>Sources :</strong> SHOM NetCDF 2D lorsqu’un atlas préparé est disponible ; sinon Open-Meteo Marine. Bathymétrie : EMODnet DTM.</p>
        <p>Le calcul SHOM convertit les composantes u/v en vitesse et direction, interpole le coefficient entre morte-eau 45 et vive-eau 95 et utilise la phase -6 h / +6 h autour de la pleine mer de référence.</p>
        <p>Les effets du fond restent une lecture tactique indicative : profondeur, frottement, chenaux, pointes et resserrements peuvent modifier localement la vitesse et la direction du courant, à confirmer sur l’eau.</p>
      </div>
    </>}
  </section>
}
