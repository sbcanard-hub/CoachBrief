import { useEffect, useRef, useState } from 'react'
import { Crosshair, LocateFixed, MapPin } from 'lucide-react'
import { loadLeaflet } from '../leafletLoader'
import '../geolocation.css'
import { usePreferences } from '../preferences'

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

function geolocationErrorMessage(error: GeolocationPositionError, language: 'fr' | 'en' | 'it' | 'es') {
  const messages = {
    fr: ['Localisation refusée. Autorisez la position pour ce site dans les réglages du navigateur. Sur iPhone, activez aussi « Position exacte ».', 'Position GPS indisponible. Sur téléphone, activez le service de localisation et « Position exacte », puis réessayez à ciel ouvert.', 'La localisation n’a pas obtenu de position assez précise. Réessayez à ciel ouvert. Sur ordinateur, la position peut rester approximative car il n’y a généralement pas de GPS.', 'Impossible de récupérer une position fiable. Ouvrez CoachBrief directement dans Safari/Chrome et vérifiez les autorisations de localisation.'],
    en: ['Location access was denied. Allow location for this site in your browser settings. On iPhone, also enable Precise Location.', 'GPS position unavailable. On a phone, enable Location Services and Precise Location, then try again outdoors.', 'Location could not obtain a sufficiently accurate position. Try again outdoors. On a computer, the position may remain approximate because there is usually no GPS.', 'Unable to obtain a reliable position. Open CoachBrief directly in Safari/Chrome and check location permissions.'],
    it: ['Accesso alla posizione negato. Autorizza la posizione per questo sito nelle impostazioni del browser. Su iPhone attiva anche Posizione esatta.', 'Posizione GPS non disponibile. Sul telefono attiva i servizi di localizzazione e Posizione esatta, poi riprova all’aperto.', 'La localizzazione non ha ottenuto una posizione abbastanza precisa. Riprova all’aperto. Sul computer la posizione può restare approssimativa perché di solito non c’è GPS.', 'Impossibile ottenere una posizione affidabile. Apri CoachBrief direttamente in Safari/Chrome e controlla le autorizzazioni di localizzazione.'],
    es: ['Se ha denegado la ubicación. Autoriza la ubicación para este sitio en los ajustes del navegador. En iPhone, activa también Ubicación exacta.', 'Posición GPS no disponible. En el teléfono, activa los servicios de ubicación y Ubicación exacta, y vuelve a intentarlo al aire libre.', 'No se ha obtenido una posición suficientemente precisa. Vuelve a intentarlo al aire libre. En un ordenador, la posición puede seguir siendo aproximada porque normalmente no hay GPS.', 'No se ha podido obtener una posición fiable. Abre CoachBrief directamente en Safari/Chrome y comprueba los permisos de ubicación.'],
  }[language]
  if (error.code === error.PERMISSION_DENIED) {
    return messages[0]
  }
  if (error.code === error.POSITION_UNAVAILABLE) {
    return messages[1]
  }
  if (error.code === error.TIMEOUT) {
    return messages[2]
  }
  return messages[3]
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
  const { language } = usePreferences()
  const c = {
    fr: { preparing: 'Préparation de la carte…', committee: 'Comité / bateau coach', adjusted: 'Position Comité ajustée manuellement.', detected: 'Position Comité détectée', tiles: 'Chargement du fond de carte…', ready: 'Cliquez sur le plan d’eau pour placer le centre du parcours, ou utilisez le GPS pour repérer le comité.', slow: 'Le fond de carte répond lentement. La carte peut continuer à se charger progressivement.', centre: 'Centre du parcours', unavailable: 'Cartographie indisponible.', enterPlace: 'Renseignez d’abord un lieu, puis recentrez la carte.', searching: 'Recherche du lieu…', found: 'trouvé. Déplacez maintenant le point sur la zone de course.', notFound: 'Lieu introuvable. Vous pouvez placer le point directement sur la carte.', noGeo: 'La géolocalisation n’est pas disponible sur ce navigateur. Essayez Safari ou Chrome.', https: 'La géolocalisation nécessite une connexion HTTPS. Ouvrez la version sécurisée de CoachBrief dans Safari ou Chrome.', blocked: 'Localisation bloquée pour ce site. Réactivez l’autorisation et, sur iPhone, activez « Position exacte ».', best: 'Recherche de la meilleure position GPS…', refining: 'GPS en cours d’affinage · précision actuelle', imprecise: 'Position reçue trop approximative', impreciseEnd: 'elle n’est pas enregistrée comme Comité. Sur téléphone, activez « Position exacte » et réessayez à ciel ouvert.', reliable: 'Impossible de récupérer une position fiable. Vérifiez les autorisations de localisation et réessayez.', title: 'Plan d’eau & position comité', centrePlace: 'Centrer sur le lieu', locating: 'Localisation…', locateCommittee: 'Me géolocaliser · Comité', mapLabel: 'Carte interactive du plan d’eau et position du comité', course: 'Parcours' },
    en: { preparing: 'Preparing the map…', committee: 'Committee / coach boat', adjusted: 'Committee position adjusted manually.', detected: 'Committee position detected', tiles: 'Loading map tiles…', ready: 'Click the sailing area to place the course centre, or use GPS to locate the committee.', slow: 'The map tiles are responding slowly. The map may continue loading progressively.', centre: 'Course centre', unavailable: 'Mapping unavailable.', enterPlace: 'Enter a venue first, then centre the map.', searching: 'Searching for the venue…', found: 'found. Now move the point onto the racing area.', notFound: 'Venue not found. You can place the point directly on the map.', noGeo: 'Geolocation is not available in this browser. Try Safari or Chrome.', https: 'Geolocation requires an HTTPS connection. Open the secure CoachBrief version in Safari or Chrome.', blocked: 'Location is blocked for this site. Re-enable permission and, on iPhone, enable Precise Location.', best: 'Searching for the best GPS position…', refining: 'Refining GPS · current accuracy', imprecise: 'Position received is too approximate', impreciseEnd: 'it has not been saved as the committee position. On a phone, enable Precise Location and try again outdoors.', reliable: 'Unable to obtain a reliable position. Check location permissions and try again.', title: 'Sailing area & committee position', centrePlace: 'Centre on venue', locating: 'Locating…', locateCommittee: 'Locate me · Committee', mapLabel: 'Interactive sailing-area map and committee position', course: 'Course' },
    it: { preparing: 'Preparazione della mappa…', committee: 'Comitato / barca coach', adjusted: 'Posizione del comitato regolata manualmente.', detected: 'Posizione del comitato rilevata', tiles: 'Caricamento della mappa…', ready: 'Tocca il campo di regata per posizionare il centro del percorso o usa il GPS per individuare il comitato.', slow: 'La mappa risponde lentamente e può continuare a caricarsi progressivamente.', centre: 'Centro del percorso', unavailable: 'Mappa non disponibile.', enterPlace: 'Inserisci prima un luogo, poi centra la mappa.', searching: 'Ricerca del luogo…', found: 'trovato. Ora sposta il punto sulla zona di regata.', notFound: 'Luogo non trovato. Puoi posizionare il punto direttamente sulla mappa.', noGeo: 'La geolocalizzazione non è disponibile in questo browser. Prova Safari o Chrome.', https: 'La geolocalizzazione richiede una connessione HTTPS. Apri la versione sicura di CoachBrief in Safari o Chrome.', blocked: 'Localizzazione bloccata per questo sito. Riattiva il permesso e, su iPhone, abilita Posizione esatta.', best: 'Ricerca della migliore posizione GPS…', refining: 'Affinamento GPS · precisione attuale', imprecise: 'Posizione ricevuta troppo approssimativa', impreciseEnd: 'non viene salvata come posizione del comitato. Sul telefono, attiva Posizione esatta e riprova all’aperto.', reliable: 'Impossibile ottenere una posizione affidabile. Controlla le autorizzazioni e riprova.', title: 'Campo di regata e posizione comitato', centrePlace: 'Centra sul luogo', locating: 'Localizzazione…', locateCommittee: 'Localizzami · Comitato', mapLabel: 'Mappa interattiva del campo di regata e posizione del comitato', course: 'Percorso' },
    es: { preparing: 'Preparando el mapa…', committee: 'Comité / barco del entrenador', adjusted: 'Posición del comité ajustada manualmente.', detected: 'Posición del comité detectada', tiles: 'Cargando el mapa…', ready: 'Pulsa en el campo de regatas para situar el centro del recorrido o usa el GPS para localizar el comité.', slow: 'El mapa responde lentamente y puede seguir cargándose de forma progresiva.', centre: 'Centro del recorrido', unavailable: 'Mapa no disponible.', enterPlace: 'Introduce primero un lugar y centra el mapa.', searching: 'Buscando el lugar…', found: 'encontrado. Mueve ahora el punto a la zona de regata.', notFound: 'Lugar no encontrado. Puedes colocar el punto directamente en el mapa.', noGeo: 'La geolocalización no está disponible en este navegador. Prueba Safari o Chrome.', https: 'La geolocalización requiere una conexión HTTPS. Abre la versión segura de CoachBrief en Safari o Chrome.', blocked: 'La ubicación está bloqueada para este sitio. Reactiva el permiso y, en iPhone, activa Ubicación exacta.', best: 'Buscando la mejor posición GPS…', refining: 'Afinando el GPS · precisión actual', imprecise: 'La posición recibida es demasiado aproximada', impreciseEnd: 'no se guarda como posición del comité. En el teléfono, activa Ubicación exacta y vuelve a intentarlo al aire libre.', reliable: 'No se ha podido obtener una posición fiable. Comprueba los permisos y vuelve a intentarlo.', title: 'Campo de regatas y posición del comité', centrePlace: 'Centrar en el lugar', locating: 'Localizando…', locateCommittee: 'Localizarme · Comité', mapLabel: 'Mapa interactivo del campo de regatas y posición del comité', course: 'Recorrido' },
  }[language]
  const elementRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const committeeMarkerRef = useRef<any>(null)
  const leafletRef = useRef<any>(null)
  const [message, setMessage] = useState(c.preparing)
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
      const committeeMarker = leaflet.marker([lat, lng], { draggable: true, icon, title: c.committee })
        .bindTooltip(c.committee, { permanent: false })
        .addTo(map)
      committeeMarker.on('dragend', () => {
        const point = committeeMarker.getLatLng()
        onCommitteeChange(point.lat.toFixed(5), point.lng.toFixed(5), '')
        setMessage(c.adjusted)
      })
      committeeMarkerRef.current = committeeMarker
    } else {
      committeeMarkerRef.current.setLatLng([lat, lng])
    }

    if (accuracy) setMessage(`${c.detected} · ±${accuracy} m.`)
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
      tiles.on('loading', () => setMessage(c.tiles))
      tiles.on('load', () => setMessage((current) => current === c.tiles || current === c.preparing
        ? c.ready
        : current))
      tiles.on('tileerror', () => setMessage(c.slow))
      tiles.addTo(map)

      const marker = leaflet.marker([initialLatitude, initialLongitude], { draggable: true }).addTo(map)

      function savePoint(lat: number, lng: number) {
        const latText = lat.toFixed(5)
        const lngText = lng.toFixed(5)
        marker.setLatLng([lat, lng])
        onPointChange(latText, lngText)
        setMessage(`${c.centre}: ${latText}, ${lngText}`)
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
      if (!cancelled) setMessage(error instanceof Error ? error.message : c.unavailable)
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
      setMessage(c.enterPlace)
      return
    }
    if (!mapRef.current || !markerRef.current) {
      setMessage(c.preparing)
      return
    }

    setMessage(c.searching)
    const params = new URLSearchParams({ name: location.trim(), count: '1', language, format: 'json' })

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
      setMessage(`${point.name} ${c.found}`)
    } catch {
      setMessage(c.notFound)
    }
  }

  async function locateCommittee() {
    if (!navigator.geolocation) {
      setMessage(c.noGeo)
      return
    }
    if (!window.isSecureContext) {
      setMessage(c.https)
      return
    }
    if (!mapRef.current) {
      setMessage(c.preparing)
      return
    }

    setLocatingCommittee(true)

    try {
      try {
        const permission = await navigator.permissions?.query({ name: 'geolocation' })
        if (permission?.state === 'denied') {
          setMessage(c.blocked)
          return
        }
      } catch {
        // Certains navigateurs mobiles ne prennent pas en charge Permissions API pour la géolocalisation.
      }

      setMessage(c.best)
      const position = await bestPositionFromWatch((accuracy) => {
        const rounded = Math.max(1, Math.round(accuracy))
        setMessage(`${c.refining} ±${rounded} m…`)
      })

      const lat = position.coords.latitude
      const lng = position.coords.longitude
      const accuracyNumber = Math.max(1, Math.round(position.coords.accuracy))
      const accuracy = String(accuracyNumber)

      if (accuracyNumber > COMMITTEE_MAX_ACCURACY_METERS) {
        mapRef.current?.setView([lat, lng], 12)
        mapRef.current?.invalidateSize(false)
        setMessage(`${c.imprecise} (±${accuracyNumber} m): ${c.impreciseEnd}`)
        return
      }

      onCommitteeChange(lat.toFixed(5), lng.toFixed(5), accuracy)
      placeCommitteeMarker(lat, lng, accuracy)
      mapRef.current?.setView([lat, lng], Math.max(mapRef.current.getZoom(), accuracyNumber <= 50 ? 16 : 15))
      mapRef.current?.invalidateSize(false)
    } catch (error) {
      setMessage(isGeolocationError(error) ? geolocationErrorMessage(error, language) : c.reliable)
    } finally {
      setLocatingCommittee(false)
    }
  }

  return (
    <div className="map-picker">
      <div className="map-picker-heading">
        <div><MapPin size={16} /><strong>{c.title}</strong></div>
        <div className="map-picker-actions">
          <button type="button" className="map-center-button" onClick={centerOnLocation}><Crosshair size={15} /> {c.centrePlace}</button>
          <button type="button" className="committee-location-button" onClick={() => void locateCommittee()} disabled={locatingCommittee}><LocateFixed size={15} /> {locatingCommittee ? c.locating : c.locateCommittee}</button>
        </div>
      </div>
      <div ref={elementRef} className="course-map" aria-label={c.mapLabel} />
      <div className="map-picker-footer">
        <span>{message}</span>
        <div className="map-position-values">
          {latitude && longitude && <strong>{c.course}: {latitude} · {longitude}</strong>}
          {committeeLatitude && committeeLongitude && <strong className="committee-position-value">{c.committee}: {committeeLatitude} · {committeeLongitude}{committeeAccuracy ? ` · ±${committeeAccuracy} m` : ''}</strong>}
        </div>
      </div>
    </div>
  )
}
