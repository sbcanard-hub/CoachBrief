import { useMemo, useRef, useState } from 'react'
import { CalendarDays, Copy, Download, FileUp, FolderOpen, Gauge, MapPin, Navigation, Radio, Sailboat, Save, Trash2, Waves, Wind } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { buildPlanCalibrations, buildSourceReliabilities, calibrationConfidence, signedAngleDelta } from '../calibration'
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

function finalGap(item: SavedBriefing) {
  const forecast = item.weather?.race
  const reality = item.reality
  if (!forecast || !reality) return null
  const actualSpeed = Number(reality.windSpeed)
  const actualDirection = Number(reality.windDirection)
  const speedGap = reality.windSpeed !== '' && Number.isFinite(actualSpeed) ? actualSpeed - forecast.speed : null
  const directionGap = reality.windDirection !== '' && Number.isFinite(actualDirection) ? signedAngleDelta(forecast.direction, actualDirection) : null
  if (speedGap == null && directionGap == null) return null
  return { speedGap, directionGap }
}

function signedGap(value: number | null, unit: string) {
  if (value == null) return '—'
  const rounded = unit === 'nd' ? value.toFixed(1).replace('.0', '') : String(Math.round(value))
  return `${value > 0 ? '+' : ''}${rounded} ${unit}`
}

function directionBiasLabel(value: number | null) {
  if (value == null) return '—'
  if (Math.abs(value) < 1) return 'quasi neutre'
  return `${Math.abs(Math.round(value))}° vers la ${value > 0 ? 'droite' : 'gauche'}`
}

