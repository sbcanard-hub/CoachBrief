import { Compass, Gauge, LoaderCircle, Mountain, Waves, Wind } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { currentCourseAnalysisPosition, subscribeCourseAnalysisPosition } from '../courseAnalysisPosition'
import type { CourseAnalysisPosition } from '../courseAnalysisPosition'
import { analyseLocalEffectsWithWater } from '../enhancedLocalEffects'
import type { EnhancedLocalEffectsAnalysis } from '../enhancedLocalEffects'
import { analyseLocalEffects, fetchTerrainSamples, localEffectBearingLabel } from '../localEffects'
import type { LocalEffectsAnalysis } from '../localEffects'
import type { BriefingRequest } from '../types'
import { fetchWaterGeometryProfile } from '../waterGeometry'
import { fetchWeatherForBriefing } from '../weather'
import './localEffects.css'
import { usePreferences, type Language } from '../preferences'

const localCopy = {
  fr: { step: 'Plan d’eau · relief + géométrie du rivage', title: 'Effets locaux probables', confidence: 'Confiance indicative', labels: ['Effet limité', 'À surveiller', 'Effet marqué'], loading: 'Analyse du relief, du rivage et des conditions du plan d’eau…', unavailable: 'Analyse locale indisponible', geometryUnavailable: 'Géométrie du rivage indisponible', shoreWarning: 'Rivage non chargé', shoreWarningEnd: 'L’analyse relief reste active.', relief: 'Relief au vent', altitudeUnavailable: 'Altitude non disponible', within: 'dans les 10 km', shape: 'Forme du plan d’eau', coastal: 'zone côtière / maritime', inland: 'lac, retenue ou plan d’eau intérieur', unknown: 'type indéterminé', fetch: 'Fetch dans l’axe du vent', waterDistance: 'distance d’eau détectée', open: 'Secteur le plus ouvert', signals: ['signal peu marqué', 'signal partiel', 'signal net'], channeling: 'Canalisation', thermal: 'Thermique', shapeReading: 'Lecture de la forme du plan d’eau', nearest: 'Rivage le plus proche', undetermined: 'non déterminé', towards: 'vers', about: 'à environ', coach: 'Lecture coach', coverage: 'Couverture relief', shoreDetected: 'Rivage détecté', sectors: 'des 16 secteurs jusqu’à 18 km.', disclaimer: 'Ce moteur cherche des effets plausibles ; il ne remplace ni l’observation sur l’eau ni l’historique spécifique du site.', movedCourse: 'Calcul recalé sur le milieu du premier près déplacé', confidenceNames: ['prudente', 'moyenne', 'bonne'] },
  en: { step: 'Sailing area · terrain + shoreline geometry', title: 'Likely local effects', confidence: 'Indicative confidence', labels: ['Limited effect', 'Monitor', 'Marked effect'], loading: 'Analysing terrain, shoreline and sailing-area conditions…', unavailable: 'Local analysis unavailable', geometryUnavailable: 'Shoreline geometry unavailable', shoreWarning: 'Shoreline not loaded', shoreWarningEnd: 'Terrain analysis remains active.', relief: 'Upwind terrain', altitudeUnavailable: 'Altitude unavailable', within: 'within 10 km', shape: 'Sailing-area shape', coastal: 'coastal / maritime area', inland: 'lake, reservoir or inland water', unknown: 'undetermined type', fetch: 'Fetch on the wind axis', waterDistance: 'detected water distance', open: 'Most open sector', signals: ['weak signal', 'partial signal', 'clear signal'], channeling: 'Channeling', thermal: 'Thermal effect', shapeReading: 'Sailing-area shape reading', nearest: 'Nearest shoreline', undetermined: 'undetermined', towards: 'towards', about: 'about', coach: 'Coach reading', coverage: 'Terrain coverage', shoreDetected: 'Shoreline detected in', sectors: 'of the 16 sectors up to 18 km.', disclaimer: 'This engine identifies plausible effects; it does not replace on-water observation or site-specific history.', movedCourse: 'Analysis centred on the middle of the moved first beat', confidenceNames: ['cautious', 'medium', 'good'] },
  it: { step: 'Campo di regata · rilievo + geometria della costa', title: 'Effetti locali probabili', confidence: 'Affidabilità indicativa', labels: ['Effetto limitato', 'Da monitorare', 'Effetto marcato'], loading: 'Analisi di rilievo, costa e condizioni del campo di regata…', unavailable: 'Analisi locale non disponibile', geometryUnavailable: 'Geometria della costa non disponibile', shoreWarning: 'Costa non caricata', shoreWarningEnd: 'L’analisi del rilievo resta attiva.', relief: 'Rilievo sopravvento', altitudeUnavailable: 'Altitudine non disponibile', within: 'entro 10 km', shape: 'Forma del campo di regata', coastal: 'zona costiera / marittima', inland: 'lago, bacino o acqua interna', unknown: 'tipo indeterminato', fetch: 'Fetch nell’asse del vento', waterDistance: 'distanza d’acqua rilevata', open: 'Settore più aperto', signals: ['segnale debole', 'segnale parziale', 'segnale netto'], channeling: 'Canalizzazione', thermal: 'Termica', shapeReading: 'Lettura della forma del campo di regata', nearest: 'Costa più vicina', undetermined: 'non determinata', towards: 'verso', about: 'a circa', coach: 'Lettura coach', coverage: 'Copertura rilievo', shoreDetected: 'Costa rilevata nel', sectors: 'dei 16 settori fino a 18 km.', disclaimer: 'Il motore individua effetti plausibili; non sostituisce l’osservazione in acqua né lo storico specifico del sito.', movedCourse: 'Calcolo centrato sul punto medio della prima bolina spostata', confidenceNames: ['prudente', 'media', 'buona'] },
  es: { step: 'Campo de regatas · relieve + geometría de costa', title: 'Efectos locales probables', confidence: 'Confianza indicativa', labels: ['Efecto limitado', 'Vigilar', 'Efecto marcado'], loading: 'Analizando el relieve, la costa y las condiciones del campo de regatas…', unavailable: 'Análisis local no disponible', geometryUnavailable: 'Geometría de costa no disponible', shoreWarning: 'Costa no cargada', shoreWarningEnd: 'El análisis del relieve sigue activo.', relief: 'Relieve a barlovento', altitudeUnavailable: 'Altitud no disponible', within: 'en 10 km', shape: 'Forma del campo de regatas', coastal: 'zona costera / marítima', inland: 'lago, embalse o aguas interiores', unknown: 'tipo indeterminado', fetch: 'Fetch en el eje del viento', waterDistance: 'distancia de agua detectada', open: 'Sector más abierto', signals: ['señal débil', 'señal parcial', 'señal clara'], channeling: 'Canalización', thermal: 'Térmica', shapeReading: 'Lectura de la forma del campo de regatas', nearest: 'Costa más cercana', undetermined: 'no determinada', towards: 'hacia', about: 'a unos', coach: 'Lectura del entrenador', coverage: 'Cobertura del relieve', shoreDetected: 'Costa detectada en el', sectors: 'de los 16 sectores hasta 18 km.', disclaimer: 'El motor identifica efectos plausibles; no sustituye la observación en el agua ni el historial específico del lugar.', movedCourse: 'Cálculo centrado en el punto medio de la primera ceñida desplazada', confidenceNames: ['prudente', 'media', 'buena'] },
} as const

