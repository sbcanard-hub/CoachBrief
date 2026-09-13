import type { BernotRow, WeatherScenario } from './bernot'
import type { CoachObservationSignal } from './observations'
import type { SavedBriefing } from './savedBriefings'
import { analyseStartLine, type StartLineAnalysis } from './startLine'
import type { BriefingRequest } from './types'
import type { Language } from './preferences'

export type IntelligentBriefing = {
  conditions: string[]
  tactics: string[]
  start: string
  firstLeg: string
  watch: string
  confidence: string
  shared: boolean
  runner: string[]
}

type Input = {
  request: BriefingRequest | null
  scenario: WeatherScenario
  rows: BernotRow[]
  observation: CoachObservationSignal
  savedBriefings: SavedBriefing[]
  localCorrectionApplied: boolean
  language: Language
  formatLength: (metres: number) => string
}

const text = {
  fr: { wind: 'Vent {speed}–{gust} nd, {dir}°.', oscillation: 'Oscillations ±{value}°, tendance {trend}.', stable: 'stable', right: 'lente à droite', left: 'lente à gauche', terrain: 'Terrain : {count} relevé(s), dernier vent {speed} nd à {dir}°.', modelGap: 'Écart terrain/modèle : {speed} nd et {dir}°.', factors: '{a} et {b} orientent l’analyse vers la {side}.', open: 'Analyse partagée — conserver une stratégie ouverte.', lineNeutral: 'Ligne sans avantage géométrique mesuré : privilégier vitesse et voie libre.', lineFavoured: '{side} favorisé de {distance} ({boats} longueurs).', enteredLine: 'Ligne déclarée {side} : conserver une voie de sortie.', startOpen: 'Départ au centre d’une zone dégagée, avec deux options.', legOpen: 'Premier bord libre ; décider sur la première bascule confirmée.', watchGust: 'Surveiller les rafales et la maîtrise du bateau.', watchShift: 'Surveiller la première oscillation et éviter de s’enfermer.', watchGap: 'Confirmer l’écart entre relevés terrain et modèle.', watchLocal: 'Valider sur l’eau la correction locale appliquée.', watchDefault: 'Surveiller pression, air libre et évolution du vent.', confidenceHigh: 'Élevée — sources cohérentes et {count} relevés terrain récents.', confidenceMedium: 'Moyenne — analyse cohérente avec {count} relevé(s) terrain.', confidenceLow: 'Faible — données limitées ou signaux contradictoires.', memory: 'La mémoire de {count} briefing(s) local(aux) comparable(s) conforte la lecture.', committee: 'Comité', pin: 'Viseur', rightSide: 'droite', leftSide: 'gauche', clearStart: 'Privilégier vitesse et voie libre au départ.', legSide: 'Premier bord vers la {side}, avec une porte de sortie.' },
  en: { wind: 'Wind {speed}–{gust} kt, {dir}°.', oscillation: 'Oscillations ±{value}°, trend {trend}.', stable: 'stable', right: 'slowly veering right', left: 'slowly backing left', terrain: 'On-water: {count} reading(s), latest wind {speed} kt at {dir}°.', modelGap: 'Field/model gap: {speed} kt and {dir}°.', factors: '{a} and {b} point to the {side}.', open: 'Split analysis — keep an open strategy.', lineNeutral: 'No measured geometric line advantage: favour speed and a clear lane.', lineFavoured: '{side} favoured by {distance} ({boats} boat lengths).', enteredLine: 'Line marked {side}: retain an escape lane.', startOpen: 'Start in a clear central area with both options available.', legOpen: 'Keep the first leg open; decide on the first confirmed shift.', watchGust: 'Watch gusts and boat control.', watchShift: 'Watch the first oscillation and avoid getting pinned.', watchGap: 'Confirm the gap between field readings and model.', watchLocal: 'Validate the applied local correction on the water.', watchDefault: 'Watch pressure, clear air and wind evolution.', confidenceHigh: 'High — consistent sources and {count} recent field readings.', confidenceMedium: 'Medium — coherent analysis with {count} field reading(s).', confidenceLow: 'Low — limited data or conflicting signals.', memory: 'Memory from {count} comparable local briefing(s) supports the reading.', committee: 'Committee', pin: 'Pin', rightSide: 'right', leftSide: 'left', clearStart: 'Prioritise speed and a clear lane at the start.', legSide: 'First leg towards the {side}, retaining an escape route.' },
  it: { wind: 'Vento {speed}–{gust} nd, {dir}°.', oscillation: 'Oscillazioni ±{value}°, tendenza {trend}.', stable: 'stabile', right: 'lenta a destra', left: 'lenta a sinistra', terrain: 'Campo: {count} rilevamento/i, ultimo vento {speed} nd a {dir}°.', modelGap: 'Scarto campo/modello: {speed} nd e {dir}°.', factors: '{a} e {b} orientano l’analisi a {side}.', open: 'Analisi divisa — mantenere una strategia aperta.', lineNeutral: 'Nessun vantaggio geometrico misurato: privilegiare velocità e spazio libero.', lineFavoured: '{side} favorito di {distance} ({boats} lunghezze).', enteredLine: 'Linea indicata {side}: mantenere una via di uscita.', startOpen: 'Partire al centro in zona libera, mantenendo entrambe le opzioni.', legOpen: 'Prima bolina libera; decidere sulla prima rotazione confermata.', watchGust: 'Sorvegliare raffiche e controllo della barca.', watchShift: 'Sorvegliare la prima oscillazione senza chiudersi.', watchGap: 'Confermare lo scarto tra rilievi e modello.', watchLocal: 'Verificare in acqua la correzione locale applicata.', watchDefault: 'Sorvegliare pressione, aria libera ed evoluzione del vento.', confidenceHigh: 'Alta — fonti coerenti e {count} rilievi recenti.', confidenceMedium: 'Media — analisi coerente con {count} rilievo/i.', confidenceLow: 'Bassa — dati limitati o segnali contraddittori.', memory: 'La memoria di {count} briefing locali comparabili conferma la lettura.', committee: 'Comitato', pin: 'Boa', rightSide: 'destra', leftSide: 'sinistra', clearStart: 'Privilegiare velocità e spazio libero in partenza.', legSide: 'Prima bolina verso {side}, mantenendo una via di uscita.' },
  es: { wind: 'Viento {speed}–{gust} nd, {dir}°.', oscillation: 'Oscilaciones ±{value}°, tendencia {trend}.', stable: 'estable', right: 'lenta a la derecha', left: 'lenta a la izquierda', terrain: 'Campo: {count} lectura(s), último viento {speed} nd a {dir}°.', modelGap: 'Diferencia campo/modelo: {speed} nd y {dir}°.', factors: '{a} y {b} orientan el análisis a la {side}.', open: 'Análisis dividido — mantener una estrategia abierta.', lineNeutral: 'Sin ventaja geométrica medida: priorizar velocidad y espacio libre.', lineFavoured: '{side} favorecido por {distance} ({boats} esloras).', enteredLine: 'Línea indicada {side}: conservar una vía de salida.', startOpen: 'Salir en una zona central despejada, manteniendo ambas opciones.', legOpen: 'Primer bordo abierto; decidir con el primer role confirmado.', watchGust: 'Vigilar rachas y control del barco.', watchShift: 'Vigilar la primera oscilación y evitar quedar encerrado.', watchGap: 'Confirmar la diferencia entre lecturas y modelo.', watchLocal: 'Validar en el agua la corrección local aplicada.', watchDefault: 'Vigilar presión, aire libre y evolución del viento.', confidenceHigh: 'Alta — fuentes coherentes y {count} lecturas recientes.', confidenceMedium: 'Media — análisis coherente con {count} lectura(s).', confidenceLow: 'Baja — datos limitados o señales contradictorias.', memory: 'La memoria de {count} briefings locales comparables confirma la lectura.', committee: 'Comité', pin: 'Visor', rightSide: 'derecha', leftSide: 'izquierda', clearStart: 'Priorizar velocidad y espacio libre en la salida.', legSide: 'Primer bordo hacia la {side}, conservando una vía de salida.' },
} as const

