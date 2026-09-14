import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, Layers3, RotateCcw, Save, Trash2, Upload } from 'lucide-react'
import { fetchElevations, isLandElevation } from '../elevation'
import { courseToGpx, parseCourseGpx } from '../gpx'
import type { GpxPoint } from '../gpx'
import '../gpx.css'
import '../geolocation.css'
import { loadLeaflet } from '../leafletLoader'
import { consumeCourseRestore, writeCurrentCourseSnapshot } from '../savedBriefings'
import type { CourseType } from '../types'
import { usePreferences, type Language } from '../preferences'

const courseCopy = {
  fr: { start: 'Départ', mark: 'Bouée', windward: 'au vent', reaching: 'reaching', lower: 'sous le vent', highReach: 'travers haut', lowReach: 'travers bas', finish: 'Arrivée', point: 'Point', restored: 'Parcours du briefing restauré', automatic: 'Tracé automatique', variant: 'Variante', moved: 'déplacé', updated: 'variante mise à jour', centre: 'Centre choisi du plan d’eau', committee: 'Comité / bateau coach', mapUnavailable: 'Cartographie indisponible.', recalculated: 'Tracé automatique recalculé', saved: 'enregistrée', loaded: 'chargée', deleted: 'supprimée', exported: 'GPX exporté', imported: 'points importés · enregistrez pour créer une variante', importFail: 'Import GPX impossible', preview: 'Prévisualisation du parcours', axis: 'Axe', drag: 'faites glisser les points pour ajuster le tracé', marker: 'Repère C = Comité / bateau coach', accuracy: 'précision GPS', variants: 'Variantes', stored: 'enregistrée(s)', choose: 'Choisir une variante de parcours', name: 'Nom de la nouvelle variante', save: 'Enregistrer', remove: 'Supprimer', variantsHelp: 'Les variantes sont mémorisées sur cet appareil pour ce plan d’eau et ce type de parcours. Une variante active est mise à jour automatiquement quand une bouée est déplacée.', import: 'Importer GPX', export: 'Exporter GPX', recalculate: 'Recalculer', example: 'Ex. Axe', checkingLand: 'Contrôle terre / mer…', onLand: 'sur terre', landRejected: 'ne peut pas être placée sur terre · position précédente restaurée', landCheckUnavailable: 'Contrôle terre / mer indisponible · déplacement annulé', landWarning: 'Parcours invalide : déplacez les points signalés hors de la terre', autoMoved: 'Parcours décalé vers l’eau en conservant son échelle', moveCourse: 'Décaler tout le parcours', moveHelp: 'Déplace le départ, toutes les bouées et l’arrivée sans déformer le tracé', step: 'Pas', north: 'nord', south: 'sud', east: 'est', west: 'ouest', wholeMoved: 'Parcours entier déplacé', wholeMoveRejected: 'Déplacement global refusé : au moins un point arriverait sur terre' },
  en: { start: 'Start', mark: 'Mark', windward: 'windward', reaching: 'reach', lower: 'leeward', highReach: 'upper reach', lowReach: 'lower reach', finish: 'Finish', point: 'Point', restored: 'Briefing course restored', automatic: 'Automatic layout', variant: 'Variant', moved: 'moved', updated: 'variant updated', centre: 'Selected sailing-area centre', committee: 'Committee / coach boat', mapUnavailable: 'Mapping unavailable.', recalculated: 'Automatic layout recalculated', saved: 'saved', loaded: 'loaded', deleted: 'deleted', exported: 'GPX exported', imported: 'points imported · save to create a variant', importFail: 'Unable to import GPX', preview: 'Course preview', axis: 'Axis', drag: 'drag points to adjust the layout', marker: 'C marker = Committee / coach boat', accuracy: 'GPS accuracy', variants: 'Variants', stored: 'saved', choose: 'Choose a course variant', name: 'New variant name', save: 'Save', remove: 'Delete', variantsHelp: 'Variants are stored on this device for this sailing area and course type. The active variant is updated automatically when a mark is moved.', import: 'Import GPX', export: 'Export GPX', recalculate: 'Recalculate', example: 'e.g. Axis', checkingLand: 'Checking land / water…', onLand: 'on land', landRejected: 'cannot be placed on land · previous position restored', landCheckUnavailable: 'Land / water check unavailable · move cancelled', landWarning: 'Invalid course: move the flagged points off land', autoMoved: 'Course shifted onto the water while preserving its scale', moveCourse: 'Shift the whole course', moveHelp: 'Moves the start, every mark and the finish without changing the layout', step: 'Step', north: 'north', south: 'south', east: 'east', west: 'west', wholeMoved: 'Whole course shifted', wholeMoveRejected: 'Whole-course move rejected: at least one point would land ashore' },
  it: { start: 'Partenza', mark: 'Boa', windward: 'al vento', reaching: 'lasco', lower: 'sottovento', highReach: 'traverso alto', lowReach: 'traverso basso', finish: 'Arrivo', point: 'Punto', restored: 'Percorso del briefing ripristinato', automatic: 'Tracciato automatico', variant: 'Variante', moved: 'spostata', updated: 'variante aggiornata', centre: 'Centro del campo di regata scelto', committee: 'Comitato / barca coach', mapUnavailable: 'Mappa non disponibile.', recalculated: 'Tracciato automatico ricalcolato', saved: 'salvata', loaded: 'caricata', deleted: 'eliminata', exported: 'GPX esportato', imported: 'punti importati · salva per creare una variante', importFail: 'Importazione GPX non riuscita', preview: 'Anteprima del percorso', axis: 'Asse', drag: 'trascina i punti per modificare il tracciato', marker: 'Indicatore C = Comitato / barca coach', accuracy: 'precisione GPS', variants: 'Varianti', stored: 'salvate', choose: 'Scegli una variante del percorso', name: 'Nome della nuova variante', save: 'Salva', remove: 'Elimina', variantsHelp: 'Le varianti sono memorizzate su questo dispositivo per il campo di regata e il tipo di percorso. La variante attiva si aggiorna automaticamente quando una boa viene spostata.', import: 'Importa GPX', export: 'Esporta GPX', recalculate: 'Ricalcola', example: 'Es. Asse', checkingLand: 'Controllo terra / acqua…', onLand: 'a terra', landRejected: 'non può essere posizionata a terra · posizione precedente ripristinata', landCheckUnavailable: 'Controllo terra / acqua non disponibile · spostamento annullato', landWarning: 'Percorso non valido: sposta fuori dalla terra i punti segnalati', autoMoved: 'Percorso spostato sull’acqua mantenendo la scala', moveCourse: 'Sposta tutto il percorso', moveHelp: 'Sposta partenza, tutte le boe e arrivo senza deformare il tracciato', step: 'Passo', north: 'nord', south: 'sud', east: 'est', west: 'ovest', wholeMoved: 'Intero percorso spostato', wholeMoveRejected: 'Spostamento globale rifiutato: almeno un punto finirebbe a terra' },
  es: { start: 'Salida', mark: 'Boya', windward: 'barlovento', reaching: 'través', lower: 'sotavento', highReach: 'través alto', lowReach: 'través bajo', finish: 'Llegada', point: 'Punto', restored: 'Recorrido del briefing restaurado', automatic: 'Trazado automático', variant: 'Variante', moved: 'movida', updated: 'variante actualizada', centre: 'Centro elegido del campo de regatas', committee: 'Comité / barco del entrenador', mapUnavailable: 'Mapa no disponible.', recalculated: 'Trazado automático recalculado', saved: 'guardada', loaded: 'cargada', deleted: 'eliminada', exported: 'GPX exportado', imported: 'puntos importados · guarda para crear una variante', importFail: 'No se pudo importar el GPX', preview: 'Vista previa del recorrido', axis: 'Eje', drag: 'arrastra los puntos para ajustar el trazado', marker: 'Marca C = Comité / barco del entrenador', accuracy: 'precisión GPS', variants: 'Variantes', stored: 'guardadas', choose: 'Elegir una variante del recorrido', name: 'Nombre de la nueva variante', save: 'Guardar', remove: 'Eliminar', variantsHelp: 'Las variantes se guardan en este dispositivo para este campo de regatas y tipo de recorrido. La variante activa se actualiza automáticamente al mover una boya.', import: 'Importar GPX', export: 'Exportar GPX', recalculate: 'Recalcular', example: 'Ej. Eje', checkingLand: 'Comprobando tierra / agua…', onLand: 'en tierra', landRejected: 'no puede colocarse en tierra · posición anterior restaurada', landCheckUnavailable: 'Comprobación tierra / agua no disponible · movimiento cancelado', landWarning: 'Recorrido no válido: mueve fuera de tierra los puntos señalados', autoMoved: 'Recorrido desplazado al agua conservando su escala', moveCourse: 'Desplazar todo el recorrido', moveHelp: 'Mueve la salida, todas las boyas y la llegada sin deformar el trazado', step: 'Paso', north: 'norte', south: 'sur', east: 'este', west: 'oeste', wholeMoved: 'Recorrido completo desplazado', wholeMoveRejected: 'Desplazamiento global rechazado: al menos un punto quedaría en tierra' },
} as const

