import { useRef, useState } from 'react'
import { CalendarDays, Download, FileUp, FolderOpen, MapPin, Sailboat, Trash2, Wind } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  briefingToJson,
  deleteSavedBriefing,
  importSavedBriefing,
  loadSavedBriefings,
  prepareBriefingRestore,
} from '../savedBriefings'
import type { SavedBriefing } from '../savedBriefings'
import './savedBriefings.css'

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

export function SavedBriefingsPage() {
  const navigate = useNavigate()
  const importRef = useRef<HTMLInputElement | null>(null)
  const [items, setItems] = useState(() => loadSavedBriefings())
  const [status, setStatus] = useState('')

  function openBriefing(item: SavedBriefing) {
    prepareBriefingRestore(item)
    navigate('/resultats', { state: item.request })
  }

  function removeBriefing(item: SavedBriefing) {
    if (!window.confirm(`Supprimer « ${item.name} » ?`)) return
    deleteSavedBriefing(item.id)
    setItems(loadSavedBriefings())
    setStatus('Briefing supprimé')
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
          <p>Retrouvez vos régates enregistrées avec leurs paramètres, observations, instantané météo et parcours choisi.</p>
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

              <div className="saved-briefing-actions">
                <button type="button" className="primary" onClick={() => openBriefing(item)}><FolderOpen size={15} /> Ouvrir</button>
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
