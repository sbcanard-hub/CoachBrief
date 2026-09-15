import type { LiveWeatherData } from '../weather'
import { usePreferences } from '../preferences'
import { ThermalQuadrantGuide } from './ThermalQuadrantGuide'

export function ThermalQuadrantPanel({ weather }: { weather: LiveWeatherData | null }) {
  const { language } = usePreferences()
  if (!weather) return null

  const flow = weather.terrain?.coastalFlow ?? 'mixed'
  const active = flow === 'offshore' ? 'Q2' : flow === 'onshore' ? 'Q4' : 'Q1/Q3'

  return <section className="forecast-panel" aria-label={language === 'fr' ? 'Théorie des cadrans thermiques' : 'Thermal quadrant theory'}>
    <ThermalQuadrantGuide active={active} language={language} />
  </section>
}
