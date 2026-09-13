import { useMemo, useState, type FormEvent } from 'react'
import { CloudSun, Gauge, Plus, Trash2, Wind } from 'lucide-react'
import { usePreferences, type Language } from '../preferences'
import type { BriefingRequest, ExpressReading as ExpressReadingData } from '../types'
import type { LiveWeatherData } from '../weather'
import { signedDirectionDelta } from '../observations'
import './expressReading.css'

type Props = {
  request: BriefingRequest | null
  weather: LiveWeatherData | null
  onChange: (readings: ExpressReadingData[]) => void
}

const copy = {
  fr: { title: 'Relevé express', intro: 'Mise à jour terrain rapide', wind: 'Vent observé', direction: 'Direction du vent', gust: 'Rafale observée', current: 'Courant observé', currentDirection: 'Direction du courant', pressure: 'Pression si disponible', clouds: 'Nébulosité', note: 'Note terrain courte', placeholder: 'Risée à droite, clapot…', add: 'Ajouter le relevé', gap: 'Écart par rapport à la prévision', model: 'Modèle', actual: 'Observation réelle', realWind: 'Vent réel', right: 'plus à droite', left: 'plus à gauche', stronger: 'plus fortes que prévu', weaker: 'moins fortes que prévu', similar: 'proches de la prévision', stable: 'stable', rising: 'en hausse', falling: 'en baisse', latest: 'Derniers relevés', empty: 'Aucun relevé pour cette séance.', remove: 'Supprimer ce relevé', at: 'à' },
  en: { title: 'Quick reading', intro: 'Fast on-water update', wind: 'Observed wind', direction: 'Wind direction', gust: 'Observed gust', current: 'Observed current', currentDirection: 'Current direction', pressure: 'Pressure if available', clouds: 'Cloud cover', note: 'Short field note', placeholder: 'More pressure right, chop…', add: 'Add reading', gap: 'Difference from forecast', model: 'Model', actual: 'Actual observation', realWind: 'Actual wind', right: 'further right', left: 'further left', stronger: 'stronger than forecast', weaker: 'weaker than forecast', similar: 'close to forecast', stable: 'steady', rising: 'rising', falling: 'falling', latest: 'Latest readings', empty: 'No reading for this session.', remove: 'Delete this reading', at: 'at' },
  it: { title: 'Rilievo rapido', intro: 'Aggiornamento rapido in acqua', wind: 'Vento osservato', direction: 'Direzione del vento', gust: 'Raffica osservata', current: 'Corrente osservata', currentDirection: 'Direzione corrente', pressure: 'Pressione se disponibile', clouds: 'Nuvolosità', note: 'Nota breve', placeholder: 'Più pressione a destra, onda…', add: 'Aggiungi rilievo', gap: 'Scarto rispetto alla previsione', model: 'Modello', actual: 'Osservazione reale', realWind: 'Vento reale', right: 'più a destra', left: 'più a sinistra', stronger: 'più forti del previsto', weaker: 'meno forti del previsto', similar: 'vicine alla previsione', stable: 'stabile', rising: 'in aumento', falling: 'in calo', latest: 'Ultimi rilievi', empty: 'Nessun rilievo per questa sessione.', remove: 'Elimina questo rilievo', at: 'alle' },
  es: { title: 'Lectura rápida', intro: 'Actualización rápida en el agua', wind: 'Viento observado', direction: 'Dirección del viento', gust: 'Racha observada', current: 'Corriente observada', currentDirection: 'Dirección corriente', pressure: 'Presión si disponible', clouds: 'Nubosidad', note: 'Nota breve', placeholder: 'Más presión a la derecha, ola…', add: 'Añadir lectura', gap: 'Diferencia respecto al pronóstico', model: 'Modelo', actual: 'Observación real', realWind: 'Viento real', right: 'más a la derecha', left: 'más a la izquierda', stronger: 'más fuertes de lo previsto', weaker: 'menos fuertes de lo previsto', similar: 'cerca del pronóstico', stable: 'estable', rising: 'subiendo', falling: 'bajando', latest: 'Últimas lecturas', empty: 'No hay lecturas para esta sesión.', remove: 'Eliminar esta lectura', at: 'a las' },
} as const

const empty = { windSpeed: '', windDirection: '', gust: '', currentSpeed: '', currentDirection: '', pressure: '', cloudCover: '', notes: '' }
function numeric(value: string) { const result = Number(value); return value.trim() !== '' && Number.isFinite(result) ? result : undefined }
function localTime(iso: string, locale: string) { return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) }

