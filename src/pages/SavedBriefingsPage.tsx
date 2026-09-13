import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, Cloud, Copy, Download, FileUp, FolderOpen, Gauge, HardDrive, MapPin, Navigation, Radio, Sailboat, Save, Trash2, Waves, Wind, ClipboardCheck } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { buildPlanCalibrations, buildSourceReliabilities, signedAngleDelta } from '../calibration'
import {
  briefingToJson,
  deleteSavedBriefing,
  importSavedBriefing,
  importCoachBriefData,
  loadSavedBriefings,
  mergeSavedBriefings,
  prepareBriefingRestore,
  requestForSavedBriefing,
  saveExistingBriefing,
  saveRaceReality,
} from '../savedBriefings'
import type { RaceReality, SavedBriefing } from '../savedBriefings'
import { firebaseCloudAdapter } from '../cloudSync'
import { onFirebaseAuthStateChanged, type FirebaseAccount } from '../firebase'
import { exportPortableCoachBriefData } from '../portableData'
import './savedBriefings.css'
import { isSameWater } from '../localMemory'
import type { BriefingRequest } from '../types'
import { usePreferences, type Language } from '../preferences'

const detailCopy = {
  fr: { merged: 'Briefings locaux et cloud réunis', noCloud: 'Aucun briefing cloud pour ce compte', cloudUnavailable: 'Cloud indisponible. Vos briefings locaux restent accessibles.', deletedBoth: 'Briefing supprimé localement et dans le cloud', deletedLocalOnly: 'Briefing supprimé localement, mais pas dans le cloud', deleted: 'Briefing supprimé', realitySaved: 'Réalité enregistrée pour', imported: 'importé', importFail: 'Import impossible', learning: 'Apprentissage local', calibration: 'Calibration par plan d’eau', calibrationIntro: 'Écart entre la prévision sauvegardée et la réalité saisie après la manche. Positif en direction = réalité plus à droite que le modèle.', races: 'manche(s) terminée(s)', speedBias: 'Biais moyen force', directionBias: 'Biais moyen direction', meanError: 'erreur abs. moy.', speedTimeline: 'Écart de force · chronologie', directionTimeline: 'Écart de direction · chronologie', chartEmpty: 'Pas assez de valeurs', fallback: 'Cette calibration générale sert de repli lorsqu’il n’y a pas encore assez de manches dans le même secteur et la même plage de force.', sourceQuality: 'Qualité des sources', reliability: 'Fiabilité modèle / METAR / coach', reliabilityIntro: 'L’erreur absolue moyenne est calculée face à la réalité post-course. Pour le METAR, l’instantané correspond au rapport disponible au moment de la sauvegarde.', comparisons: 'comparaison(s)', noComparison: 'Pas encore de comparaison', speedError: 'Erreur force', directionError: 'Erreur direction', bias: 'Biais', metarNew: 'Les nouveaux briefings sauvegardés capturent désormais le METAR proche.', savedList: 'Briefings enregistrés', saved: 'Sauvegardé', noVenue: 'Lieu non renseigné', noDate: 'Sans date', noWeather: 'Instantané météo indisponible', savedCourse: 'Parcours sauvegardé', automatic: 'Tracé automatique', points: 'points', axis: 'axe', recalculated: 'Le tracé sera recalculé à l’ouverture.', historyFlow: 'Prévision → METAR → terrain → réalité', forecast: 'Prévision sauvegardée', noSnapshot: 'Pas d’instantané météo', savedMetar: 'METAR sauvegardé', notCaptured: 'Non capturé', nextSaves: 'Disponible sur les prochaines sauvegardes', beforeStart: 'Relevé avant départ', reading: 'relevé', noCoach: 'Pas de relevé coach', raceReality: 'Réalité de la manche', toEnter: 'À renseigner', entered: 'saisie', after: 'Après la course', observed: 'Conditions observées', pressure: 'pression', clouds: 'nébulosité', current: 'courant', sea: 'mer', finalGap: 'Écart final au modèle', coachFeedback: 'Retour coach', enterAfter: 'À saisir après la course', wind: 'Vent', direction: 'Direction', gust: 'Rafale', waves: 'Vagues', currentDir: 'Dir. courant', airTemp: 'Temp. air', waterTemp: 'Temp. eau', raceFeedback: 'Retour de manche', placeholder: 'ex. droite plus forte que prévu, rotation plus tardive, clapot court au centre…', saveReality: 'Enregistrer la réalité', cancel: 'Annuler', neutral: 'quasi neutre', right: 'droite', left: 'gauche' },
  en: { merged: 'Local and cloud briefings merged', noCloud: 'No cloud briefing for this account', cloudUnavailable: 'Cloud unavailable. Your local briefings remain accessible.', deletedBoth: 'Briefing deleted locally and from the cloud', deletedLocalOnly: 'Briefing deleted locally, but not from the cloud', deleted: 'Briefing deleted', realitySaved: 'Actual data saved for', imported: 'imported', importFail: 'Import failed', learning: 'Local learning', calibration: 'Calibration by sailing area', calibrationIntro: 'Difference between the saved forecast and post-race actual data. A positive direction value means the actual wind was farther right than the model.', races: 'completed race(s)', speedBias: 'Mean speed bias', directionBias: 'Mean direction bias', meanError: 'mean abs. error', speedTimeline: 'Speed difference · timeline', directionTimeline: 'Direction difference · timeline', chartEmpty: 'Not enough values', fallback: 'This general calibration is used as a fallback until enough races exist in the same wind sector and speed range.', sourceQuality: 'Source quality', reliability: 'Model / METAR / coach reliability', reliabilityIntro: 'Mean absolute error is calculated against post-race reality. For METAR, the snapshot is the report available when the briefing was saved.', comparisons: 'comparison(s)', noComparison: 'No comparison yet', speedError: 'Speed error', directionError: 'Direction error', bias: 'Bias', metarNew: 'Newly saved briefings now capture the nearby METAR.', savedList: 'Saved briefings', saved: 'Saved', noVenue: 'Venue not entered', noDate: 'No date', noWeather: 'Weather snapshot unavailable', savedCourse: 'Saved course', automatic: 'Automatic layout', points: 'points', axis: 'axis', recalculated: 'The layout will be recalculated when opened.', historyFlow: 'Forecast → METAR → field → actual', forecast: 'Saved forecast', noSnapshot: 'No weather snapshot', savedMetar: 'Saved METAR', notCaptured: 'Not captured', nextSaves: 'Available in future saves', beforeStart: 'Pre-start reading', reading: 'reading', noCoach: 'No coach reading', raceReality: 'Race actual data', toEnter: 'To be entered', entered: 'entered', after: 'After the race', observed: 'Observed conditions', pressure: 'pressure', clouds: 'cloud cover', current: 'current', sea: 'sea', finalGap: 'Final difference from model', coachFeedback: 'Coach feedback', enterAfter: 'Enter after the race', wind: 'Wind', direction: 'Direction', gust: 'Gust', waves: 'Waves', currentDir: 'Current dir.', airTemp: 'Air temp.', waterTemp: 'Water temp.', raceFeedback: 'Race feedback', placeholder: 'e.g. right stronger than expected, later rotation, short chop in the centre…', saveReality: 'Save actual data', cancel: 'Cancel', neutral: 'nearly neutral', right: 'right', left: 'left' },
  it: { merged: 'Briefing locali e cloud riuniti', noCloud: 'Nessun briefing cloud per questo account', cloudUnavailable: 'Cloud non disponibile. I briefing locali restano accessibili.', deletedBoth: 'Briefing eliminato localmente e dal cloud', deletedLocalOnly: 'Briefing eliminato localmente, ma non dal cloud', deleted: 'Briefing eliminato', realitySaved: 'Dati reali salvati per', imported: 'importato', importFail: 'Importazione non riuscita', learning: 'Apprendimento locale', calibration: 'Calibrazione per campo di regata', calibrationIntro: 'Differenza tra previsione salvata e dati reali post-regata. Un valore positivo di direzione indica che il vento reale era più a destra del modello.', races: 'prove concluse', speedBias: 'Bias medio intensità', directionBias: 'Bias medio direzione', meanError: 'errore ass. medio', speedTimeline: 'Scarto intensità · cronologia', directionTimeline: 'Scarto direzione · cronologia', chartEmpty: 'Valori insufficienti', fallback: 'Questa calibrazione generale viene usata finché non ci sono abbastanza prove nello stesso settore e intervallo di vento.', sourceQuality: 'Qualità delle fonti', reliability: 'Affidabilità modello / METAR / coach', reliabilityIntro: 'L’errore assoluto medio è calcolato rispetto ai dati reali post-regata. Per METAR, l’istantanea è il rapporto disponibile al salvataggio.', comparisons: 'confronto/i', noComparison: 'Nessun confronto', speedError: 'Errore intensità', directionError: 'Errore direzione', bias: 'Bias', metarNew: 'I nuovi briefing salvati acquisiscono ora il METAR vicino.', savedList: 'Briefing salvati', saved: 'Salvato', noVenue: 'Luogo non inserito', noDate: 'Senza data', noWeather: 'Istantanea meteo non disponibile', savedCourse: 'Percorso salvato', automatic: 'Tracciato automatico', points: 'punti', axis: 'asse', recalculated: 'Il tracciato verrà ricalcolato all’apertura.', historyFlow: 'Previsione → METAR → campo → realtà', forecast: 'Previsione salvata', noSnapshot: 'Nessuna istantanea meteo', savedMetar: 'METAR salvato', notCaptured: 'Non acquisito', nextSaves: 'Disponibile nei prossimi salvataggi', beforeStart: 'Rilievo pre-partenza', reading: 'rilievo', noCoach: 'Nessun rilievo coach', raceReality: 'Dati reali della prova', toEnter: 'Da inserire', entered: 'inserito', after: 'Dopo la prova', observed: 'Condizioni osservate', pressure: 'pressione', clouds: 'nuvolosità', current: 'corrente', sea: 'mare', finalGap: 'Scarto finale dal modello', coachFeedback: 'Commento coach', enterAfter: 'Da inserire dopo la prova', wind: 'Vento', direction: 'Direzione', gust: 'Raffica', waves: 'Onde', currentDir: 'Dir. corrente', airTemp: 'Temp. aria', waterTemp: 'Temp. acqua', raceFeedback: 'Commento sulla prova', placeholder: 'es. destra più forte del previsto, rotazione più tardiva, onda corta al centro…', saveReality: 'Salva dati reali', cancel: 'Annulla', neutral: 'quasi neutra', right: 'destra', left: 'sinistra' },
  es: { merged: 'Briefings locales y de la nube combinados', noCloud: 'No hay briefings en la nube para esta cuenta', cloudUnavailable: 'Nube no disponible. Tus briefings locales siguen accesibles.', deletedBoth: 'Briefing eliminado localmente y de la nube', deletedLocalOnly: 'Briefing eliminado localmente, pero no de la nube', deleted: 'Briefing eliminado', realitySaved: 'Datos reales guardados para', imported: 'importado', importFail: 'No se pudo importar', learning: 'Aprendizaje local', calibration: 'Calibración por campo de regatas', calibrationIntro: 'Diferencia entre la previsión guardada y los datos reales posteriores. Un valor positivo en dirección significa que el viento real estaba más a la derecha que el modelo.', races: 'prueba(s) terminada(s)', speedBias: 'Sesgo medio de fuerza', directionBias: 'Sesgo medio de dirección', meanError: 'error abs. medio', speedTimeline: 'Diferencia de fuerza · cronología', directionTimeline: 'Diferencia de dirección · cronología', chartEmpty: 'Valores insuficientes', fallback: 'Esta calibración general se utiliza hasta que haya suficientes pruebas en el mismo sector y rango de viento.', sourceQuality: 'Calidad de las fuentes', reliability: 'Fiabilidad modelo / METAR / entrenador', reliabilityIntro: 'El error absoluto medio se calcula frente a los datos reales posteriores. Para METAR, la instantánea corresponde al informe disponible al guardar.', comparisons: 'comparación(es)', noComparison: 'Todavía sin comparación', speedError: 'Error de fuerza', directionError: 'Error de dirección', bias: 'Sesgo', metarNew: 'Los nuevos briefings guardados capturan ahora el METAR cercano.', savedList: 'Briefings guardados', saved: 'Guardado', noVenue: 'Lugar no indicado', noDate: 'Sin fecha', noWeather: 'Instantánea meteorológica no disponible', savedCourse: 'Recorrido guardado', automatic: 'Trazado automático', points: 'puntos', axis: 'eje', recalculated: 'El trazado se recalculará al abrirlo.', historyFlow: 'Previsión → METAR → campo → realidad', forecast: 'Previsión guardada', noSnapshot: 'Sin instantánea meteorológica', savedMetar: 'METAR guardado', notCaptured: 'No capturado', nextSaves: 'Disponible en próximas copias', beforeStart: 'Lectura antes de la salida', reading: 'lectura', noCoach: 'Sin lectura del entrenador', raceReality: 'Datos reales de la prueba', toEnter: 'Por introducir', entered: 'introducido', after: 'Después de la prueba', observed: 'Condiciones observadas', pressure: 'presión', clouds: 'nubosidad', current: 'corriente', sea: 'mar', finalGap: 'Diferencia final con el modelo', coachFeedback: 'Comentario del entrenador', enterAfter: 'Introducir después de la prueba', wind: 'Viento', direction: 'Dirección', gust: 'Racha', waves: 'Olas', currentDir: 'Dir. corriente', airTemp: 'Temp. aire', waterTemp: 'Temp. agua', raceFeedback: 'Comentario de la prueba', placeholder: 'p. ej., derecha más fuerte de lo previsto, rotación más tardía, ola corta en el centro…', saveReality: 'Guardar datos reales', cancel: 'Cancelar', neutral: 'casi neutro', right: 'derecha', left: 'izquierda' },
} as const

