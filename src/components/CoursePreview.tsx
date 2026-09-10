import { useEffect, useRef } from 'react'
import type { CourseType } from '../types'

type CoursePreviewProps = {
  latitude: number
  longitude: number
  axis: number
  windwardOffset: number
  firstLegNm: number
  courseType: CourseType
}

type LeafletWindow = Window & { L?: any }
type Point = { latitude: number; longitude: number }
type CourseMark = { label: string; point: Point }
type CourseGeometry = {
  start: Point
  startLeft: Point
  startRight: Point
  finish: Point
  finishLeft: Point
  finishRight: Point
  marks: CourseMark[]
  route: Point[]
  sequence: string
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

function lineAround(point: Point, courseBearing: number, halfWidthNm: number) {
  return {
    left: destination(point, courseBearing - 90, halfWidthNm),
    right: destination(point, courseBearing + 90, halfWidthNm),
  }
}

function buildCourseGeometry(center: Point, bearing: number, firstLegNm: number, courseType: CourseType): CourseGeometry {
  const start = destination(center, bearing + 180, firstLegNm / 2)
  const markOne = destination(center, bearing, firstLegNm / 2)
  const lineHalfWidth = Math.min(0.09, Math.max(0.035, firstLegNm * 0.12))
  const startLine = lineAround(start, bearing, lineHalfWidth)

  if (courseType === 'Triangle') {
    const markTwo = destination(markOne, bearing + 135, firstLegNm * 0.78)
    const markThree = destination(markOne, bearing + 180, firstLegNm * 0.92)
    const finish = destination(markThree, bearing + 180, firstLegNm * 0.16)
    const finishLine = lineAround(finish, bearing, lineHalfWidth * 0.85)
    return {
      start,
      startLeft: startLine.left,
      startRight: startLine.right,
      finish,
      finishLeft: finishLine.left,
      finishRight: finishLine.right,
      marks: [
        { label: 'Bouée 1 · au vent', point: markOne },
        { label: 'Bouée 2 · reaching', point: markTwo },
        { label: 'Bouée 3 · sous le vent', point: markThree },
      ],
      route: [start, markOne, markTwo, markThree, finish],
      sequence: 'Départ → 1 → 2 → 3 → arrivée',
    }
  }

  if (courseType === 'Trapèze') {
    const markTwo = destination(markOne, bearing + 110, firstLegNm * 0.58)
    const markThree = destination(markTwo, bearing + 180, firstLegNm * 0.72)
    const markFour = destination(markThree, bearing + 250, firstLegNm * 0.58)
    const finish = destination(markFour, bearing + 180, firstLegNm * 0.15)
    const finishLine = lineAround(finish, bearing, lineHalfWidth * 0.85)
    return {
      start,
      startLeft: startLine.left,
      startRight: startLine.right,
      finish,
      finishLeft: finishLine.left,
      finishRight: finishLine.right,
      marks: [
        { label: 'Bouée 1 · au vent', point: markOne },
        { label: 'Bouée 2 · travers haut', point: markTwo },
        { label: 'Bouée 3 · sous le vent', point: markThree },
        { label: 'Bouée 4 · travers bas', point: markFour },
      ],
      route: [start, markOne, markTwo, markThree, markFour, finish],
      sequence: 'Départ → 1 → 2 → 3 → 4 → arrivée',
    }
  }

  const markTwo = destination(markOne, bearing + 180, firstLegNm * 0.9)
  const finish = destination(markOne, bearing + 180, firstLegNm * 0.82)
  const finishLine = lineAround(finish, bearing, lineHalfWidth * 0.85)
  return {
    start,
    startLeft: startLine.left,
    startRight: startLine.right,
    finish,
    finishLeft: finishLine.left,
    finishRight: finishLine.right,
    marks: [
      { label: 'Bouée 1 · au vent', point: markOne },
      { label: 'Bouée 2 · sous le vent', point: markTwo },
    ],
    route: [start, markOne, markTwo, markOne, finish],
    sequence: 'Départ → 1 → 2 → 1 → arrivée',
  }
}

function latLng(point: Point): [number, number] {
  return [point.latitude, point.longitude]
}

export function CoursePreview({ latitude, longitude, axis, windwardOffset, firstLegNm, courseType }: CoursePreviewProps) {
  const elementRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  const bearing = normalizeBearing(axis + windwardOffset)
  const geometry = buildCourseGeometry({ latitude, longitude }, bearing, firstLegNm, courseType)

  useEffect(() => {
    const leaflet = (window as LeafletWindow).L
    if (!leaflet || !elementRef.current) return

    mapRef.current?.remove()
    const map = leaflet.map(elementRef.current, { zoomControl: true, attributionControl: true })
    leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map)

    leaflet.polyline(geometry.route.map(latLng), { weight: 4, opacity: 0.85 }).addTo(map)
    leaflet.polyline([latLng(geometry.startLeft), latLng(geometry.startRight)], { weight: 5, opacity: 0.95 }).addTo(map)
    leaflet.polyline([latLng(geometry.finishLeft), latLng(geometry.finishRight)], { weight: 4, opacity: 0.8, dashArray: '7 6' }).addTo(map)

    leaflet.circleMarker(latLng(geometry.start), { radius: 6, weight: 2, fillOpacity: 1 })
      .bindTooltip('Départ', { permanent: false })
      .addTo(map)

    geometry.marks.forEach((mark, index) => {
      leaflet.circleMarker(latLng(mark.point), { radius: 7, weight: 2, fillOpacity: 1 })
        .bindTooltip(`${index + 1} · ${mark.label}`, { permanent: false })
        .addTo(map)
    })

    leaflet.circleMarker(latLng(geometry.finish), { radius: 6, weight: 2, fillOpacity: 0.8 })
      .bindTooltip('Arrivée', { permanent: false })
      .addTo(map)

    leaflet.circleMarker([latitude, longitude], { radius: 4, weight: 1, fillOpacity: 0.55 })
      .bindTooltip('Centre choisi du plan d’eau', { permanent: false })
      .addTo(map)

    const bounds = [
      geometry.startLeft,
      geometry.startRight,
      geometry.finishLeft,
      geometry.finishRight,
      ...geometry.marks.map((mark) => mark.point),
    ].map(latLng)
    map.fitBounds(bounds, { padding: [32, 32] })

    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [latitude, longitude, bearing, firstLegNm, courseType])

  return (
    <div className="course-preview-shell">
      <div ref={elementRef} className="course-preview-map" aria-label={`Prévisualisation du parcours ${courseType}`} />
      <div className="course-preview-caption">
        <strong>{courseType}</strong>
        <span>{geometry.sequence}</span>
        <small>Axe dessiné : {String(Math.round(bearing)).padStart(3, '0')}° · schéma coach ajustable</small>
      </div>
    </div>
  )
}