function fill(value: string, values: Record<string, string | number>) { return value.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? '')) }
function angle(from: number, to: number) { return ((to - from + 540) % 360) - 180 }
function lineAnalysis(request: BriefingRequest | null, wind: number): StartLineAnalysis | null {
  if (!request?.committeeLatitude?.trim() || !request.committeeLongitude?.trim() || !request.pinLatitude?.trim() || !request.pinLongitude?.trim()) return null
  return analyseStartLine({ latitude: Number(request.committeeLatitude), longitude: Number(request.committeeLongitude) }, { latitude: Number(request.pinLatitude), longitude: Number(request.pinLongitude) }, wind, request.boatClass)
}

export function buildIntelligentBriefing(input: Input): IntelligentBriefing {
  const { request, scenario, rows, observation, savedBriefings, localCorrectionApplied, language, formatLength } = input
  const c = text[language]
  const readings = request?.expressReadings ?? []
  const latest = readings.at(-1)
  const rotation = angle(scenario.windStart, scenario.windEnd)
  const conditions = [fill(c.wind, { speed: Math.round(scenario.raceWindSpeed), gust: Math.round(scenario.maxWindSpeed), dir: Math.round(scenario.windStart) }), fill(c.oscillation, { value: Math.round(scenario.oscillation), trend: Math.abs(rotation) < 3 ? c.stable : rotation > 0 ? c.right : c.left })]
  if (latest?.windSpeed && latest.windDirection) conditions.push(fill(c.terrain, { count: readings.length, speed: latest.windSpeed, dir: latest.windDirection }))
  else if (observation.hasObservation && observation.windSpeed != null && observation.windDirection != null) conditions.push(fill(c.terrain, { count: 1, speed: observation.windSpeed.toFixed(1), dir: Math.round(observation.windDirection) }))

  const directional = rows.filter((row) => row.priority <= 4 && row.factor !== 'Adversaires' && row.zone !== 'Centre')
  const signs = directional.map((row) => row.zone.includes('G.') || row.zone === 'Gauche' ? -1 : 1)
  if (Math.abs(rotation) >= 6) signs.push(rotation > 0 ? 1 : -1)
  const positive = signs.filter((sign) => sign > 0).length; const negative = signs.filter((sign) => sign < 0).length
  const shared = positive > 0 && negative > 0 && Math.min(positive, negative) / Math.max(positive, negative) >= .5
  const leading = directional.slice(0, 2)
  const tactics = shared || !leading.length ? [c.open] : [fill(c.factors, { a: leading[0].factor, b: leading[1]?.factor ?? leading[0].factor, side: positive > negative ? c.rightSide : c.leftSide })]
  const comparable = savedBriefings.filter((item) => item.request.location.trim().toLocaleLowerCase() === request?.location.trim().toLocaleLowerCase()).length
  if (comparable) tactics.push(fill(c.memory, { count: comparable }))
  if (observation.hasObservation && (Math.abs(observation.windSpeedDelta ?? 0) >= 2 || Math.abs(observation.windDirectionDelta ?? 0) >= 10)) tactics.push(fill(c.modelGap, { speed: Math.abs(observation.windSpeedDelta ?? 0).toFixed(1), dir: Math.abs(Math.round(observation.windDirectionDelta ?? 0)) }))

  const line = lineAnalysis(request, observation.windDirection ?? scenario.windStart)
  let start: string = c.clearStart
  if (shared) start = c.startOpen
  else if (line?.favoured === 'neutral') start = c.lineNeutral
  else if (line) start = fill(c.lineFavoured, { side: line.favoured === 'pin' ? c.pin : c.committee, distance: formatLength(line.advantageMetres), boats: Math.round(line.boatLengths) })
  else if (request?.startLineBias && request.startLineBias !== 'Neutre') start = fill(c.enteredLine, { side: request.startLineBias === 'Pin' ? c.pin : c.committee })
  const firstLeg = shared ? c.legOpen : fill(c.legSide, { side: positive > negative ? c.rightSide : negative > positive ? c.leftSide : c.stable })
  const significantGap = observation.hasObservation && (Math.abs(observation.windSpeedDelta ?? 0) >= 2 || Math.abs(observation.windDirectionDelta ?? 0) >= 10)
  const watch = significantGap ? c.watchGap : localCorrectionApplied ? c.watchLocal : scenario.maxWindSpeed - scenario.raceWindSpeed >= 4 ? c.watchGust : scenario.oscillation >= 10 ? c.watchShift : c.watchDefault
  const evidence = readings.length || (observation.hasObservation ? 1 : 0)
  const confidence = shared || (!evidence && !comparable) ? c.confidenceLow : evidence >= 3 && !significantGap ? fill(c.confidenceHigh, { count: evidence }) : fill(c.confidenceMedium, { count: evidence })
  const runner = [conditions[0], shared ? c.open : tactics[0], start, firstLeg, watch].slice(0, 5)
  return { conditions: conditions.slice(0, 3), tactics: tactics.slice(0, 3), start, firstLeg, watch, confidence, shared, runner }
}
