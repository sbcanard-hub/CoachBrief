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
  const { t, language } = usePreferences()
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
  const topFactor = ({ fr: { Vent: 'Vent', Courant: 'Courant', Vagues: 'Vagues', 'Relief / côte': 'Relief / côte', Nuages: 'Nuages', Parcours: 'Parcours', Adversaires: 'Adversaires' }, en: { Vent: 'Wind', Courant: 'Current', Vagues: 'Waves', 'Relief / côte': 'Terrain / coast', Nuages: 'Clouds', Parcours: 'Course', Adversaires: 'Competitors' }, it: { Vent: 'Vento', Courant: 'Corrente', Vagues: 'Onde', 'Relief / côte': 'Rilievo / costa', Nuages: 'Nuvole', Parcours: 'Percorso', Adversaires: 'Avversari' }, es: { Vent: 'Viento', Courant: 'Corriente', Vagues: 'Olas', 'Relief / côte': 'Relieve / costa', Nuages: 'Nubes', Parcours: 'Recorrido', Adversaires: 'Rivales' } }[language] as Record<string, string>)[top.factor] || top.factor
  const side = coherence.preferredSide
  const sideLabel = side === 'right' ? t('right').toLowerCase() : side === 'left' ? t('left').toLowerCase() : t('neutral').toLowerCase()
  const localizedAdvice = language === 'fr' ? advice : {
    preferredSide: side === 'neutral' ? ({ en: 'Speed and a clear lane first', it: 'Priorità a velocità e spazio libero', es: 'Prioridad a velocidad y calle libre' }[language]) : `${language === 'en' ? 'Preferred side' : language === 'it' ? 'Lato preferito' : 'Lado preferente'}: ${sideLabel}`,
    firstLeg: side === 'neutral' ? ({ en: 'Keep the first leg open', it: 'Mantieni aperta la prima bolina', es: 'Mantén abierto el primer tramo' }[language]) : `${language === 'en' ? 'Leg towards' : language === 'it' ? 'Bordo verso' : 'Tramo hacia'} ${sideLabel}`,
    mainRisk: scenario.maxWindSpeed - scenario.raceWindSpeed >= 4 ? ({ en: 'Gusts and loss of control', it: 'Raffiche e perdita di controllo', es: 'Rachas y pérdida de control' }[language]) : scenario.oscillation >= 12 ? ({ en: 'Getting trapped by one shift', it: 'Restare chiusi su una rotazione', es: 'Quedar encerrado por un role' }[language]) : ({ en: 'No clear exit from the line', it: 'Uscita dalla linea senza spazio libero', es: 'Salida de línea sin calle libre' }[language]),
    plan: [
      ({ en: 'Start with speed and a clear exit lane', it: 'Partire con velocità e una via di uscita libera', es: 'Salir con velocidad y una vía de escape libre' }[language]),
      side === 'neutral' ? ({ en: 'Keep both sides available on the first leg', it: 'Mantieni disponibili entrambi i lati sulla prima bolina', es: 'Mantén disponibles ambos lados en el primer tramo' }[language]) : `${language === 'en' ? 'Keep an option towards' : language === 'it' ? 'Mantieni un’opzione verso' : 'Mantén una opción hacia'} ${sideLabel}`,
      scenario.oscillation >= 10 ? ({ en: 'Watch the first confirmed shift', it: 'Controlla la prima rotazione confermata', es: 'Vigila el primer role confirmado' }[language]) : ({ en: 'Watch pressure and clear air', it: 'Controlla pressione e aria libera', es: 'Vigila la presión y el viento libre' }[language]),
    ],
  }

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
      <article><small>Bernot · {t('preferredSide')}</small><strong>{localizedAdvice.preferredSide}</strong><span>{t('topStack')} : {topFactor}</span></article>
      <article><small>{t('firstLeg')}</small><strong>{localizedAdvice.firstLeg}</strong></article>
      <article className="is-risk"><small>{t('mainRisk')}</small><strong>{localizedAdvice.mainRisk}</strong></article>
    </section>

    <AnalysisCoherence coherence={coherence} compact />

    <section className="start-plan" aria-labelledby="start-plan-title"><h2 id="start-plan-title">{t('startPlan')}</h2><ol>{localizedAdvice.plan.slice(0, 4).map((item, index) => <li key={`${index}-${item}`}><span>{index + 1}</span><strong>{item}</strong></li>)}</ol></section>
    <IntelligentBriefing briefing={intelligentBriefing} compact />
    <button className="start-back-bottom" type="button" onClick={onBack}><ArrowLeft size={20} /> {t('backToBriefing')}</button>
  </main>
}
