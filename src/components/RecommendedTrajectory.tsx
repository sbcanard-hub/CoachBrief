import type { BernotRow, WeatherScenario } from '../bernot'
import type { BriefingRequest } from '../types'

type Side = 'left' | 'neutral' | 'right'
type TrajectoryAdvice = { side: Side; start: string; firstLeg: string; target: string; tack: string; downwind: string; gate: string; rationale: string }
const zoneValue = { Gauche: -2, 'Centre G.': -1, Centre: 0, 'Centre D.': 1, Droite: 2 } as const

function buildTrajectoryAdvice(request: BriefingRequest | null, rows: BernotRow[], weather: WeatherScenario): TrajectoryAdvice {
  // The highest-ranked piles deliberately carry the most weight: this drawing
  // visualises the Bernot hierarchy rather than creating a separate forecast.
  const tacticalRows = rows.filter((row) => row.factor !== 'Adversaires')
  const weightedSide = tacticalRows.reduce((total, row) => total + zoneValue[row.zone] * (8 - row.priority), 0)
  const directionalWeight = tacticalRows.reduce((total, row) => total + Math.abs(zoneValue[row.zone]) * (8 - row.priority), 0)
  const normalized = directionalWeight ? weightedSide / directionalWeight : 0
  const side: Side = Math.abs(normalized) < 0.28 ? 'neutral' : normalized > 0 ? 'right' : 'left'
  const leading = tacticalRows.filter((row) => row.zone !== 'Centre').slice(0, 2).map((row) => row.factor.toLowerCase())
  const rotation = ((weather.windEnd - weather.windStart + 540) % 360) - 180

  if (side === 'neutral') return {
    side,
    start: request?.startLineBias === 'Comité' ? 'Comité favorable, sans fermer la sortie' : request?.startLineBias === 'Pin' ? 'Viseur favorable, sans fermer la sortie' : 'Départ : vitesse et voie libre',
    firstLeg: 'Premier bord selon la bascule observée', target: 'Pas de côté nettement favorisé',
    tack: 'Virer sur refus ou pour rester libre', downwind: 'Portant : jouer pression et air libre',
    gate: 'Porte : décision à l’approche', rationale: 'Les piles prioritaires ne dégagent pas de convergence latérale suffisante.',
  }

  const right = side === 'right'
  const start = request?.startLineBias === 'Comité' ? 'Départ plutôt côté comité' : request?.startLineBias === 'Pin' ? 'Départ plutôt côté viseur' : `Départ centre-${right ? 'comité' : 'viseur'}, voie libre`
  return {
    side, start, firstLeg: `Premier bord plutôt ${right ? 'bâbord' : 'tribord'}`,
    target: `Priorité à la zone ${right ? 'droite' : 'gauche'}`,
    tack: `Virer dans le tiers ${right ? 'droit' : 'gauche'}, sans toucher le bord`,
    downwind: `Portant : option ${right ? 'gauche' : 'droite'} à tester sous pression`,
    gate: `Porte : entrée ${right ? 'gauche' : 'droite'} si elle reste dégagée`,
    rationale: `${leading.length ? leading.join(' et ') : 'analyse tactique'} orientent la synthèse${Math.abs(rotation) > 5 ? ` ; rotation prévue de ${Math.abs(Math.round(rotation))}° vers la ${rotation > 0 ? 'droite' : 'gauche'}` : ''}.`,
  }
}

export function RecommendedTrajectory({ request, rows, weather }: { request: BriefingRequest | null; rows: BernotRow[]; weather: WeatherScenario }) {
  const advice = buildTrajectoryAdvice(request, rows, weather)
  const right = advice.side === 'right'; const neutral = advice.side === 'neutral'
  const upwindPath = neutral ? 'M 300 408 C 290 335, 310 265, 300 105' : right ? 'M 300 408 C 350 355, 425 308, 432 242 S 375 145, 300 105' : 'M 300 408 C 250 355, 175 308, 168 242 S 225 145, 300 105'
  const downwindPath = neutral ? 'M 300 105 C 335 190, 265 300, 300 408' : right ? 'M 300 105 C 230 180, 220 280, 278 408' : 'M 300 105 C 370 180, 380 280, 322 408'

  return <section className="trajectory-section" aria-labelledby="trajectory-title">
    <div className="section-heading"><div><span className="section-number">03</span><div><span className="step-label">Lecture tactique calculée</span><h2 id="trajectory-title">Trajectoire conseillée</h2></div></div><span className={`trajectory-status is-${advice.side}`}>{neutral ? 'Option ouverte' : `Préférence ${right ? 'droite' : 'gauche'}`}</span></div>
    <div className="trajectory-layout">
      <figure className="trajectory-figure"><svg viewBox="0 0 600 470" role="img" aria-labelledby="trajectory-svg-title trajectory-svg-desc">
        <title id="trajectory-svg-title">Schéma de la trajectoire tactique préférentielle</title><desc id="trajectory-svg-desc">{advice.start}. {advice.firstLeg}. {advice.target}. {advice.tack}. {advice.downwind}. {advice.gate}.</desc>
        <defs><marker id="trajectory-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker><pattern id="water-grid" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M 0 28 L 28 28 M 28 0 L 28 28" /></pattern></defs>
        <rect className="trajectory-water" x="16" y="16" width="568" height="438" /><rect className="trajectory-grid" x="16" y="16" width="568" height="438" />
        <path className="course-axis" d="M 300 410 L 300 102" /><path className="start-line" d="M 155 410 L 445 410" /><circle className="committee-mark" cx="445" cy="410" r="8" /><path className="pin-mark" d="M 147 418 L 155 397 L 163 418 Z" />
        <path className="windward-mark" d="M 288 105 L 300 82 L 312 105 Z" /><path className="gate" d="M 250 422 L 350 422" /><circle className="gate-mark" cx="250" cy="422" r="6" /><circle className="gate-mark" cx="350" cy="422" r="6" />
        <path className={`preferred-path${neutral ? ' is-neutral' : ''}`} d={upwindPath} markerEnd="url(#trajectory-arrow)" /><path className="downwind-path" d={downwindPath} markerEnd="url(#trajectory-arrow)" />
        <circle className="decision-zone" cx={neutral ? 300 : right ? 432 : 168} cy="242" r="28" />
        <text className="diagram-label" x="300" y="60" textAnchor="middle">Bouée au vent</text><text className="diagram-label" x="145" y="445" textAnchor="middle">Viseur</text><text className="diagram-label" x="455" y="445" textAnchor="middle">Comité</text>
        <text className="diagram-note" x={neutral ? 325 : right ? 465 : 135} y="238" textAnchor={neutral || right ? 'start' : 'end'}>{neutral ? 'Observer la bascule' : 'Zone de virement'}</text><text className="diagram-note is-portant" x={right ? 195 : 405} y="310" textAnchor="middle">Option au portant</text>
      </svg></figure>
      <div className="trajectory-notes" aria-label="Consignes associées au schéma"><strong>{advice.target}</strong><ul><li>{advice.start}</li><li>{advice.firstLeg}</li><li>{advice.tack}</li><li>{advice.downwind}</li><li>{advice.gate}</li></ul><p><span>Pourquoi :</span> {advice.rationale}</p></div>
    </div>
    <p className="trajectory-disclaimer">Trajectoire indicative issue de l’analyse du briefing — à adapter aux conditions réelles et aux adversaires.</p>
  </section>
}
