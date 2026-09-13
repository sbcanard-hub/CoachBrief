import { Activity, Navigation } from 'lucide-react'
import { usePreferences, type Language } from '../preferences'
import type { ExpressReading } from '../types'
import { analyzeWindShifts, DEFAULT_SIGNIFICANT_SHIFT_DEGREES } from '../windShiftAnalysis'
import './windShiftRhythm.css'

type Props = { readings?: ExpressReading[] }

const copy = {
  fr: { eyebrow: 'Relevés express', title: 'Rythme des bascules', insufficient: 'Pas encore assez de relevés pour analyser le rythme des bascules.', mean: 'Vent moyen', oscillation: 'Oscillation', sides: 'Écart max. gauche / droite', shifts: 'Bascules détectées', rhythm: 'Rythme moyen', trend: 'Tendance', left: 'rotation lente à gauche', right: 'rotation lente à droite', stable: 'stable', noRhythm: 'pas encore calculable', threshold: 'Seuil significatif', advice: 'Consigne tactique', oscillating: 'jouer les refus / adonnantes', progressive: 'privilégier la tendance', irregular: 'priorité à la pression et à la voie libre', stableAdvice: 'priorité à la pression et à la voie libre', chart: 'Direction du vent dans le temps', average: 'Moyenne' },
  en: { eyebrow: 'Quick readings', title: 'Shift rhythm', insufficient: 'Not enough readings yet to analyse the shift rhythm.', mean: 'Mean wind', oscillation: 'Oscillation', sides: 'Max. left / right deviation', shifts: 'Shifts detected', rhythm: 'Average rhythm', trend: 'Trend', left: 'slow rotation left', right: 'slow rotation right', stable: 'stable', noRhythm: 'not calculable yet', threshold: 'Significant threshold', advice: 'Tactical instruction', oscillating: 'play the headers / lifts', progressive: 'favour the trend', irregular: 'prioritise pressure and a clear lane', stableAdvice: 'prioritise pressure and a clear lane', chart: 'Wind direction over time', average: 'Average' },
  it: { eyebrow: 'Rilievi rapidi', title: 'Ritmo delle oscillazioni', insufficient: 'Non ci sono ancora abbastanza rilievi per analizzare il ritmo delle oscillazioni.', mean: 'Vento medio', oscillation: 'Oscillazione', sides: 'Scarto max. sinistra / destra', shifts: 'Oscillazioni rilevate', rhythm: 'Ritmo medio', trend: 'Tendenza', left: 'rotazione lenta a sinistra', right: 'rotazione lenta a destra', stable: 'stabile', noRhythm: 'non ancora calcolabile', threshold: 'Soglia significativa', advice: 'Indicazione tattica', oscillating: 'giocare rifiuti / buoni', progressive: 'privilegiare la tendenza', irregular: 'priorità alla pressione e alla corsia libera', stableAdvice: 'priorità alla pressione e alla corsia libera', chart: 'Direzione del vento nel tempo', average: 'Media' },
  es: { eyebrow: 'Lecturas rápidas', title: 'Ritmo de los roles', insufficient: 'Aún no hay suficientes lecturas para analizar el ritmo de los roles.', mean: 'Viento medio', oscillation: 'Oscilación', sides: 'Desvío máx. izquierda / derecha', shifts: 'Roles detectados', rhythm: 'Ritmo medio', trend: 'Tendencia', left: 'rotación lenta a la izquierda', right: 'rotación lenta a la derecha', stable: 'estable', noRhythm: 'aún no calculable', threshold: 'Umbral significativo', advice: 'Consigna táctica', oscillating: 'jugar los rechazos / favorecimientos', progressive: 'priorizar la tendencia', irregular: 'prioridad a la presión y a la calle libre', stableAdvice: 'prioridad a la presión y a la calle libre', chart: 'Dirección del viento en el tiempo', average: 'Media' },
} as const

function degrees(value: number) { return `${String(Math.round(((value % 360) + 360) % 360)).padStart(3, '0')}°` }

export function WindShiftRhythm({ readings = [] }: Props) {
  const { language, locale } = usePreferences()
  const c = copy[language as Language]
  const analysis = analyzeWindShifts(readings)
  const times = analysis.points.map((point) => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(point.recordedAt)))
  const values = analysis.points.map((point) => point.unwrappedDirection)
  const low = Math.min(...values, analysis.meanUnwrappedDirection ?? 0) - 3
  const high = Math.max(...values, analysis.meanUnwrappedDirection ?? 0) + 3
  const range = Math.max(10, high - low)
  const chartLow = high - range
  const x = (index: number) => analysis.points.length === 1 ? 50 : 10 + index * 80 / (analysis.points.length - 1)
  const y = (value: number) => 8 + (high - value) / range * 68
  const advice = analysis.pattern ? c[analysis.pattern === 'stable' ? 'stableAdvice' : analysis.pattern] : ''

  return <section className="wind-shift-rhythm" aria-labelledby="wind-shift-title">
    <header><Activity aria-hidden="true" /><div><span>{c.eyebrow}</span><h2 id="wind-shift-title">{c.title}</h2></div></header>
    {!analysis.sufficient ? <p className="wind-shift-empty">{c.insufficient}</p> : <>
      <div className="wind-shift-metrics">
        <article><small>{c.mean}</small><strong>{degrees(analysis.meanDirection!)}</strong></article>
        <article><small>{c.oscillation}</small><strong>±{Math.round(analysis.amplitude!)}°</strong></article>
        <article><small>{c.sides}</small><strong>−{Math.round(analysis.maxLeft!)}° / +{Math.round(analysis.maxRight!)}°</strong></article>
        <article><small>{c.shifts}</small><strong>{analysis.shiftCount}</strong></article>
        <article><small>{c.rhythm}</small><strong>{analysis.averageRhythmMinutes == null ? c.noRhythm : `${Math.round(analysis.averageRhythmMinutes)} min`}</strong></article>
        <article><small>{c.trend}</small><strong>{c[analysis.trend!]}</strong></article>
      </div>
      <div className="wind-shift-chart" role="img" aria-label={c.chart}>
        <svg viewBox="0 0 100 92" preserveAspectRatio="none">
          {[0, .5, 1].map((ratio) => <line key={ratio} className="chart-grid" x1="10" x2="90" y1={8 + ratio * 68} y2={8 + ratio * 68} />)}
          <line className="chart-average" x1="10" x2="90" y1={y(analysis.meanUnwrappedDirection!)} y2={y(analysis.meanUnwrappedDirection!)} />
          <polyline className="chart-direction" points={values.map((value, index) => `${x(index)},${y(value)}`).join(' ')} />
          {values.map((value, index) => <circle className="chart-point" key={`${times[index]}-${index}`} cx={x(index)} cy={y(value)} r="1.8" />)}
        </svg>
        <div className="chart-y"><span>{degrees(high)}</span><span>{degrees(high - range / 2)}</span><span>{degrees(chartLow)}</span></div>
        <div className="chart-x"><time>{times[0]}</time><time>{times.at(-1)}</time></div>
        <div className="chart-legend"><span><i /> {c.average} {degrees(analysis.meanDirection!)}</span><span><Navigation size={13} /> {c.threshold} ≥ {DEFAULT_SIGNIFICANT_SHIFT_DEGREES}°</span></div>
      </div>
      <p className="wind-shift-advice"><small>{c.advice}</small><strong>{advice}</strong></p>
    </>}
  </section>
}
