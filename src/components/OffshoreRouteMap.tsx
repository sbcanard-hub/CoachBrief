import { useEffect, useRef } from 'react'
import { loadLeaflet } from '../leafletLoader'
import type { OffshorePoint } from '../offshore'
import type { IsochroneResult } from '../offshoreIsochrone'

function valid(point: OffshorePoint) {
  const lat = Number(point.latitude)
  const lon = Number(point.longitude)
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
}

type Props = {
  points: OffshorePoint[]
  onPointChange: (id: string, latitude: string, longitude: string) => void
  isochrones?: IsochroneResult | null
}

export function OffshoreRouteMap({ points, onPointChange, isochrones = null }: Props) {
  const elementRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  const layerRef = useRef<any>(null)

  useEffect(() => {
    let cancelled = false
    void loadLeaflet().then((leaflet) => {
      if (cancelled || !elementRef.current) return
      if (!mapRef.current) {
        const map = leaflet.map(elementRef.current, { zoomControl: true }).setView([46.5, -2.5], 5)
        leaflet.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map)
        mapRef.current = map
      }

      const map = mapRef.current
      if (layerRef.current) layerRef.current.remove()
      const group = leaflet.layerGroup().addTo(map)
      layerRef.current = group

      const usable = points.filter(valid)
      const latLngs = usable.map((point) => [Number(point.latitude), Number(point.longitude)] as [number, number])

      // Route géométrique saisie : volontairement neutre et en pointillés pour ne pas masquer le routage calculé.
      if (latLngs.length >= 2) {
        leaflet.polyline(latLngs, {
          color: '#687386',
          weight: 3,
          opacity: .75,
          dashArray: '9 8',
        }).bindTooltip('Route directe / waypoints saisis').addTo(group)
      }

      if (isochrones) {
        // Fronts d'isochrones : fins et discrets.
        isochrones.steps.slice(1).forEach((step) => {
          const front = step.nodes.map((node) => [node.latitude, node.longitude] as [number, number])
          if (front.length >= 2) {
            leaflet.polyline(front, { color: '#287f9f', weight: 1.5, opacity: .35 }).addTo(group)
          } else if (front.length === 1) {
            leaflet.circleMarker(front[0], {
              radius: 2.5,
              color: '#287f9f',
              opacity: .55,
              fillColor: '#287f9f',
              fillOpacity: .35,
            }).addTo(group)
          }
        })

        const routed = isochrones.bestRoute.map((node) => [node.latitude, node.longitude] as [number, number])
        if (routed.length >= 2) {
          // Double trait = excellente lisibilité sur fond clair ou sombre, sans dépendre du rouge/vert.
          leaflet.polyline(routed, {
            color: '#ffffff',
            weight: 9,
            opacity: .9,
            lineCap: 'round',
            lineJoin: 'round',
          }).addTo(group)
          leaflet.polyline(routed, {
            color: '#6d3fc0',
            weight: 5,
            opacity: 1,
            lineCap: 'round',
            lineJoin: 'round',
          }).bindTooltip('Trajectoire idéale · route isochrone retenue', { sticky: true }).addTo(group)

          routed.forEach((point, index) => {
            if (index === 0 || index === routed.length - 1 || index % 4 !== 0) return
            leaflet.circleMarker(point, {
              radius: 2.7,
              color: '#ffffff',
              weight: 1.5,
              fillColor: '#6d3fc0',
              fillOpacity: 1,
              opacity: 1,
            }).addTo(group)
          })
        }
      }

      usable.forEach((point, index) => {
        const icon = leaflet.divIcon({
          className: 'offshore-map-marker',
          html: `<span>${index === 0 ? 'D' : index === usable.length - 1 ? 'A' : index}</span>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        })
        const marker = leaflet.marker([Number(point.latitude), Number(point.longitude)], { draggable: true, icon, title: point.name }).addTo(group)
        marker.bindTooltip(point.name || `Point ${index + 1}`)
        marker.on('dragend', () => {
          const next = marker.getLatLng()
          onPointChange(point.id, next.lat.toFixed(5), next.lng.toFixed(5))
        })
      })

      const boundsPoints = [...latLngs, ...(isochrones?.bestRoute.map((node) => [node.latitude, node.longitude] as [number, number]) ?? [])]
      if (boundsPoints.length >= 2) map.fitBounds(boundsPoints, { padding: [28, 28] })
      else if (boundsPoints.length === 1) map.setView(boundsPoints[0], 9)
      window.setTimeout(() => map.invalidateSize(false), 50)
    })
    return () => { cancelled = true }
  }, [points, onPointChange, isochrones])

  useEffect(() => () => {
    if (mapRef.current) {
      mapRef.current.remove()
      mapRef.current = null
      layerRef.current = null
    }
  }, [])

  return <div className="offshore-route-map" ref={elementRef} aria-label="Carte interactive de la route au large" />
}
