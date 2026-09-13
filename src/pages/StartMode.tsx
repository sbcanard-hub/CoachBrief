import { useEffect, useState } from 'react'
import { ArrowLeft, Clock3, Compass, Navigation, Timer, Waves, Wind } from 'lucide-react'
import type { BernotRow, StartModeAdvice, WeatherScenario } from '../bernot'
import type { CoachObservationSignal } from '../observations'
import type { BriefingRequest } from '../types'
import type { LiveWeatherData } from '../weather'
import { ExpressReading } from '../components/ExpressReading'
import './startMode.css'

type Props = {
  request: BriefingRequest | null
  weather: LiveWeatherData | null
  scenario: WeatherScenario
  rows: BernotRow[]
  advice: StartModeAdvice
  observation: CoachObservationSignal
  onBack: () => void
  onReadingsChange: (readings: NonNullable<BriefingRequest['expressReadings']>) => void
}

function degrees(value: number) { return `${String(Math.round(value)).padStart(3, '0')}°` }
function decimal(value: number) { return value.toFixed(1).replace('.', ',') }

function remainingLabel(request: BriefingRequest | null, now: Date) {
  if (!request?.date || !request.raceTime) return null
  const start = new Date(`${request.date}T${request.raceTime}:00`)
  if (Number.isNaN(start.getTime())) return null
  const minutes = Math.ceil((start.getTime() - now.getTime()) / 60000)
  if (minutes < 0) return 'Départ passé'
  if (minutes === 0) return 'Départ imminent'
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const rest = minutes % 60
  if (days) return `J-${days} · ${hours} h`
  return hours ? `${hours} h ${String(rest).padStart(2, '0')}` : `${rest} min`
}

export function StartMode({ request, weather, scenario, rows, advice, observation, onBack, onReadingsChange }: Props) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    document.body.classList.add('start-mode-open')
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => { document.body.classList.remove('start-mode-open'); window.clearInterval(timer) }
  }, [])
  const race = weather?.race
  const rotation = ((scenario.windEnd - scenario.windStart + 540) % 360) - 180
  const currentSpeed = observation.currentVelocity ?? weather?.marine?.currentVelocity
  const currentDirection = observation.currentDirection ?? weather?.marine?.currentDirection
  const lineBias = request?.startLineBias === 'Pin' ? 'Pin' : request?.startLineBias === 'Comité' ? 'Comité' : 'Neutre'
  const offset = Number(request?.windwardOffset)
  const top = rows[0]

  return <main className="start-mode" aria-labelledby="start-mode-title">
    <header className="start-mode-header">
      <div><span>CoachBrief · dernière minute</span><h1 id="start-mode-title">Mode Départ</h1><p>{request?.location || 'Plan d’eau'}</p></div>
      <button type="button" onClick={onBack}><ArrowLeft size={20} /> Retour au briefing</button>
    </header>

    <section className="start-countdown" aria-label="Horaire de la manche">
      <div><Clock3 /><small>Manche</small><strong>{request?.raceTime || request?.startTime || '—'}</strong></div>
      {remainingLabel(request, now) && <div className="is-countdown" aria-live="polite"><Timer /><small>Temps restant</small><strong>{remainingLabel(request, now)}</strong></div>}
    </section>

    <ExpressReading request={request} weather={weather} onChange={onReadingsChange} />

    <section className="start-metrics" aria-label="Conditions tactiques essentielles">
      <article className="is-primary"><Wind /><small>Vent moyen</small><strong>{race ? Math.round(race.speed) : Math.round(scenario.raceWindSpeed)} <span>nd</span></strong></article>
      <article><small>Rafales</small><strong>{race ? Math.round(race.gust) : Math.round(scenario.maxWindSpeed)} nd</strong></article>
      <article><Navigation /><small>Direction</small><strong>{degrees(race?.direction ?? scenario.windStart)}</strong></article>
      <article><small>Rotation</small><strong>{Math.abs(rotation) < 2 ? 'Stable' : `${rotation > 0 ? 'Droite' : 'Gauche'} ${Math.abs(Math.round(rotation))}°`}</strong></article>
      <article><small>Oscillations</small><strong>± {Math.round(scenario.oscillation)}°</strong></article>
      <article><small>Ligne favorable</small><strong>{lineBias}</strong></article>
      <article><Compass /><small>Bouée au vent</small><strong>{Number.isFinite(offset) && offset !== 0 ? `${offset > 0 ? '+' : ''}${Math.round(offset)}° ${offset > 0 ? 'droite' : 'gauche'}` : 'Axe neutre'}</strong></article>
      <article><Waves /><small>Courant</small><strong>{currentSpeed != null || currentDirection != null ? `${currentSpeed == null ? 'Vitesse —' : `${decimal(currentSpeed)} nd`}${currentDirection == null ? '' : ` · ${degrees(currentDirection)}`}` : 'Non disponible'}</strong></article>
    </section>

    <section className="start-decisions" aria-label="Décisions tactiques">
      <article><small>Bernot · côté privilégié</small><strong>{advice.preferredSide}</strong><span>Pile n°1 : {top.factor}</span></article>
      <article><small>Premier bord</small><strong>{advice.firstLeg}</strong></article>
      <article className="is-risk"><small>Risque principal</small><strong>{advice.mainRisk}</strong></article>
    </section>

    <section className="start-plan" aria-labelledby="start-plan-title"><h2 id="start-plan-title">Plan de départ</h2><ol>{advice.plan.slice(0, 4).map((item, index) => <li key={`${index}-${item}`}><span>{index + 1}</span><strong>{item}</strong></li>)}</ol></section>
    <button className="start-back-bottom" type="button" onClick={onBack}><ArrowLeft size={20} /> Retour au briefing</button>
  </main>
}
