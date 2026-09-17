import { useState } from 'react'
import { Crosshair, Navigation } from 'lucide-react'
import { usePreferences, type Language } from '../preferences'
import { analyseStartLine } from '../startLine'
import type { BriefingRequest } from '../types'
import { CurrentAnalysisPanel } from './CurrentAnalysisPanel'
import './startLineAnalysis.css'

const copy: Record<Language, Record<string, string>> = {
  fr: { title: 'Analyse de la ligne de départ', committee: 'Comité', pin: 'Viseur', latitude: 'Latitude', longitude: 'Longitude', locate: 'Position GPS actuelle', waiting: 'Localisation…', orientation: 'Orientation de la ligne', angle: 'Angle ligne / vent', length: 'Longueur réelle', current: 'Courant (information tactique)', noCurrent: 'Non disponible', help: 'Enregistrez les deux extrémités pour calculer l’avantage géométrique.', neutral: 'Ligne quasiment neutre.', favoured: '{side} favorisé de {distance}, soit environ {boats} longueurs de {boat}.', gpsError: 'Position GPS indisponible. Vérifiez les autorisations.', pure: 'Le courant est affiché à titre tactique uniquement et ne modifie pas ce calcul.' },
  en: { title: 'Start line analysis', committee: 'Committee', pin: 'Pin', latitude: 'Latitude', longitude: 'Longitude', locate: 'Use current GPS position', waiting: 'Locating…', orientation: 'Line bearing', angle: 'Line / wind angle', length: 'Actual length', current: 'Current (tactical information)', noCurrent: 'Unavailable', help: 'Record both ends to calculate the geometric advantage.', neutral: 'Line almost square.', favoured: '{side} favoured by {distance}, approximately {boats} {boat} lengths.', gpsError: 'GPS position unavailable. Check permissions.', pure: 'Current is tactical information only and does not alter this calculation.' },
  it: { title: 'Analisi della linea di partenza', committee: 'Comitato', pin: 'Boa', latitude: 'Latitudine', longitude: 'Longitudine', locate: 'Posizione GPS attuale', waiting: 'Localizzazione…', orientation: 'Orientamento linea', angle: 'Angolo linea / vento', length: 'Lunghezza reale', current: 'Corrente (informazione tattica)', noCurrent: 'Non disponibile', help: 'Registra le due estremità per calcolare il vantaggio geometrico.', neutral: 'Linea quasi neutra.', favoured: '{side} favorito di {distance}, circa {boats} lunghezze di {boat}.', gpsError: 'Posizione GPS non disponibile. Controlla i permessi.', pure: 'La corrente è solo un’informazione tattica e non modifica il calcolo.' },
  es: { title: 'Análisis de la línea de salida', committee: 'Comité', pin: 'Visor', latitude: 'Latitud', longitude: 'Longitud', locate: 'Posición GPS actual', waiting: 'Localizando…', orientation: 'Orientación de línea', angle: 'Ángulo línea / viento', length: 'Longitud real', current: 'Corriente (información táctica)', noCurrent: 'No disponible', help: 'Registra ambos extremos para calcular la ventaja geométrica.', neutral: 'Línea casi neutra.', favoured: '{side} favorecido por {distance}, unas {boats} esloras de {boat}.', gpsError: 'Posición GPS no disponible. Comprueba los permisos.', pure: 'La corriente es solo información táctica y no modifica el cálculo.' },
}

