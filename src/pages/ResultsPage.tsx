import { useState } from 'react'
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  Clock3,
  CloudSun,
  Compass,
  Droplets,
  Flag,
  Gauge,
  HelpCircle,
  Navigation,
  Sailboat,
  Thermometer,
  Waves,
  Wind,
} from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { bernotColumns, buildBernotRows, buildCoachRecommendations } from '../bernot'
import type { BriefingRequest } from '../types'

const hourlyForecast = [
  { time: '09:00', speed: 7, gust: 10, direction: 'N-E', degrees: '045°', temperature: '18°' },
  { time: '10:00', speed: 9, gust: 13, direction: 'E-N-E', degrees: '065°', temperature: '19°' },
  { time: '11:00', speed: 11, gust: 15, direction: 'E', degrees: '080°', temperature: '20°', race: true },
  { time: '12:00', speed: 13, gust: 17, direction: 'E', degrees: '090°', temperature: '21°' },
  { time: '13:00', speed: 14, gust: 18, direction: 'E-S-E', degrees: '105°', temperature: '22°' },
  { time: '14:00', speed: 13, gust: 17, direction: 'E-S-E', degrees: '110°', temperature: '22°' },
]

function formatDate(date?: string) {
  if (!date) return 'Samedi 6 septembre 2026'
  const parsed = new Date(`${date}T12:00:00`)
  return Number.isNaN(parsed.getTime())
    ? date
    : new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(parsed)
}

function formatAxis(axis?: string) {
  const value = Number(axis)
  if (!Number.isFinite(value)) return '080°'
  return `${String(Math.round(value)).padStart(3, '0')}°`
}

function formatOffset(offset?: string) {
  const value = Number(offset)
  if (!Number.isFinite(value) || value === 0) return '0° · axe neutre'
  return `${value > 0 ? '+' : ''}${value}° · ${value > 0 ? 'droite' : 'gauche'}`
}

