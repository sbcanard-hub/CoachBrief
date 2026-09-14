import { CloudDownload, Database, ExternalLink, Trash2, Upload } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { BriefingRequest } from '../types'
import type { LiveWeatherData } from '../weather'
import { analyzeFirstBeat, loadHistoricalRaces, parseTrackingUrl, parseTrackGpx, saveHistoricalRaces, weatherCompatibility } from '../trackingHistory'
import type { HistoricalRace, Lane } from '../trackingHistory'
import { usePreferences } from '../preferences'
import './historicalRaces.css'

const copy = {
  fr: { title: 'Régates similaires et traces historiques', intro: 'Ajoutez un replay public MetaSail ou TracTrac. CoachBrief le rattache à ce plan d’eau et peut analyser son GPX.', link: 'Lien public MetaSail ou TracTrac', windDir: 'Vent réel (°)', windSpeed: 'Force réelle (nd)', add: 'Ajouter la régate', empty: 'Aucune régate externe enregistrée sur ce plan d’eau.', auto: 'Récupérer automatiquement', fetching: 'Récupération de la trace…', autoDone: 'Trace récupérée et analysée automatiquement.', autoUnavailable: 'Aucune trace GPX publique directement récupérable : l’import manuel reste disponible.', gpx: 'Importer le GPX', tracks: 'traces analysées', compatible: 'Météo comparable', different: 'Météo différente', unknown: 'Météo historique à renseigner', analysis: 'Premier près — tendance de passage', thirds: ['1er tiers', '2e tiers', '3e tiers'], remove: 'Supprimer', saved: 'Régate rattachée au plan d’eau.', imported: 'GPX analysé et mémorisé.', caution: 'Tendance historique : à confronter aux observations du jour, au courant et au déplacement réel des bouées.' },
  en: { title: 'Similar races and historical tracks', intro: 'Add a public MetaSail or TracTrac replay. CoachBrief links it to this sailing area and can analyse its GPX.', link: 'Public MetaSail or TracTrac link', windDir: 'Actual wind (°)', windSpeed: 'Actual speed (kt)', add: 'Add race', empty: 'No external race saved for this sailing area.', auto: 'Fetch automatically', fetching: 'Fetching track…', autoDone: 'Track fetched and analysed automatically.', autoUnavailable: 'No directly downloadable public GPX track was found; manual import remains available.', gpx: 'Import GPX', tracks: 'tracks analysed', compatible: 'Comparable weather', different: 'Different weather', unknown: 'Historical weather required', analysis: 'First beat — route tendency', thirds: ['First third', 'Second third', 'Final third'], remove: 'Remove', saved: 'Race linked to sailing area.', imported: 'GPX analysed and saved.', caution: 'Historical tendency: compare with today’s observations, current and actual mark positions.' },
  it: { title: 'Regate simili e tracce storiche', intro: 'Aggiungi un replay pubblico MetaSail o TracTrac. CoachBrief lo collega a questo campo e analizza il GPX.', link: 'Link pubblico MetaSail o TracTrac', windDir: 'Vento reale (°)', windSpeed: 'Intensità reale (nd)', add: 'Aggiungi regata', empty: 'Nessuna regata esterna salvata per questo campo.', auto: 'Recupera automaticamente', fetching: 'Recupero della traccia…', autoDone: 'Traccia recuperata e analizzata automaticamente.', autoUnavailable: 'Nessuna traccia GPX pubblica scaricabile direttamente; resta disponibile l’importazione manuale.', gpx: 'Importa GPX', tracks: 'tracce analizzate', compatible: 'Meteo comparabile', different: 'Meteo diversa', unknown: 'Inserire il meteo storico', analysis: 'Prima bolina — tendenza del percorso', thirds: ['Primo terzo', 'Secondo terzo', 'Terzo finale'], remove: 'Elimina', saved: 'Regata collegata al campo.', imported: 'GPX analizzato e salvato.', caution: 'Tendenza storica: confrontare con osservazioni odierne, corrente e posizione reale delle boe.' },
  es: { title: 'Regatas similares y trazas históricas', intro: 'Añade una repetición pública de MetaSail o TracTrac. CoachBrief la vincula al campo y analiza su GPX.', link: 'Enlace público MetaSail o TracTrac', windDir: 'Viento real (°)', windSpeed: 'Intensidad real (kn)', add: 'Añadir regata', empty: 'No hay regatas externas guardadas para este campo.', auto: 'Recuperar automáticamente', fetching: 'Recuperando la traza…', autoDone: 'Traza recuperada y analizada automáticamente.', autoUnavailable: 'No se encontró una traza GPX pública descargable directamente; queda disponible la importación manual.', gpx: 'Importar GPX', tracks: 'trazas analizadas', compatible: 'Meteorología comparable', different: 'Meteorología diferente', unknown: 'Falta la meteorología histórica', analysis: 'Primera ceñida — tendencia de ruta', thirds: ['Primer tercio', 'Segundo tercio', 'Tercer tercio'], remove: 'Eliminar', saved: 'Regata vinculada al campo.', imported: 'GPX analizado y guardado.', caution: 'Tendencia histórica: compárala con las observaciones de hoy, la corriente y las posiciones reales de las boyas.' },
} as const

