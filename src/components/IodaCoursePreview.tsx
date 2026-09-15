import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchElevations, isLandElevation } from '../elevation'
import { loadLeaflet } from '../leafletLoader'
import { publishCourseAnalysisPosition } from '../courseAnalysisPosition'
import { writeCurrentCourseSnapshot } from '../savedBriefings'
import { usePreferences } from '../preferences'
import '../geolocation.css'

type Point = { latitude: number; longitude: number }
type Mark = Point & { name: string }
type IodaPoints = {
  startCentre: Point
  mark1: Point
  mark2: Point
  gate3S: Point
  gate3P: Point
  finishCentre: Point
}

type Props = {
  latitude: number
  longitude: number
  axis: number
  windwardOffset: number
  firstLegNm: number
  committeeLatitude?: number
  committeeLongitude?: number
  committeeAccuracy?: string
}

const IODA_POINT_KEYS: Array<keyof IodaPoints> = ['startCentre', 'mark1', 'mark2', 'gate3S', 'gate3P', 'finishCentre']

function radians(value: number) { return value * Math.PI / 180 }
function degrees(value: number) { return value * 180 / Math.PI }
function normalize(value: number) { return ((value % 360) + 360) % 360 }

function destination(point: Point, bearing: number, distanceNm: number): Point {
  const radius = 6371
  const angular = distanceNm * 1.852 / radius
  const brg = radians(normalize(bearing))
  const lat1 = radians(point.latitude)
  const lon1 = radians(point.longitude)
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(brg))
  const lon2 = lon1 + Math.atan2(Math.sin(brg) * Math.sin(angular) * Math.cos(lat1), Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2))
  return { latitude: degrees(lat2), longitude: degrees(lon2) }
}

function lineAround(point: Point, bearing: number, halfWidthNm: number) {
  return { left: destination(point, bearing - 90, halfWidthNm), right: destination(point, bearing + 90, halfWidthNm) }
}

function midpoint(a: Point, b: Point): Point {
  return { latitude: (a.latitude + b.latitude) / 2, longitude: (a.longitude + b.longitude) / 2 }
}

function iodaPointList(points: IodaPoints): Point[] {
  return IODA_POINT_KEYS.map((key) => points[key])
}

async function waterState(points: Point[]): Promise<'water' | 'land' | 'unknown'> {
  const elevations = await fetchElevations(points)
  if (elevations.some((value) => value === null)) return 'unknown'
  return elevations.some((value) => isLandElevation(value)) ? 'land' : 'water'
}

async function nearestWaterIoda(points: IodaPoints): Promise<IodaPoints | null> {
  const distances = [0.05, 0.1, 0.2, 0.35, 0.5, 0.75, 1, 1.5]
  const candidates: IodaPoints[] = distances.flatMap((distanceNm) =>
    Array.from({ length: 8 }, (_, index) => {
      const direction = index * 45
      return Object.fromEntries(
        IODA_POINT_KEYS.map((key) => [key, destination(points[key], direction, distanceNm)]),
      ) as IodaPoints
    }),
  )
  const elevations = await fetchElevations(candidates.flatMap(iodaPointList))
  for (let index = 0; index < candidates.length; index += 1) {
    const candidateElevations = elevations.slice(index * IODA_POINT_KEYS.length, (index + 1) * IODA_POINT_KEYS.length)
    if (candidateElevations.every((value) => value !== null && !isLandElevation(value))) return candidates[index]
  }
  return null
}