function MiniGapChart({ values, unit, ariaLabel }: { values: number[]; unit: string; ariaLabel: string }) {
  if (!values.length) return <div className="calibration-chart-empty">Pas assez de valeurs</div>
  const limit = Math.max(unit === 'nd' ? 3 : 15, ...values.map((value) => Math.abs(value)))
  const width = 260
  const height = 72
  const middle = height / 2
  const padding = 10
  const step = values.length === 1 ? 0 : (width - padding * 2) / (values.length - 1)
  const points = values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : padding + index * step
    const y = middle - (value / limit) * (middle - 10)
    return { x, y, value }
  })
  return <div className="calibration-chart-wrap">
    <svg className="calibration-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel}>
      <line className="calibration-zero" x1="0" y1={middle} x2={width} y2={middle} />
      {points.length > 1 && <polyline className="calibration-line" points={points.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" />}
      {points.map((point, index) => <circle className="calibration-dot" key={`${point.x}-${index}`} cx={point.x} cy={point.y} r="3.5"><title>{signedGap(point.value, unit)}</title></circle>)}
    </svg>
    <div className="calibration-chart-axis"><span>−</span><span>0</span><span>+</span></div>
  </div>
}

export function SavedBriefingsPage() {
  const navigate = useNavigate()
  const importRef = useRef<HTMLInputElement | null>(null)
  const [items, setItems] = useState(() => loadSavedBriefings())
  const [status, setStatus] = useState('')
  const [editingRealityId, setEditingRealityId] = useState<string | null>(null)
  const [realityDraft, setRealityDraft] = useState<Omit<RaceReality, 'recordedAt'>>(emptyReality)
  const calibrations = useMemo(() => buildPlanCalibrations(items), [items])
  const sourceReliabilities = useMemo(() => buildSourceReliabilities(items), [items])

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
          <p>Retrouvez vos régates, dupliquez une préparation pour la manche suivante et comparez ensuite les différentes sources à ce qui s’est réellement passé sur l’eau.</p>
        </div>
        <div className="saved-briefings-import">
          <input ref={importRef} type="file" accept=".json,application/json" hidden onChange={(event) => void importFile(event.target.files?.[0])} />
          <button type="button" onClick={() => importRef.current?.click()}><FileUp size={16} /> Importer un briefing</button>
        </div>
      </section>

      {status && <p className="saved-briefings-status" role="status">{status}</p>}

      {calibrations.length > 0 && <section className="calibration-section" aria-labelledby="calibration-title">
        <div className="calibration-heading">
          <div><span className="step-label">Apprentissage local</span><h2 id="calibration-title">Calibration par plan d’eau</h2></div>
          <p>Écart entre la prévision sauvegardée et la réalité saisie après la manche. Positif en direction = réalité plus à droite que le modèle.</p>
        </div>
        <div className="calibration-grid">{calibrations.map((calibration) => {
          const speedValues = calibration.samples.flatMap((sample) => sample.speedGap == null ? [] : [sample.speedGap])
          const directionValues = calibration.samples.flatMap((sample) => sample.directionGap == null ? [] : [sample.directionGap])
          return <article className="calibration-card" key={calibration.key}>
            <div className="calibration-card-heading"><div><strong>{calibration.label}</strong><span>{calibration.sampleCount} manche{calibration.sampleCount > 1 ? 's' : ''} terminée{calibration.sampleCount > 1 ? 's' : ''}</span></div><small>{calibrationConfidence(calibration.sampleCount)}</small></div>
            <div className="calibration-metrics">
              <div><small>Biais moyen force</small><strong>{signedGap(calibration.meanSpeedBias, 'nd')}</strong><span>erreur abs. moy. {calibration.meanAbsSpeedError == null ? '—' : `${calibration.meanAbsSpeedError.toFixed(1).replace('.0', '')} nd`}</span></div>
              <div><small>Biais moyen direction</small><strong>{directionBiasLabel(calibration.meanDirectionBias)}</strong><span>erreur abs. moy. {calibration.meanAbsDirectionError == null ? '—' : `${Math.round(calibration.meanAbsDirectionError)}°`}</span></div>
            </div>
            <div className="calibration-charts">
              <div><small>Écart de force · chronologie</small><MiniGapChart values={speedValues} unit="nd" ariaLabel={`Écarts de force à ${calibration.label}`} /></div>
              <div><small>Écart de direction · chronologie</small><MiniGapChart values={directionValues} unit="°" ariaLabel={`Écarts de direction à ${calibration.label}`} /></div>
            </div>
            <p className="calibration-note">Cette calibration générale sert de repli lorsqu’il n’y a pas encore assez de manches dans le même secteur et la même plage de force.</p>
          </article>
        })}</div>
      </section>}

      {sourceReliabilities.length > 0 && <section className="source-reliability-section" aria-labelledby="source-reliability-title">
        <div className="calibration-heading">
          <div><span className="step-label">Qualité des sources</span><h2 id="source-reliability-title">Fiabilité modèle / METAR / coach</h2></div>
          <p>L’erreur absolue moyenne est calculée face à la réalité post-course. Pour le METAR, l’instantané correspond au rapport disponible au moment où le briefing a été sauvegardé.</p>
        </div>
        <div className="source-reliability-plans">{sourceReliabilities.map((entry) => <article className="source-reliability-plan" key={entry.key}>
          <div className="source-reliability-plan-title"><MapPin size={14} /><strong>{entry.label}</strong></div>
          <div className="source-reliability-grid">{entry.metrics.map((metric) => <div className={`source-reliability-card source-${metric.key}`} key={metric.key}>
            <div className="source-reliability-name">{metric.key === 'metar' ? <Radio size={15} /> : metric.key === 'coach' ? <Gauge size={15} /> : <Wind size={15} />}<strong>{metric.label}</strong></div>
            <span>{metric.sampleCount ? `${metric.sampleCount} comparaison${metric.sampleCount > 1 ? 's' : ''}` : 'Pas encore de comparaison'}</span>
            <div className="source-reliability-values">
              <small>Erreur force <strong>{metric.meanAbsSpeedError == null ? '—' : `${metric.meanAbsSpeedError.toFixed(1).replace('.0', '')} nd`}</strong></small>
              <small>Erreur direction <strong>{metric.meanAbsDirectionError == null ? '—' : `${Math.round(metric.meanAbsDirectionError)}°`}</strong></small>
            </div>
            {metric.sampleCount > 0 && <small className="source-reliability-bias">Biais : {signedGap(metric.meanSpeedBias, 'nd')} · {signedGap(metric.meanDirectionBias, '°')}</small>}
            {metric.key === 'metar' && metric.sampleCount === 0 && <small className="source-reliability-bias">Les nouveaux briefings sauvegardés capturent désormais le METAR proche.</small>}
          </div>)}</div>
        </article>)}</div>
      </section>}

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
                <div className="history-title"><Gauge size={15} /><strong>Prévision → METAR → terrain → réalité</strong></div>
                <div className="history-grid">
                  <article><small>Prévision sauvegardée</small><strong>{raceWeather ? windSummary(raceWeather.speed, raceWeather.direction) : '—'}</strong><span>{raceWeather ? `raf. ${Math.round(raceWeather.gust)} nd` : 'Pas d’instantané météo'}</span></article>
                  <article><small>METAR sauvegardé</small><strong>{item.metar ? windSummary(item.metar.windSpeed, item.metar.windDirection) : 'Non capturé'}</strong><span>{item.metar ? `${item.metar.station} · ${Math.round(item.metar.distanceKm)} km${item.metar.reportTime ? ` · ${item.metar.reportTime}` : ''}` : 'Disponible sur les prochaines sauvegardes'}</span></article>
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