const laneCopy: Record<string, Record<Lane, string>> = {
  fr: { left: 'gauche', 'centre-left': 'centre-gauche', centre: 'centre', 'centre-right': 'centre-droit', right: 'droite' },
  en: { left: 'left', 'centre-left': 'centre-left', centre: 'centre', 'centre-right': 'centre-right', right: 'right' },
  it: { left: 'sinistra', 'centre-left': 'centro-sinistra', centre: 'centro', 'centre-right': 'centro-destra', right: 'destra' },
  es: { left: 'izquierda', 'centre-left': 'centro-izquierda', centre: 'centro', 'centre-right': 'centro-derecha', right: 'derecha' },
}

const TRACE_RELAY_URL = 'https://coachbriefrelay.sbcanard.workers.dev'

async function fetchPublicResource(url: string) {
  const response = await fetch(`${TRACE_RELAY_URL}/fetch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  const body = await response.text()
  if (!response.ok) {
    try {
      const payload = JSON.parse(body) as { error?: string }
      throw new Error(payload.error || 'Récupération impossible')
    } catch (error) {
      if (error instanceof SyntaxError) throw new Error('Récupération impossible')
      throw error
    }
  }
  return body
}

function findGpxLink(html: string, sourceUrl: string) {
  const document = new DOMParser().parseFromString(html, 'text/html')
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))
  const candidate = links.find((link) => {
    const value = `${link.href} ${link.textContent || ''}`
    return /(?:\.gpx(?:[?#]|$)|gpx|download.{0,20}(?:track|trace)|export.{0,20}(?:track|trace))/i.test(value)
  })
  if (!candidate) return null
  try {
    return new URL(candidate.getAttribute('href') || '', sourceUrl).href
  } catch {
    return null
  }
}

async function retrievePublicTracks(sourceUrl: string) {
  const firstBody = await fetchPublicResource(sourceUrl)
  if (/<gpx[\s>]/i.test(firstBody)) return parseTrackGpx(firstBody)
  const gpxUrl = findGpxLink(firstBody, sourceUrl)
  if (!gpxUrl) throw new Error('Aucune trace GPX publique détectée')
  return parseTrackGpx(await fetchPublicResource(gpxUrl))
}

function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const y = (bLat - aLat) * 111.32
  const x = (bLon - aLon) * Math.cos(aLat * Math.PI / 180) * 111.32
  return Math.hypot(x, y)
}

export function HistoricalRaces({ request, weather }: { request: BriefingRequest; weather: LiveWeatherData | null }) {
  const { language } = usePreferences()
  const c = copy[language]
  const latitude = Number(request.latitude)
  const longitude = Number(request.longitude)
  const [races, setRaces] = useState(loadHistoricalRaces)
  const [url, setUrl] = useState('')
  const [windDirection, setWindDirection] = useState('')
  const [windSpeed, setWindSpeed] = useState('')
  const [status, setStatus] = useState('')
  const [retrievingId, setRetrievingId] = useState('')
  const localRaces = useMemo(() => races.filter((race) =>
    Number.isFinite(latitude) && Number.isFinite(longitude)
      ? distanceKm(latitude, longitude, race.latitude, race.longitude) <= 12
      : race.location.toLowerCase() === request.location.toLowerCase()), [races, latitude, longitude, request.location])

  function persist(next: HistoricalRace[]) {
    setRaces(next)
    saveHistoricalRaces(next)
  }

  async function retrieveRace(race: HistoricalRace, baseRaces = races) {
    setRetrievingId(race.id)
    setStatus(c.fetching)
    try {
      const tracks = await retrievePublicTracks(race.url)
      persist(baseRaces.map((item) => item.id === race.id ? { ...item, tracks } : item))
      setStatus(`${c.autoDone} ${tracks.length} ${c.tracks}.`)
    } catch {
      setStatus(c.autoUnavailable)
    } finally {
      setRetrievingId('')
    }
  }

  async function addRace() {
    try {
      const parsed = parseTrackingUrl(url)
      const direction = Number(windDirection)
      const speed = Number(windSpeed)
      const race: HistoricalRace = {
        ...parsed,
        id: `${parsed.provider}:${parsed.eventId}:${parsed.raceId || ''}`,
        location: request.location,
        latitude,
        longitude,
        boatClass: request.boatClass,
        windDirection: windDirection !== '' && Number.isFinite(direction) ? direction : undefined,
        windSpeed: windSpeed !== '' && Number.isFinite(speed) ? speed : undefined,
        addedAt: new Date().toISOString(),
      }
      const nextRaces = [race, ...races.filter((item) => item.id !== race.id)]
      persist(nextRaces)
      setUrl('')
      await retrieveRace(race, nextRaces)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Lien invalide')
    }
  }

  async function importGpx(race: HistoricalRace, file?: File) {
    if (!file) return
    try {
      const tracks = parseTrackGpx(await file.text())
      persist(races.map((item) => item.id === race.id ? { ...item, tracks } : item))
      setStatus(`${c.imported} ${tracks.length} ${c.tracks}.`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'GPX invalide')
    }
  }

  const raceDirection = weather?.race.direction ?? Number(request.courseAxis)
  const raceSpeed = weather?.race.speed ?? Number(request.observedWindSpeed)

  return <section className="historical-races" aria-labelledby="historical-races-title">
    <div className="historical-races-heading"><Database size={21} /><div><span className="step-label">MetaSail · TracTrac · GPX</span><h2 id="historical-races-title">{c.title}</h2></div></div>
    <p>{c.intro}</p>
    <div className="historical-race-form">
      <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder={c.link} aria-label={c.link} />
      <input value={windDirection} onChange={(event) => setWindDirection(event.target.value)} inputMode="numeric" placeholder={c.windDir} aria-label={c.windDir} />
      <input value={windSpeed} onChange={(event) => setWindSpeed(event.target.value)} inputMode="decimal" placeholder={c.windSpeed} aria-label={c.windSpeed} />
      <button type="button" onClick={() => void addRace()} disabled={!url.trim() || Boolean(retrievingId)}>{c.add}</button>
    </div>
    {status && <div className="historical-race-status" role="status">{status}</div>}
    {!localRaces.length ? <p className="historical-race-empty">{c.empty}</p> : <div className="historical-race-list">
      {localRaces.map((race) => {
        const compatibility = weatherCompatibility(race, raceDirection, raceSpeed)
        const analysis = race.tracks ? analyzeFirstBeat(race.tracks, Number(request.courseAxis) || raceDirection) : null
        return <article key={race.id}>
          <div className="historical-race-title"><span>{race.provider}</span><strong>{race.title}</strong><a href={race.url} target="_blank" rel="noreferrer" aria-label={race.title}><ExternalLink size={15} /></a></div>
          <div className={`historical-weather is-${compatibility}`}>{compatibility === 'match' ? c.compatible : compatibility === 'different' ? c.different : c.unknown}</div>
          {analysis && <div className="historical-track-analysis"><b>{c.analysis} · {analysis.trackCount} {c.tracks}</b><div>{analysis.lanes.map((lane, index) => <span key={index}><small>{c.thirds[index]}</small><strong>{laneCopy[language][lane]}</strong></span>)}</div></div>}
          <div className="historical-race-actions">
            <button type="button" onClick={() => void retrieveRace(race)} disabled={retrievingId === race.id}><CloudDownload size={14} /> {retrievingId === race.id ? c.fetching : c.auto}</button>
            <label><Upload size={14} /> {c.gpx}<input type="file" accept=".gpx,application/gpx+xml" hidden onChange={(event) => void importGpx(race, event.target.files?.[0])} /></label>
            <button type="button" onClick={() => persist(races.filter((item) => item.id !== race.id))} aria-label={c.remove}><Trash2 size={14} /> {c.remove}</button>
          </div>
        </article>
      })}
    </div>}
    <small className="historical-race-caution">{c.caution}</small>
  </section>
}
