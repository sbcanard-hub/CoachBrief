import { Compass, Gauge, Mountain, ThermometerSun, Waves, Wind } from 'lucide-react'
import { usePreferences } from '../preferences'
import type { TerrainAnalysis, TerrainLevel } from '../terrainAnalysis'

const copy = {
  fr: {
    step: 'Relief · dynamique locale', title: 'Analyse orographique', sampled: 'points analysés sur', max: 'Relief maximal',
    upstream: 'Obstacle au vent', flow: 'Écoulement côtier', blocking: 'Risque de blocage', lee: 'Dévent sous le relief',
    channel: 'Canalisation', thermal: 'Potentiel thermique', lateral: 'Dissymétrie latérale', confidence: 'Confiance',
    left: 'gauche', right: 'droite', neutral: 'aucun côté net', onshore: 'mer → terre', offshore: 'terre → mer',
    alongshore: 'parallèle à la côte', mixed: 'configuration complexe', low: 'faible', medium: 'modéré', high: 'fort',
    side: 'Le relief suggère une zone plus ouverte à {side}. À confirmer avec les relevés sur l’eau.',
    noSide: 'Le relief ne crée pas de préférence gauche/droite suffisamment nette.',
    note: 'Diagnostic physique simplifié à partir des altitudes autour du plan d’eau, du vent, de la nébulosité et de l’écart air–mer. Il repère les risques d’accélération, de contournement et de dévent mais ne remplace pas une simulation CFD ni l’observation.',
  },
  en: {
    step: 'Terrain · local dynamics', title: 'Orographic analysis', sampled: 'points analysed within', max: 'Maximum terrain',
    upstream: 'Upwind obstacle', flow: 'Coastal flow', blocking: 'Blocking risk', lee: 'Lee wind shadow',
    channel: 'Channelling', thermal: 'Thermal potential', lateral: 'Lateral asymmetry', confidence: 'Confidence',
    left: 'left', right: 'right', neutral: 'no clear side', onshore: 'sea → land', offshore: 'land → sea',
    alongshore: 'along the coast', mixed: 'complex setting', low: 'low', medium: 'moderate', high: 'high',
    side: 'Terrain suggests a more open area on the {side}. Confirm with on-water readings.',
    noSide: 'Terrain does not create a sufficiently clear left/right preference.',
    note: 'Simplified physical diagnosis using surrounding elevation, wind, cloud and the air–sea difference. It identifies acceleration, diversion and wind-shadow risks but is not CFD and does not replace observation.',
  },
  it: {
    step: 'Rilievo · dinamica locale', title: 'Analisi orografica', sampled: 'punti analizzati entro', max: 'Rilievo massimo',
    upstream: 'Ostacolo sopravento', flow: 'Flusso costiero', blocking: 'Rischio di blocco', lee: 'Copertura sottovento',
    channel: 'Canalizzazione', thermal: 'Potenziale termico', lateral: 'Asimmetria laterale', confidence: 'Affidabilità',
    left: 'sinistra', right: 'destra', neutral: 'nessun lato netto', onshore: 'mare → terra', offshore: 'terra → mare',
    alongshore: 'parallelo alla costa', mixed: 'configurazione complessa', low: 'basso', medium: 'moderato', high: 'alto',
    side: 'Il rilievo suggerisce una zona più aperta a {side}. Da confermare con i rilievi in acqua.',
    noSide: 'Il rilievo non crea una preferenza sinistra/destra abbastanza netta.',
    note: 'Diagnosi fisica semplificata basata su quote circostanti, vento, nuvolosità e differenza aria–mare. Individua accelerazione, aggiramento e copertura, ma non è una CFD e non sostituisce l’osservazione.',
  },
  es: {
    step: 'Relieve · dinámica local', title: 'Análisis orográfico', sampled: 'puntos analizados en', max: 'Relieve máximo',
    upstream: 'Obstáculo a barlovento', flow: 'Flujo costero', blocking: 'Riesgo de bloqueo', lee: 'Desvente a sotavento',
    channel: 'Canalización', thermal: 'Potencial térmico', lateral: 'Asimetría lateral', confidence: 'Confianza',
    left: 'izquierda', right: 'derecha', neutral: 'sin lado claro', onshore: 'mar → tierra', offshore: 'tierra → mar',
    alongshore: 'paralelo a la costa', mixed: 'configuración compleja', low: 'bajo', medium: 'moderado', high: 'alto',
    side: 'El relieve sugiere una zona más abierta a la {side}. Confírmalo con lecturas en el agua.',
    noSide: 'El relieve no crea una preferencia izquierda/derecha suficientemente clara.',
    note: 'Diagnóstico físico simplificado con altitudes cercanas, viento, nubosidad y diferencia aire–mar. Detecta riesgos de aceleración, desvío y desvente, pero no es CFD ni sustituye la observación.',
  },
} as const

export function TerrainAnalysisPanel({ terrain }: { terrain?: TerrainAnalysis }) {
  const { language } = usePreferences()
  if (!terrain?.available) return null
  const c = copy[language]
  const level = (value: TerrainLevel) => c[value]
  const flow = c[terrain.coastalFlow]
  const side = c[terrain.preferredSide]
  const sideText = terrain.preferredSide === 'neutral' ? c.noSide : c.side.replace('{side}', side)

  return <section className="terrain-analysis" aria-labelledby="terrain-analysis-title">
    <div className="terrain-analysis-heading">
      <div><Mountain size={20} /><div><span className="step-label">{c.step}</span><h2 id="terrain-analysis-title">{c.title}</h2></div></div>
      <span>{terrain.sampleCount} {c.sampled} {terrain.radiusKm} km · {c.confidence} {level(terrain.confidence)}</span>
    </div>
    <div className="terrain-analysis-grid">
      <article><Mountain size={17} /><small>{c.max}</small><strong>{terrain.maxElevation} m</strong><span>Δ {terrain.relief} m</span></article>
      <article><Wind size={17} /><small>{c.upstream}</small><strong>{terrain.upstreamMax} m</strong><span>{c.blocking} : {level(terrain.blockingRisk)}</span></article>
      <article><Waves size={17} /><small>{c.flow}</small><strong>{flow}</strong><span>{c.lee} : {level(terrain.leeRisk)}</span></article>
      <article><Compass size={17} /><small>{c.lateral}</small><strong>{side}</strong><span>Δ {Math.abs(terrain.sideDifference)} m</span></article>
      <article><Gauge size={17} /><small>{c.channel}</small><strong>{level(terrain.channelingRisk)}</strong><span>{c.blocking} : {level(terrain.blockingRisk)}</span></article>
      <article><ThermometerSun size={17} /><small>{c.thermal}</small><strong>{level(terrain.thermalPotential)}</strong><span>{terrain.coastalFlow === 'onshore' ? flow : c.mixed}</span></article>
    </div>
    <p className="terrain-analysis-reading">{sideText}</p>
    <small className="terrain-analysis-note">{c.note}</small>
  </section>
}
