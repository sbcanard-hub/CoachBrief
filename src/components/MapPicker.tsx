import { useEffect, useRef, useState } from 'react'
import { Crosshair, MapPin } from 'lucide-react'
import { loadLeaflet } from '../leafletLoader'

type MapPickerProps = {
  location: string
  latitude: string
  longitude: string
  onPointChange: (latitude: string, longitude: string) => void
}

const ANTIBES = { latitude: 43.5804, longitude: 7.1251 }

function parseCoordinate(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export function MapPicker({ location, latitude, longitude, onPointChange }: MapPickerProps) {
  const elementRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const [message, setMessage] = useState('Préparation de la carte…')

  useEffect(() => {
    let cancelled = false
    let map: any = null

    void loadLeaflet().then((leaflet) => {
      if (cancelled || !elementRef.current || mapRef.current) return

      const initialLatitude = parseCoordinate(latitude) ?? ANTIBES.latitude
      const initialLongitude = parseCoordinate(longitude) ?? ANTIBES.longitude
      map = leaflet.map(elementRef.current, { zoomControl: true }).setView([initialLatitude, initialLongitude], 12)

      const tiles = leaflet.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      })
      tiles.on('loading', () => setMessage('Chargement du fond de carte…'))
      tiles.on('load', () => setMessage((current) => current === 'Chargement du fond de carte…' || current === 'Préparation de la carte…'
        ? 'Cliquez sur le plan d’eau pour placer le centre du parcours.'
        : current))
      tiles.on('tileerror', () => setMessage('Le fond de carte répond lentement. La carte peut continuer à se charger progressivement.'))
      tiles.addTo(map)

      const marker = leaflet.marker([initialLatitude, initialLongitude], { draggable: true }).addTo(map)

      function savePoint(lat: number, lng: number) {
        const latText = lat.toFixed(5)
        const lngText = lng.toFixed(5)
        marker.setLatLng([lat, lng])
        onPointChange(latText, lngText)
        setMessage(`Point précis : ${latText}, ${lngText}`)
      }

      map.on('click', (event: any) => savePoint(event.latlng.lat, event.latlng.lng))
      marker.on('dragend', () => {
        const point = marker.getLatLng()
        savePoint(point.lat, point.lng)
      })

      mapRef.current = map
      markerRef.current = marker
      window.requestAnimationFrame(() => map?.invalidateSize(false))
      window.setTimeout(() => map?.invalidateSize(false), 250)
    }).catch((error: unknown) => {
      if (!cancelled) setMessage(error instanceof Error ? error.message : 'Cartographie indisponible.')
    })

    return () => {
      cancelled = true
      map?.remove()
      if (mapRef.current === map) mapRef.current = null
      markerRef.current = null
    }
  }, [])

  useEffect(() => {
    const lat = parseCoordinate(latitude)
    const lng = parseCoordinate(longitude)
    if (lat === undefined || lng === undefined || !mapRef.current || !markerRef.current) return
    markerRef.current.setLatLng([lat, lng])
  }, [latitude, longitude])

  async function centerOnLocation() {
    if (!location.trim()) {
      setMessage('Renseignez d’abord un lieu, puis recentrez la carte.')
      return
    }
    if (!mapRef.current || !markerRef.current) {
      setMessage('La carte est encore en cours de préparation…')
      return
    }

    setMessage('Recherche du lieu…')
    const params = new URLSearchParams({ name: location.trim(), count: '1', language: 'fr', format: 'json' })

    try {
      const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`)
      if (!response.ok) throw new Error()
      const data = await response.json() as { results?: Array<{ latitude: number; longitude: number; name: string }> }
      const point = data.results?.[0]
      if (!point) throw new Error()

      mapRef.current.setView([point.latitude, point.longitude], 13)
      markerRef.current.setLatLng([point.latitude, point.longitude])
      mapRef.current.invalidateSize(false)
      onPointChange(point.latitude.toFixed(5), point.longitude.toFixed(5))
      setMessage(`${point.name} trouvé. Déplacez maintenant le point sur la zone de course.`)
    } catch {
      setMessage('Lieu introuvable. Vous pouvez placer le point directement sur la carte.')
    }
  }

  return (
    <div className="map-picker">
      <div className="map-picker-heading">
        <div><MapPin size={16} /><strong>Point précis du plan d’eau</strong></div>
        <button type="button" className="map-center-button" onClick={centerOnLocation}><Crosshair size={15} /> Centrer sur le lieu</button>
      </div>
      <div ref={elementRef} className="course-map" aria-label="Carte interactive du plan d’eau" />
      <div className="map-picker-footer">
        <span>{message}</span>
        {latitude && longitude && <strong>{latitude} · {longitude}</strong>}
      </div>
    </div>
  )
}