export function ExpressReading({ request, weather, onChange }: Props) {
  const { language, locale, units, pressure: formatPressure, pressureUnit } = usePreferences()
  const c = copy[language as Language]
  const [form, setForm] = useState(empty)
  const readings = request?.expressReadings ?? []
  const latest = readings.at(-1)
  const model = weather?.hourly.reduce((best, hour) => {
    if (!latest) return best
    const target = new Date(latest.recordedAt)
    const minutes = target.getHours() * 60 + target.getMinutes()
    const hm = hour.time.split(':').map(Number)
    const gap = Math.abs(hm[0] * 60 + hm[1] - minutes)
    return !best || gap < best.gap ? { hour, gap } : best
  }, undefined as { hour: LiveWeatherData['hourly'][number], gap: number } | undefined)?.hour ?? weather?.race
  const pressureValue = latest ? numeric(latest.pressure) : undefined
  const previousPressure = readings.length > 1 ? numeric(readings.at(-2)?.pressure ?? '') : weather?.race.pressure
  const comparison = useMemo(() => {
    if (!latest || !model) return null
    const speed = numeric(latest.windSpeed), direction = numeric(latest.windDirection), gust = numeric(latest.gust)
    const directionGap = direction == null ? undefined : signedDirectionDelta(model.direction, direction)
    const pressureGap = pressureValue == null || previousPressure == null ? undefined : pressureValue - previousPressure
    return { speed: speed == null ? undefined : speed - model.speed, direction: directionGap, gust: gust == null ? undefined : gust - model.gust, pressure: pressureGap }
  }, [latest, model, pressureValue, previousPressure])

  function set(key: keyof typeof empty, value: string) { setForm((current) => ({ ...current, [key]: value })) }
  function submit(event: FormEvent) {
    event.preventDefault()
    if (!Object.values(form).some((value) => value.trim())) return
    const recordedAt = new Date().toISOString()
    const pressureHpa = numeric(form.pressure)
    const reading: ExpressReadingData = {
      ...form,
      pressure: pressureHpa == null ? '' : String(units === 'imperial' ? pressureHpa / 0.0295299831 : pressureHpa),
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      recordedAt,
    }
    onChange([...readings, reading])
    setForm(empty)
  }
  const input = (key: keyof typeof empty, label: string, suffix: string, min?: number, max?: number) => <label><span>{label}</span><div className="express-input"><input inputMode="decimal" type="number" min={min} max={max} step="0.1" value={form[key]} onChange={(event) => set(key, event.target.value)} /><b>{suffix}</b></div></label>

  return <section className="express-reading" aria-labelledby="express-reading-title">
    <header><div className="express-icon"><Wind aria-hidden="true" /></div><div><span>{c.intro}</span><h2 id="express-reading-title">{c.title}</h2></div></header>
    <form onSubmit={submit}>
      <div className="express-fields">
        {input('windSpeed', c.wind, 'nd', 0)}{input('windDirection', c.direction, '°', 0, 360)}{input('gust', c.gust, 'nd', 0)}
        {input('currentSpeed', c.current, 'nd', 0)}{input('currentDirection', c.currentDirection, '°', 0, 360)}{input('pressure', c.pressure, pressureUnit, 0)}{input('cloudCover', c.clouds, '%', 0, 100)}
        <label className="express-note"><span>{c.note}</span><input maxLength={100} value={form.notes} placeholder={c.placeholder} onChange={(event) => set('notes', event.target.value)} /></label>
      </div>
      <button className="express-add" type="submit"><Plus /> {c.add}</button>
    </form>
    {latest && <div className="express-comparison" aria-live="polite"><div><Gauge /><h3>{c.gap}</h3></div><p className="source-separation"><b>{c.model}</b> {model ? `${model.speed.toFixed(1)} nd · ${Math.round(model.direction)}°` : '—'} <span>≠</span> <b>{c.actual}</b> {numeric(latest.windSpeed) ?? '—'} nd · {numeric(latest.windDirection) ?? '—'}°</p>{comparison && <ul>
      {comparison.speed != null && <li>{c.realWind}: <strong>{comparison.speed >= 0 ? '+' : ''}{comparison.speed.toFixed(1).replace('.', ',')} nd</strong></li>}
      {comparison.direction != null && <li>{c.direction}: <strong>{Math.abs(Math.round(comparison.direction))}° {comparison.direction >= 0 ? c.right : c.left}</strong></li>}
      {comparison.gust != null && <li>{c.gust}: <strong>{Math.abs(comparison.gust) < 1 ? c.similar : comparison.gust > 0 ? c.stronger : c.weaker}</strong></li>}
      {comparison.pressure != null && <li>{c.pressure}: <strong>{Math.abs(comparison.pressure) < 0.8 ? c.stable : comparison.pressure > 0 ? c.rising : c.falling}</strong>{pressureValue != null && <> · {formatPressure(pressureValue)}</>}</li>}
    </ul>}</div>}
    <div className="express-history"><h3><CloudSun /> {c.latest}</h3>{readings.length === 0 ? <p>{c.empty}</p> : <ol>{[...readings].reverse().slice(0, 6).map((reading) => <li key={reading.id}><time dateTime={reading.recordedAt}>{localTime(reading.recordedAt, locale)}</time><span><b>{reading.windSpeed || '—'} nd</b> · {reading.windDirection || '—'}° · raf. {reading.gust || '—'}{reading.notes && <small>{reading.notes}</small>}</span><button type="button" title={c.remove} aria-label={`${c.remove} ${c.at} ${localTime(reading.recordedAt, locale)}`} onClick={() => onChange(readings.filter((item) => item.id !== reading.id))}><Trash2 /></button></li>)}</ol>}</div>
  </section>
}
