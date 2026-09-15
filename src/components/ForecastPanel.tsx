import { useEffect, useMemo, useState } from 'react'
import { CloudSun, Compass, Gauge, Layers3, Mountain, Navigation, Sun, Thermometer, Waves, Wind } from 'lucide-react'
import type { BriefingRequest } from '../types'
import type { LiveWeatherData } from '../weather'
import { usePreferences, type Language } from '../preferences'
import './forecastPanel.css'

type UpperAir = {
  speed850: number | null
  direction850: number | null
  temp850: number | null
  height850: number | null
  speed700: number | null
  direction700: number | null
  height700: number | null
  source: string
}

type Copy = {
  title: string; eyebrow: string; general: string; synoptic: string; fronts: string; terrain: string; left: string; right: string
  temperatures: string; air: string; sea: string; stability: string; flow: string; upperWind: string; solarNoon: string; cadrans: string
  unavailable: string; loading: string; strong: string; medium: string; weak: string; stable: string; neutral: string; unstable: string
  onshore: string; offshore: string; alongshore: string; mixed: string; highConfidence: string; mediumConfidence: string; lowConfidence: string
}

const copy: Record<Language, Copy> = {
  fr: { title: 'Prévision générale', eyebrow: 'Du synoptique au thermique', general: 'Situation générale', synoptic: 'Lecture synoptique', fronts: 'Fronts possibles', terrain: 'Topographie', left: 'Gauche', right: 'Droite', temperatures: 'Températures', air: 'Air', sea: 'Eau', stability: 'Stabilité', flow: 'Vent terre / mer', upperWind: 'Vent en altitude', solarNoon: 'Milieu solaire', cadrans: 'Cadrans & thermique', unavailable: 'Indisponible', loading: 'Chargement…', strong: 'fort', medium: 'modéré', weak: 'faible', stable: 'stable', neutral: 'neutre / mixte', unstable: 'instable', onshore: 'mer → terre', offshore: 'terre → mer', alongshore: 'parallèle à la côte', mixed: 'mixte', highConfidence: 'confiance élevée', mediumConfidence: 'confiance moyenne', lowConfidence: 'confiance faible' },
  en: { title: 'General forecast', eyebrow: 'From synoptic scale to sea breeze', general: 'General situation', synoptic: 'Synoptic reading', fronts: 'Possible fronts', terrain: 'Topography', left: 'Left', right: 'Right', temperatures: 'Temperatures', air: 'Air', sea: 'Water', stability: 'Stability', flow: 'Land / sea flow', upperWind: 'Upper wind', solarNoon: 'Solar noon', cadrans: 'Clock theory & thermal', unavailable: 'Unavailable', loading: 'Loading…', strong: 'strong', medium: 'moderate', weak: 'weak', stable: 'stable', neutral: 'neutral / mixed', unstable: 'unstable', onshore: 'sea → land', offshore: 'land → sea', alongshore: 'alongshore', mixed: 'mixed', highConfidence: 'high confidence', mediumConfidence: 'medium confidence', lowConfidence: 'low confidence' },
  it: { title: 'Previsione generale', eyebrow: 'Dal sinottico alla brezza termica', general: 'Situazione generale', synoptic: 'Lettura sinottica', fronts: 'Fronti possibili', terrain: 'Topografia', left: 'Sinistra', right: 'Destra', temperatures: 'Temperature', air: 'Aria', sea: 'Acqua', stability: 'Stabilità', flow: 'Vento terra / mare', upperWind: 'Vento in quota', solarNoon: 'Mezzogiorno solare', cadrans: 'Quadranti & termica', unavailable: 'Non disponibile', loading: 'Caricamento…', strong: 'forte', medium: 'moderato', weak: 'debole', stable: 'stabile', neutral: 'neutro / misto', unstable: 'instabile', onshore: 'mare → terra', offshore: 'terra → mare', alongshore: 'lungo costa', mixed: 'misto', highConfidence: 'confidenza alta', mediumConfidence: 'confidenza media', lowConfidence: 'confidenza bassa' },
  es: { title: 'Previsión general', eyebrow: 'De la escala sinóptica a la brisa térmica', general: 'Situación general', synoptic: 'Lectura sinóptica', fronts: 'Frentes posibles', terrain: 'Topografía', left: 'Izquierda', right: 'Derecha', temperatures: 'Temperaturas', air: 'Aire', sea: 'Agua', stability: 'Estabilidad', flow: 'Viento tierra / mar', upperWind: 'Viento en altura', solarNoon: 'Mediodía solar', cadrans: 'Cuadrantes y térmica', unavailable: 'No disponible', loading: 'Cargando…', strong: 'fuerte', medium: 'moderado', weak: 'débil', stable: 'estable', neutral: 'neutro / mixto', unstable: 'inestable', onshore: 'mar → tierra', offshore: 'tierra → mar', alongshore: 'paralelo a costa', mixed: 'mixto', highConfidence: 'confianza alta', mediumConfidence: 'confianza media', lowConfidence: 'confianza baja' },
}

