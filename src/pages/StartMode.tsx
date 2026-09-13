import { useEffect, useState } from 'react'
import { ArrowLeft, Clock3, Compass, Navigation, Timer, Waves, Wind } from 'lucide-react'
import type { BernotRow, StartModeAdvice, WeatherScenario } from '../bernot'
import type { CoachObservationSignal } from '../observations'
import type { BriefingRequest } from '../types'
import type { LiveWeatherData } from '../weather'
import { ExpressReading } from '../components/ExpressReading'
import { WindShiftRhythm } from '../components/WindShiftRhythm'
import { StartLineAnalysis } from '../components/StartLineAnalysis'
import { IntelligentBriefing } from '../components/IntelligentBriefing'
import type { IntelligentBriefing as IntelligentBriefingData } from '../intelligentBriefing'
import type { TacticalCoherence } from '../tacticalCoherence'
import { AnalysisCoherence } from '../components/AnalysisCoherence'
import './startMode.css'
import { usePreferences } from '../preferences'
import type { TranslationKey } from '../i18n/fr'

type Props = {
  request: BriefingRequest | null
  weather: LiveWeatherData | null
  scenario: WeatherScenario
  rows: BernotRow[]
  advice: StartModeAdvice
  observation: CoachObservationSignal
  intelligentBriefing: IntelligentBriefingData
  coherence: TacticalCoherence
  onBack: () => void
  onReadingsChange: (readings: NonNullable<BriefingRequest['expressReadings']>) => void
  onRequestChange: (request: BriefingRequest) => void
}

function degrees(value: number) { return `${String(Math.round(value)).padStart(3, '0')}°` }
function decimal(value: number) { return value.toFixed(1).replace('.', ',') }

function remainingLabel(request: BriefingRequest | null, now: Date, t: (key: TranslationKey) => string) {
  if (!request?.date || !request.raceTime) return null
  const start = new Date(`${request.date}T${request.raceTime}:00`)
  if (Number.isNaN(start.getTime())) return null
  const minutes = Math.ceil((start.getTime() - now.getTime()) / 60000)
  if (minutes < 0) return t('startPassed')
  if (minutes === 0) return t('startImminent')
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const rest = minutes % 60
  if (days) return `J-${days} · ${hours} h`
  return hours ? `${hours} h ${String(rest).padStart(2, '0')}` : `${rest} min`
}

export function StartMode({ request, weather, scenario, rows, advice, observation, intelligentBriefing, coherence, onBack, onReadingsChange, onRequestChange }: Props) {
  const { t } = usePreferences()
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
  const lineBias = request?.startLineBias === 'Pin' ? 'Pin' : request?.startLineBias === 'Comité' ? t('committee') : t('neutral')
  const offset = Number(request?.windwardOffset)
  const top = rows[0]

  return <main className="start-mode" aria-labelledby="start-mode-title">
    <header className="start-mode-header">
      <div><span>CoachBrief · {t('lastMinute')}</span><h1 id="start-mode-title">{t('startMode')}</h1><p>{request?.location || t('sailingArea')}</p></div>
      <button type="button" onClick={onBack}><ArrowLeft size={20} /> {t('backToBriefing')}</button>
    </header>

    <section className="start-countdown" aria-label={t('raceSchedule')}>
      <div><Clock3 /><small>{t('race')}</small><strong>{request?.raceTime || request?.startTime || '—'}</strong></div>
      {remainingLabel(request, now, t) && <div className="is-countdown" aria-live="polite"><Timer /><small>{t('timeRemaining')}</small><strong>{remainingLabel(request, now, t)}</strong></div>}
    </section>

    <ExpressReading request={request} weather={weather} onChange={onReadingsChange} />
    <WindShiftRhythm readings={request?.expressReadings} />

    <StartLineAnalysis request={request} windDirection={race?.direction ?? scenario.windStart} currentSpeed={currentSpeed} currentDirection={currentDirection} editable onChange={onRequestChange} />

    <section className="start-metrics" aria-label={t('essentialTacticalConditions')}>
      <article className="is-primary"><Wind /><small>{t('averageWind')}</small><strong>{race ? Math.round(race.speed) : Math.round(scenario.raceWindSpeed)} <span>nd</span></strong></article>
      <article><small>{t('gusts')}</small><strong>{race ? Math.round(race.gust) : Math.round(scenario.maxWindSpeed)} nd</strong></article>
      <article><Navigation /><small>{t('direction')}</small><strong>{degrees(race?.direction ?? scenario.windStart)}</strong></article>
      <article><small>{t('rotation')}</small><strong>{Math.abs(rotation) < 2 ? t('stable') : `${rotation > 0 ? t('right') : t('left')} ${Math.abs(Math.round(rotation))}°`}</strong></article>
      <article><small>{t('oscillations')}</small><strong>± {Math.round(scenario.oscillation)}°</strong></article>
      <article><small>{t('favouredLine')}</small><strong>{lineBias}</strong></article>
      <article><Compass /><small>{t('windwardMark')}</small><strong>{Number.isFinite(offset) && offset !== 0 ? `${offset > 0 ? '+' : ''}${Math.round(offset)}° ${offset > 0 ? t('right').toLowerCase() : t('left').toLowerCase()}` : t('neutralAxis')}</strong></article>
      <article><Waves /><small>{t('current')}</small><strong>{currentSpeed != null || currentDirection != null ? `${currentSpeed == null ? `${t('speed')} —` : `${decimal(currentSpeed)} nd`}${currentDirection == null ? '' : ` · ${degrees(currentDirection)}`}` : t('unavailable')}</strong></article>
    </section>

    <section className="start-decisions" aria-label={t('tacticalDecisions')}>
      <article><small>Bernot · {t('preferredSide')}</small><strong>{advice.preferredSide}</strong><span>{t('topStack')} : {top.factor}</span></article>
      <article><small>{t('firstLeg')}</small><strong>{advice.firstLeg}</strong></article>
      <article className="is-risk"><small>{t('mainRisk')}</small><strong>{advice.mainRisk}</strong></article>
    </section>

    <AnalysisCoherence coherence={coherence} compact />

    <section className="start-plan" aria-labelledby="start-plan-title"><h2 id="start-plan-title">{t('startPlan')}</h2><ol>{advice.plan.slice(0, 4).map((item, index) => <li key={`${index}-${item}`}><span>{index + 1}</span><strong>{item}</strong></li>)}</ol></section>
    <IntelligentBriefing briefing={intelligentBriefing} compact />
    <button className="start-back-bottom" type="button" onClick={onBack}><ArrowLeft size={20} /> {t('backToBriefing')}</button>
  </main>
}
