import { useEffect, useMemo, useRef, useState } from 'react'
import { loadLeaflet } from '../leafletLoader'
import { publishCourseAnalysisPosition } from '../courseAnalysisPosition'
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

function midpoint(a: Point, b: Point): Point {
  return { latitude: (a.latitude + b.latitude) / 2, longitude: (a.longitude + b.longitude) / 2 }
}

function lineAround(point: Point, bearing: number, halfWidthNm: number) {
  return { left: destination(point, bearing - 90, halfWidthNm), right: destination(point, bearing + 90, halfWidthNm) }
}

export function IodaCoursePreview({ latitude, longitude, axis, windwardOffset, firstLegNm, committeeLatitude, committeeLongitude, committeeAccuracy = '' }: Props) {
  const { language } = usePreferences()
  const c = {
    fr: { title: 'Parcours IODA officiel', sequence: 'Départ → 1 (bâbord) → 2 (bâbord) → porte 3S/3P → arrivée', start: 'Départ', finish: 'Arrivée', mark1: '1 · au vent', mark2: '2 · extérieur', gateS: '3S · porte', gateP: '3P · porte', official: 'Trapèze extérieur IODA · arrivée au terme du second près', committee: 'Comité / bateau coach', note: 'Le tracé et l’analyse utilisent la même géométrie IODA.' },
    en: { title: 'Official IODA course', sequence: 'Start → 1 (port) → 2 (port) → 3S/3P gate → finish', start: 'Start', finish: 'Finish', mark1: '1 · windward', mark2: '2 · outer', gateS: '3S · gate', gateP: '3P · gate', official: 'IODA outer-loop trapezoid · finish at the end of the second windward leg', committee: 'Committee / coach boat', note: 'The layout and course analysis use the same IODA geometry.' },
    it: { title: 'Percorso IODA ufficiale', sequence: 'Partenza → 1 (sinistra) → 2 (sinistra) → cancello 3S/3P → arrivo', start: 'Partenza', finish: 'Arrivo', mark1: '1 · bolina', mark2: '2 · esterna', gateS: '3S · cancello', gateP: '3P · cancello', official: 'Trapezio esterno IODA · arrivo al termine della seconda bolina', committee: 'Comitato / barca coach', note: 'Tracciato e analisi usano la stessa geometria IODA.' },
    es: { title: 'Recorrido IODA oficial', sequence: 'Salida → 1 (babor) → 2 (babor) → puerta 3S/3P → llegada', start: 'Salida', finish: 'Llegada', mark1: '1 · barlovento', mark2: '2 · exterior', gateS: '3S · puerta', gateP: '3P · puerta', official: 'Trapecio exterior IODA · llegada al final de la segunda ceñida', committee: 'Comité / barco del entrenador', note: 'El trazado y el análisis usan la misma geometría IODA.' },
  }[language]
  const mapElement = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  const [status, setStatus] = useState('')
  const bearing = normalize(axis + windwardOffset)

  const layout = useMemo(() => {
    // Geometry follows the IODA outer-loop shape: first beat on the right side,
    // outer reach to mark 2, run to the 3S/3P gate, then a second beat to finish.
    const startCentre = destination({ latitude, longitude }, bearing + 180, firstLegNm * 0.42)
    const mark1 = destination(startCentre, bearing, firstLegNm)
    const mark2 = destination(mark1, bearing + 225, firstLegNm * 0.72)
    const gateCentre = destination(mark2, bearing + 180, firstLegNm * 0.78)
    const gateHalfWidth = Math.max(0.025, Math.min(0.055, firstLegNm * 0.09))
    const gate3S = destination(gateCentre, bearing - 90, gateHalfWidth)
    const gate3P = destination(gateCentre, bearing + 90, gateHalfWidth)
    // Official IODA finish is at the end of the second windward leg, near mark 2.
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
    let cancelled = false
    let map: any = null
    let refresh: EventListener | null = null
    void loadLeaflet().then((leaflet) => {
      if (cancelled || !mapElement.current) return
      mapRef.current?.remove()
      map = leaflet.map(mapElement.current, { zoomControl: true, attributionControl: true })
      leaflet.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map)
      const ll = (p: Point): [number, number] => [p.latitude, p.longitude]

      // Two possible paths through the leeward gate are shown so the analysis does not invent a single mandatory gate mark.
      leaflet.polyline([ll(layout.startCentre), ll(layout.mark1), ll(layout.mark2), ll(layout.gate3S), ll(layout.finishCentre)], { weight: 4, opacity: .86 }).addTo(map)
      leaflet.polyline([ll(layout.mark2), ll(layout.gate3P), ll(layout.finishCentre)], { weight: 3, opacity: .5, dashArray: '7 6' }).addTo(map)
      leaflet.polyline([ll(layout.startLine.left), ll(layout.startLine.right)], { weight: 5, opacity: .95 }).addTo(map)
      leaflet.polyline([ll(layout.finishLine.left), ll(layout.finishLine.right)], { weight: 4, opacity: .85, dashArray: '7 6' }).addTo(map)

      layout.marks.forEach((mark) => leaflet.marker(ll(mark), { title: mark.name }).bindTooltip(mark.name, { permanent: true, direction: 'top' }).addTo(map))
      leaflet.circleMarker(ll(layout.startCentre), { radius: 5, weight: 2, fillOpacity: .75 }).bindTooltip(c.start, { permanent: true, direction: 'bottom' }).addTo(map)
      leaflet.circleMarker(ll(layout.finishCentre), { radius: 5, weight: 2, fillOpacity: .75 }).bindTooltip(c.finish, { permanent: true, direction: 'right' }).addTo(map)

      const hasCommittee = typeof committeeLatitude === 'number' && Number.isFinite(committeeLatitude) && typeof committeeLongitude === 'number' && Number.isFinite(committeeLongitude)
      if (hasCommittee) leaflet.marker([committeeLatitude!, committeeLongitude!], { title: c.committee }).bindTooltip(`${c.committee}${committeeAccuracy ? ` · ±${committeeAccuracy} m` : ''}`).addTo(map)

      const bounds = [layout.startLine.left, layout.startLine.right, layout.finishLine.left, layout.finishLine.right, ...layout.marks].map(ll)
      map.fitBounds(bounds, { padding: [32, 32] })
      mapRef.current = map
      refresh = ((event: CustomEvent<{ tab?: string }>) => {
        if (event.detail?.tab !== 'course') return
        map.invalidateSize(false)
        map.fitBounds(bounds, { padding: [32, 32] })
      }) as EventListener
      window.addEventListener('coachbrief:results-tab-shown', refresh)
      window.requestAnimationFrame(() => map.invalidateSize(false))
      window.setTimeout(() => map.invalidateSize(false), 250)
    }).catch((error: unknown) => setStatus(error instanceof Error ? error.message : 'Map unavailable'))
    return () => { cancelled = true; if (refresh) window.removeEventListener('coachbrief:results-tab-shown', refresh); map?.remove() }
  }, [layout, committeeLatitude, committeeLongitude, committeeAccuracy, c])

  return <div className="course-preview">
    <div className="course-preview-heading"><div><strong>{c.title}</strong><small>{c.official}</small></div></div>
    <p className="course-route-sequence"><strong>{c.sequence}</strong></p>
    <div ref={mapElement} className="course-map" aria-label={c.title} />
    <small>{c.note}</small>
    {status && <p className="gpx-status">{status}</p>}
  </div>
}
