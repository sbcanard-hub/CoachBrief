import { useEffect, useRef, useState } from 'react'
import { Crosshair, LocateFixed, MapPin } from 'lucide-react'
import { loadLeaflet } from '../leafletLoader'
import '../geolocation.css'

type MapPickerProps = {
  location: string
  latitude: string
  longitude: string
  committeeLatitude: string
  committeeLongitude: string
  committeeAccuracy: string
  onPointChange: (latitude: string, longitude: string) => void
  onCommitteeChange: (latitude: string, longitude: string, accuracy: string) => void
}

const ANTIBES = { latitude: 43.5804, longitude: 7.1251 }
const COMMITTEE_MAX_ACCURACY_METERS = 150

function parseCoordinate(value: string) {
  if (!value.trim()) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function geolocationErrorMessage(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) {
    return 'Localisation refusée. Autorisez la position pour ce site dans les réglages du navigateur. Sur iPhone, activez aussi « Position exacte ».'
  }
  if (error.code === error.POSITION_UNAVAILABLE) {
    return 'Position GPS indisponible. Sur téléphone, activez le service de localisation et « Position exacte », puis réessayez à ciel ouvert.'
  }
  if (error.code === error.TIMEOUT) {
    return 'La localisation n’a pas obtenu de position assez précise. Réessayez à ciel ouvert. Sur ordinateur, la position peut rester approximative car il n’y a généralement pas de GPS.'
  }
  return 'Impossible de récupérer une position fiable. Ouvrez CoachBrief directement dans Safari/Chrome et vérifiez les autorisations de localisation.'
}

function isGeolocationError(error: unknown): error is GeolocationPositionError {
  return Boolean(error && typeof error === 'object' && 'code' in error)
}

function bestPositionFromWatch(onAccuracy: (accuracy: number) => void) {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    let watchId: number | null = null
    let timeoutId: number | null = null
    let best: GeolocationPosition | null = null
    let lastError: GeolocationPositionError | null = null
    let finished = false

    const finish = (error?: unknown) => {
      if (finished) return
      finished = true
      if (watchId != null) navigator.geolocation.clearWatch(watchId)
      if (timeoutId != null) window.clearTimeout(timeoutId)
      if (best) resolve(best)
      else reject(error ?? lastError ?? new Error('Position indisponible'))
    }

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (!best || position.coords.accuracy < best.coords.accuracy) best = position
        onAccuracy(position.coords.accuracy)
        if (position.coords.accuracy <= 35) finish()
      },
      (error) => {
        lastError = error
        if (error.code === error.PERMISSION_DENIED) finish(error)
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    )

    timeoutId = window.setTimeout(() => finish(lastError ?? undefined), 18000)
  })
}

