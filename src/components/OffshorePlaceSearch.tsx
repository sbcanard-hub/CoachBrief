import { useState } from 'react'
import { Anchor, LoaderCircle, MapPin, Search } from 'lucide-react'
import { offshorePlaceLabel, searchOffshorePlaces, searchOffshorePorts, type OffshorePlaceResult } from '../offshoreGeocoding'

type Props = {
  title: string
  marker: 'D' | 'A'
  placeholder?: string
  onSelect: (place: OffshorePlaceResult) => void
}

export function OffshorePlaceSearch({ title, marker, placeholder, onSelect }: Props) {
  const [mode, setMode] = useState<'city' | 'port'>('city')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<OffshorePlaceResult[]>([])
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')

  async function runSearch() {
    if (query.trim().length < 2) return
    setState('loading')
    setResults([])
    try {
      const next = mode === 'port' ? await searchOffshorePorts(query) : await searchOffshorePlaces(query)
      setResults(next)
      setState('ready')
      if (next.length === 1) apply(next[0])
    } catch {
      setState('error')
    }
  }

  function apply(place: OffshorePlaceResult) {
    setQuery(place.name)
    setResults([])
    setState('idle')
    onSelect(place)
  }

  return <div className="offshore-departure-city offshore-place-search-card">
    <div className="offshore-place-search-heading">
      <label><span>{mode === 'port' ? <Anchor size={15} /> : <MapPin size={15} />} {title}</span></label>
      <div className="offshore-place-mode" role="group" aria-label={`Type de recherche pour ${title}`}>
        <button type="button" className={mode === 'city' ? 'is-active' : ''} onClick={() => { setMode('city'); setResults([]); setState('idle') }}>Ville</button>
        <button type="button" className={mode === 'port' ? 'is-active' : ''} onClick={() => { setMode('port'); setResults([]); setState('idle') }}>Port / marina</button>
      </div>
    </div>
    <div className="offshore-city-search">
      <input value={query} onChange={(e) => { setQuery(e.target.value); setState('idle'); setResults([]) }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void runSearch() } }} placeholder={placeholder ?? (mode === 'port' ? 'Ex. Port Vauban, Lorient La Base…' : 'Ex. Antibes, Lorient, Saint-Malo…')} />
      <button type="button" onClick={() => void runSearch()} disabled={state === 'loading' || query.trim().length < 2}>{state === 'loading' ? <LoaderCircle size={16} className="current-spin" /> : <Search size={16} />} Rechercher</button>
    </div>
    <p>{mode === 'port' ? 'Recherche un port ou une marina précise.' : 'Recherche une ville.'} CoachBrief place automatiquement le curseur <strong>{marker}</strong>, puis tu peux l’affiner directement sur la carte.</p>
    {state === 'error' && <p className="offshore-city-error">La recherche est momentanément indisponible. Les coordonnées restent modifiables manuellement.</p>}
    {state === 'ready' && results.length === 0 && <p className="offshore-city-error">Aucun résultat trouvé pour cette recherche.</p>}
    {results.length > 0 && <div className="offshore-city-results">
      {results.map((place) => <button key={place.id} type="button" onClick={() => apply(place)}>{place.kind === 'port' ? <Anchor size={14} /> : <MapPin size={14} />}<span>{offshorePlaceLabel(place)}</span><small>{place.latitude.toFixed(4)}, {place.longitude.toFixed(4)}</small></button>)}
    </div>}
  </div>
}