export function IodaCoursePreview({ latitude, longitude, axis, windwardOffset, firstLegNm, committeeLatitude, committeeLongitude, committeeAccuracy = '' }: Props) {
  const { language } = usePreferences()
  const c = useMemo(() => ({
    fr: { title: 'Parcours IODA officiel', sequence: 'Départ → 1 (bâbord) → 2 (bâbord) → porte 3S/3P → arrivée', start: 'Départ', finish: 'Arrivée', mark1: '1 · au vent', mark2: '2 · extérieur', gateS: '3S · porte', gateP: '3P · porte', gate: 'Porte 3S/3P', official: 'Trapèze extérieur IODA · arrivée au terme du second près', committee: 'Comité / bateau coach', note: 'Le tracé et l’analyse utilisent la même géométrie IODA.', dragHint: 'Touchez puis faites glisser le départ, les bouées, la porte ou l’arrivée pour ajuster le parcours.', moved: 'déplacé · parcours IODA mis à jour', moveCourse: 'Décaler tout le parcours', moveHelp: 'Déplace le départ, toutes les bouées et l’arrivée sans déformer le tracé', step: 'Pas', north: 'nord', south: 'sud', east: 'est', west: 'ouest', wholeMoved: 'Parcours entier déplacé', checkingLand: 'Contrôle terre / mer…', landRejected: 'ne peut pas être placé sur terre · position précédente restaurée', landCheckUnavailable: 'Contrôle terre / mer indisponible · déplacement annulé', landWarning: 'Parcours IODA invalide : certaines bouées restent sur terre', autoMoved: 'Parcours IODA décalé automatiquement vers l’eau', wholeMoveRejected: 'Déplacement global refusé : au moins un point arriverait sur terre' },
    en: { title: 'Official IODA course', sequence: 'Start → 1 (port) → 2 (port) → 3S/3P gate → finish', start: 'Start', finish: 'Finish', mark1: '1 · windward', mark2: '2 · outer', gateS: '3S · gate', gateP: '3P · gate', gate: '3S/3P gate', official: 'IODA outer-loop trapezoid · finish at the end of the second windward leg', committee: 'Committee / coach boat', note: 'The layout and course analysis use the same IODA geometry.', dragHint: 'Touch and drag the start, marks, gate or finish to adjust the course.', moved: 'moved · IODA course updated', moveCourse: 'Shift the whole course', moveHelp: 'Moves the start, every mark and the finish without changing the layout', step: 'Step', north: 'north', south: 'south', east: 'east', west: 'west', wholeMoved: 'Whole course shifted', checkingLand: 'Checking land / water…', landRejected: 'cannot be placed ashore · previous position restored', landCheckUnavailable: 'Land / water check unavailable · move cancelled', landWarning: 'Invalid IODA course: some marks remain ashore', autoMoved: 'IODA course automatically shifted onto the water', wholeMoveRejected: 'Whole-course move rejected: at least one point would land ashore' },
    it: { title: 'Percorso IODA ufficiale', sequence: 'Partenza → 1 (sinistra) → 2 (sinistra) → cancello 3S/3P → arrivo', start: 'Partenza', finish: 'Arrivo', mark1: '1 · bolina', mark2: '2 · esterna', gateS: '3S · cancello', gateP: '3P · cancello', gate: 'Cancello 3S/3P', official: 'Trapezio esterno IODA · arrivo al termine della seconda bolina', committee: 'Comitato / barca coach', note: 'Tracciato e analisi usano la stessa geometria IODA.', dragHint: 'Tocca e trascina partenza, boe, cancello o arrivo per regolare il percorso.', moved: 'spostato · percorso IODA aggiornato', moveCourse: 'Sposta tutto il percorso', moveHelp: 'Sposta partenza, tutte le boe e arrivo senza deformare il tracciato', step: 'Passo', north: 'nord', south: 'sud', east: 'est', west: 'ovest', wholeMoved: 'Intero percorso spostato', checkingLand: 'Controllo terra / acqua…', landRejected: 'non può essere posizionato a terra · posizione precedente ripristinata', landCheckUnavailable: 'Controllo terra / acqua non disponibile · spostamento annullato', landWarning: 'Percorso IODA non valido: alcune boe restano a terra', autoMoved: 'Percorso IODA spostato automaticamente sull’acqua', wholeMoveRejected: 'Spostamento globale rifiutato: almeno un punto finirebbe a terra' },
    es: { title: 'Recorrido IODA oficial', sequence: 'Salida → 1 (babor) → 2 (babor) → puerta 3S/3P → llegada', start: 'Salida', finish: 'Llegada', mark1: '1 · barlovento', mark2: '2 · exterior', gateS: '3S · puerta', gateP: '3P · puerta', gate: 'Puerta 3S/3P', official: 'Trapecio exterior IODA · llegada al final de la segunda ceñida', committee: 'Comité / barco del entrenador', note: 'El trazado y el análisis usan la misma geometría IODA.', dragHint: 'Toca y arrastra la salida, las balizas, la puerta o la llegada para ajustar el recorrido.', moved: 'movido · recorrido IODA actualizado', moveCourse: 'Desplazar todo el recorrido', moveHelp: 'Mueve la salida, todas las boyas y la llegada sin deformar el trazado', step: 'Paso', north: 'norte', south: 'sur', east: 'este', west: 'oeste', wholeMoved: 'Recorrido completo desplazado', checkingLand: 'Comprobando tierra / agua…', landRejected: 'no puede colocarse en tierra · posición anterior restaurada', landCheckUnavailable: 'Comprobación tierra / agua no disponible · movimiento cancelado', landWarning: 'Recorrido IODA no válido: algunas boyas siguen en tierra', autoMoved: 'Recorrido IODA desplazado automáticamente al agua', wholeMoveRejected: 'Desplazamiento global rechazado: al menos un punto quedaría en tierra' },
  }[language]), [language])
  const mapElement = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  const [status, setStatus] = useState('')
  const [shiftStepMeters, setShiftStepMeters] = useState(50)
  const bearing = normalize(axis + windwardOffset)

  const defaultPoints = useMemo<IodaPoints>(() => {
    const startCentre = destination({ latitude, longitude }, bearing + 180, firstLegNm * 0.42)
    const mark1 = destination(startCentre, bearing, firstLegNm)
    const mark2 = destination(mark1, bearing + 225, firstLegNm * 0.72)
    const gateCentre = destination(mark2, bearing + 180, firstLegNm * 0.78)
    const gateHalfWidth = Math.max(0.025, Math.min(0.055, firstLegNm * 0.09))
    const gate3S = destination(gateCentre, bearing - 90, gateHalfWidth)
    const gate3P = destination(gateCentre, bearing + 90, gateHalfWidth)
    const finishCentre = destination(gateCentre, bearing, firstLegNm * 0.72)
    return { startCentre, mark1, mark2, gate3S, gate3P, finishCentre }
  }, [latitude, longitude, bearing, firstLegNm])

  const [points, setPoints] = useState<IodaPoints>(defaultPoints)
  useEffect(() => {
    let cancelled = false
    setPoints(defaultPoints)
    setStatus(c.checkingLand)
    void waterState(iodaPointList(defaultPoints)).then(async (state) => {
      if (cancelled) return
      if (state === 'water') {
        setStatus('')
        return
      }
      if (state === 'unknown') {
        setStatus(c.landCheckUnavailable)
        return
      }
      const corrected = await nearestWaterIoda(defaultPoints)
      if (cancelled) return
      if (corrected) {
        setPoints(corrected)
        setStatus(c.autoMoved)
      } else {
        setStatus(c.landWarning)
      }
    })
    return () => { cancelled = true }
  }, [defaultPoints, c])

  const layout = useMemo(() => {
    const gateCentre = midpoint(points.gate3S, points.gate3P)
    const startLine = lineAround(points.startCentre, bearing, Math.max(0.04, Math.min(0.09, firstLegNm * 0.13)))
    const finishLine = lineAround(points.finishCentre, bearing, Math.max(0.03, Math.min(0.075, firstLegNm * 0.1)))
    const marks: Mark[] = [
      { name: c.mark1, ...points.mark1 }, { name: c.mark2, ...points.mark2 }, { name: c.gateS, ...points.gate3S }, { name: c.gateP, ...points.gate3P },
    ]
    return { ...points, gateCentre, startLine, finishLine, marks }
  }, [points, bearing, firstLegNm, c.mark1, c.mark2, c.gateS, c.gateP])

  const moveWholeCourse = async (direction: number, directionLabel: string) => {
    const distanceNm = shiftStepMeters / 1852
    const shifted: IodaPoints = Object.fromEntries(
      IODA_POINT_KEYS.map((key) => [key, destination(points[key], direction, distanceNm)]),
    ) as IodaPoints
    setStatus(c.checkingLand)
    const state = await waterState(iodaPointList(shifted))
    if (state === 'water') {
      setPoints(shifted)
      setStatus(`${c.wholeMoved} · ${shiftStepMeters} m ${directionLabel}`)
    } else if (state === 'land') {
      setStatus(c.wholeMoveRejected)
    } else {
      setStatus(c.landCheckUnavailable)
    }
  }

  useEffect(() => {
    publishCourseAnalysisPosition({
      originLatitude: latitude,
      originLongitude: longitude,
      latitude: (layout.startCentre.latitude + layout.mark1.latitude) / 2,
      longitude: (layout.startCentre.longitude + layout.mark1.longitude) / 2,
    })
  }, [latitude, longitude, layout])

  useEffect(() => {
    const storageKey = `coachbrief:course-variants:v1:IODA:${latitude.toFixed(3)}:${longitude.toFixed(3)}`
    writeCurrentCourseSnapshot({
      storageKey,
      courseType: 'IODA',
      bearing,
      points: [
        { name: c.start, ...layout.startCentre },
        { name: c.mark1, ...layout.mark1 },
        { name: c.mark2, ...layout.mark2 },
        { name: c.gateS, ...layout.gate3S },
        { name: c.gateP, ...layout.gate3P },
        { name: c.gate, ...layout.gateCentre },
        { name: c.finish, ...layout.finishCentre },
      ],
      routeOrder: [0, 1, 2, 5, 6],
      variants: [],
      activeVariantId: 'auto',
      activeVariantName: 'IODA officiel',
    })
  }, [latitude, longitude, bearing, layout, c])

  useEffect(() => {
    let cancelled = false
    let map: any = null
    let refresh: EventListener | null = null
    let resizeObserver: ResizeObserver | null = null
    const container = mapElement.current

    if (!container) return

    void loadLeaflet().then((leaflet) => {
      if (cancelled || !mapElement.current) return

      const activeContainer = mapElement.current as HTMLDivElement & { _leaflet_id?: number }
      if (mapRef.current) {
        try { mapRef.current.remove() } catch { /* stale Leaflet instance */ }
        mapRef.current = null
      }
      if (activeContainer._leaflet_id) delete activeContainer._leaflet_id
      activeContainer.replaceChildren()

      map = leaflet.map(activeContainer, { zoomControl: true, attributionControl: true })
      mapRef.current = map

      leaflet.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map)
      const ll = (p: Point): [number, number] => [p.latitude, p.longitude]

      leaflet.polyline([ll(layout.startCentre), ll(layout.mark1), ll(layout.mark2), ll(layout.gate3S), ll(layout.finishCentre)], { weight: 4, opacity: .86 }).addTo(map)
      leaflet.polyline([ll(layout.mark2), ll(layout.gate3P), ll(layout.finishCentre)], { weight: 3, opacity: .5, dashArray: '7 6' }).addTo(map)
      leaflet.polyline([ll(layout.startLine.left), ll(layout.startLine.right)], { weight: 5, opacity: .95 }).addTo(map)
      leaflet.polyline([ll(layout.finishLine.left), ll(layout.finishLine.right)], { weight: 4, opacity: .85, dashArray: '7 6' }).addTo(map)

      const dragIcon = leaflet.divIcon({
        className: 'course-drag-marker-icon',
        html: '<span style="display:block;width:22px;height:22px;border:3px solid #164f50;border-radius:50%;background:#fff;box-shadow:0 2px 7px rgba(0,0,0,.28);box-sizing:border-box"></span>',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      })

      const addDraggable = (key: keyof IodaPoints, point: Point, label: string, direction: string) => {
        const marker = leaflet.marker(ll(point), { draggable: true, title: label, icon: dragIcon })
          .bindTooltip(label, { permanent: true, direction, offset: [0, -12], className: 'course-point-label' })
          .addTo(map)
        marker.on('dragend', (event: any) => {
          const position = event.target.getLatLng()
          const candidate = { latitude: position.lat, longitude: position.lng }
          setStatus(c.checkingLand)
          void waterState([candidate]).then((state) => {
            if (state === 'water') {
              setPoints((current) => ({ ...current, [key]: candidate }))
              setStatus(`${label} ${c.moved}`)
            } else {
              marker.setLatLng(ll(point))
              setStatus(state === 'land' ? `${label} ${c.landRejected}` : c.landCheckUnavailable)
            }
          })
        })
      }

      addDraggable('startCentre', layout.startCentre, c.start, 'bottom')
      addDraggable('mark1', layout.mark1, c.mark1, 'top')
      addDraggable('mark2', layout.mark2, c.mark2, 'top')
      addDraggable('gate3S', layout.gate3S, c.gateS, 'top')
      addDraggable('gate3P', layout.gate3P, c.gateP, 'top')
      addDraggable('finishCentre', layout.finishCentre, c.finish, 'right')

      const hasCommittee = typeof committeeLatitude === 'number' && Number.isFinite(committeeLatitude) && typeof committeeLongitude === 'number' && Number.isFinite(committeeLongitude)
      if (hasCommittee) leaflet.circleMarker([committeeLatitude!, committeeLongitude!], { radius: 8, weight: 3, fillOpacity: .9 }).bindTooltip(`${c.committee}${committeeAccuracy ? ` · ±${committeeAccuracy} m` : ''}`, { permanent: true, direction: 'top' }).addTo(map)

      const bounds = [layout.startLine.left, layout.startLine.right, layout.finishLine.left, layout.finishLine.right, ...layout.marks].map(ll)
      const refreshMap = () => {
        if (!map || !mapElement.current) return
        const { width, height } = mapElement.current.getBoundingClientRect()
        if (width < 40 || height < 40) return
        map.invalidateSize(false)
        map.fitBounds(bounds, { padding: [32, 32] })
      }

      map.fitBounds(bounds, { padding: [32, 32] })
      refresh = ((event: CustomEvent<{ tab?: string }>) => {
        if (event.detail?.tab !== 'course') return
        window.requestAnimationFrame(refreshMap)
        window.setTimeout(refreshMap, 180)
      }) as EventListener
      window.addEventListener('coachbrief:results-tab-shown', refresh)

      if ('ResizeObserver' in window) {
        resizeObserver = new ResizeObserver(() => window.requestAnimationFrame(refreshMap))
        resizeObserver.observe(activeContainer)
      }

      window.requestAnimationFrame(refreshMap)
      window.setTimeout(refreshMap, 250)
      window.setTimeout(refreshMap, 700)
    }).catch((error: unknown) => {
      if (!cancelled) setStatus(error instanceof Error ? error.message : 'Map unavailable')
    })

    return () => {
      cancelled = true
      if (refresh) window.removeEventListener('coachbrief:results-tab-shown', refresh)
      resizeObserver?.disconnect()
      if (map) {
        try { map.remove() } catch { /* already removed */ }
      }
      if (mapRef.current === map) mapRef.current = null
      const staleContainer = container as HTMLDivElement & { _leaflet_id?: number }
      if (staleContainer._leaflet_id) delete staleContainer._leaflet_id
      staleContainer.replaceChildren()
    }
  }, [layout, committeeLatitude, committeeLongitude, committeeAccuracy, c])

  return <div className="course-preview">
    <div className="course-preview-heading"><div><strong>{c.title}</strong><small>{c.official}</small></div></div>
    <p className="course-route-sequence"><strong>{c.sequence}</strong></p>
    <div ref={mapElement} className="course-map" aria-label={c.title} style={{ minHeight: 360, width: '100%' }} />
    <small>{c.dragHint}</small><br />
    <small>{c.note}</small>

    <div className="course-shift-panel">
      <div className="course-shift-heading">
        <strong>{c.moveCourse}</strong>
        <small>{c.moveHelp}</small>
      </div>
      <label className="course-shift-step">
        <span>{c.step}</span>
        <select value={shiftStepMeters} onChange={(event) => setShiftStepMeters(Number(event.target.value))}>
          <option value={25}>25 m</option>
          <option value={50}>50 m</option>
          <option value={100}>100 m</option>
        </select>
      </label>
      <div className="course-shift-pad" aria-label={c.moveCourse}>
        <button type="button" className="shift-north" onClick={() => void moveWholeCourse(0, c.north)} aria-label={c.north} title={c.north}>↑</button>
        <button type="button" className="shift-west" onClick={() => void moveWholeCourse(270, c.west)} aria-label={c.west} title={c.west}>←</button>
        <span className="shift-centre" aria-hidden="true">◎</span>
        <button type="button" className="shift-east" onClick={() => void moveWholeCourse(90, c.east)} aria-label={c.east} title={c.east}>→</button>
        <button type="button" className="shift-south" onClick={() => void moveWholeCourse(180, c.south)} aria-label={c.south} title={c.south}>↓</button>
      </div>
    </div>

    {status && <p className="gpx-status">{status}</p>}
  </div>
}