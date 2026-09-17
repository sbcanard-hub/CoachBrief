import { useMemo, useState } from 'react'
import { Anchor, Clock3, Compass, LoaderCircle, Route } from 'lucide-react'
import type { OffshorePoint } from '../offshore'
import { computeIsochrones, type IsochroneResult } from '../offshoreIsochrone'
import type { PolarTable } from '../offshorePolar'
import { parseHighWaterLines, SHOM_REFERENCE_PORTS, type ShomHighWaterSchedules } from '../shomHighWater'
import './offshoreIsochrone.css'

type Props = {
  start: OffshorePoint
  target: OffshorePoint
  departureDate: string
  departureTime: string
  polar: PolarTable
  onResult: (result: IsochroneResult | null) => void
}

function fmtTime(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date) : '—'
}

export function OffshoreIsochronePanel({ start, target, departureDate, departureTime, polar, onResult }: Props) {
  const [stepMinutes, setStepMinutes] = useState('60')
  const [maxHours, setMaxHours] = useState('48')
  const [tidalCoefficient, setTidalCoefficient] = useState('70')
  const [referenceHighWater, setReferenceHighWater] = useState('')
  const [portHighWaters, setPortHighWaters] = useState<Record<string, string>>({})
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [result, setResult] = useState<IsochroneResult | null>(null)

  const schedules = useMemo<ShomHighWaterSchedules>(() => Object.fromEntries(
    SHOM_REFERENCE_PORTS.map(({ atlasId }) => [atlasId, parseHighWaterLines(portHighWaters[atlasId] ?? '')])
      .filter(([, values]) => values.length > 0),
  ), [portHighWaters])

  async function run() {
    const departure = new Date(`${departureDate}T${departureTime}:00`)
    if (!departureDate || !departureTime || !Number.isFinite(departure.getTime())) return
    const genericHighWater = referenceHighWater ? new Date(referenceHighWater) : null
    const firstScheduled = Object.values(schedules).flat()[0] ?? null
    const highWater = genericHighWater && Number.isFinite(genericHighWater.getTime()) ? genericHighWater : firstScheduled
    const coefficient = Number(tidalCoefficient)
    setState('loading')
    setResult(null)
    onResult(null)
    try {
      const next = await computeIsochrones({
        start,
        target,
        departure,
        polar,
        stepMinutes: Math.max(30, Number(stepMinutes) || 60),
        maxHours: Math.max(6, Number(maxHours) || 48),
        tidalCoefficient: Number.isFinite(coefficient) ? coefficient : null,
        referenceHighWater: highWater,
        referenceHighWaterSchedules: schedules,
      })
      setResult(next)
      onResult(next)
      setState('ready')
    } catch {
      setState('error')
    }
  }

  return <section className="offshore-card offshore-isochrone-card">
    <div className="offshore-card-heading">
      <div><span>05</span><div><small>Routage météo</small><h2>Isochrones</h2></div></div>
      <Route size={24} />
    </div>
    <div className="offshore-isochrone-controls">
      <label><span><Clock3 size={14} /> Pas de temps</span><select value={stepMinutes} onChange={(e) => setStepMinutes(e.target.value)}><option value="30">30 min</option><option value="60">1 h</option><option value="120">2 h</option></select></label>
      <label><span>Horizon</span><select value={maxHours} onChange={(e) => setMaxHours(e.target.value)}><option value="24">24 h</option><option value="48">48 h</option><option value="72">72 h</option><option value="120">5 jours</option></select></label>
      <label><span><Anchor size={14} /> Coefficient marée</span><input type="number" min="20" max="120" value={tidalCoefficient} onChange={(e) => setTidalCoefficient(e.target.value)} /></label>
      <label className="offshore-high-water"><span>PM générique de secours</span><input type="datetime-local" value={referenceHighWater} onChange={(e) => setReferenceHighWater(e.target.value)} /></label>
      <button type="button" className="offshore-add" onClick={() => void run()} disabled={state === 'loading' || !departureDate || !departureTime}>
        {state === 'loading' ? <LoaderCircle size={17} className="current-spin" /> : <Compass size={17} />}
        {state === 'loading' ? 'Calcul des isochrones…' : 'Calculer le routage'}
      </button>
    </div>

    <div className="offshore-shom-schedules">
      <div className="offshore-shom-schedules-title"><Anchor size={16} /><div><strong>Pleines mers par port de référence SHOM</strong><small>Une date/heure par ligne. CoachBrief choisit la PM la plus proche de chaque nœud de routage.</small></div></div>
      <div className="offshore-shom-schedule-grid">
        {SHOM_REFERENCE_PORTS.map(({ atlasId, port }) => <label key={atlasId}>
          <span>{port}</span>
          <textarea
            rows={3}
            value={portHighWaters[atlasId] ?? ''}
            onChange={(e) => setPortHighWaters((current) => ({ ...current, [atlasId]: e.target.value }))}
            placeholder={'2026-09-17T10:25\n2026-09-17T22:48\n2026-09-18T11:10'}
          />
          <small>{schedules[atlasId]?.length ?? 0} PM valide{(schedules[atlasId]?.length ?? 0) > 1 ? 's' : ''}</small>
        </label>)}
      </div>
    </div>

    <p className="offshore-help">À chaque pas, CoachBrief recalcule vent, courant et mer, applique la polaire puis élimine les branches qui coupent une côte détectée. Quand plusieurs pleines mers sont saisies pour Roscoff, Cherbourg ou Saint-Malo, le moteur utilise automatiquement la référence du bon atlas et la PM la plus proche dans le temps. La PM générique ne sert plus que de secours.</p>
    {state === 'error' && <p className="offshore-analysis-error">Le routage n’a pas pu être calculé avec les données disponibles.</p>}
    {result && <div className="offshore-isochrone-summary">
      <span>Isochrones <strong>{Math.max(0, result.steps.length - 1)}</strong></span>
      <span>Route retenue <strong>{Math.max(0, result.bestRoute.length - 1)} pas</strong></span>
      <span>Arrivée <strong>{result.reached ? fmtTime(result.eta) : 'hors horizon'}</strong></span>
      <span>Coupures de terre écartées <strong>{result.blockedLandCandidates}</strong></span>
      <span>Options coupant un TSS <strong>{result.tssCrossingCandidates}</strong></span>
      <span>Échantillons courant SHOM <strong>{result.shomCurrentSamples}</strong></span>
      <span>PM de port utilisées <strong>{result.shomScheduledReferenceSamples}</strong></span>
      <span>PM propagées ~12 h 25 <strong>{result.shomPropagatedReferenceSamples}</strong></span>
      <span>Replis Open-Meteo <strong>{result.fallbackCurrentSamples}</strong></span>
      <span>Atlas SHOM utilisés <strong>{result.shomAtlasLabels.length ? result.shomAtlasLabels.join(' · ') : 'aucun'}</strong></span>
      <p>{result.note}</p>
      <p>{result.constraintsNote}</p>
    </div>}
    <p className="offshore-source">Les PM saisies par port sont prioritaires et évitent de propager artificiellement un même horaire entre Roscoff, Cherbourg et Saint-Malo. Lorsqu’aucune PM locale n’est fournie pour un atlas, le moteur garde le secours semi-diurne d’environ 12 h 25 à partir de la PM générique. Sans tuile SHOM locale, il revient automatiquement au courant Open-Meteo.</p>
  </section>
}