export function MapPicker({
  location,
  latitude,
  longitude,
  committeeLatitude,
  committeeLongitude,
  committeeAccuracy,
  onPointChange,
  onCommitteeChange,
}: MapPickerProps) {
  const elementRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const committeeMarkerRef = useRef<any>(null)
  const leafletRef = useRef<any>(null)
  const [message, setMessage] = useState('Préparation de la carte…')
  const [locatingCommittee, setLocatingCommittee] = useState(false)

  function placeCommitteeMarker(lat: number, lng: number, accuracy = '') {
    const leaflet = leafletRef.current
    const map = mapRef.current
    if (!leaflet || !map) return

    if (!committeeMarkerRef.current) {
      const icon = leaflet.divIcon({
        className: 'committee-marker-icon',
        html: '<span>C</span>',
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      })
      const committeeMarker = leaflet.marker([lat, lng], { draggable: true, icon, title: 'Comité / bateau coach' })
        .bindTooltip('Comité / bateau coach', { permanent: false })
        .addTo(map)
      committeeMarker.on('dragend', () => {
        const point = committeeMarker.getLatLng()
        onCommitteeChange(point.lat.toFixed(5), point.lng.toFixed(5), '')
        setMessage('Position Comité ajustée manuellement.')
      })
      committeeMarkerRef.current = committeeMarker
    } else {
      committeeMarkerRef.current.setLatLng([lat, lng])
    }

    if (accuracy) setMessage(`Position Comité détectée · précision ±${accuracy} m.`)
  }

  useEffect(() => {
    let cancelled = false
    let map: any = null

    void loadLeaflet().then((leaflet) => {
      if (cancelled || !elementRef.current || mapRef.current) return

      leafletRef.current = leaflet
      const initialLatitude = parseCoordinate(latitude) ?? ANTIBES.latitude
      const initialLongitude = parseCoordinate(longitude) ?? ANTIBES.longitude
      map = leaflet.map(elementRef.current, { zoomControl: true }).setView([initialLatitude, initialLongitude], 12)

      const tiles = leaflet.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      })
      tiles.on('loading', () => setMessage('Chargement du fond de carte…'))
      tiles.on('load', () => setMessage((current) => current === 'Chargement du fond de carte…' || current === 'Préparation de la carte…'
        ? 'Cliquez sur le plan d’eau pour placer le centre du parcours, ou utilisez le GPS pour repérer le comité.'
        : current))
      tiles.on('tileerror', () => setMessage('Le fond de carte répond lentement. La carte peut continuer à se charger progressivement.'))
      tiles.addTo(map)

      const marker = leaflet.marker([initialLatitude, initialLongitude], { draggable: true }).addTo(map)

      function savePoint(lat: number, lng: number) {
        const latText = lat.toFixed(5)
        const lngText = lng.toFixed(5)
        marker.setLatLng([lat, lng])
        onPointChange(latText, lngText)
        setMessage(`Centre du parcours : ${latText}, ${lngText}`)
      }

      map.on('click', (event: any) => savePoint(event.latlng.lat, event.latlng.lng))
      marker.on('dragend', () => {
        const point = marker.getLatLng()
        savePoint(point.lat, point.lng)
      })

      mapRef.current = map
      markerRef.current = marker

      const savedCommitteeLat = parseCoordinate(committeeLatitude)
      const savedCommitteeLng = parseCoordinate(committeeLongitude)
      if (savedCommitteeLat !== undefined && savedCommitteeLng !== undefined) {
        placeCommitteeMarker(savedCommitteeLat, savedCommitteeLng, committeeAccuracy)
      }

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
      committeeMarkerRef.current = null
      leafletRef.current = null
    }
  }, [])

  useEffect(() => {
    const lat = parseCoordinate(latitude)
    const lng = parseCoordinate(longitude)
    if (lat === undefined || lng === undefined || !mapRef.current || !markerRef.current) return
    markerRef.current.setLatLng([lat, lng])
  }, [latitude, longitude])

  useEffect(() => {
    const lat = parseCoordinate(committeeLatitude)
    const lng = parseCoordinate(committeeLongitude)
    if (lat === undefined || lng === undefined || !mapRef.current) return
    placeCommitteeMarker(lat, lng, committeeAccuracy)
  }, [committeeLatitude, committeeLongitude, committeeAccuracy])

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

  async function locateCommittee() {
    if (!navigator.geolocation) {
      setMessage('La géolocalisation n’est pas disponible sur ce navigateur. Essayez Safari ou Chrome.')
      return
    }
    if (!window.isSecureContext) {
      setMessage('La géolocalisation nécessite une connexion HTTPS. Ouvrez la version sécurisée de CoachBrief dans Safari ou Chrome.')
      return
    }
    if (!mapRef.current) {
      setMessage('La carte est encore en cours de préparation…')
      return
    }

    setLocatingCommittee(true)

    try {
      try {
        const permission = await navigator.permissions?.query({ name: 'geolocation' })
        if (permission?.state === 'denied') {
          setMessage('Localisation bloquée pour ce site. Réactivez l’autorisation et, sur iPhone, activez « Position exacte ».')
          return
        }
      } catch {
        // Certains navigateurs mobiles ne prennent pas en charge Permissions API pour la géolocalisation.
      }

      setMessage('Recherche de la meilleure position GPS…')
      const position = await bestPositionFromWatch((accuracy) => {
        const rounded = Math.max(1, Math.round(accuracy))
        setMessage(`GPS en cours d’affinage · précision actuelle ±${rounded} m…`)
      })

      const lat = position.coords.latitude
      const lng = position.coords.longitude
      const accuracyNumber = Math.max(1, Math.round(position.coords.accuracy))
      const accuracy = String(accuracyNumber)

      if (accuracyNumber > COMMITTEE_MAX_ACCURACY_METERS) {
        mapRef.current?.setView([lat, lng], 12)
        mapRef.current?.invalidateSize(false)
        setMessage(`Position reçue trop approximative (±${accuracyNumber} m) : elle n’est pas enregistrée comme Comité. Sur téléphone, activez « Position exacte » et réessayez à ciel ouvert. Sur ordinateur, l’estimation Wi‑Fi/IP peut rester imprécise.`)
        return
      }

      onCommitteeChange(lat.toFixed(5), lng.toFixed(5), accuracy)
      placeCommitteeMarker(lat, lng, accuracy)
      mapRef.current?.setView([lat, lng], Math.max(mapRef.current.getZoom(), accuracyNumber <= 50 ? 16 : 15))
      mapRef.current?.invalidateSize(false)
    } catch (error) {
      setMessage(isGeolocationError(error) ? geolocationErrorMessage(error) : 'Impossible de récupérer une position fiable. Vérifiez les autorisations de localisation et réessayez.')
    } finally {
      setLocatingCommittee(false)
    }
  }

  return (
    <div className="map-picker">
      <div className="map-picker-heading">
        <div><MapPin size={16} /><strong>Plan d’eau & position comité</strong></div>
        <div className="map-picker-actions">
          <button type="button" className="map-center-button" onClick={centerOnLocation}><Crosshair size={15} /> Centrer sur le lieu</button>
          <button type="button" className="committee-location-button" onClick={() => void locateCommittee()} disabled={locatingCommittee}><LocateFixed size={15} /> {locatingCommittee ? 'Localisation…' : 'Me géolocaliser · Comité'}</button>
        </div>
      </div>
      <div ref={elementRef} className="course-map" aria-label="Carte interactive du plan d’eau et position du comité" />
      <div className="map-picker-footer">
        <span>{message}</span>
        <div className="map-position-values">
          {latitude && longitude && <strong>Parcours : {latitude} · {longitude}</strong>}
          {committeeLatitude && committeeLongitude && <strong className="committee-position-value">Comité : {committeeLatitude} · {committeeLongitude}{committeeAccuracy ? ` · ±${committeeAccuracy} m` : ''}</strong>}
        </div>
      </div>
    </div>
  )
}
