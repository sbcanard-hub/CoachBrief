import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { BriefingRequest } from '../types'
import { usePreferences } from '../preferences'
import './raceRoundsPanel.css'

type RaceRound = {
  id: string
  number: number
  time: string
  windSpeed: string
  windDirection: string
  gust: string
  notes: string
  debrief: string
}

type StoredRounds = { activeId: string; rounds: RaceRound[] }

type Props = { request: BriefingRequest }

function raceKey(request: BriefingRequest) {
  const course = request.iodaCourse ? 'IODA' : request.courseType
  return `coachbrief:race-rounds:v1:${request.savedBriefingId || `${request.location}:${request.date}:${request.boatClass}:${course}`}`
}

function firstRound(request: BriefingRequest): RaceRound {
  return {
    id: 'm1', number: 1, time: request.raceTime || request.startTime,
    windSpeed: request.observedWindSpeed || '', windDirection: request.observedWindDirection || '',
    gust: request.observedGust || '', notes: request.observationNotes || '', debrief: '',
  }
}

export function RaceRoundsPanel({ request }: Props) {
  const navigate = useNavigate()
  const { language } = usePreferences()
  const copy = useMemo(() => ({
    fr: { title: 'Manches de la journée', add: 'Ajouter une manche', time: 'Heure de manche', wind: 'Vent observé', direction: 'Direction', gust: 'Rafale', notes: 'Notes de manche', debrief: 'Débrief de la manche', analyse: 'Analyser cette manche', remove: 'Supprimer', hint: 'Le lieu, le parcours, la classe et la météo générale restent communs. Chaque manche conserve ses propres relevés et son débrief.' },
    en: { title: 'Races of the day', add: 'Add race', time: 'Race time', wind: 'Observed wind', direction: 'Direction', gust: 'Gust', notes: 'Race notes', debrief: 'Race debrief', analyse: 'Analyse this race', remove: 'Delete', hint: 'Venue, course, class and general forecast stay shared. Each race keeps its own observations and debrief.' },
    it: { title: 'Prove della giornata', add: 'Aggiungi prova', time: 'Ora della prova', wind: 'Vento osservato', direction: 'Direzione', gust: 'Raffica', notes: 'Note della prova', debrief: 'Debrief della prova', analyse: 'Analizza questa prova', remove: 'Elimina', hint: 'Luogo, percorso, classe e meteo generale restano comuni. Ogni prova conserva rilevamenti e debrief.' },
    es: { title: 'Mangas del día', add: 'Añadir manga', time: 'Hora de la manga', wind: 'Viento observado', direction: 'Dirección', gust: 'Racha', notes: 'Notas de la manga', debrief: 'Debrief de la manga', analyse: 'Analizar esta manga', remove: 'Eliminar', hint: 'Lugar, recorrido, clase y previsión general siguen siendo comunes. Cada manga conserva sus observaciones y debrief.' },
  }[language]), [language])
  const storageKey = useMemo(() => raceKey(request), [request.savedBriefingId, request.location, request.date, request.boatClass, request.courseType, request.iodaCourse])
  const [data, setData] = useState<StoredRounds>(() => ({ activeId: 'm1', rounds: [firstRound(request)] }))

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const parsed = JSON.parse(stored) as StoredRounds
        if (Array.isArray(parsed.rounds) && parsed.rounds.length) {
          setData({ activeId: parsed.activeId || parsed.rounds[0].id, rounds: parsed.rounds })
          return
        }
      }
    } catch { /* local storage unavailable */ }
    setData({ activeId: 'm1', rounds: [firstRound(request)] })
  }, [storageKey])

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(data)) } catch { /* local storage unavailable */ }
  }, [storageKey, data])

  const active = data.rounds.find((round) => round.id === data.activeId) || data.rounds[0]

  function patchActive(patch: Partial<RaceRound>) {
    setData((current) => ({ ...current, rounds: current.rounds.map((round) => round.id === current.activeId ? { ...round, ...patch } : round) }))
  }

  function addRound() {
    setData((current) => {
      const number = Math.max(...current.rounds.map((round) => round.number), 0) + 1
      const round: RaceRound = { id: `m${number}-${Date.now()}`, number, time: active?.time || request.raceTime || request.startTime, windSpeed: '', windDirection: '', gust: '', notes: '', debrief: '' }
      return { activeId: round.id, rounds: [...current.rounds, round] }
    })
  }

  function removeActive() {
    if (data.rounds.length <= 1) return
    setData((current) => {
      const rounds = current.rounds.filter((round) => round.id !== current.activeId)
      return { activeId: rounds[0].id, rounds }
    })
  }

  function analyseRound() {
    if (!active) return
    const next: BriefingRequest = {
      ...request,
      raceTime: active.time || request.raceTime,
      observationTime: active.time || request.observationTime,
      observedWindSpeed: active.windSpeed,
      observedWindDirection: active.windDirection,
      observedGust: active.gust,
      observationNotes: active.notes,
    }
    navigate('/resultats', { replace: true, state: next })
  }

  if (!active) return null

  return <section className="race-rounds" aria-label={copy.title}>
    <div className="race-rounds__head">
      <div><strong>{copy.title}</strong><p>{copy.hint}</p></div>
      <button type="button" className="race-rounds__add" onClick={addRound}><Plus size={16} /> {copy.add}</button>
    </div>
    <div className="race-rounds__tabs" role="tablist">
      {data.rounds.map((round) => <button type="button" role="tab" aria-selected={round.id === data.activeId} className={round.id === data.activeId ? 'is-active' : ''} key={round.id} onClick={() => setData((current) => ({ ...current, activeId: round.id }))}>M{round.number}{round.time ? ` · ${round.time}` : ''}</button>)}
    </div>
    <div className="race-rounds__grid">
      <label><span>{copy.time}</span><input type="time" value={active.time} onChange={(event) => patchActive({ time: event.target.value })} /></label>
      <label><span>{copy.wind}</span><div className="race-rounds__unit"><input inputMode="decimal" value={active.windSpeed} onChange={(event) => patchActive({ windSpeed: event.target.value })} /><span>nd</span></div></label>
      <label><span>{copy.direction}</span><div className="race-rounds__unit"><input inputMode="numeric" value={active.windDirection} onChange={(event) => patchActive({ windDirection: event.target.value })} /><span>°</span></div></label>
      <label><span>{copy.gust}</span><div className="race-rounds__unit"><input inputMode="decimal" value={active.gust} onChange={(event) => patchActive({ gust: event.target.value })} /><span>nd</span></div></label>
    </div>
    <label className="race-rounds__wide"><span>{copy.notes}</span><textarea rows={2} value={active.notes} onChange={(event) => patchActive({ notes: event.target.value })} /></label>
    <label className="race-rounds__wide"><span>{copy.debrief}</span><textarea rows={3} value={active.debrief} onChange={(event) => patchActive({ debrief: event.target.value })} /></label>
    <div className="race-rounds__actions">
      <button type="button" className="primary-action" onClick={analyseRound}>{copy.analyse}</button>
      {data.rounds.length > 1 && <button type="button" className="race-rounds__remove" onClick={removeActive}><Trash2 size={15} /> {copy.remove}</button>}
    </div>
  </section>
}