const libraryCopy = {
  fr: { library: 'Bibliothèque locale et cloud', history: 'Historique du plan d’eau', mine: 'Mes briefings', historyIntro: 'Anciens briefings, conditions observées, écarts et tendances récurrentes. Les autres plans d’eau sont exclus.', intro: 'Retrouvez vos régates sauvegardées sur cet appareil et dans votre espace Firebase privé.', import: 'Importer un briefing', cloudLoading: 'Chargement des briefings cloud…', empty: 'Aucun briefing enregistré', emptyHelp: 'Préparez une régate puis utilisez « Enregistrer » dans l’en-tête du briefing.', open: 'Ouvrir', duplicate: 'Dupliquer', addReality: 'Ajouter réalité', editReality: 'Modifier réalité', export: 'Exporter', remove: 'Supprimer', removeConfirm: (name: string) => `Supprimer « ${name} » ?` },
  en: { library: 'Local and cloud library', history: 'Sailing area history', mine: 'My briefings', historyIntro: 'Past briefings, observed conditions, differences and recurring trends. Other sailing areas are excluded.', intro: 'Find races saved on this device and in your private Firebase space.', import: 'Import a briefing', cloudLoading: 'Loading cloud briefings…', empty: 'No saved briefing', emptyHelp: 'Prepare a race, then use “Save” in the briefing header.', open: 'Open', duplicate: 'Duplicate', addReality: 'Add actual data', editReality: 'Edit actual data', export: 'Export', remove: 'Delete', removeConfirm: (name: string) => `Delete “${name}”?` },
  it: { library: 'Archivio locale e cloud', history: 'Storico del campo di regata', mine: 'I miei briefing', historyIntro: 'Briefing precedenti, condizioni osservate, scarti e tendenze ricorrenti. Gli altri campi di regata sono esclusi.', intro: 'Ritrova le regate salvate su questo dispositivo e nel tuo spazio Firebase privato.', import: 'Importa un briefing', cloudLoading: 'Caricamento briefing cloud…', empty: 'Nessun briefing salvato', emptyHelp: 'Prepara una regata, poi usa “Salva” nell’intestazione del briefing.', open: 'Apri', duplicate: 'Duplica', addReality: 'Aggiungi dati reali', editReality: 'Modifica dati reali', export: 'Esporta', remove: 'Elimina', removeConfirm: (name: string) => `Eliminare “${name}”?` },
  es: { library: 'Biblioteca local y en la nube', history: 'Historial del campo de regatas', mine: 'Mis briefings', historyIntro: 'Briefings anteriores, condiciones observadas, diferencias y tendencias recurrentes. Se excluyen los demás campos de regatas.', intro: 'Consulta las regatas guardadas en este dispositivo y en tu espacio privado de Firebase.', import: 'Importar un briefing', cloudLoading: 'Cargando briefings de la nube…', empty: 'No hay briefings guardados', emptyHelp: 'Prepara una regata y usa “Guardar” en el encabezado del briefing.', open: 'Abrir', duplicate: 'Duplicar', addReality: 'Añadir datos reales', editReality: 'Editar datos reales', export: 'Exportar', remove: 'Eliminar', removeConfirm: (name: string) => `¿Eliminar “${name}”?` },
} as const