function normalize(value: number) { return ((value % 360) + 360) % 360 }
function signedAngle(from: number, to: number) { return ((to - from + 540) % 360) - 180 }
function directionLabel(value: number) {
  const labels = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']
  return labels[Math.round(normalize(value) / 45) % 8]
}
function deg(value: number | null) { return value == null ? '—' : `${String(Math.round(normalize(value))).padStart(3, '0')}° ${directionLabel(value)}` }
function raceMinutes(request: BriefingRequest) {
  const value = request.raceTime || request.startTime || '12:00'
  const [h, m] = value.split(':').map(Number)
  return (Number.isFinite(h) ? h : 12) * 60 + (Number.isFinite(m) ? m : 0)
}
function nearestIndex(times: string[], request: BriefingRequest) {
  const target = raceMinutes(request)
  let best = 0, distance = Infinity
  times.forEach((time, index) => {
    const [h, m] = (time.split('T')[1] || '12:00').split(':').map(Number)
    const d = Math.abs((h || 0) * 60 + (m || 0) - target)
    if (d < distance) { distance = d; best = index }
  })
  return best
}
function dayOfYear(date: string) {
  const d = new Date(`${date}T12:00:00Z`)
  const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 0))
  return Math.floor((d.getTime() - start.getTime()) / 86400000)
}
function timezoneOffsetMinutes(date: string, timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'longOffset', hour: '2-digit' }).formatToParts(new Date(`${date}T12:00:00Z`))
    const raw = parts.find((part) => part.type === 'timeZoneName')?.value || 'GMT+00:00'
    const match = raw.match(/GMT([+-])(\d{2}):(\d{2})/)
    if (!match) return 0
    const sign = match[1] === '-' ? -1 : 1
    return sign * (Number(match[2]) * 60 + Number(match[3]))
  } catch { return 0 }
}
function solarNoon(date: string, longitude: number, timezone: string) {
  const n = dayOfYear(date)
  const b = 2 * Math.PI * (n - 81) / 364
  const equation = 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b)
  const minutes = 720 - 4 * longitude - equation + timezoneOffsetMinutes(date, timezone)
  const h = Math.floor(minutes / 60) % 24
  const m = Math.round(minutes % 60)
  return `${String((h + (m === 60 ? 1 : 0)) % 24).padStart(2, '0')}:${String(m === 60 ? 0 : m).padStart(2, '0')}`
}