type Props = { request: BriefingRequest | null; windDirection: number; currentSpeed?: number | null; currentDirection?: number | null; editable?: boolean; onChange?: (request: BriefingRequest) => void }
export function StartLineAnalysis({ request, windDirection, currentSpeed, currentDirection, editable = false, onChange }: Props) {
  const { language, locale, length } = usePreferences(); const c = copy[language]
  const [locating, setLocating] = useState<'committee' | 'pin' | null>(null); const [error, setError] = useState('')
  const committee = { latitude: Number(request?.committeeLatitude), longitude: Number(request?.committeeLongitude) }
  const pin = { latitude: Number(request?.pinLatitude), longitude: Number(request?.pinLongitude) }
  const hasBothEnds = Boolean(request?.committeeLatitude?.trim() && request?.committeeLongitude?.trim() && request?.pinLatitude?.trim() && request?.pinLongitude?.trim())
  const analysis = request && hasBothEnds ? analyseStartLine(committee, pin, windDirection, request.boatClass) : null
  const fmt = (value: number, digits = 0) => new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value)
  const text = analysis?.favoured === 'neutral' ? c.neutral : analysis ? c.favoured.replace('{side}', analysis.favoured === 'pin' ? c.pin : c.committee).replace('{distance}', length(analysis.advantageMetres, 0)).replace('{boats}', fmt(analysis.boatLengths)).replace('{boat}', request?.boatClass || '') : c.help
  const update = (key: keyof BriefingRequest, value: string) => request && onChange?.({ ...request, [key]: value })
  const locate = (end: 'committee' | 'pin') => {
    if (!navigator.geolocation || !request) { setError(c.gpsError); return }
    setLocating(end); setError('')
    navigator.geolocation.getCurrentPosition(({ coords }) => { onChange?.({ ...request, [`${end === 'pin' ? 'pin' : 'committee'}Latitude`]: coords.latitude.toFixed(6), [`${end === 'pin' ? 'pin' : 'committee'}Longitude`]: coords.longitude.toFixed(6), [`${end === 'pin' ? 'pin' : 'committee'}Accuracy`]: Math.round(coords.accuracy).toString() }); setLocating(null) }, () => { setError(c.gpsError); setLocating(null) }, { enableHighAccuracy: true, timeout: 10000 })
  }
  return <>
    <section className="start-line-analysis" aria-labelledby="start-line-title"><div className="start-line-heading"><div><span>GPS · {c.pure}</span><h2 id="start-line-title">{c.title}</h2></div><Navigation aria-hidden="true" /></div>
      {editable && <div className="line-inputs">{(['committee', 'pin'] as const).map((end) => <fieldset key={end}><legend>{c[end]}</legend><label>{c.latitude}<input inputMode="decimal" value={end === 'pin' ? request?.pinLatitude || '' : request?.committeeLatitude || ''} onChange={(e) => update(end === 'pin' ? 'pinLatitude' : 'committeeLatitude', e.target.value)} /></label><label>{c.longitude}<input inputMode="decimal" value={end === 'pin' ? request?.pinLongitude || '' : request?.committeeLongitude || ''} onChange={(e) => update(end === 'pin' ? 'pinLongitude' : 'committeeLongitude', e.target.value)} /></label><button type="button" onClick={() => locate(end)} disabled={locating !== null}><Crosshair size={17} />{locating === end ? c.waiting : c.locate}</button></fieldset>)}</div>}
      {error && <p className="line-error" role="alert">{error}</p>}
      <div className={`line-result${analysis?.favoured === 'neutral' ? ' is-neutral' : ''}`} aria-live="polite"><strong>{text}</strong>{analysis && <div className="line-stats"><span>{c.orientation}<b>{fmt(analysis.orientation)}°</b></span><span>{c.angle}<b>{fmt(analysis.windAngle)}°</b></span><span>{c.length}<b>{length(analysis.lengthMetres, 0)}</b></span></div>}</div>
      {analysis && <div className="line-diagram" role="img" aria-label={`${c.committee}, ${c.pin}, ${text}`}><svg viewBox="0 0 500 180"><defs><marker id="wind-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8Z" fill="currentColor" /></marker></defs><line className="diagram-line" x1="80" y1="125" x2="420" y2="125"/><circle className={analysis.favoured === 'committee' ? 'favoured' : ''} cx="80" cy="125" r="13"/><circle className={analysis.favoured === 'pin' ? 'favoured' : ''} cx="420" cy="125" r="13"/><text x="80" y="158" textAnchor="middle">{c.committee}</text><text x="420" y="158" textAnchor="middle">{c.pin}</text><g style={{ transform: `rotate(${windDirection}deg)`, transformOrigin: '250px 65px' }}><line className="wind-line" x1="250" y1="15" x2="250" y2="92" markerEnd="url(#wind-arrow)"/></g></svg></div>}
      <p className="current-note"><b>{c.current} :</b> {currentSpeed == null && currentDirection == null ? c.noCurrent : `${currentSpeed == null ? '—' : `${fmt(currentSpeed, 1)} nd`}${currentDirection == null ? '' : ` · ${fmt(currentDirection)}°`}`}. {c.pure}</p>
    </section>
    <CurrentAnalysisPanel request={request} />
  </>
}
