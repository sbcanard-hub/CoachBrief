import type { LiveWeatherData } from '../weather'
import { usePreferences } from '../preferences'
import { ThermalQuadrantGuide } from './ThermalQuadrantGuide'

const diagnosticCopy = {
  fr: { coast: 'Axe de côte estimé', sea: 'Large', wind: 'Vent', angle: 'Angle vent / large', auto: 'Classement automatique à partir de la géométrie côte-mer.', fallback: 'Orientation de côte insuffisamment contrastée : estimation simplifiée.' },
  en: { coast: 'Estimated coastline axis', sea: 'Sea side', wind: 'Wind', angle: 'Wind / sea angle', auto: 'Automatic classification from the local coast-to-sea geometry.', fallback: 'Coastline contrast is insufficient: simplified estimate.' },
  it: { coast: 'Asse costa stimato', sea: 'Mare aperto', wind: 'Vento', angle: 'Angolo vento / mare', auto: 'Classificazione automatica dalla geometria locale costa-mare.', fallback: 'Contrasto costiero insufficiente: stima semplificata.' },
  es: { coast: 'Eje de costa estimado', sea: 'Mar abierto', wind: 'Viento', angle: 'Ángulo viento / mar', auto: 'Clasificación automática a partir de la geometría local costa-mar.', fallback: 'Contraste costero insuficiente: estimación simplificada.' },
} as const

export function ThermalQuadrantPanel({ weather }: { weather: LiveWeatherData | null }) {
  const { language } = usePreferences()
  if (!weather) return null

  const terrain = weather.terrain
  const flow = terrain?.coastalFlow ?? 'mixed'
  const active = terrain?.thermalQuadrant ?? (flow === 'offshore' ? 'Q2' : flow === 'onshore' ? 'Q4' : 'Q1/Q3')
  const c = diagnosticCopy[language]
  const precise = Boolean(terrain?.thermalQuadrant && terrain.seaBearing != null && terrain.coastlineBearing != null && terrain.windSeaAngle != null)

  return <section className="forecast-panel" aria-label={language === 'fr' ? 'Théorie des cadrans thermiques' : 'Thermal quadrant theory'}>
    <ThermalQuadrantGuide active={active} language={language} />
    <div className="thermal-quadrants__diagnostic" aria-live="polite">
      {precise ? <>
        <strong>{c.auto}</strong>
        <span>{c.coast} {String(Math.round(terrain!.coastlineBearing!)).padStart(3, '0')}° · {c.sea} {String(Math.round(terrain!.seaBearing!)).padStart(3, '0')}° · {c.wind} {String(Math.round(weather.race.direction)).padStart(3, '0')}° · {c.angle} {Math.round(terrain!.windSeaAngle!)}°.</span>
      </> : <span>{c.fallback}</span>}
    </div>
  </section>
}
