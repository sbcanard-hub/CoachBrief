import { useMemo, useState } from 'react'
import { Gauge, Upload, Wind } from 'lucide-react'
import type { OffshoreLeg } from '../offshore'
import type { OffshoreLegForecast } from '../offshoreForecast'
import { DEMO_POLAR, parsePolarCsv, polarSpeed, trueWindAngle, type PolarTable } from '../offshorePolar'

type Props = { legs: OffshoreLeg[]; forecasts: OffshoreLegForecast[] }

function fmt(value: number | null, digits = 1) { return value == null ? '—' : value.toFixed(digits).replace('.', ',') }

export function OffshorePolarPanel({ legs, forecasts }: Props) {
  const [polar, setPolar] = useState<PolarTable>(DEMO_POLAR)
  const [message, setMessage] = useState('Polaire de démonstration active. Importe la polaire réelle du bateau pour fiabiliser le routage.')

  const rows = useMemo(() => legs.map((leg) => {
    const forecast = forecasts.find((item) => item.legIndex === leg.index)
    if (!forecast || forecast.windSpeed == null || forecast.windDirection == null) return { leg, twa: null, targetSpeed: null, hours: null }
    const twa = trueWindAngle(leg.bearing, forecast.windDirection)
    const targetSpeed = polarSpeed(polar, twa, forecast.windSpeed)
    return { leg, twa, targetSpeed, hours: targetSpeed > 0.2 ? leg.distanceNm / targetSpeed : null }
  }), [legs, forecasts, polar])

  const routeHours = rows.reduce((sum, row) => sum + (row.hours ?? 0), 0)
  const usable = rows.filter((row) => row.hours != null).length

  async function importFile(file: File | null) {
    if (!file) return
    try {
      const text = await file.text()
      const parsed = parsePolarCsv(text, file.name.replace(/\.[^.]+$/, ''))
      setPolar(parsed)
      setMessage(`Polaire « ${parsed.name} » chargée : ${parsed.rows.length} angles TWA × ${parsed.tws.length} forces TWS.`)
    } catch (error) {
      setMessage(error instanceof Error ? `Import impossible : ${error.message}` : 'Import impossible.')
    }
  }

  return <section className="offshore-card offshore-polar-card">
    <div className="offshore-card-heading">
      <div><span>04</span><div><small>Performance bateau</small><h2>Polaires et vitesse cible</h2></div></div>
      <Gauge size={24} />
    </div>
    <div className="offshore-polar-toolbar">
      <div><strong>{polar.name}</strong><p>{message}</p></div>
      <label className="offshore-file-button"><Upload size={16} /> Importer CSV / TXT<input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={(e) => void importFile(e.target.files?.[0] ?? null)} /></label>
    </div>
    <p className="offshore-help">Format attendu : première colonne = TWA en degrés, première ligne = TWS en nœuds, cellules = vitesse bateau en nœuds. Séparateur « ; », virgule ou tabulation accepté.</p>
    {forecasts.length === 0 && <div className="offshore-polar-empty"><Wind size={18} /> Lance d’abord « Analyser la route » pour croiser la polaire avec le vent prévu sur chaque tronçon.</div>}
    {forecasts.length > 0 && <>
      <div className="offshore-polar-summary"><span>Tronçons exploitables <strong>{usable}/{legs.length}</strong></span><span>Durée théorique polaire <strong>{usable ? `${fmt(routeHours, 1)} h` : '—'}</strong></span></div>
      <div className="offshore-polar-table">
        {rows.map(({ leg, twa, targetSpeed, hours }) => <article key={leg.index}>
          <div><strong>{leg.from.name} → {leg.to.name}</strong><small>Route {String(Math.round(leg.bearing)).padStart(3, '0')}°</small></div>
          <span>TWA <b>{twa == null ? '—' : `${Math.round(twa)}°`}</b></span>
          <span>Vitesse cible <b>{targetSpeed == null ? '—' : `${fmt(targetSpeed)} nd`}</b></span>
          <span>Durée tronçon <b>{hours == null ? '—' : `${fmt(hours, 1)} h`}</b></span>
        </article>)}
      </div>
      <p className="offshore-source">Cette première estimation suppose que les conditions échantillonnées au milieu du tronçon restent représentatives pendant le tronçon. L’étape suivante est l’isochrone : recalculer vent, courant et vitesse à chaque pas de temps et tester plusieurs caps.</p>
    </>}
  </section>
}
