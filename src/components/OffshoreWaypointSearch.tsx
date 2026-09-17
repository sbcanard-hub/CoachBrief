import { useState } from 'react'
import { LoaderCircle, MapPin, Search } from 'lucide-react'
import { offshorePlaceLabel, searchOffshoreWaypoints, type OffshorePlaceResult } from '../offshoreGeocoding'

type Props = {
  onSelect: (place: OffshorePlaceResult) => void
}

export function OffshoreWaypointSearch({ onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<OffshorePlaceResult[]>([])
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')

  async function runSearch() {
    if (query.trim().length < 2) return
    setState('loading')
    setResults([])
    try {
      const next = await searchOffshoreWaypoints(query)
      setResults(next)
      setState('ready')
      if (next.length === 1) apply(next[0])
    } catch {
      setState('error')
    }
  }

  function apply(place: OffshorePlaceResult) {
    setQuery('')
    setResults([])
    setState('idle')
    onSelect(place)
  }

  return <div className="offshore-departure-city offshore-waypoint-search">
    <div>
      <label><span><MapPin size={15} /> Ajouter un waypoint par nom</span></label>
      <div className="offshore-city-search">
        <input value={query} onChange={(e) => { setQuery(e.target.value); setState('idle'); setResults([]) }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void runSearch() } }} placeholder="Ex. Fastnet Rock, Raz de Sein, Belle-Île, Cap Lizard…" />
        <button type="button" onClick={() => void runSearch()} disabled={state === 'loading' || query.trim().length < 2}>{state === 'loading' ? <LoaderCircle size={16} className="current-spin" /> : <Search size={16} />} Rechercher</button>
      </div>
    </div>
    <p>La sélection est ajoutée automatiquement avant l’arrivée. Tu peux ensuite déplacer le waypoint sur la carte ou modifier ses coordonnées.</p>
    {state === 'error' && <p className="offshore-city-error">La recherche de waypoint est momentanément indisponible.</p>}
    {state === 'ready' && results.length === 0 && <p className="offshore-city-error">Aucun lieu trouvé pour cette recherche.</p>}
    {results.length > 0 && <div className="offshore-city-results">
      {results.map((place) => <button key={place.id} type="button" onClick={() => apply(place)}><MapPin size={14} /><span>{offshorePlaceLabel(place)}</span><small>{place.latitude.toFixed(4)}, {place.longitude.toFixed(4)}</small></button>)}
    </div>}
  </div>
}
