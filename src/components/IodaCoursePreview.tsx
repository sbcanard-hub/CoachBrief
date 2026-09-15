import { useEffect, useMemo, useRef, useState } from 'react'
import { loadLeaflet } from '../leafletLoader'
import { publishCourseAnalysisPosition } from '../courseAnalysisPosition'
import { writeCurrentCourseSnapshot } from '../savedBriefings'
import { usePreferences } from '../preferences'
import '../geolocation.css'

type Point = { latitude: number; longitude: number }
type Mark = Point & { name: string }

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

export function IodaCoursePreview({ latitude, longitude, axis, windwardOffset, firstLegNm, committeeLatitude, committeeLongitude, committeeAccuracy = '' }: Props) {
  const { language } = usePreferences()
  const c = useMemo(() => ({
    fr: { title: 'Parcours IODA officiel', sequence: 'Départ → 1 (bâbord) → 2 (bâbord) → porte 3S/3P → arrivée', start: 'Départ', finish: 'Arrivée', mark1: '1 · au vent', mark2: '2 · extérieur', gateS: '3S · porte', gateP: '3P · porte', gate: 'Porte 3S/3P', official: 'Trapèze extérieur IODA · arrivée au terme du second près', committee: 'Comité / bateau coach', note: 'Le tracé et l’analyse utilisent la même géométrie IODA.' },
    en: { title: 'Official IODA course', sequence: 'Start → 1 (port) → 2 (port) → 3S/3P gate → finish', start: 'Start', finish: 'Finish', mark1: '1 · windward', mark2: '2 · outer', gateS: '3S · gate', gateP: '3P · gate', gate: '3S/3P gate', official: 'IODA outer-loop trapezoid · finish at the end of the second windward leg', committee: 'Committee / coach boat', note: 'The layout and course analysis use the same IODA geometry.' },
    it: { title: 'Percorso IODA ufficiale', sequence: 'Partenza → 1 (sinistra) → 2 (sinistra) → cancello 3S/3P → arrivo', start: 'Partenza', finish: 'Arrivo', mark1: '1 · bolina', mark2: '2 · esterna', gateS: '3S · cancello', gateP: '3P · cancello', gate: 'Cancello 3S/3P', official: 'Trapezio esterno IODA · arrivo al termine della seconda bolina', committee: 'Comitato / barca coach', note: 'Tracciato e analisi usano la stessa geometria IODA.' },
    es: { title: 'Recorrido IODA oficial', sequence: 'Salida → 1 (babor) → 2 (babor) → puerta 3S/3P → llegada', start: 'Salida', finish: 'Llegada', mark1: '1 · barlovento', mark2: '2 · exterior', gateS: '3S · puerta', gateP: '3P · puerta', gate: 'Puerta 3S/3P', official: 'Trapecio exterior IODA · llegada al final de la segunda ceñida', committee: 'Comité / barco del entrenador', note: 'El trazado y el análisis usan la misma geometría IODA.' },
  }[language]), [language])
  const mapElement = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  const [status, setStatus] = useState('')
  const bearing = normalize(axis + windwardOffset)

  const layout = useMemo(() => {
    const startCentre = destination({ latitude, longitude }, bearing + 180, firstLegNm * 0.42)
    const mark1 = destination(startCentre, bearing, firstLegNm)
    const mark2 = destination(mark1, bearing + 225, firstLegNm * 0.72)
    const gateCentre = destination(mark2, bearing + 180, firstLegNm * 0.78)
    const gateHalfWidth = Math.max(0.025, Math.min(0.055, firstLegNm * 0.09))
    const gate3S = destination(gateCentre, bearing - 90, gateHalfWidth)
    const gate3P = destination(gateCentre, bearing + 90, gateHalfWidth)
    const finishCentre = destination(gateCentre, bearing, firstLegNm * 0.72)
    const startLine = lineAround(startCentre, bearing, Math.max(0.04, Math.min(0.09, firstLegNm * 0.13)))
    const finishLine = lineAround(finishCentre, bearing, Math.max(0.03, Math.min(0.075, firstLegNm * 0.1)))
    const marks: Mark[] = [
      { name: c.mark1, ...mark1 }, { name: c.mark2, ...mark2 }, { name: c.gateS, ...gate3S }, { name: c.gateP, ...gate3P },
    ]
    return { startCentre, mark1, mark2, gateCentre, gate3S, gate3P, finishCentre, startLine, finishLine, marks }
  }, [latitude, longitude, bearing, firstLegNm, c.mark1, c.mark2, c.gateS, c.gateP])

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
      setStatus('')

      leaflet.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map)
      const ll = (p: Point): [number, number] => [p.latitude, p.longitude]

      leaflet.polyline([ll(layout.startCentre), ll(layout.mark1), ll(layout.mark2), ll(layout.gate3S), ll(layout.finishCentre)], { weight: 4, opacity: .86 }).addTo(map)
      leaflet.polyline([ll(layout.mark2), ll(layout.gate3P), ll(layout.finishCentre)], { weight: 3, opacity: .5, dashArray: '7 6' }).addTo(map)
      leaflet.polyline([ll(layout.startLine.left), ll(layout.startLine.right)], { weight: 5, opacity: .95 }).addTo(map)
      leaflet.polyline([ll(layout.finishLine.left), ll(layout.finishLine.right)], { weight: 4, opacity: .85, dashArray: '7 6' }).addTo(map)

      layout.marks.forEach((mark) => leaflet.circleMarker(ll(mark), { radius: 7, weight: 3, fillOpacity: .9 }).bindTooltip(mark.name, { permanent: true, direction: 'top' }).addTo(map))
      leaflet.circleMarker(ll(layout.startCentre), { radius: 6, weight: 3, fillOpacity: .9 }).bindTooltip(c.start, { permanent: true, direction: 'bottom' }).addTo(map)
      leaflet.circleMarker(ll(layout.finishCentre), { radius: 6, weight: 3, fillOpacity: .9 }).bindTooltip(c.finish, { permanent: true, direction: 'right' }).addTo(map)

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
    <small>{c.note}</small>
    {status && <p className="gpx-status">{status}</p>}
  </div>
}
