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

export function CoursePreview({ latitude, longitude, axis, windwardOffset, firstLegNm, courseType }: CoursePreviewProps) {
  const elementRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)

  useEffect(() => {
    const leaflet = (window as LeafletWindow).L
    if (!leaflet || !elementRef.current) return

    mapRef.current?.remove()

    const center = { latitude, longitude }
    const bearing = normalizeBearing(axis + windwardOffset)
    const start = destination(center, bearing + 180, firstLegNm / 2)
    const markOne = destination(center, bearing, firstLegNm / 2)
    const startLeft = destination(start, bearing - 90, Math.min(0.08, firstLegNm * 0.12))
    const startRight = destination(start, bearing + 90, Math.min(0.08, firstLegNm * 0.12))

    const map = leaflet.map(elementRef.current, { zoomControl: true, attributionControl: true })
    leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map)

    leaflet.polyline([
      [start.latitude, start.longitude],
      [markOne.latitude, markOne.longitude],
    ], { weight: 4, opacity: 0.85 }).addTo(map)

    leaflet.polyline([
      [startLeft.latitude, startLeft.longitude],
      [startRight.latitude, startRight.longitude],
    ], { weight: 5, opacity: 0.9 }).addTo(map)

    leaflet.circleMarker([start.latitude, start.longitude], { radius: 6, weight: 2, fillOpacity: 1 })
      .bindTooltip('Ligne de départ', { permanent: false })
      .addTo(map)

    leaflet.circleMarker([markOne.latitude, markOne.longitude], { radius: 7, weight: 2, fillOpacity: 1 })
      .bindTooltip(`Bouée 1 · ${courseType}`, { permanent: false })
      .addTo(map)

    leaflet.circleMarker([center.latitude, center.longitude], { radius: 4, weight: 1, fillOpacity: 0.6 })
      .bindTooltip('Centre choisi du plan d’eau', { permanent: false })
      .addTo(map)

    map.fitBounds([
      [startLeft.latitude, startLeft.longitude],
      [startRight.latitude, startRight.longitude],
      [markOne.latitude, markOne.longitude],
    ], { padding: [28, 28] })

    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [latitude, longitude, axis, windwardOffset, firstLegNm, courseType])

  return <div ref={elementRef} className="course-preview-map" aria-label="Prévisualisation cartographique du premier bord" />
}