const emptyReality: Omit<RaceReality, 'recordedAt'> = {
  windSpeed: '',
  windDirection: '',
  gust: '',
  waveHeight: '',
  currentSpeed: '',
  currentDirection: '',
  pressure: '',
  cloudCover: '',
  airTemperature: '',
  waterTemperature: '',
  notes: '',
}

function formatSavedAt(value: string, locale: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(date)
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

function windSummary(speed: string | number | null | undefined, direction: string | number | null | undefined, language: Language) {
  const speedValue = Number(speed)
  const directionValue = Number(direction)
  const hasSpeed = speed !== '' && speed != null && Number.isFinite(speedValue)
  const hasDirection = direction !== '' && direction != null && Number.isFinite(directionValue)
  if (!hasSpeed && !hasDirection) return '—'
  const wind = { fr: 'vent', en: 'wind', it: 'vento', es: 'viento' }[language]
  return `${hasSpeed ? `${speedValue.toFixed(1).replace('.0', '')} nd` : `${wind} —`} · ${hasDirection ? `${String(Math.round(directionValue)).padStart(3, '0')}°` : 'dir. —'}`
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

function directionBiasLabel(value: number | null, language: Language) {
  const c = detailCopy[language]
  if (value == null) return '—'
  if (Math.abs(value) < 1) return c.neutral
  return `${Math.abs(Math.round(value))}° → ${value > 0 ? c.right : c.left}`
}

function MiniGapChart({ values, unit, ariaLabel, empty }: { values: number[]; unit: string; ariaLabel: string; empty: string }) {
  if (!values.length) return <div className="calibration-chart-empty">{empty}</div>
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
  const { t, language, locale } = usePreferences()
  const c = libraryCopy[language]
  const d = detailCopy[language]
  const navigate = useNavigate()
  const route = useLocation()
  const historyRequest = route.pathname === '/historique-plan-eau'
    ? (route.state as { water?: BriefingRequest } | null)?.water ?? null
    : null
  const importRef = useRef<HTMLInputElement | null>(null)
  const cloudRequestRef = useRef(0)
  const [items, setItems] = useState(() => loadSavedBriefings())
  const [account, setAccount] = useState<FirebaseAccount | null>(null)
  const [cloudIds, setCloudIds] = useState<Set<string>>(() => new Set())
  const [localIds, setLocalIds] = useState<Set<string>>(() => new Set(loadSavedBriefings().map((item) => item.id)))
  const [cloudLoading, setCloudLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [editingRealityId, setEditingRealityId] = useState<string | null>(null)
  const [realityDraft, setRealityDraft] = useState<Omit<RaceReality, 'recordedAt'>>(emptyReality)
  const visibleItems = useMemo(() => historyRequest ? items.filter((item) => isSameWater(item.request, historyRequest)) : items, [historyRequest, items])
  const calibrations = useMemo(() => buildPlanCalibrations(visibleItems), [visibleItems])
  const sourceReliabilities = useMemo(() => buildSourceReliabilities(visibleItems), [visibleItems])
  const calibrationLevel = (count: number) => ({
    fr: count >= 6 ? 'bonne confiance' : count >= 3 ? 'confiance moyenne' : 'premiers retours',
    en: count >= 6 ? 'good confidence' : count >= 3 ? 'medium confidence' : 'early feedback',
    it: count >= 6 ? 'buona affidabilità' : count >= 3 ? 'affidabilità media' : 'primi riscontri',
    es: count >= 6 ? 'buena confianza' : count >= 3 ? 'confianza media' : 'primeros datos',
  }[language])
  const sourceName = (key: 'model' | 'metar' | 'coach') => ({
    fr: { model: 'Modèle Open-Meteo', metar: 'METAR proche', coach: 'Relevé coach' },
    en: { model: 'Open-Meteo model', metar: 'Nearby METAR', coach: 'Coach reading' },
    it: { model: 'Modello Open-Meteo', metar: 'METAR vicino', coach: 'Rilievo coach' },
    es: { model: 'Modelo Open-Meteo', metar: 'METAR cercano', coach: 'Lectura del entrenador' },
  }[language][key])

  useEffect(() => onFirebaseAuthStateChanged((nextAccount) => {
    const requestId = ++cloudRequestRef.current
    setAccount(nextAccount)
    if (!nextAccount) {
      setCloudLoading(false)
      setCloudIds(new Set())
      setItems(loadSavedBriefings())
      return
    }

    setCloudLoading(true)
    void firebaseCloudAdapter.pull().then((snapshot) => {
      if (requestId !== cloudRequestRef.current) return
      const cloud = snapshot?.bundle.data.briefings ?? []
      if (snapshot) importCoachBriefData(JSON.stringify(snapshot.bundle.data), 'merge')
      const local = loadSavedBriefings()
      setLocalIds(new Set(local.map((item) => item.id)))
      setCloudIds(new Set(cloud.map((item) => item.id)))
      setItems(mergeSavedBriefings(local, cloud))
      setStatus(snapshot ? d.merged : d.noCloud)
    }).catch((error) => {
      if (requestId !== cloudRequestRef.current) return
      setItems(loadSavedBriefings())
      setStatus(error instanceof Error ? `${d.cloudUnavailable} ${error.message}` : d.cloudUnavailable)
    }).finally(() => {
      if (requestId === cloudRequestRef.current) setCloudLoading(false)
    })
  }), [])

  function refreshLocalItems() {
    const local = loadSavedBriefings()
    setLocalIds(new Set(local.map((item) => item.id)))
    setItems((current) => mergeSavedBriefings(local, current.filter((item) => cloudIds.has(item.id))))
  }

  function storageLabel(id: string) {
    const local = localIds.has(id)
    const cloud = cloudIds.has(id)
    if (local && cloud) return 'Local + Cloud'
    return cloud ? 'Cloud' : 'Local'
  }

  function openBriefing(item: SavedBriefing) {
    prepareBriefingRestore(item)
    navigate('/resultats', { state: requestForSavedBriefing(item) })
  }

  function duplicateBriefing(item: SavedBriefing) {
    prepareBriefingRestore(item)
    const prefill = { ...item.request }
    delete prefill.savedBriefingId
    navigate('/', { state: { prefill, duplicate: true } })
  }

  async function removeBriefing(item: SavedBriefing) {
    if (!window.confirm(c.removeConfirm(item.name))) return
    const remaining = items.filter((candidate) => candidate.id !== item.id)
    setItems(remaining)
    setLocalIds((current) => { const next = new Set(current); next.delete(item.id); return next })
    setCloudIds((current) => { const next = new Set(current); next.delete(item.id); return next })

    if (account && cloudIds.has(item.id)) {
      try {
        // Delete remotely first so automatic sync cannot pull and resurrect the old cloud copy.
        const bundle = exportPortableCoachBriefData()
        bundle.data.briefings = remaining
        const updatedAt = new Date().toISOString()
        await firebaseCloudAdapter.push({ revision: crypto.randomUUID(), updatedAt, bundle })
        deleteSavedBriefing(item.id)
        setStatus(d.deletedBoth)
      } catch (error) {
        deleteSavedBriefing(item.id)
        setStatus(error instanceof Error
          ? `${d.deletedLocalOnly}: ${error.message}`
          : d.deletedLocalOnly)
      }
      return
    }
    deleteSavedBriefing(item.id)
    setStatus(d.deleted)
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
      pressure: item.reality.pressure ?? '',
      cloudCover: item.reality.cloudCover ?? '',
      airTemperature: item.reality.airTemperature ?? '',
      waterTemperature: item.reality.waterTemperature ?? '',
      notes: item.reality.notes,
    } : emptyReality)
  }

  function updateReality(field: keyof Omit<RaceReality, 'recordedAt'>, value: string) {
    setRealityDraft((current) => ({ ...current, [field]: value }))
  }

  function persistReality(item: SavedBriefing) {
    // Une copie uniquement cloud devient locale avant d'être modifiée.
    saveExistingBriefing(item)
    saveRaceReality(item.id, realityDraft)
    refreshLocalItems()
    setEditingRealityId(null)
    setRealityDraft(emptyReality)
    setStatus(`${d.realitySaved} « ${item.name} »`)
  }

  async function importFile(file: File | undefined) {
    if (!file) return
    try {
      const imported = importSavedBriefing(await file.text())
      refreshLocalItems()
      setStatus(`« ${imported.name} » ${d.imported}`)
    } catch (error) {
      setStatus(error instanceof Error && language === 'fr' ? error.message : d.importFail)
    } finally {
      if (importRef.current) importRef.current.value = ''
    }
  }

  return (
    <main className="saved-briefings-page">
      <section className="saved-briefings-hero">
        <div>
          <span className="step-label">{c.library}</span>
          <h1>{historyRequest ? c.history : c.mine}</h1>
          <p>{historyRequest ? `${c.historyIntro} — ${historyRequest.location}.` : c.intro}</p>
        </div>
        <div className="saved-briefings-import">
          <input ref={importRef} type="file" accept=".json,application/json" hidden onChange={(event) => void importFile(event.target.files?.[0])} />
          <button type="button" onClick={() => importRef.current?.click()}><FileUp size={16} /> {c.import}</button>
        </div>
      </section>

      {status && <p className="saved-briefings-status" role="status">{status}</p>}
      {account && cloudLoading && <p className="saved-briefings-cloud-loading" role="status">{c.cloudLoading}</p>}

      {calibrations.length > 0 && <section className="calibration-section" aria-labelledby="calibration-title">
        <div className="calibration-heading">
          <div><span className="step-label">{d.learning}</span><h2 id="calibration-title">{d.calibration}</h2></div>
          <p>{d.calibrationIntro}</p>
        </div>
        <div className="calibration-grid">{calibrations.map((calibration) => {
          const speedValues = calibration.samples.flatMap((sample) => sample.speedGap == null ? [] : [sample.speedGap])
          const directionValues = calibration.samples.flatMap((sample) => sample.directionGap == null ? [] : [sample.directionGap])
          return <article className="calibration-card" key={calibration.key}>
            <div className="calibration-card-heading"><div><strong>{calibration.label}</strong><span>{calibration.sampleCount} {d.races}</span></div><small>{calibrationLevel(calibration.sampleCount)}</small></div>
            <div className="calibration-metrics">
              <div><small>{d.speedBias}</small><strong>{signedGap(calibration.meanSpeedBias, 'nd')}</strong><span>{d.meanError} {calibration.meanAbsSpeedError == null ? '—' : `${calibration.meanAbsSpeedError.toFixed(1).replace('.0', '')} nd`}</span></div>
              <div><small>{d.directionBias}</small><strong>{directionBiasLabel(calibration.meanDirectionBias, language)}</strong><span>{d.meanError} {calibration.meanAbsDirectionError == null ? '—' : `${Math.round(calibration.meanAbsDirectionError)}°`}</span></div>
            </div>
            <div className="calibration-charts">
              <div><small>{d.speedTimeline}</small><MiniGapChart values={speedValues} unit="nd" ariaLabel={`${d.speedTimeline} ${calibration.label}`} empty={d.chartEmpty} /></div>
              <div><small>{d.directionTimeline}</small><MiniGapChart values={directionValues} unit="°" ariaLabel={`${d.directionTimeline} ${calibration.label}`} empty={d.chartEmpty} /></div>
            </div>
            <p className="calibration-note">{d.fallback}</p>
          </article>
        })}</div>
      </section>}

      {sourceReliabilities.length > 0 && <section className="source-reliability-section" aria-labelledby="source-reliability-title">
        <div className="calibration-heading">
          <div><span className="step-label">{d.sourceQuality}</span><h2 id="source-reliability-title">{d.reliability}</h2></div>
          <p>{d.reliabilityIntro}</p>
        </div>
        <div className="source-reliability-plans">{sourceReliabilities.map((entry) => <article className="source-reliability-plan" key={entry.key}>
          <div className="source-reliability-plan-title"><MapPin size={14} /><strong>{entry.label}</strong></div>
          <div className="source-reliability-grid">{entry.metrics.map((metric) => <div className={`source-reliability-card source-${metric.key}`} key={metric.key}>
            <div className="source-reliability-name">{metric.key === 'metar' ? <Radio size={15} /> : metric.key === 'coach' ? <Gauge size={15} /> : <Wind size={15} />}<strong>{sourceName(metric.key)}</strong></div>
            <span>{metric.sampleCount ? `${metric.sampleCount} ${d.comparisons}` : d.noComparison}</span>
            <div className="source-reliability-values">
              <small>{d.speedError} <strong>{metric.meanAbsSpeedError == null ? '—' : `${metric.meanAbsSpeedError.toFixed(1).replace('.0', '')} nd`}</strong></small>
              <small>{d.directionError} <strong>{metric.meanAbsDirectionError == null ? '—' : `${Math.round(metric.meanAbsDirectionError)}°`}</strong></small>
            </div>
            {metric.sampleCount > 0 && <small className="source-reliability-bias">{d.bias}: {signedGap(metric.meanSpeedBias, 'nd')} · {signedGap(metric.meanDirectionBias, '°')}</small>}
            {metric.key === 'metar' && metric.sampleCount === 0 && <small className="source-reliability-bias">{d.metarNew}</small>}
          </div>)}</div>
        </article>)}</div>
      </section>}

      {visibleItems.length === 0 ? (
        <section className="saved-briefings-empty">
          <FolderOpen size={28} />
          <h2>{c.empty}</h2>
          <p>{c.emptyHelp}</p>
        </section>
      ) : (
        <section className="saved-briefings-grid" aria-label={d.savedList}>
          {visibleItems.map((item) => {
            const raceWeather = item.weather?.race
            const gap = finalGap(item)
            const editingReality = editingRealityId === item.id
            return <article className="saved-briefing-card" key={item.id}>
              <div className="saved-briefing-heading">
                <div><span className="step-label">{d.saved} {formatSavedAt(item.savedAt, locale)}</span><h2>{item.name}</h2><span className={`saved-storage-badge storage-${storageLabel(item.id).toLowerCase().replaceAll(' ', '-').replace('+', 'and')}`}>{storageLabel(item.id) === 'Cloud' ? <Cloud size={11} /> : <HardDrive size={11} />}{storageLabel(item.id)}</span></div>
                <span className="saved-course-badge">{item.request.courseType}</span>
              </div>

              <div className="saved-briefing-meta">
                <span><MapPin size={14} /> {item.request.location || d.noVenue}</span>
                <span><CalendarDays size={14} /> {item.request.date || d.noDate} · {item.request.raceTime || '—'}</span>
                <span><Sailboat size={14} /> {item.request.boatClass}</span>
                <span><Wind size={14} /> {raceWeather ? `${Math.round(raceWeather.speed)} nd · ${String(Math.round(raceWeather.direction)).padStart(3, '0')}°` : d.noWeather}</span>
              </div>

              <div className="saved-briefing-course">
                <small>{d.savedCourse}</small>
                <strong>{item.course?.activeVariantName || d.automatic}</strong>
                <span>{item.course ? `${item.course.points.length} ${d.points} · ${d.axis} ${String(Math.round(item.course.bearing)).padStart(3, '0')}°` : d.recalculated}</span>
              </div>

              <div className="history-block">
                <div className="history-title"><Gauge size={15} /><strong>{d.historyFlow}</strong></div>
                <div className="history-grid">
                  <article><small>{d.forecast}</small><strong>{raceWeather ? windSummary(raceWeather.speed, raceWeather.direction, language) : '—'}</strong><span>{raceWeather ? `${d.gust} ${Math.round(raceWeather.gust)} nd` : d.noSnapshot}</span></article>
                  <article><small>{d.savedMetar}</small><strong>{item.metar ? windSummary(item.metar.windSpeed, item.metar.windDirection, language) : d.notCaptured}</strong><span>{item.metar ? `${item.metar.station} · ${Math.round(item.metar.distanceKm)} km${item.metar.reportTime ? ` · ${item.metar.reportTime}` : ''}` : d.nextSaves}</span></article>
                  <article><small>{d.beforeStart}</small><strong>{windSummary(item.request.observedWindSpeed, item.request.observedWindDirection, language)}</strong><span>{item.request.observationTime ? `${d.reading} ${item.request.observationTime}` : d.noCoach}</span></article>
                  <article className={item.reality ? 'has-reality' : ''}><small>{d.raceReality}</small><strong>{item.reality ? windSummary(item.reality.windSpeed, item.reality.windDirection, language) : d.toEnter}</strong><span>{item.reality ? `${d.entered} ${formatSavedAt(item.reality.recordedAt, locale)}` : d.after}</span></article>
                </div>
                {item.reality && <p className="history-note"><strong>{d.observed}:</strong> {d.gust} {item.reality.gust || '—'} nd · {d.pressure} {item.reality.pressure || '—'} hPa · {d.clouds} {item.reality.cloudCover || '—'} % · {d.current} {item.reality.currentSpeed || '—'} nd / {item.reality.currentDirection || '—'}° · {d.sea} {item.reality.waveHeight || '—'} m · {d.airTemp}/{d.waterTemp} {item.reality.airTemperature || '—'} / {item.reality.waterTemperature || '—'} °C</p>}
                {gap && <p className="history-gap">{d.finalGap}: {gap.speedGap == null ? '' : `${gap.speedGap >= 0 ? '+' : ''}${gap.speedGap.toFixed(1).replace('.0', '')} nd`}{gap.speedGap != null && gap.directionGap != null ? ' · ' : ''}{gap.directionGap == null ? '' : `${gap.directionGap >= 0 ? '+' : ''}${Math.round(gap.directionGap)}°`}</p>}
                {item.reality?.notes && <p className="history-note"><strong>{d.coachFeedback}:</strong> {item.reality.notes}</p>}
                {item.debrief && <p className="history-note"><strong>{t('raceDebrief')} :</strong> {item.debrief.validatedAt ? t('debriefMemoryAdded') : t('debriefDraft')}</p>}
              </div>

              {editingReality && <div className="reality-form">
                <div className="reality-form-title"><strong>{d.raceReality}</strong><span>{d.enterAfter}</span></div>
                <div className="reality-fields">
                  <label><span><Wind size={13} /> {d.wind}</span><div><input type="number" min="0" max="80" step="0.1" value={realityDraft.windSpeed} onChange={(event) => updateReality('windSpeed', event.target.value)} /><small>nd</small></div></label>
                  <label><span><Navigation size={13} /> {d.direction}</span><div><input type="number" min="0" max="359" step="1" value={realityDraft.windDirection} onChange={(event) => updateReality('windDirection', event.target.value)} /><small>°</small></div></label>
                  <label><span><Wind size={13} /> {d.gust}</span><div><input type="number" min="0" max="100" step="0.1" value={realityDraft.gust} onChange={(event) => updateReality('gust', event.target.value)} /><small>nd</small></div></label>
                  <label><span><Waves size={13} /> {d.waves}</span><div><input type="number" min="0" max="10" step="0.1" value={realityDraft.waveHeight} onChange={(event) => updateReality('waveHeight', event.target.value)} /><small>m</small></div></label>
                  <label><span><Navigation size={13} /> {d.current}</span><div><input type="number" min="0" max="8" step="0.1" value={realityDraft.currentSpeed} onChange={(event) => updateReality('currentSpeed', event.target.value)} /><small>nd</small></div></label>
                  <label><span><Navigation size={13} /> {d.currentDir}</span><div><input type="number" min="0" max="359" step="1" value={realityDraft.currentDirection} onChange={(event) => updateReality('currentDirection', event.target.value)} /><small>°</small></div></label>
                  <label><span><Gauge size={13} /> {d.pressure}</span><div><input type="number" min="850" max="1100" step="1" value={realityDraft.pressure} onChange={(event) => updateReality('pressure', event.target.value)} /><small>hPa</small></div></label>
                  <label><span><Cloud size={13} /> {d.clouds}</span><div><input type="number" min="0" max="100" step="1" value={realityDraft.cloudCover} onChange={(event) => updateReality('cloudCover', event.target.value)} /><small>%</small></div></label>
                  <label><span>{d.airTemp}</span><div><input type="number" min="-30" max="60" step="0.1" value={realityDraft.airTemperature} onChange={(event) => updateReality('airTemperature', event.target.value)} /><small>°C</small></div></label>
                  <label><span>{d.waterTemp}</span><div><input type="number" min="-5" max="40" step="0.1" value={realityDraft.waterTemperature} onChange={(event) => updateReality('waterTemperature', event.target.value)} /><small>°C</small></div></label>
                </div>
                <label className="reality-notes"><span>{d.raceFeedback}</span><textarea rows={3} value={realityDraft.notes} onChange={(event) => updateReality('notes', event.target.value)} placeholder={d.placeholder} /></label>
                <div className="reality-form-actions"><button type="button" className="primary" onClick={() => persistReality(item)}><Save size={14} /> {d.saveReality}</button><button type="button" onClick={() => setEditingRealityId(null)}>{d.cancel}</button></div>
              </div>}

              <div className="saved-briefing-actions">
                <button type="button" className="primary" onClick={() => openBriefing(item)}><FolderOpen size={15} /> {c.open}</button>
                <button type="button" onClick={() => duplicateBriefing(item)}><Copy size={15} /> {c.duplicate}</button>
                <button type="button" onClick={() => editReality(item)}><Gauge size={15} /> {item.reality ? c.editReality : c.addReality}</button>
                <button type="button" onClick={() => navigate(`/briefings/${item.id}/debrief`)}><ClipboardCheck size={15} /> {item.debrief ? t('openDebrief') : t('addDebrief')}</button>
                <button type="button" onClick={() => downloadBriefing(item)}><Download size={15} /> {c.export}</button>
                <button type="button" onClick={() => void removeBriefing(item)}><Trash2 size={15} /> {c.remove}</button>
              </div>
            </article>
          })}
        </section>
      )}
    </main>
  )
}