type LocalEffectsPanelProps = {
  request: BriefingRequest
}

type PanelState = 'loading' | 'ready' | 'error'
type DisplayAnalysis = LocalEffectsAnalysis | EnhancedLocalEffectsAnalysis

function levelLabel(level: 'faible' | 'modéré' | 'fort', language: Language) {
  const labels = localCopy[language].labels
  return labels[level === 'fort' ? 2 : level === 'modéré' ? 1 : 0]
}

function isEnhanced(analysis: DisplayAnalysis): analysis is EnhancedLocalEffectsAnalysis {
  return 'waterGeometry' in analysis
}

function formatFetch(value: number | null) {
  if (value == null) return '—'
  if (value >= 17.5) return '≥ 18 km'
  return `${value < 10 ? value.toFixed(1).replace('.', ',') : Math.round(value)} km`
}

export function LocalEffectsPanel({ request }: LocalEffectsPanelProps) {
  const { language } = usePreferences()
  const c = localCopy[language]
  const [state, setState] = useState<PanelState>('loading')
  const [analysis, setAnalysis] = useState<DisplayAnalysis | null>(null)
  const [error, setError] = useState('')
  const [geometryWarning, setGeometryWarning] = useState('')
  const [coursePosition, setCoursePosition] = useState<CourseAnalysisPosition | null>(null)
  const originLatitude = Number(request.latitude)
  const originLongitude = Number(request.longitude)
  const matchesRequest = (position: CourseAnalysisPosition | null) => Boolean(position
    && Number.isFinite(originLatitude)
    && Number.isFinite(originLongitude)
    && Math.abs(position.originLatitude - originLatitude) < 1e-6
    && Math.abs(position.originLongitude - originLongitude) < 1e-6)
  const analysisRequest = useMemo(() => matchesRequest(coursePosition)
    ? { ...request, latitude: String(coursePosition?.latitude), longitude: String(coursePosition?.longitude) }
    : request, [coursePosition, request])
  const movedFromOrigin = matchesRequest(coursePosition)
    && Math.hypot((coursePosition?.latitude ?? originLatitude) - originLatitude, (coursePosition?.longitude ?? originLongitude) - originLongitude) > 1e-6

  useEffect(() => {
    const current = currentCourseAnalysisPosition()
    setCoursePosition(matchesRequest(current) ? current : null)
    return subscribeCourseAnalysisPosition((position) => {
      setCoursePosition(matchesRequest(position) ? position : null)
    })
  }, [originLatitude, originLongitude])

  useEffect(() => {
    let active = true
    setState('loading')
    setError('')
    setGeometryWarning('')
    setAnalysis(null)

    void fetchWeatherForBriefing(analysisRequest)
      .then(async (weather) => {
        const [terrain, waterGeometryResult] = await Promise.all([
          fetchTerrainSamples(weather.latitude, weather.longitude),
          fetchWaterGeometryProfile(weather.latitude, weather.longitude)
            .then((profile) => ({ profile, error: '' }))
            .catch((reason: unknown) => ({
              profile: null,
              error: reason instanceof Error && language === 'fr' ? reason.message : c.geometryUnavailable,
            })),
        ])
        if (waterGeometryResult.profile) {
          return {
            result: analyseLocalEffectsWithWater(analysisRequest, weather, terrain, waterGeometryResult.profile),
            geometryError: '',
          }
        }
        return {
          result: analyseLocalEffects(analysisRequest, weather, terrain),
          geometryError: waterGeometryResult.error,
        }
      })
      .then(({ result, geometryError }) => {
        if (!active) return
        setAnalysis(result)
        setGeometryWarning(geometryError)
        setState('ready')
      })
      .catch((reason: unknown) => {
        if (!active) return
        setState('error')
        setError(reason instanceof Error && language === 'fr' ? reason.message : c.unavailable)
      })

    return () => { active = false }
  }, [
    analysisRequest.location,
    analysisRequest.latitude,
    analysisRequest.longitude,
    request.date,
    request.raceTime,
    request.startTime,
    request.endTime,
    request.weatherModel,
  ])

  return <section className="local-effects-panel" aria-labelledby="local-effects-title">
    <div className="local-effects-heading">
      <div>
        <span className="step-label">{c.step}</span>
        <h2 id="local-effects-title">{c.title}</h2>
      </div>
      {analysis && <div className="local-effects-confidence">
        <small>{c.confidence}</small>
        <strong>{analysis.confidence}/100 · {c.confidenceNames[analysis.confidence >= 75 ? 2 : analysis.confidence >= 55 ? 1 : 0]}</strong>
      </div>}
    </div>

    {state === 'loading' && <div className="local-effects-loading"><LoaderCircle className="local-effects-spin" size={18} /> {c.loading}</div>}
    {state === 'error' && <div className="local-effects-error">{c.unavailable}: {error}</div>}

    {state === 'ready' && analysis && <>
      {movedFromOrigin && <div className="local-effects-warning">{c.movedCourse}</div>}
      {geometryWarning && <div className="local-effects-warning">{c.shoreWarning}: {language === 'fr' ? geometryWarning : c.geometryUnavailable}. {c.shoreWarningEnd}</div>}
      <div className="local-effects-metrics">
        <article><Mountain size={17} /><div><small>{c.relief}</small><strong>{language === 'fr' ? analysis.exposureLabel : levelLabel((analysis.upwindMaxElevation ?? 0) >= 300 ? 'fort' : (analysis.upwindMaxElevation ?? 0) >= 140 ? 'modéré' : 'faible', language)}</strong><span>{analysis.upwindMaxElevation == null ? c.altitudeUnavailable : `max. ≈ ${Math.round(analysis.upwindMaxElevation)} m ${c.within}`}</span></div></article>
        {isEnhanced(analysis) && <article><Waves size={17} /><div><small>{c.shape}</small><strong>{language === 'fr' ? analysis.waterGeometry.shapeLabel : c.shape}</strong><span>{analysis.waterGeometry.waterBodyType === 'côtier' ? c.coastal : analysis.waterGeometry.waterBodyType === 'intérieur' ? c.inland : c.unknown}</span></div></article>}
        {isEnhanced(analysis) && <article><Wind size={17} /><div><small>{c.fetch}</small><strong>{formatFetch(analysis.upwindFetchKm)}</strong><span>{c.waterDistance}: {formatFetch(analysis.upwindFetchKm)}</span></div></article>}
        <article><Compass size={17} /><div><small>{c.open}</small><strong>{localEffectBearingLabel(analysis.openBearing)}</strong><span>{c.signals[analysis.openBearingClarity >= .45 ? 2 : analysis.openBearingClarity >= .2 ? 1 : 0]}</span></div></article>
        <article><Wind size={17} /><div><small>{c.channeling}</small><strong>{language === 'fr' ? analysis.channelingLabel : levelLabel(analysis.effects.some((effect) => effect.title === 'Canalisation') ? 'modéré' : 'faible', language)}</strong></div></article>
        <article><Waves size={17} /><div><small>{c.thermal}</small><strong>{language === 'fr' ? analysis.thermalLabel : levelLabel(analysis.effects.some((effect) => effect.title.includes('Thermique')) ? 'modéré' : 'faible', language)}</strong></div></article>
      </div>

      {isEnhanced(analysis) && <div className="local-water-geometry-summary">
        <Compass size={16} />
        <p><strong>{c.shapeReading}:</strong> {language === 'fr' ? analysis.waterInteractionLabel : c.shape}. {c.nearest} {analysis.waterGeometry.nearestShoreBearing == null ? c.undetermined : `${c.towards} ${localEffectBearingLabel(analysis.waterGeometry.nearestShoreBearing)}`} {analysis.waterGeometry.nearestShoreDistanceKm == null ? '' : `${c.about} ${formatFetch(analysis.waterGeometry.nearestShoreDistanceKm)}`}.</p>
      </div>}

      {analysis.effects.length > 0 && <div className="local-effects-grid">
        {analysis.effects.map((effect) => <article className={`local-effect-card level-${effect.level}`} key={effect.title}>
          <div className="local-effect-card-heading"><strong>{language === 'fr' ? effect.title : c.title}</strong><span>{levelLabel(effect.level, language)}</span></div>
          <p>{language === 'fr' ? effect.text : c.disclaimer}</p>
        </article>)}
      </div>}

      <div className="local-effects-advice"><Gauge size={16} /><p><strong>{c.coach}:</strong> {language === 'fr' ? analysis.coachAdvice : c.disclaimer}</p></div>
      <p className="local-effects-note">{language === 'fr' ? analysis.attribution : 'Open-Meteo · OpenStreetMap / Overpass.'} {c.coverage}: {Math.round(analysis.elevationCoverage * 100)} %.
        {isEnhanced(analysis) ? ` ${c.shoreDetected} ${Math.round(analysis.waterGeometry.shorelineCoverage * 100)} % ${c.sectors}` : ''} {c.disclaimer}</p>
    </>}
  </section>
}
