import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, RotateCcw, Upload } from 'lucide-react'
import { courseToGpx, parseCourseGpx } from '../gpx'
import type { GpxPoint } from '../gpx'
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

type DefaultCourse = {
  points: GpxPoint[]
  routeOrder: number[]
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

function buildDefaultCourse(center: Point, bearing: number, firstLegNm: number, courseType: CourseType): DefaultCourse {
  const start = destination(center, bearing + 180, firstLegNm / 2)
  const markOne = destination(center, bearing, firstLegNm / 2)

  if (courseType === 'Triangle') {
    const markTwo = destination(markOne, bearing + 135, firstLegNm * 0.78)
    const markThree = destination(markOne, bearing + 180, firstLegNm * 0.92)
    const finish = destination(markThree, bearing + 180, firstLegNm * 0.16)
    return {
      points: [
        { name: 'Départ', ...start },
        { name: 'Bouée 1 · au vent', ...markOne },
        { name: 'Bouée 2 · reaching', ...markTwo },
        { name: 'Bouée 3 · sous le vent', ...markThree },
        { name: 'Arrivée', ...finish },
      ],
      routeOrder: [0, 1, 2, 3, 4],
    }
  }

  if (courseType === 'Trapèze') {
    const markTwo = destination(markOne, bearing + 110, firstLegNm * 0.58)
    const markThree = destination(markTwo, bearing + 180, firstLegNm * 0.72)
    const markFour = destination(markThree, bearing + 250, firstLegNm * 0.58)
    const finish = destination(markFour, bearing + 180, firstLegNm * 0.15)
    return {
      points: [
        { name: 'Départ', ...start },
        { name: 'Bouée 1 · au vent', ...markOne },
        { name: 'Bouée 2 · travers haut', ...markTwo },
        { name: 'Bouée 3 · sous le vent', ...markThree },
        { name: 'Bouée 4 · travers bas', ...markFour },
        { name: 'Arrivée', ...finish },
      ],
      routeOrder: [0, 1, 2, 3, 4, 5],
    }
  }

  const markTwo = destination(markOne, bearing + 180, firstLegNm * 0.9)
  const finish = destination(markOne, bearing + 180, firstLegNm * 0.82)
  return {
    points: [
      { name: 'Départ', ...start },
      { name: 'Bouée 1 · au vent', ...markOne },
      { name: 'Bouée 2 · sous le vent', ...markTwo },
      { name: 'Arrivée', ...finish },
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

export function CoursePreview({ latitude, longitude, axis, windwardOffset, firstLegNm, courseType }: CoursePreviewProps) {
  const elementRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const bearing = normalizeBearing(axis + windwardOffset)
  const defaultCourse = useMemo(
    () => buildDefaultCourse({ latitude, longitude }, bearing, firstLegNm, courseType),
    [latitude, longitude, bearing, firstLegNm, courseType],
  )
  const [points, setPoints] = useState<GpxPoint[]>(defaultCourse.points)
  const [routeOrder, setRouteOrder] = useState<number[]>(defaultCourse.routeOrder)
  const [gpxStatus, setGpxStatus] = useState('')

  useEffect(() => {
    setPoints(defaultCourse.points)
    setRouteOrder(defaultCourse.routeOrder)
    setGpxStatus('')
  }, [defaultCourse])

  useEffect(() => {
    const leaflet = (window as LeafletWindow).L
    if (!leaflet || !elementRef.current || points.length < 2) return

    mapRef.current?.remove()
    const map = leaflet.map(elementRef.current, { zoomControl: true, attributionControl: true })
    leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
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
      const marker = leaflet.marker(latLng(point), { draggable: true, title: point.name })
        .bindTooltip(`${index + 1}. ${point.name}`, { permanent: false })
        .addTo(map)

      marker.on('dragend', (event: any) => {
        const position = event.target.getLatLng()
        setPoints((current) => current.map((item, itemIndex) => itemIndex === index
          ? { ...item, latitude: position.lat, longitude: position.lng }
          : item))
        setGpxStatus(`${point.name} déplacé`)
      })
    })

    leaflet.circleMarker([latitude, longitude], { radius: 4, weight: 1, fillOpacity: 0.55 })
      .bindTooltip('Centre choisi du plan d’eau', { permanent: false })
      .addTo(map)

    const bounds = [startLine.left, startLine.right, finishLine.left, finishLine.right, ...points].map(latLng)
    map.fitBounds(bounds, { padding: [32, 32] })

    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [latitude, longitude, bearing, firstLegNm, points, routeOrder])

  function resetCourse() {
    setPoints(defaultCourse.points)
    setRouteOrder(defaultCourse.routeOrder)
    setGpxStatus('Tracé recalculé')
  }

  function exportGpx() {
    const content = courseToGpx(points, `CoachBrief · ${courseType}`)
    const blob = new Blob([content], { type: 'application/gpx+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `coachbrief-${courseType.toLowerCase().replace('è', 'e')}.gpx`
    link.click()
    URL.revokeObjectURL(url)
    setGpxStatus('GPX exporté')
  }

  async function importGpx(file: File | undefined) {
    if (!file) return
    try {
      const imported = parseCourseGpx(await file.text())
      const importedPoints = imported.points.map((point, index) => ({
        ...point,
        name: point.name || (index === 0 ? 'Départ' : index === imported.points.length - 1 ? 'Arrivée' : `Bouée ${index}`),
      }))
      setPoints(importedPoints)
      setRouteOrder(routeOrderForImported(courseType, importedPoints.length))
      setGpxStatus(`${importedPoints.length} points importés`)
    } catch (error) {
      setGpxStatus(error instanceof Error ? error.message : 'Import GPX impossible')
    } finally {
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="course-preview-shell">
      <div ref={elementRef} className="course-preview-map" aria-label={`Prévisualisation du parcours ${courseType}`} />
      <div className="course-preview-caption">
        <div>
          <strong>{courseType}</strong>
          <span>{routeSequence(points, routeOrder)}</span>
          <small>Axe : {String(Math.round(bearing)).padStart(3, '0')}° · faites glisser les points pour ajuster le tracé</small>
        </div>
        <div className="course-preview-actions">
          <input ref={inputRef} type="file" accept=".gpx,application/gpx+xml,application/xml,text/xml" hidden onChange={(event) => void importGpx(event.target.files?.[0])} />
          <button type="button" onClick={() => inputRef.current?.click()}><Upload size={14} /> Importer GPX</button>
          <button type="button" onClick={exportGpx}><Download size={14} /> Exporter GPX</button>
          <button type="button" onClick={resetCourse}><RotateCcw size={14} /> Recalculer</button>
        </div>
        {gpxStatus && <small className="course-gpx-status" role="status">{gpxStatus}</small>}
      </div>
    </div>
  )
}