export function ResultsPage() {
  const { state } = useLocation()
  const request = state as BriefingRequest | null
  const [openWhy, setOpenWhy] = useState<number | null>(null)
  const location = request?.location || 'Antibes · Baie des Anges'
  const raceTime = request?.raceTime || request?.startTime || '11:00'
  const boatClass = request?.boatClass || 'Optimist'
  const courseType = request?.courseType || 'Banane'
  const courseAxis = formatAxis(request?.courseAxis)
  const startLineBias = request?.startLineBias || 'Neutre'
  const windwardOffset = formatOffset(request?.windwardOffset)
  const finishOrientation = request?.finishOrientation || 'Sous le vent'
  const bernotRows = buildBernotRows(request)
  const recommendations = buildCoachRecommendations(request)

  return (
    <main className="results-page briefing-page">
      <Link className="back-link" to="/"><ArrowLeft size={17} /> Modifier les informations</Link>

      <section className="briefing-hero" aria-labelledby="briefing-title">
        <div>
          <span className="step-label">Briefing météo & tactique · Données météo fictives</span>
          <h1 id="briefing-title">{location}</h1>
          <div className="event-meta">
            <span><CalendarDays size={15} /> {formatDate(request?.date)}</span>
            <span><Clock3 size={15} /> Manche à {raceTime}</span>
            <span><Sailboat size={15} /> {boatClass}</span>
            <span><Flag size={15} /> Parcours {courseType}</span>
          </div>
        </div>
        <div className="hero-status"><span aria-hidden="true" /> Briefing prêt</div>
      </section>

      <section className="tactical-overview" aria-label="Paramètres tactiques du parcours">
        <article><Compass /><div><small>Axe parcours</small><strong>{courseAxis}</strong></div></article>
        <article><Navigation /><div><small>Ligne favorable</small><strong>{startLineBias}</strong></div></article>
        <article><Wind /><div><small>Bouée au vent</small><strong>{windwardOffset}</strong></div></article>
        <article><Flag /><div><small>Arrivée</small><strong>{finishOrientation}</strong></div></article>
      </section>

      <section className="weather-overview" aria-label="Conditions principales">
        <article className="wind-feature">
          <div className="card-kicker"><Wind size={17} /> Vent à la manche</div>
          <div className="wind-reading">
            <div><strong>11</strong><span>nœuds<br />moyen</span></div>
            <div className="wind-arrow" aria-hidden="true"><Navigation size={48} /></div>
          </div>
          <div className="wind-details">
            <span><small>Rafales</small><strong>15 nds</strong></span>
            <span><small>Direction</small><strong>080° · Est</strong></span>
          </div>
        </article>

        <div className="conditions-grid">
          <article className="condition-card"><Thermometer /><div><small>Températures</small><strong>20°C <span>air</span></strong><p>19°C · eau</p></div></article>
          <article className="condition-card"><Gauge /><div><small>Pression</small><strong>1018 <span>hPa</span></strong><p className="trend-up"><ArrowUpRight /> En hausse</p></div></article>
          <article className="condition-card"><Droplets /><div><small>Point de rosée</small><strong>14°C</strong><p>Humidité 62 %</p></div></article>
          <article className="condition-card"><CloudSun /><div><small>Nébulosité</small><strong>25 %</strong><p>Peu nuageux</p></div></article>
        </div>
      </section>

      <section className="brief-section" aria-labelledby="evolution-title">
        <div className="section-heading">
          <div><span className="section-number">01</span><div><span className="step-label">Fenêtre de course</span><h2 id="evolution-title">Évolution heure par heure</h2></div></div>
          <div className="legend"><span className="legend-average" /> Vent moyen <span className="legend-gust" /> Rafales</div>
        </div>
        <div className="forecast-scroll" tabIndex={0} aria-label="Prévisions horaires, faites défiler horizontalement sur mobile">
          <div className="forecast-table">
            {hourlyForecast.map((hour) => (
              <article className={`forecast-hour${hour.race ? ' is-race' : ''}`} key={hour.time}>
                <div className="forecast-time">{hour.time}{hour.race && <span>Manche</span>}</div>
                <Navigation className="direction-arrow" size={27} aria-hidden="true" />
                <strong className="hour-speed">{hour.speed}<small> nds</small></strong>
                <span className="hour-gust">raf. {hour.gust}</span>
                <span className="hour-direction">{hour.degrees} · {hour.direction}</span>
                <span className="hour-temperature">{hour.temperature}</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="dynamics-grid" aria-label="Dynamique du vent et état de la mer">
        <article className="detail-panel">
          <div className="panel-icon"><Compass /></div>
          <div><span className="step-label">Dynamique du vent</span><h2>Oscillation & rotation</h2></div>
          <div className="metric-line"><span>Oscillation prévue</span><strong>± 8°</strong></div>
          <div className="metric-line"><span>Tendance</span><strong className="rotation"><ArrowDownRight /> Droite</strong></div>
          <p>Rotation progressive de 080° à 110° entre 11 h et 14 h. Oscillations régulières, période estimée à 8–12 minutes.</p>
        </article>
        <article className="detail-panel sea-panel">
          <div className="panel-icon"><Waves /></div>
          <div><span className="step-label">Plan d'eau</span><h2>État de la mer</h2></div>
          <div className="sea-measure"><strong>0,6 <small>m</small></strong><span>Vague courte<br />de secteur Est</span></div>
          <div className="metric-line"><span>Période</span><strong>4 secondes</strong></div>
          <p>Mer peu agitée, devenant légèrement plus courte avec le renforcement de la brise en début d’après-midi.</p>
        </article>
      </section>

      <section className="bernot-section" aria-labelledby="bernot-title">
        <div className="section-heading">
          <div><span className="section-number">02</span><div><span className="step-label">Lecture du plan d’eau</span><h2 id="bernot-title">Les 7 piles de Bernot</h2></div></div>
          <span className="bernot-help">Calcul dynamique · 1 = facteur prioritaire</span>
        </div>
        <div className="bernot-scroll" tabIndex={0} aria-label="Tableau des 7 piles de Bernot">
          <div className="bernot-board">
            <div className="bernot-head factor-head">Facteur</div>
            {bernotColumns.map((column) => <div className="bernot-head" key={column}>{column}</div>)}
            {bernotRows.map((row) => (
              <div className="bernot-row" key={row.factor}>
                <div className="bernot-factor"><span className="priority-badge">{row.priority}</span><div><strong>{row.factor}</strong><small>{row.note}</small></div></div>
                {bernotColumns.map((column) => (
                  <div className={`bernot-cell${row.zone === column ? ' is-selected' : ''}`} key={column}>
                    {row.zone === column ? <><span className="zone-marker">●</span><small>tendance</small></> : <span aria-hidden="true">·</span>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
        <p className="bernot-note">La hiérarchie est maintenant recalculée à partir de la rotation et de l’oscillation du vent de la maquette, du lieu, de l’axe, de la ligne favorable et du désaxage saisi. Courant, relief détaillé et météo réelle seront branchés ensuite.</p>
      </section>

      <section className="coach-section" aria-labelledby="coach-title">
        <div className="coach-heading"><div><span className="step-label">L’essentiel pour le coach</span><h2 id="coach-title">Synthèse tactique</h2></div><span className="coach-badge">3 points calculés</span></div>
        <div className="recommendations">
          {recommendations.map((recommendation, index) => {
            const isOpen = openWhy === index
            return (
              <article className="recommendation" key={recommendation.title}>
                <span className="recommendation-number">0{index + 1}</span>
                <div className="recommendation-content">
                  <h3>{recommendation.title}</h3>
                  <p>{recommendation.text}</p>
                  <button className="why-button" type="button" aria-expanded={isOpen} aria-controls={`why-${index}`} onClick={() => setOpenWhy(isOpen ? null : index)}>
                    <HelpCircle size={15} /> Pourquoi <ChevronDown className={isOpen ? 'rotated' : ''} size={15} />
                  </button>
                  <div className="why-answer" id={`why-${index}`} hidden={!isOpen}>{recommendation.why}</div>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <p className="data-note">Météo encore fictive · Bernot et synthèse tactique calculés à partir des données disponibles · Aucune API externe connectée</p>
    </main>
  )
}