type CoursePreviewProps = {
  latitude: number
  longitude: number
  axis: number
  windwardOffset: number
  firstLegNm: number
  courseType: CourseType
  committeeLatitude?: number
  committeeLongitude?: number
  committeeAccuracy?: string
}

type Point = { latitude: number; longitude: number }

type DefaultCourse = {
  points: GpxPoint[]
  routeOrder: number[]
}

type CourseVariant = {
  id: string
  name: string
  points: GpxPoint[]
  routeOrder: number[]
  updatedAt: string
}

function radians(value: number) { return value * Math.PI / 180 }
function degrees(value: number) { return value * 180 / Math.PI }
function normalizeBearing(value: number) { return ((value % 360) + 360) % 360 }

function destination(point: Point, bearing: number, distanceNm: number): Point {
  const earthRadiusKm = 6371
  const distanceKm = distanceNm * 1.852
  const angularDistance = distanceKm / earthRadiusKm
  const bearingRad = radians(normalizeBearing(bearing))
  const lat1 = radians(point.latitude)
  const lon1 = radians(point.longitude)
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(angularDistance) + Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearingRad))
  const lon2 = lon1 + Math.atan2(Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(lat1), Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2))
  return { latitude: degrees(lat2), longitude: degrees(lon2) }
}

async function nearestWaterCourse(points: GpxPoint[]): Promise<GpxPoint[] | null> {
  const candidates = [0.05, 0.1, 0.2, 0.35, 0.5, 0.75, 1, 1.5].flatMap((distanceNm) =>
    Array.from({ length: 8 }, (_, index) => points.map((point) => ({
      ...point,
      ...destination(point, index * 45, distanceNm),
    }))),
  )
  const elevations = await fetchElevations(candidates.flat())
  for (let index = 0; index < candidates.length; index += 1) {
    const candidateElevations = elevations.slice(index * points.length, (index + 1) * points.length)
    if (candidateElevations.every((value) => value !== null && !isLandElevation(value))) return candidates[index]
  }
  return null
}

