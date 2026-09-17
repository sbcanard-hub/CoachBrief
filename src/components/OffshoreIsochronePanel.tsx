import { useState } from 'react'
import { Clock3, Compass, LoaderCircle, Route } from 'lucide-react'
import type { OffshorePoint } from '../offshore'
import { computeIsochrones, type IsochroneResult } from '../offshoreIsochrone'
import type { PolarTable } from '../offshorePolar'
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
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [result, setResult] = useState<IsochroneResult | null>(null)

  async function run() {
    const departure = new Date(`${departureDate}T${departureTime}:00`)
    if (!departureDate || !departureTime || !Number.isFinite(departure.getTime())) return
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
      <button type="button" className="offshore-add" onClick={() => void run()} disabled={state === 'loading' || !departureDate || !departureTime}>
        {state === 'loading' ? <LoaderCircle size={17} className="current-spin" /> : <Compass size={17} />}
        {state === 'loading' ? 'Calcul des isochrones…' : 'Calculer le routage'}
      </button>
    </div>
    <p className="offshore-help">À chaque pas, CoachBrief recalcule le vent et le courant à la position atteinte, teste plusieurs caps autour de la route directe, applique la polaire du bateau puis conserve les positions les plus prometteuses.</p>
    {state === 'error' && <p className="offshore-analysis-error">Le routage n’a pas pu être calculé avec les données disponibles.</p>}
    {result && <div className="offshore-isochrone-summary">
      <span>Isochrones <strong>{Math.max(0, result.steps.length - 1)}</strong></span>
      <span>Route retenue <strong>{Math.max(0, result.bestRoute.length - 1)} pas</strong></span>
      <span>Arrivée <strong>{result.reached ? fmtTime(result.eta) : 'hors horizon'}</strong></span>
      <p>{result.note}</p>
    </div>}
    <p className="offshore-source">Version actuelle : vent et courant Open-Meteo, polaire active du bateau, recherche par faisceau autour du cap vers l’objectif. Les zones interdites, la terre, la houle pénalisante et les champs SHOM fins seront ajoutés ensuite.</p>
  </section>
}