export function ForecastPanel({ request, weather }: { request: BriefingRequest; weather: LiveWeatherData | null }) {
  const { language } = usePreferences()
  const c = copy[language]
  const [upperAir, setUpperAir] = useState<UpperAir | null>(null)
  const [upperState, setUpperState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')

  useEffect(() => {
    if (!weather || !request.date) return
    let active = true
    const load = async () => {
      setUpperState('loading')
      const makeUrl = (withModel: boolean) => {
        const params = new URLSearchParams({
          latitude: String(weather.latitude), longitude: String(weather.longitude), start_date: request.date, end_date: request.date,
          timezone: 'auto', wind_speed_unit: 'kn',
          hourly: 'temperature_850hPa,wind_speed_850hPa,wind_direction_850hPa,geopotential_height_850hPa,wind_speed_700hPa,wind_direction_700hPa,geopotential_height_700hPa',
        })
        if (withModel && request.weatherModel) params.set('models', request.weatherModel)
        return `https://api.open-meteo.com/v1/forecast?${params}`
      }
      try {
        let response = await fetch(makeUrl(true))
        let source = weather.model?.shortLabel || 'Best Match'
        if (!response.ok && request.weatherModel && request.weatherModel !== 'best_match') {
          response = await fetch(makeUrl(false)); source = 'Best Match'
        }
        if (!response.ok) throw new Error('upper air unavailable')
        const data = await response.json() as { hourly?: Record<string, Array<number | string | null>> }
        const times = (data.hourly?.time || []) as string[]
        if (!times.length) throw new Error('no upper air')
        const i = nearestIndex(times, request)
        const n = (key: string) => {
          const value = data.hourly?.[key]?.[i]
          return typeof value === 'number' && Number.isFinite(value) ? value : null
        }
        if (!active) return
        setUpperAir({ speed850: n('wind_speed_850hPa'), direction850: n('wind_direction_850hPa'), temp850: n('temperature_850hPa'), height850: n('geopotential_height_850hPa'), speed700: n('wind_speed_700hPa'), direction700: n('wind_direction_700hPa'), height700: n('geopotential_height_700hPa'), source })
        setUpperState('ready')
      } catch { if (active) { setUpperAir(null); setUpperState('error') } }
    }
    load()
    return () => { active = false }
  }, [request.date, request.raceTime, request.startTime, request.weatherModel, weather])

  const analysis = useMemo(() => {
    if (!weather) return null
    const terrain = weather.terrain
    const sea = weather.marine?.seaTemperature ?? null
    const delta = sea == null ? null : weather.race.temperature - sea
    const rotation = signedAngle(weather.scenario.windStart, weather.scenario.windEnd)
    const gustSpread = weather.race.gust - weather.race.speed
    const pressureText = weather.pressureTrend === 'baisse' ? 'pression en baisse' : weather.pressureTrend === 'hausse' ? 'pression en hausse' : 'pression stable'
    const synoptic = `${Math.round(weather.race.pressure)} hPa · ${pressureText} · vent ${deg(weather.race.direction)} ${Math.round(weather.race.speed)} kt, rotation ${rotation >= 0 ? '+' : ''}${Math.round(rotation)}° sur la plage étudiée.`
    let front = 'Signal frontal faible à l’heure de la manche.'
    if (weather.pressureTrend === 'baisse' && weather.race.cloudCover >= 70 && gustSpread >= 5) front = 'Signal frontal modéré : baisse de pression, forte nébulosité et rafales. À confirmer sur une carte synoptique.'
    else if (weather.pressureTrend === 'baisse' && (weather.race.cloudCover >= 55 || gustSpread >= 5)) front = 'Front ou ligne perturbée possible : signal incomplet, à surveiller sur le synoptique.'
    const lapse = upperAir?.temp850 != null && upperAir.height850 != null && upperAir.height850 > 300 ? (weather.race.temperature - upperAir.temp850) / (upperAir.height850 / 1000) : null
    let stability: 'stable' | 'neutral' | 'unstable' = 'neutral'
    if (lapse != null) stability = lapse >= 7 ? 'unstable' : lapse <= 5.5 ? 'stable' : 'neutral'
    else if (delta != null) stability = delta >= 3 && weather.race.cloudCover < 60 ? 'unstable' : delta <= 0 || weather.race.cloudCover > 80 ? 'stable' : 'neutral'
    const flow = terrain?.coastalFlow || 'mixed'
    const thermalScore = (terrain?.thermalPotential === 'high' ? 2 : terrain?.thermalPotential === 'medium' ? 1 : 0) + (stability === 'unstable' ? 2 : stability === 'neutral' ? 1 : 0) + (delta != null && delta >= 2 ? 1 : 0) + (weather.race.speed <= 12 ? 1 : 0)
    const thermal = thermalScore >= 5 ? 'strong' : thermalScore >= 3 ? 'medium' : 'weak'
    const cadrans = thermal === 'strong'
      ? `Thermique favorable : surveiller son établissement autour du midi solaire, puis une rotation progressive vers le flux marin. La bascule réelle prime sur le modèle pour choisir le cadran actif.`
      : thermal === 'medium'
        ? `Thermique possible mais concurrencé par le synoptique. Utiliser le midi solaire comme repère et vérifier sur l’eau si la rotation accélère avant de privilégier un cadran.`
        : `Thermique peu dominant : le cadran synoptique devrait rester prioritaire. Rechercher surtout les effets de relief, les oscillations et les zones de pression.`
    return { terrain, sea, delta, synoptic, front, lapse, stability, flow, thermal, cadrans }
  }, [weather, upperAir])

  if (!weather || !analysis) return <section className="forecast-panel"><p>{c.loading}</p></section>
  const confidence = analysis.terrain?.confidence === 'high' ? c.highConfidence : analysis.terrain?.confidence === 'medium' ? c.mediumConfidence : c.lowConfidence
  const flowLabel = analysis.flow === 'onshore' ? c.onshore : analysis.flow === 'offshore' ? c.offshore : analysis.flow === 'alongshore' ? c.alongshore : c.mixed
  const stabilityLabel = analysis.stability === 'unstable' ? c.unstable : analysis.stability === 'stable' ? c.stable : c.neutral
  const thermalLabel = analysis.thermal === 'strong' ? c.strong : analysis.thermal === 'medium' ? c.medium : c.weak
  const noon = solarNoon(request.date, weather.longitude, weather.timezone)

  return <section className="forecast-panel" aria-labelledby="forecast-title">
    <header className="forecast-panel__header"><div><span>{c.eyebrow}</span><h2 id="forecast-title">{c.title}</h2></div><strong>{weather.model?.shortLabel || 'Best Match'}</strong></header>
    <div className="forecast-panel__grid">
      <article className="forecast-card forecast-card--wide"><div className="forecast-card__title"><Gauge size={18}/><span>{c.general}</span></div><strong>{Math.round(weather.race.pressure)} hPa · {weather.pressureTrend}</strong><p>{analysis.synoptic}</p></article>
      <article><div className="forecast-card__title"><CloudSun size={18}/><span>{c.fronts}</span></div><p>{analysis.front}</p></article>
      <article><div className="forecast-card__title"><Mountain size={18}/><span>{c.terrain}</span></div><strong>{analysis.terrain ? `${c.left} ${Math.round(analysis.terrain.leftMean)} m · ${c.right} ${Math.round(analysis.terrain.rightMean)} m` : c.unavailable}</strong>{analysis.terrain && <p>Relief max. {analysis.terrain.maxElevation} m · {confidence}.</p>}</article>
      <article><div className="forecast-card__title"><Thermometer size={18}/><span>{c.temperatures}</span></div><strong>{c.air} {Math.round(weather.race.temperature)} °C · {c.sea} {analysis.sea == null ? '—' : `${analysis.sea.toFixed(1)} °C`}</strong>{analysis.delta != null && <p>ΔT air-eau {analysis.delta >= 0 ? '+' : ''}{analysis.delta.toFixed(1)} °C.</p>}</article>
      <article><div className="forecast-card__title"><Layers3 size={18}/><span>{c.stability}</span></div><strong>{stabilityLabel}</strong><p>{analysis.lapse == null ? 'Diagnostic de surface air/eau et nébulosité.' : `Gradient 2 m → 850 hPa ≈ ${analysis.lapse.toFixed(1)} °C/km.`}</p></article>
      <article><div className="forecast-card__title"><Waves size={18}/><span>{c.flow}</span></div><strong>{flowLabel}</strong><p>{analysis.terrain ? `Diagnostic automatique du relief dans un rayon de ${analysis.terrain.radiusKm} km.` : c.unavailable}</p></article>
      <article><div className="forecast-card__title"><Wind size={18}/><span>{c.upperWind}</span></div>{upperState === 'loading' ? <strong>{c.loading}</strong> : upperAir ? <><strong>850 hPa · {deg(upperAir.direction850)} · {upperAir.speed850 == null ? '—' : `${Math.round(upperAir.speed850)} kt`}</strong><p>700 hPa · {deg(upperAir.direction700)} · {upperAir.speed700 == null ? '—' : `${Math.round(upperAir.speed700)} kt`} · {upperAir.source}</p></> : <strong>{c.unavailable}</strong>}</article>
      <article><div className="forecast-card__title"><Sun size={18}/><span>{c.solarNoon}</span></div><strong>{noon}</strong><p>{weather.timezone}</p></article>
      <article className="forecast-card forecast-card--wide forecast-card--thermal"><div className="forecast-card__title"><Compass size={18}/><span>{c.cadrans}</span></div><strong>Potentiel thermique : {thermalLabel}</strong><p>{analysis.cadrans}</p><div className="forecast-card__thermal-row"><span><Navigation size={15}/> Vent surface {deg(weather.race.direction)}</span><span><Sun size={15}/> Midi solaire {noon}</span><span><Wind size={15}/> Rotation modèle {Math.round(signedAngle(weather.scenario.windStart, weather.scenario.windEnd))}°</span></div></article>
    </div>
    <p className="forecast-panel__note">Lecture d’aide à la décision : les signaux de front et de stabilité sont des diagnostics automatiques à confirmer avec l’observation et les cartes météo officielles.</p>
  </section>
}