function sameLayout(left: GpxPoint[], right: GpxPoint[]) {
  return left.length === right.length && left.every((point, index) =>
    Math.abs(point.latitude - right[index].latitude) < 1e-7
    && Math.abs(point.longitude - right[index].longitude) < 1e-7)
}

function lineAround(point: Point, courseBearing: number, halfWidthNm: number) {
  return {
    left: destination(point, courseBearing - 90, halfWidthNm),
    right: destination(point, courseBearing + 90, halfWidthNm),
  }
}

function buildDefaultCourse(center: Point, bearing: number, firstLegNm: number, courseType: CourseType, language: Language): DefaultCourse {
  const c = courseCopy[language]
  const start = destination(center, bearing + 180, firstLegNm / 2)
  const markOne = destination(center, bearing, firstLegNm / 2)

  if (courseType === 'Triangle') {
    const markTwo = destination(markOne, bearing + 135, firstLegNm * 0.78)
    const markThree = destination(markOne, bearing + 180, firstLegNm * 0.92)
    const finish = destination(markThree, bearing + 180, firstLegNm * 0.16)
    return {
      points: [
        { name: c.start, ...start },
        { name: `${c.mark} 1 · ${c.windward}`, ...markOne },
        { name: `${c.mark} 2 · ${c.reaching}`, ...markTwo },
        { name: `${c.mark} 3 · ${c.lower}`, ...markThree },
        { name: c.finish, ...finish },
      ],
      routeOrder: [0, 1, 2, 3, 4],
    }
  }

  if (courseType === 'Trapèze') {
    const markTwo = destination(markOne, bearing - 110, firstLegNm * 0.58)
    const markThree = destination(markTwo, bearing + 180, firstLegNm * 0.72)
    const markFour = destination(markThree, bearing + 110, firstLegNm * 0.58)
    const finish = destination(markFour, bearing + 180, firstLegNm * 0.15)
    return {
      points: [
        { name: c.start, ...start },
        { name: `${c.mark} 1 · ${c.windward}`, ...markOne },
        { name: `${c.mark} 2 · ${c.highReach}`, ...markTwo },
        { name: `${c.mark} 3 · ${c.lower}`, ...markThree },
        { name: `${c.mark} 4 · ${c.lowReach}`, ...markFour },
        { name: c.finish, ...finish },
      ],
      routeOrder: [0, 1, 2, 3, 4, 5],
    }
  }

  const markTwo = destination(markOne, bearing + 180, firstLegNm * 0.9)
  const finish = destination(markOne, bearing + 180, firstLegNm * 0.82)
  return {
    points: [
      { name: c.start, ...start },
      { name: `${c.mark} 1 · ${c.windward}`, ...markOne },
      { name: `${c.mark} 2 · ${c.lower}`, ...markTwo },
      { name: c.finish, ...finish },
    ],
    routeOrder: [0, 1, 2, 1, 3],
  }
}

