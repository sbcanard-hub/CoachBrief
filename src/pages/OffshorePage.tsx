import { useMemo, useState } from 'react'
import { Anchor, ArrowRight, CalendarDays, Clock3, Compass, Gauge, MapPin, Plus, Route, Sailboat, Trash2, Waves, Wind } from 'lucide-react'
import { buildOffshoreLegs, estimateOffshoreEtaHours, totalOffshoreDistance, type OffshorePoint } from '../offshore'
import './offshore.css'

function makePoint(name = ''): OffshorePoint {
  return { id: crypto.randomUUID(), name, latitude: '', longitude: '' }
}

function formatNm(value: number) { return `${value.toFixed(value >= 100 ? 0 : 1).replace('.', ',')} nm` }
function formatBearing(value: number) { return `${String(Math.round(value)).padStart(3, '0')}°` }
function formatDuration(hours: number | null) {
  if (hours == null) return '—'
  const totalMinutes = Math.round(hours * 60)
  const days = Math.floor(totalMinutes / 1440)
  const remainder = totalMinutes % 1440
  const h = Math.floor(remainder / 60)
  const m = remainder % 60
  return [days ? `${days} j` : '', h ? `${h} h` : '', `${m} min`].filter(Boolean).join(' ')
}

export function OffshorePage() {
  const [raceName, setRaceName] = useState('')
  const [departureDate, setDepartureDate] = useState('')
  const [departureTime, setDepartureTime] = useState('')
  const [boatName, setBoatName] = useState('')
  const [boatType, setBoatType] = useState('Monocoque')
  const [averageSpeed, setAverageSpeed] = useState('7')
  const [points, setPoints] = useState<OffshorePoint[]>([makePoint('Départ'), makePoint('Arrivée')])

  const legs = useMemo(() => buildOffshoreLegs(points), [points])
  const totalDistance = useMemo(() => totalOffshoreDistance(legs), [legs])
  const etaHours = useMemo(() => estimateOffshoreEtaHours(totalDistance, Number(averageSpeed)), [totalDistance, averageSpeed])

  function updatePoint(id: string, key: keyof OffshorePoint, value: string) {
    setPoints((current) => current.map((point) => point.id === id ? { ...point, [key]: value } : point))
  }

  function addWaypoint() {
    setPoints((current) => {
      const next = [...current]
      next.splice(Math.max(1, next.length - 1), 0, makePoint(`Waypoint ${Math.max(1, next.length - 1)}`))
      return next
    })
  }

  function removePoint(id: string) {
    setPoints((current) => current.length <= 2 ? current : current.filter((point) => point.id !== id))
  }

  return <main className="offshore-page">
    <section className="offshore-hero">
      <div className="offshore-kicker"><Route size={17} /> CoachBrief · Course au large</div>
      <h1>Préparer une route qui évolue <em>dans le temps et dans l’espace</em></h1>
      <p>Cette interface est séparée du petit parcours : on raisonne ici en route, tronçons, météo évolutive, courant, état de mer, caps, détroits et timing de passage.</p>
    </section>

    <section className="offshore-card">
      <div className="offshore-card-heading">
        <div><span>01</span><div><small>Course</small><h2>Départ et bateau</h2></div></div>
        <Sailboat size={24} />
      </div>
      <div className="offshore-grid offshore-grid-3">
        <label><span>Nom de la course</span><input value={raceName} onChange={(e) => setRaceName(e.target.value)} placeholder="Ex. Fastnet, Spi Ouest offshore…" /></label>
        <label><span><CalendarDays size={15} /> Date de départ</span><input type="date" value={departureDate} onChange={(e) => setDepartureDate(e.target.value)} /></label>
        <label><span><Clock3 size={15} /> Heure de départ</span><input type="time" value={departureTime} onChange={(e) => setDepartureTime(e.target.value)} /></label>
        <label><span>Nom du bateau</span><input value={boatName} onChange={(e) => setBoatName(e.target.value)} placeholder="Nom ou numéro" /></label>
        <label><span>Type de bateau</span><select value={boatType} onChange={(e) => setBoatType(e.target.value)}><option>Monocoque</option><option>Multicoque</option><option>Mini 6.50</option><option>Class40</option><option>IRC / ORC</option><option>Autre</option></select></label>
        <label><span><Gauge size={15} /> Vitesse moyenne de travail</span><div className="offshore-unit"><input type="number" min="0.5" step="0.1" value={averageSpeed} onChange={(e) => setAverageSpeed(e.target.value)} /><b>nd</b></div></label>
      </div>
      <p className="offshore-help">Cette vitesse sert uniquement à une première estimation de durée. Le routage utilisera ensuite les polaires du bateau et le vent réel.</p>
    </section>

    <section className="offshore-card">
      <div className="offshore-card-heading">
        <div><span>02</span><div><small>Route</small><h2>Départ, waypoints et arrivée</h2></div></div>
        <MapPin size={24} />
      </div>
      <div className="offshore-points">
        {points.map((point, index) => <article className="offshore-point" key={point.id}>
          <div className="offshore-point-index">{index === 0 ? 'D' : index === points.length - 1 ? 'A' : index}</div>
          <label><span>Nom</span><input value={point.name} onChange={(e) => updatePoint(point.id, 'name', e.target.value)} /></label>
          <label><span>Latitude</span><input inputMode="decimal" placeholder="48.390" value={point.latitude} onChange={(e) => updatePoint(point.id, 'latitude', e.target.value)} /></label>
          <label><span>Longitude</span><input inputMode="decimal" placeholder="-4.486" value={point.longitude} onChange={(e) => updatePoint(point.id, 'longitude', e.target.value)} /></label>
          {index > 0 && index < points.length - 1 && <button type="button" className="offshore-icon-button" onClick={() => removePoint(point.id)} aria-label={`Supprimer ${point.name}`}><Trash2 size={17} /></button>}
        </article>)}
      </div>
      <button type="button" className="offshore-add" onClick={addWaypoint}><Plus size={17} /> Ajouter un waypoint</button>
    </section>

    <section className="offshore-summary">
      <div className="offshore-summary-main">
        <span>Route calculée</span>
        <strong>{formatNm(totalDistance)}</strong>
        <small>Durée indicative à {Number(averageSpeed) || 0} nd : {formatDuration(etaHours)}</small>
      </div>
      <div><Compass size={20} /><span>{legs.length} tronçon{legs.length > 1 ? 's' : ''}</span></div>
      <div><Wind size={20} /><span>Météo multi-modèles prévue</span></div>
      <div><Waves size={20} /><span>Mer + houle prévues</span></div>
      <div><Anchor size={20} /><span>Courant + marée + fond prévus</span></div>
    </section>

    {legs.length > 0 && <section className="offshore-card">
      <div className="offshore-card-heading">
        <div><span>03</span><div><small>Découpage tactique</small><h2>Tronçons de route</h2></div></div>
        <Route size={24} />
      </div>
      <div className="offshore-legs">
        {legs.map((leg) => <article key={`${leg.from.id}-${leg.to.id}`}>
          <div className="offshore-leg-route"><strong>{leg.from.name}</strong><ArrowRight size={17} /><strong>{leg.to.name}</strong></div>
          <div><span>Distance</span><b>{formatNm(leg.distanceNm)}</b></div>
          <div><span>Route directe</span><b>{formatBearing(leg.bearing)}</b></div>
          <div><span>À analyser ensuite</span><b>Vent · courant · mer · options</b></div>
        </article>)}
      </div>
    </section>}

    <section className="offshore-roadmap">
      <h2>Ce que ce mode va intégrer</h2>
      <div className="offshore-roadmap-grid">
        <article><Wind /><strong>Routage météo</strong><p>Comparaison AROME, ECMWF, ICON et GFS, avec évolution heure par heure sur chaque tronçon.</p></article>
        <article><Anchor /><strong>Courants</strong><p>SHOM en zones couvertes, courant océanique ailleurs, renverses et bathymétrie le long de la route.</p></article>
        <article><Waves /><strong>Mer et houle</strong><p>Hauteur, période, direction et interaction avec le cap du bateau.</p></article>
        <article><Compass /><strong>Polaires et isochrones</strong><p>Vitesse cible par angle et force de vent, puis comparaison de plusieurs routes et ETA.</p></article>
      </div>
    </section>
  </main>
}
