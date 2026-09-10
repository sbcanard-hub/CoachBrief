import { useRef, useState } from 'react'
import { CalendarDays, Copy, Download, FileUp, FolderOpen, Gauge, MapPin, Navigation, Sailboat, Save, Trash2, Waves, Wind } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  briefingToJson,
  deleteSavedBriefing,
  importSavedBriefing,
  loadSavedBriefings,
  prepareBriefingRestore,
  saveRaceReality,
} from '../savedBriefings'
import type { RaceReality, SavedBriefing } from '../savedBriefings'
import './savedBriefings.css'

const emptyReality: Omit<RaceReality, 'recordedAt'> = {
  windSpeed: '',
  windDirection: '',
  gust: '',
  waveHeight: '',
  currentSpeed: '',
  currentDirection: '',
  notes: '',
}

function formatSavedAt(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

function safeFileName(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'briefing'
}

function downloadBriefing(item: SavedBriefing) {
  const blob = new Blob([briefingToJson(item)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `coachbrief-${safeFileName(item.name)}.json`
  link.click()
  URL.revokeObjectURL(url)
}

function windSummary(speed: string | number | null | undefined, direction: string | number | null | undefined) {
  const speedValue = Number(speed)
  const directionValue = Number(direction)
  const hasSpeed = speed !== '' && speed != null && Number.isFinite(speedValue)
  const hasDirection = direction !== '' && direction != null && Number.isFinite(directionValue)
  if (!hasSpeed && !hasDirection) return '—'
  return `${hasSpeed ? `${speedValue.toFixed(1).replace('.0', '')} nd` : 'vent —'} · ${hasDirection ? `${String(Math.round(directionValue)).padStart(3, '0')}°` : 'dir. —'}`
}

function signedAngleDelta(from: number, to: number) {
  return ((to - from + 540) % 360) - 180
}

function finalGap(item: SavedBriefing) {
  const forecast = item.weather?.race
  const reality = item.reality
  if (!forecast || !reality) return null
  const actualSpeed = Number(reality.windSpeed)
  const actualDirection = Number(reality.windDirection)
  const speedGap = reality.windSpeed !== '' && Number.isFinite(actualSpeed) ? actualSpeed - forecast.speed : null
  const directionGap = reality.windDirection !== '' && Number.isFinite(actualDirection) ? signedAngleDelta(forecast.direction, actualDirection) : null
  if (speedGap == null && directionGap == null) return null
  return {
    speedGap,
    directionGap,
  }
}

export function SavedBriefingsPage() {
  const navigate = useNavigate()
  const importRef = useRef<HTMLInputElement | null>(null)
  const [items, setItems] = useState(() => loadSavedBriefings())
  const [status, setStatus] = useState('')
  const [editingRealityId, setEditingRealityId] = useState<string | null>(null)
  const [realityDraft, setRealityDraft] = useState<Omit<RaceReality, 'recordedAt'>>(emptyReality)

  function openBriefing(item: SavedBriefing) {
    prepareBriefingRestore(item)
    navigate('/resultats', { state: item.request })
  }

  function duplicateBriefing(item: SavedBriefing) {
    prepareBriefingRestore(item)
    navigate('/', { state: { prefill: item.request, duplicate: true } })
  }

  function removeBriefing(item: SavedBriefing) {
    if (!window.confirm(`Supprimer « ${item.name} » ?`)) return
    deleteSavedBriefing(item.id)
    setItems(loadSavedBriefings())
    setStatus('Briefing supprimé')
  }

  function editReality(item: SavedBriefing) {
    setEditingRealityId(item.id)
    setRealityDraft(item.reality ? {
      windSpeed: item.reality.windSpeed,
      windDirection: item.reality.windDirection,
      gust: item.reality.gust,
      waveHeight: item.reality.waveHeight,
      currentSpeed: item.reality.currentSpeed,
      currentDirection: item.reality.currentDirection,
      notes: item.reality.notes,
    } : emptyReality)
  }

  function updateReality(field: keyof Omit<RaceReality, 'recordedAt'>, value: string) {
    setRealityDraft((current) => ({ ...current, [field]: value }))
  }

  function persistReality(item: SavedBriefing) {
    saveRaceReality(item.id, realityDraft)
    setItems(loadSavedBriefings())
    setEditingRealityId(null)
    setRealityDraft(emptyReality)
    setStatus(`Réalité enregistrée pour « ${item.name} »`)
  }

  async function importFile(file: File | undefined) {
    if (!file) return
    try {
      const imported = importSavedBriefing(await file.text())
      setItems(loadSavedBriefings())
      setStatus(`« ${imported.name} » importé`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Import impossible')
    } finally {
      if (importRef.current) importRef.current.value = ''
    }
  }

  return (
    <main className="saved-briefings-page">
      <section className="saved-briefings-hero">
        <div>
          <span className="step-label">Bibliothèque locale</span>
          <h1>Mes briefings</h1>
          <p>Retrouvez vos régates, dupliquez une préparation pour la manche suivante et comparez ensuite la prévision à ce qui s’est réellement passé sur l’eau.</p>
        </div>
        <div className="saved-briefings-import">
          <input ref={importRef} type="file" accept=".json,application/json" hidden onChange={(event) => void importFile(event.target.files?.[0])} />
          <button type="button" onClick={() => importRef.current?.click()}><FileUp size={16} /> Importer un briefing</button>
        </div>
      </section>

      {status && <p className="saved-briefings-status" role="status">{status}</p>}

      {items.length === 0 ? (
        <section className="saved-briefings-empty">
          <FolderOpen size={28} />
          <h2>Aucun briefing enregistré</h2>
          <p>Préparez une régate puis utilisez « Enregistrer » dans l’en-tête du briefing.</p>
        </section>
      ) : (
        <section className="saved-briefings-grid" aria-label="Briefings enregistrés">
          {items.map((item) => {
            const raceWeather = item.weather?.race
            const gap = finalGap(item)
            const editingReality = editingRealityId === item.id
            return <article className="saved-briefing-card" key={item.id}>
              <div className="saved-briefing-heading">
                <div><span className="step-label">Sauvegardé {formatSavedAt(item.savedAt)}</span><h2>{item.name}</h2></div>
                <span className="saved-course-badge">{item.request.courseType}</span>
              </div>

              <div className="saved-briefing-meta">
                <span><MapPin size={14} /> {item.request.location || 'Lieu non renseigné'}</span>
                <span><CalendarDays size={14} /> {item.request.date || 'Sans date'} · {item.request.raceTime || '—'}</span>
                <span><Sailboat size={14} /> {item.request.boatClass}</span>
                <span><Wind size={14} /> {raceWeather ? `${Math.round(raceWeather.speed)} nd · ${String(Math.round(raceWeather.direction)).padStart(3, '0')}°` : 'Instantané météo indisponible'}</span>
              </div>

              <div className="saved-briefing-course">
                <small>Parcours sauvegardé</small>
                <strong>{item.course?.activeVariantName || 'Tracé automatique'}</strong>
                <span>{item.course ? `${item.course.points.length} points · axe ${String(Math.round(item.course.bearing)).padStart(3, '0')}°` : 'Le tracé sera recalculé à l’ouverture.'}</span>
              </div>

              <div className="history-block">
                <div className="history-title"><Gauge size={15} /><strong>Prévision → terrain → réalité</strong></div>
                <div className="history-grid">
                  <article><small>Prévision sauvegardée</small><strong>{raceWeather ? windSummary(raceWeather.speed, raceWeather.direction) : '—'}</strong><span>{raceWeather ? `raf. ${Math.round(raceWeather.gust)} nd` : 'Pas d’instantané météo'}</span></article>
                  <article><small>Relevé avant départ</small><strong>{windSummary(item.request.observedWindSpeed, item.request.observedWindDirection)}</strong><span>{item.request.observationTime ? `relevé ${item.request.observationTime}` : 'Pas de relevé coach'}</span></article>
                  <article className={item.reality ? 'has-reality' : ''}><small>Réalité de la manche</small><strong>{item.reality ? windSummary(item.reality.windSpeed, item.reality.windDirection) : 'À renseigner'}</strong><span>{item.reality ? `saisie ${formatSavedAt(item.reality.recordedAt)}` : 'Après la course'}</span></article>
                </div>
                {gap && <p className="history-gap">Écart final au modèle : {gap.speedGap == null ? '' : `${gap.speedGap >= 0 ? '+' : ''}${gap.speedGap.toFixed(1).replace('.0', '')} nd`}{gap.speedGap != null && gap.directionGap != null ? ' · ' : ''}{gap.directionGap == null ? '' : `${gap.directionGap >= 0 ? '+' : ''}${Math.round(gap.directionGap)}°`}</p>}
                {item.reality?.notes && <p className="history-note"><strong>Retour coach :</strong> {item.reality.notes}</p>}
              </div>

              {editingReality && <div className="reality-form">
                <div className="reality-form-title"><strong>Réalité de la manche</strong><span>À saisir après la course</span></div>
                <div className="reality-fields">
                  <label><span><Wind size={13} /> Vent</span><div><input type="number" min="0" max="80" step="0.1" value={realityDraft.windSpeed} onChange={(event) => updateReality('windSpeed', event.target.value)} /><small>nd</small></div></label>
                  <label><span><Navigation size={13} /> Direction</span><div><input type="number" min="0" max="359" step="1" value={realityDraft.windDirection} onChange={(event) => updateReality('windDirection', event.target.value)} /><small>°</small></div></label>
                  <label><span><Wind size={13} /> Rafale</span><div><input type="number" min="0" max="100" step="0.1" value={realityDraft.gust} onChange={(event) => updateReality('gust', event.target.value)} /><small>nd</small></div></label>
                  <label><span><Waves size={13} /> Vagues</span><div><input type="number" min="0" max="10" step="0.1" value={realityDraft.waveHeight} onChange={(event) => updateReality('waveHeight', event.target.value)} /><small>m</small></div></label>
                  <label><span><Navigation size={13} /> Courant</span><div><input type="number" min="0" max="8" step="0.1" value={realityDraft.currentSpeed} onChange={(event) => updateReality('currentSpeed', event.target.value)} /><small>nd</small></div></label>
                  <label><span><Navigation size={13} /> Dir. courant</span><div><input type="number" min="0" max="359" step="1" value={realityDraft.currentDirection} onChange={(event) => updateReality('currentDirection', event.target.value)} /><small>°</small></div></label>
                </div>
                <label className="reality-notes"><span>Retour de manche</span><textarea rows={3} value={realityDraft.notes} onChange={(event) => updateReality('notes', event.target.value)} placeholder="ex. droite plus forte que prévu, rotation plus tardive, clapot court au centre…" /></label>
                <div className="reality-form-actions"><button type="button" className="primary" onClick={() => persistReality(item)}><Save size={14} /> Enregistrer la réalité</button><button type="button" onClick={() => setEditingRealityId(null)}>Annuler</button></div>
              </div>}

              <div className="saved-briefing-actions">
                <button type="button" className="primary" onClick={() => openBriefing(item)}><FolderOpen size={15} /> Ouvrir</button>
                <button type="button" onClick={() => duplicateBriefing(item)}><Copy size={15} /> Dupliquer</button>
                <button type="button" onClick={() => editReality(item)}><Gauge size={15} /> {item.reality ? 'Modifier réalité' : 'Ajouter réalité'}</button>
                <button type="button" onClick={() => downloadBriefing(item)}><Download size={15} /> Exporter</button>
                <button type="button" onClick={() => removeBriefing(item)}><Trash2 size={15} /> Supprimer</button>
              </div>
            </article>
          })}
        </section>
      )}
    </main>
  )
}