function routeOrderForImported(courseType: CourseType, count: number) {
  if (courseType === 'Banane' && count === 4) return [0, 1, 2, 1, 3]
  return Array.from({ length: count }, (_, index) => index)
}

function latLng(point: Point): [number, number] {
  return [point.latitude, point.longitude]
}

function routeSequence(points: GpxPoint[], routeOrder: number[]) {
  return routeOrder.map((index) => points[index]?.name || `Point ${index + 1}`).join(' → ')
}

function clonePoints(points: GpxPoint[]) {
  return points.map((point) => ({ ...point }))
}

function loadVariants(key: string): CourseVariant[] {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as CourseVariant[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter((variant) => variant && typeof variant.id === 'string' && typeof variant.name === 'string' && Array.isArray(variant.points) && Array.isArray(variant.routeOrder))
  } catch {
    return []
  }
}

function persistVariants(key: string, variants: CourseVariant[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(variants))
  } catch {
    // Le tracé reste utilisable même si le stockage local est indisponible.
  }
}

export function CoursePreview({ latitude, longitude, axis, windwardOffset, firstLegNm, courseType, committeeLatitude, committeeLongitude, committeeAccuracy = '' }: CoursePreviewProps) {
  const { language, t } = usePreferences()
  const courseLabel = t(courseType === 'Banane' ? 'courseBanana' : courseType === 'Trapèze' ? 'courseTrapezoid' : 'courseTriangle')
  const c = courseCopy[language]
  const elementRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const bearing = normalizeBearing(axis + windwardOffset)
  const defaultCourse = useMemo(
    () => buildDefaultCourse({ latitude, longitude }, bearing, firstLegNm, courseType, language),
    [latitude, longitude, bearing, firstLegNm, courseType, language],
  )
  const storageKey = useMemo(
    () => `coachbrief:course-variants:v1:${courseType}:${latitude.toFixed(3)}:${longitude.toFixed(3)}`,
    [courseType, latitude, longitude],
  )
  const [points, setPoints] = useState<GpxPoint[]>(defaultCourse.points)
  const [routeOrder, setRouteOrder] = useState<number[]>(defaultCourse.routeOrder)
  const [gpxStatus, setGpxStatus] = useState('')
  const [variants, setVariants] = useState<CourseVariant[]>([])
  const [activeVariantId, setActiveVariantId] = useState('auto')
  const [variantName, setVariantName] = useState('')
  const [landIndexes, setLandIndexes] = useState<number[]>([])
  const [landCheckState, setLandCheckState] = useState<'checking' | 'ready' | 'unavailable'>('checking')
  const [shiftStepMeters, setShiftStepMeters] = useState(50)
  const [isShiftingCourse, setIsShiftingCourse] = useState(false)

  useEffect(() => {
    const restored = consumeCourseRestore(storageKey)
    if (restored) {
      const restoredVariants = restored.variants || loadVariants(storageKey)
      persistVariants(storageKey, restoredVariants)
      setPoints(clonePoints(restored.points))
      setRouteOrder([...restored.routeOrder])
      setVariants(restoredVariants)
      setActiveVariantId(restored.activeVariantId || 'auto')
      setVariantName(restored.activeVariantId === 'auto' ? '' : restored.activeVariantName || '')
      setGpxStatus(c.restored)
      return
    }

    setPoints(defaultCourse.points)
    setRouteOrder(defaultCourse.routeOrder)
    setActiveVariantId('auto')
    setVariantName('')
    setVariants(loadVariants(storageKey))
    setGpxStatus('')
  }, [defaultCourse, storageKey])

  const activeVariantName = activeVariantId === 'auto' ? c.automatic : variants.find((variant) => variant.id === activeVariantId)?.name || variantName || c.variant

  useEffect(() => {
    writeCurrentCourseSnapshot({
      storageKey,
      courseType,
      bearing,
      points: clonePoints(points),
      routeOrder: [...routeOrder],
      variants: variants.map((variant) => ({ ...variant, points: clonePoints(variant.points), routeOrder: [...variant.routeOrder] })),
      activeVariantId,
      activeVariantName,
    })
  }, [storageKey, courseType, bearing, points, routeOrder, variants, activeVariantId, activeVariantName])

  useEffect(() => {
    let cancelled = false
    setLandCheckState('checking')
    void fetchElevations(points).then(async (elevations) => {
      if (cancelled) return
      if (elevations.every((value) => value === null)) {
        setLandIndexes([])
        setLandCheckState('unavailable')
        return
      }
      const invalid = elevations.flatMap((value, index) => isLandElevation(value) ? [index] : [])
      if (invalid.length && sameLayout(points, defaultCourse.points)) {
        const shifted = await nearestWaterCourse(points)
        if (cancelled) return
        if (shifted) {
          setLandIndexes([])
          setGpxStatus(c.autoMoved)
          setPoints(shifted)
          return
        }
      }
      setLandIndexes(invalid)
      setLandCheckState('ready')
    }).catch(() => {
      if (!cancelled) {
        setLandIndexes([])
        setLandCheckState('unavailable')
      }
    })
    return () => { cancelled = true }
  }, [points, defaultCourse])

  useEffect(() => {
    let cancelled = false
    let map: any = null

    void loadLeaflet().then((leaflet) => {
      if (cancelled || !elementRef.current || points.length < 2) return

      mapRef.current?.remove()
      map = leaflet.map(elementRef.current, { zoomControl: true, attributionControl: true })
      leaflet.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map)

      const start = points[0]
      const finish = points[points.length - 1]
      const lineHalfWidth = Math.min(0.09, Math.max(0.035, firstLegNm * 0.12))
      const startLine = lineAround(start, bearing, lineHalfWidth)
      const finishLine = lineAround(finish, bearing, lineHalfWidth * 0.85)
      const route = routeOrder.map((index) => points[index]).filter((point): point is GpxPoint => Boolean(point))

      leaflet.polyline(route.map(latLng), { weight: 4, opacity: 0.85 }).addTo(map)
      leaflet.polyline([latLng(startLine.left), latLng(startLine.right)], { weight: 5, opacity: 0.95 }).addTo(map)
      leaflet.polyline([latLng(finishLine.left), latLng(finishLine.right)], { weight: 4, opacity: 0.8, dashArray: '7 6' }).addTo(map)

      points.forEach((point, index) => {
        const isOnLand = landIndexes.includes(index)
        const markerOptions: any = { draggable: true, title: point.name }
        if (isOnLand) {
          markerOptions.icon = leaflet.divIcon({
            className: 'course-land-marker-icon',
            html: '<span aria-hidden="true">!</span>',
            iconSize: [34, 34],
            iconAnchor: [17, 17],
          })
        }
        const marker = leaflet.marker(latLng(point), markerOptions)
          .bindTooltip(
            `${index === 0 ? c.start : index === points.length - 1 ? c.finish : `${c.mark} ${index}`}${isOnLand ? ` · ${c.onLand}` : ''}`,
            { permanent: true, direction: 'top', offset: [0, -12], className: 'course-point-label' },
          )
          .addTo(map)

        marker.on('dragend', async (event: any) => {
          const position = event.target.getLatLng()
          const candidate = { ...point, latitude: position.lat, longitude: position.lng }
          setGpxStatus(c.checkingLand)
          const [elevation] = await fetchElevations([candidate])
          if (elevation === null) {
            event.target.setLatLng(latLng(point))
            setGpxStatus(c.landCheckUnavailable)
            return
          }
          if (isLandElevation(elevation)) {
            event.target.setLatLng(latLng(point))
            setGpxStatus(`${point.name} ${c.landRejected}`)
            return
          }
          const nextPoints = points.map((item, itemIndex) => itemIndex === index ? candidate : item)
          setPoints(nextPoints)
          if (activeVariantId !== 'auto') {
            setVariants((current) => {
              const nextVariants = current.map((variant) => variant.id === activeVariantId
                ? { ...variant, points: clonePoints(nextPoints), routeOrder: [...routeOrder], updatedAt: new Date().toISOString() }
                : variant)
              persistVariants(storageKey, nextVariants)
              return nextVariants
            })
          }
          setGpxStatus(`${point.name} ${c.moved}${activeVariantId === 'auto' ? '' : ` · ${c.updated}`}`)
        })
      })

      leaflet.circleMarker([latitude, longitude], { radius: 4, weight: 1, fillOpacity: 0.55 })
        .bindTooltip(c.centre, { permanent: false })
        .addTo(map)

      const committeePoint = typeof committeeLatitude === 'number' && Number.isFinite(committeeLatitude)
        && typeof committeeLongitude === 'number' && Number.isFinite(committeeLongitude)
        ? { latitude: committeeLatitude, longitude: committeeLongitude }
        : null

      if (committeePoint) {
        const committeeIcon = leaflet.divIcon({
          className: 'committee-marker-icon',
          html: '<span>C</span>',
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        })
        leaflet.marker([committeePoint.latitude, committeePoint.longitude], { icon: committeeIcon, title: c.committee })
          .bindTooltip(`${c.committee}${committeeAccuracy ? ` · ±${committeeAccuracy} m` : ''}`, { permanent: false })
          .addTo(map)
      }

      const bounds = [startLine.left, startLine.right, finishLine.left, finishLine.right, ...points].map(latLng)
      if (committeePoint) bounds.push([committeePoint.latitude, committeePoint.longitude])
      map.fitBounds(bounds, { padding: [32, 32] })
      mapRef.current = map
      window.requestAnimationFrame(() => map?.invalidateSize(false))
      window.setTimeout(() => map?.invalidateSize(false), 250)
    }).catch((error: unknown) => {
      if (!cancelled) setGpxStatus(error instanceof Error ? error.message : c.mapUnavailable)
    })

    return () => {
      cancelled = true
      map?.remove()
      if (mapRef.current === map) mapRef.current = null
    }
  }, [latitude, longitude, bearing, firstLegNm, points, routeOrder, activeVariantId, storageKey, committeeLatitude, committeeLongitude, committeeAccuracy, landIndexes])

  async function moveWholeCourse(direction: number, directionLabel: string) {
    if (isShiftingCourse) return
    setIsShiftingCourse(true)
    setGpxStatus(c.checkingLand)
    try {
      const nextPoints = points.map((point) => ({
        ...point,
        ...destination(point, direction, shiftStepMeters / 1852),
      }))
      const elevations = await fetchElevations(nextPoints)
      if (elevations.some((value) => value === null)) {
        setGpxStatus(c.landCheckUnavailable)
        return
      }
      if (elevations.some(isLandElevation)) {
        setGpxStatus(c.wholeMoveRejected)
        return
      }
      setPoints(nextPoints)
      if (activeVariantId !== 'auto') {
        setVariants((current) => {
          const nextVariants = current.map((variant) => variant.id === activeVariantId
            ? { ...variant, points: clonePoints(nextPoints), routeOrder: [...routeOrder], updatedAt: new Date().toISOString() }
            : variant)
          persistVariants(storageKey, nextVariants)
          return nextVariants
        })
      }
      setGpxStatus(`${c.wholeMoved} · ${shiftStepMeters} m ${directionLabel}${activeVariantId === 'auto' ? '' : ` · ${c.updated}`}`)
    } finally {
      setIsShiftingCourse(false)
    }
  }

  function resetCourse() {
    setPoints(defaultCourse.points)
    setRouteOrder(defaultCourse.routeOrder)
    setActiveVariantId('auto')
    setVariantName('')
    setGpxStatus(c.recalculated)
  }

  function saveVariant() {
    const name = variantName.trim() || `${c.variant} ${variants.length + 1}`
    const variant: CourseVariant = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      points: clonePoints(points),
      routeOrder: [...routeOrder],
      updatedAt: new Date().toISOString(),
    }
    const nextVariants = [...variants, variant]
    setVariants(nextVariants)
    persistVariants(storageKey, nextVariants)
    setActiveVariantId(variant.id)
    setVariantName(variant.name)
    setGpxStatus(`${c.variant} « ${variant.name} » ${c.saved}`)
  }

  function selectVariant(id: string) {
    if (id === 'auto') {
      resetCourse()
      return
    }
    const variant = variants.find((item) => item.id === id)
    if (!variant) return
    setPoints(clonePoints(variant.points))
    setRouteOrder([...variant.routeOrder])
    setActiveVariantId(variant.id)
    setVariantName(variant.name)
    setGpxStatus(`${c.variant} « ${variant.name} » ${c.loaded}`)
  }

  function deleteActiveVariant() {
    if (activeVariantId === 'auto') return
    const deleted = variants.find((variant) => variant.id === activeVariantId)
    const nextVariants = variants.filter((variant) => variant.id !== activeVariantId)
    setVariants(nextVariants)
    persistVariants(storageKey, nextVariants)
    setPoints(defaultCourse.points)
    setRouteOrder(defaultCourse.routeOrder)
    setActiveVariantId('auto')
    setVariantName('')
    setGpxStatus(deleted ? `${c.variant} « ${deleted.name} » ${c.deleted}` : `${c.variant} ${c.deleted}`)
  }

  function exportGpx() {
    const activeName = activeVariantId === 'auto' ? courseType : variants.find((variant) => variant.id === activeVariantId)?.name || courseType
    const content = courseToGpx(points, `CoachBrief · ${activeName}`)
    const blob = new Blob([content], { type: 'application/gpx+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `coachbrief-${activeName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')}.gpx`
    link.click()
    URL.revokeObjectURL(url)
    setGpxStatus(c.exported)
  }

  async function importGpx(file: File | undefined) {
    if (!file) return
    try {
      const imported = parseCourseGpx(await file.text())
      const importedPoints = imported.points.map((point, index) => ({
        ...point,
        name: point.name || (index === 0 ? c.start : index === imported.points.length - 1 ? c.finish : `${c.mark} ${index}`),
      }))
      const importedRoute = routeOrderForImported(courseType, importedPoints.length)
      setPoints(importedPoints)
      setRouteOrder(importedRoute)
      setActiveVariantId('auto')
      setVariantName(file.name.replace(/\.gpx$/i, ''))
      setGpxStatus(`${importedPoints.length} ${c.imported}`)
    } catch (error) {
      setGpxStatus(error instanceof Error ? error.message : c.importFail)
    } finally {
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="course-preview-shell">
      <div ref={elementRef} className="course-preview-map" aria-label={`${c.preview} ${courseLabel}`} />
      <div className="course-preview-caption">
        <div>
          <strong>{courseLabel} · {activeVariantName}</strong>
          <span>{routeSequence(points, routeOrder)}</span>
          <small>{c.axis}: {String(Math.round(bearing)).padStart(3, '0')}° · {c.drag}</small>
          {typeof committeeLatitude === 'number' && Number.isFinite(committeeLatitude) && typeof committeeLongitude === 'number' && Number.isFinite(committeeLongitude) && <small className="committee-course-summary">{c.marker}{committeeAccuracy ? ` · ${c.accuracy} ±${committeeAccuracy} m` : ''}</small>}
          {landIndexes.length > 0 && <small className="course-land-warning" role="alert">{c.landWarning} : {landIndexes.map((index) => points[index]?.name).filter(Boolean).join(', ')}.</small>}
          {landCheckState === 'unavailable' && <small className="course-land-check-unavailable" role="status">{c.landCheckUnavailable}.</small>}
        </div>

        <div className="course-variant-panel">
          <div className="course-variant-title"><Layers3 size={14} /><strong>{c.variants}</strong><span>{variants.length} {c.stored}</span></div>
          <div className="course-variant-controls">
            <select value={activeVariantId} onChange={(event) => selectVariant(event.target.value)} aria-label={c.choose}>
              <option value="auto">{c.automatic}</option>
              {variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.name}</option>)}
            </select>
            <input value={variantName} onChange={(event) => setVariantName(event.target.value)} placeholder={`${c.example} ${String(Math.round(bearing)).padStart(3, '0')}°`} aria-label={c.name} />
            <button type="button" onClick={saveVariant}><Save size={14} /> {c.save}</button>
            <button type="button" onClick={deleteActiveVariant} disabled={activeVariantId === 'auto'}><Trash2 size={14} /> {c.remove}</button>
          </div>
          <small>{c.variantsHelp}</small>
        </div>

        <div className="course-shift-panel">
          <div className="course-shift-heading">
            <strong>{c.moveCourse}</strong>
            <small>{c.moveHelp}</small>
          </div>
          <label className="course-shift-step">
            <span>{c.step}</span>
            <select value={shiftStepMeters} onChange={(event) => setShiftStepMeters(Number(event.target.value))} disabled={isShiftingCourse}>
              <option value={25}>25 m</option>
              <option value={50}>50 m</option>
              <option value={100}>100 m</option>
            </select>
          </label>
          <div className="course-shift-pad" aria-label={c.moveCourse}>
            <button type="button" className="shift-north" onClick={() => void moveWholeCourse(0, c.north)} disabled={isShiftingCourse} aria-label={c.north} title={c.north}>↑</button>
            <button type="button" className="shift-west" onClick={() => void moveWholeCourse(270, c.west)} disabled={isShiftingCourse} aria-label={c.west} title={c.west}>←</button>
            <span className="shift-centre" aria-hidden="true">◎</span>
            <button type="button" className="shift-east" onClick={() => void moveWholeCourse(90, c.east)} disabled={isShiftingCourse} aria-label={c.east} title={c.east}>→</button>
            <button type="button" className="shift-south" onClick={() => void moveWholeCourse(180, c.south)} disabled={isShiftingCourse} aria-label={c.south} title={c.south}>↓</button>
          </div>
        </div>

        <div className="course-preview-actions">
          <input ref={inputRef} type="file" accept=".gpx,application/gpx+xml,application/xml,text/xml" hidden onChange={(event) => void importGpx(event.target.files?.[0])} />
          <button type="button" onClick={() => inputRef.current?.click()}><Upload size={14} /> {c.import}</button>
          <button type="button" onClick={exportGpx}><Download size={14} /> {c.export}</button>
          <button type="button" onClick={resetCourse}><RotateCcw size={14} /> {c.recalculate}</button>
        </div>
        {gpxStatus && <small className="course-gpx-status" role="status">{gpxStatus}</small>}
      </div>
    </div>
  )
}
