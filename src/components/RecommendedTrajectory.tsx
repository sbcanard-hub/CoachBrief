import type { BernotRow, WeatherScenario } from '../bernot'
import type { BriefingRequest } from '../types'
import type { TacticalCoherence } from '../tacticalCoherence'
import { usePreferences } from '../preferences'
import type { TranslationKey } from '../i18n/fr'

type Side = 'left' | 'neutral' | 'right'
type TrajectoryCourseType = BriefingRequest['courseType'] | 'IODA'
type TrajectoryAdvice = { side: Side; start: string; firstLeg: string; target: string; tack: string; downwind: string; gate: string; rationale: string }
const zoneValue = { Gauche: -2, 'Centre G.': -1, Centre: 0, 'Centre D.': 1, Droite: 2 } as const

function buildTrajectoryAdvice(request: BriefingRequest | null, rows: BernotRow[], weather: WeatherScenario, t: (key: TranslationKey, variables?: Record<string, string | number>) => string, coherence?: TacticalCoherence): TrajectoryAdvice {
  const tacticalRows = rows.filter((row) => row.factor !== 'Adversaires')
  const weightedSide = tacticalRows.reduce((total, row) => total + zoneValue[row.zone] * (8 - row.priority), 0)
  const directionalWeight = tacticalRows.reduce((total, row) => total + Math.abs(zoneValue[row.zone]) * (8 - row.priority), 0)
  const normalized = directionalWeight ? weightedSide / directionalWeight : 0
  const side: Side = coherence?.preferredSide ?? (Math.abs(normalized) < 0.28 ? 'neutral' : normalized > 0 ? 'right' : 'left')
  const factorKeys: Record<string, TranslationKey> = { Vent: 'trajectoryFactorWind', 'Axe parcours': 'trajectoryFactorCourse', Courant: 'trajectoryFactorCurrent', Vagues: 'trajectoryFactorSea', 'Relief / côte': 'trajectoryFactorLocal', Nuages: 'trajectoryFactorClouds', Adversaires: 'trajectoryFactorOpponents' }
  const leading = tacticalRows.filter((row) => row.zone !== 'Centre').slice(0, 2).map((row) => t(factorKeys[row.factor] ?? 'tacticalAnalysis').toLowerCase())
  const rotation = ((weather.windEnd - weather.windStart + 540) % 360) - 180

  if (side === 'neutral') return {
    side,
    start: t(request?.startLineBias === 'Comité' ? 'trajectoryNeutralCommittee' : request?.startLineBias === 'Pin' ? 'trajectoryNeutralPin' : 'trajectoryNeutralStart'),
    firstLeg: t('trajectoryNeutralLeg'), target: t('trajectoryNeutralTarget'),
    tack: t('trajectoryNeutralTack'), downwind: t('trajectoryNeutralDownwind'),
    gate: t('trajectoryNeutralGate'), rationale: t('trajectoryNeutralRationale'),
  }

  const right = side === 'right'
  const sideLabel = t(right ? 'right' : 'left').toLowerCase()
  const opposite = t(right ? 'left' : 'right').toLowerCase()
  const start = request?.startLineBias === 'Comité' ? t('trajectoryStartCommittee') : request?.startLineBias === 'Pin' ? t('trajectoryStartPin') : t('trajectoryStartCentre', { end: right ? t('committee').toLowerCase() : t('pin').toLowerCase() })
  return {
    side: right ? 'right' : 'left', start, firstLeg: t('trajectoryFirstLeg', { tack: t(right ? 'portTack' : 'starboardTack').toLowerCase() }),
    target: t('trajectoryTarget', { side: sideLabel }), tack: t('trajectoryTack', { side: sideLabel }),
    downwind: t('trajectoryDownwind', { side: opposite }), gate: t('trajectoryGate', { side: opposite }),
    rationale: t(Math.abs(rotation) > 5 ? 'trajectoryRationaleRotation' : 'trajectoryRationale', { factors: leading.length ? leading.join(` ${t('and')} `) : t('tacticalAnalysis').toLowerCase(), degrees: Math.abs(Math.round(rotation)), side: t(rotation > 0 ? 'right' : 'left').toLowerCase() }),
  }
}

type DiagramPoint = { x: number; y: number; label: string }
type FullCourse = { marks: DiagramPoint[]; route: string; alternateRoute?: string; start: DiagramPoint; finish: DiagramPoint }

const detailedCopy = {
  fr: {
    detailed: 'Analyse détaillée du parcours', firstBeat: 'Premier près · découpage tactique', requested: 'Parcours demandé',
    lanes: ['Gauche', 'Centre gauche', 'Centre', 'Centre droit', 'Droite'],
    thirds: ['1er tiers', '2e tiers', '3e tiers'], start: 'Départ', finish: 'Arrivée', mark: 'Bouée',
    leg: 'Bord', recommended: 'Zone conseillée', keepOpen: 'Rester centré et valider la première bascule.',
    phaseOpen: ['Sortir vite et garder les deux côtés accessibles.', 'Choisir le côté seulement sur un signal confirmé.', 'Revenir dans l’axe avant les laylines.'],
    phaseSide: ['Construire une voie libre vers {side}.', 'Exploiter {side} sans atteindre le cadre trop tôt.', 'Revenir vers l’axe et poser la layline tardivement.'],
    courses: {
      Banane: ['Premier près : jouer les bascules par bords droits.', 'Vent arrière : protéger l’intérieur et l’air libre.', 'Deuxième près : réévaluer le côté avec les nouveaux relevés.', 'Dernier bord vers l’arrivée.'],
      Triangle: ['Premier près : jouer les bascules par bords droits.', 'Premier reaching : vitesse et air libre.', 'Deuxième reaching : anticiper la marque suivante.', 'Dernier bord vers l’arrivée.'],
      'Trapèze': ['Premier près : lecture détaillée en trois tiers.', 'Travers haut : vitesse, pression et contrôle de la layline.', 'Bord extérieur : gérer vent arrière et trafic.', 'Travers bas : préparer l’approche de l’arrivée.', 'Dernier bord vers l’arrivée.'],
      IODA: ['Premier près vers 1 : construire le côté conseillé sans atteindre la layline trop tôt.', '1 → 2 : priorité à la vitesse et à l’air libre sur le bord extérieur.', '2 → porte 3S/3P : préparer le choix de porte selon pression, trafic et côté tactique.', 'Porte → arrivée : second près, tirer des bords selon la tactique du jour, réévaluer le côté et poser la layline tardivement.'],
    },
  },
  en: {
    detailed: 'Detailed course analysis', firstBeat: 'First beat · tactical breakdown', requested: 'Requested course',
    lanes: ['Left', 'Centre-left', 'Centre', 'Centre-right', 'Right'],
    thirds: ['First third', 'Second third', 'Final third'], start: 'Start', finish: 'Finish', mark: 'Mark',
    leg: 'Leg', recommended: 'Recommended zone', keepOpen: 'Stay central and confirm the first shift.',
    phaseOpen: ['Accelerate with both sides available.', 'Commit only on a confirmed signal.', 'Return to the axis before the laylines.'],
    phaseSide: ['Build a clear lane towards {side}.', 'Use {side} without reaching the boundary too early.', 'Return towards the axis and approach the layline late.'],
    courses: {
      Banane: ['First beat: play the shifts with straight tacks.', 'Run: protect the inside and clear air.', 'Second beat: reassess the side with new readings.', 'Final leg to the finish.'],
      Triangle: ['First beat: play the shifts with straight tacks.', 'First reach: speed and clear air.', 'Second reach: anticipate the next mark.', 'Final leg to the finish.'],
      'Trapèze': ['First beat: detailed reading in three thirds.', 'Upper reach: speed, pressure and layline control.', 'Outer leg: manage downwind pressure and traffic.', 'Lower reach: prepare the finish approach.', 'Final leg to the finish.'],
      IODA: ['First beat to 1: build towards the recommended side without reaching the layline too early.', '1 → 2: prioritise speed and clear air on the outer leg.', '2 → 3S/3P gate: prepare the gate choice from pressure, traffic and tactical side.', 'Gate → finish: second beat, tack according to the tactical side, reassess the pressure and take the layline late.'],
    },
  },
  it: {
    detailed: 'Analisi dettagliata del percorso', firstBeat: 'Prima bolina · suddivisione tattica', requested: 'Percorso richiesto',
    lanes: ['Sinistra', 'Centro sinistra', 'Centro', 'Centro destra', 'Destra'],
    thirds: ['Primo terzo', 'Secondo terzo', 'Ultimo terzo'], start: 'Partenza', finish: 'Arrivo', mark: 'Boa',
    leg: 'Lato', recommended: 'Zona consigliata', keepOpen: 'Resta al centro e conferma la prima rotazione.',
    phaseOpen: ['Parti veloce mantenendo aperti entrambi i lati.', 'Scegli un lato solo con un segnale confermato.', 'Torna sull’asse prima delle layline.'],
    phaseSide: ['Costruisci una corsia libera verso {side}.', 'Sfrutta {side} senza arrivare troppo presto al bordo.', 'Torna verso l’asse e prendi la layline tardi.'],
    courses: {
      Banane: ['Prima bolina: gioca le rotazioni con bordi rettilinei.', 'Poppa: proteggi l’interno e l’aria libera.', 'Seconda bolina: rivaluta il lato con i nuovi rilievi.', 'Ultimo lato verso l’arrivo.'],
      Triangle: ['Prima bolina: gioca le rotazioni con bordi rettilinei.', 'Primo lasco: velocità e aria libera.', 'Secondo lasco: anticipa la boa seguente.', 'Ultimo lato verso l’arrivo.'],
      'Trapèze': ['Prima bolina: lettura dettagliata in tre terzi.', 'Traverso alto: velocità, pressione e layline.', 'Lato esterno: gestisci poppa e traffico.', 'Traverso basso: prepara l’arrivo.', 'Ultimo lato verso l’arrivo.'],
      IODA: ['Prima bolina verso 1: costruisci il lato consigliato senza raggiungere troppo presto la layline.', '1 → 2: privilegia velocità e aria libera sul lato esterno.', '2 → cancello 3S/3P: prepara la scelta del cancello in base a pressione, traffico e lato tattico.', 'Cancello → arrivo: seconda bolina, fai i bordi secondo il lato tattico, rivaluta la pressione e prendi la layline tardi.'],
    },
  },
  es: {
    detailed: 'Análisis detallado del recorrido', firstBeat: 'Primera ceñida · desglose táctico', requested: 'Recorrido solicitado',
    lanes: ['Izquierda', 'Centro izquierda', 'Centro', 'Centro derecha', 'Derecha'],
    thirds: ['Primer tercio', 'Segundo tercio', 'Último tercio'], start: 'Salida', finish: 'Llegada', mark: 'Boya',
    leg: 'Tramo', recommended: 'Zona recomendada', keepOpen: 'Mantente centrado y confirma el primer role.',
    phaseOpen: ['Sal con velocidad manteniendo abiertos ambos lados.', 'Elige lado solo con un señal confirmado.', 'Vuelve al eje antes de las laylines.'],
    phaseSide: ['Construye una calle libre hacia {side}.', 'Aprovecha {side} sin llegar demasiado pronto al límite.', 'Vuelve hacia el eje y toma la layline tarde.'],
    courses: {
      Banane: ['Primera ceñida: juega los roles con bordos rectos.', 'Popa: protege el interior y el viento libre.', 'Segunda ceñida: reevalúa el lado con nuevas lecturas.', 'Último tramo hacia la llegada.'],
      Triangle: ['Primera ceñida: juega los roles con bordos rectos.', 'Primer través: velocidad y viento libre.', 'Segundo través: anticipa la siguiente boya.', 'Último tramo hacia la llegada.'],
      'Trapèze': ['Primera ceñida: lectura detallada en tres tercios.', 'Través alto: velocidad, presión y layline.', 'Tramo exterior: gestiona popa y tráfico.', 'Través bajo: prepara la llegada.', 'Último tramo hacia la llegada.'],
      IODA: ['Primera ceñida a 1: construye hacia el lado recomendado sin llegar demasiado pronto a la layline.', '1 → 2: prioriza velocidad y viento libre en el tramo exterior.', '2 → puerta 3S/3P: prepara la elección según presión, tráfico y lado táctico.', 'Puerta → llegada: segunda ceñida, da bordos según el lado táctico, reevalúa la presión y toma la layline tarde.'],
    },
  },
} as const

function fullCourse(courseType: TrajectoryCourseType, side: Side, labels: { start: string; finish: string; mark: string }): FullCourse {
  const offset = side === 'right' ? 34 : side === 'left' ? -34 : 0
  const firstBeat = `650,445 ${720 + offset},350 ${690 - offset},250 ${720 + offset},155 720,70`
  if (courseType === 'IODA') {
    const chosenGateX = side === 'right' ? 690 : side === 'left' ? 610 : 650
    const otherGateX = chosenGateX === 690 ? 610 : 690
    const finishX = 675
    const finishY = 220
    const secondBeat = side === 'right'
      ? `${chosenGateX},365 760,325 700,285 735,248 ${finishX},${finishY}`
      : side === 'left'
        ? `${chosenGateX},365 600,325 670,285 620,248 ${finishX},${finishY}`
        : `${chosenGateX},365 615,325 705,285 635,248 ${finishX},${finishY}`
    const alternateSecondBeat = side === 'right'
      ? `${otherGateX},365 745,325 695,285 730,248 ${finishX},${finishY}`
      : side === 'left'
        ? `${otherGateX},365 605,325 665,285 625,248 ${finishX},${finishY}`
        : `${otherGateX},365 610,325 700,285 640,248 ${finishX},${finishY}`
    return {
      marks: [
        { x: 840, y: 70, label: `${labels.mark} 1` },
        { x: 620, y: 165, label: `${labels.mark} 2` },
        { x: 610, y: 365, label: '3S' },
        { x: 690, y: 365, label: '3P' },
      ],
      route: `840,445 ${900 + offset},350 ${810 - offset},250 ${900 + offset},155 840,70 620,165 ${secondBeat}`,
      alternateRoute: `620,165 ${alternateSecondBeat}`,
      start: { x: 840, y: 445, label: labels.start },
      finish: { x: finishX, y: finishY, label: labels.finish },
    }
  }
  if (courseType === 'Triangle') return {
    marks: [{ x: 720, y: 70, label: `${labels.mark} 1` }, { x: 915, y: 285, label: `${labels.mark} 2` }, { x: 650, y: 390, label: `${labels.mark} 3` }],
    route: `650,445 ${firstBeat.split(' ').slice(1).join(' ')} 915,285 650,390 835,445`,
    start: { x: 650, y: 445, label: labels.start }, finish: { x: 835, y: 445, label: labels.finish },
  }
  if (courseType === 'Trapèze') return {
    marks: [{ x: 840, y: 70, label: `${labels.mark} 1` }, { x: 620, y: 165, label: `${labels.mark} 2` }, { x: 620, y: 365, label: `${labels.mark} 3` }, { x: 840, y: 365, label: `${labels.mark} 4` }],
    route: `840,445 ${900 + offset},350 ${810 - offset},250 ${900 + offset},155 840,70 620,165 620,365 840,365 735,445`,
    start: { x: 840, y: 445, label: labels.start }, finish: { x: 735, y: 445, label: labels.finish },
  }
  return {
    marks: [{ x: 780, y: 70, label: `${labels.mark} 1` }, { x: 780, y: 385, label: `${labels.mark} 2` }],
    route: `780,445 ${850 + offset},350 ${750 - offset},250 ${850 + offset},155 780,70 780,385 ${710 - offset},290 ${810 + offset},190 780,70 875,445`,
    start: { x: 780, y: 445, label: labels.start }, finish: { x: 875, y: 445, label: labels.finish },
  }
}

export function RecommendedTrajectory({ request, rows, weather, coherence }: { request: BriefingRequest | null; rows: BernotRow[]; weather: WeatherScenario; coherence?: TacticalCoherence }) {
  const { t, language } = usePreferences()
  const advice = buildTrajectoryAdvice(request, rows, weather, t, coherence)
  const c = detailedCopy[language]
  const rawCourseType = (request as (BriefingRequest & { courseType?: string }) | null)?.courseType
  const courseType: TrajectoryCourseType = request?.iodaCourse === true || rawCourseType === 'IODA' ? 'IODA' : (request?.courseType ?? 'Banane')
  const right = advice.side === 'right'
  const neutral = advice.side === 'neutral'
  const preferredLane = neutral ? 2 : right ? 4 : 0
  const laneX = [90, 190, 290, 390, 490]
  const firstBeatPoints = neutral
    ? `290,445 245,350 335,265 260,175 290,70`
    : right
      ? `290,445 385,350 310,280 475,185 405,125 290,70`
      : `290,445 195,350 270,280 105,185 175,125 290,70`
  const course = fullCourse(courseType, advice.side, c)
  const sideLabel = c.lanes[preferredLane].toLowerCase()
  const phases = neutral ? c.phaseOpen : c.phaseSide.map((item) => item.replace('{side}', sideLabel))
  const legAdvice = c.courses[courseType]
  const courseLabel = courseType === 'IODA' ? 'IODA' : t(courseType === 'Banane' ? 'courseBanana' : courseType === 'Trapèze' ? 'courseTrapezoid' : 'courseTriangle')

  return <section className="trajectory-section" aria-labelledby="trajectory-title">
    <div className="section-heading"><div><span className="section-number">03</span><div><span className="step-label">{c.detailed}</span><h2 id="trajectory-title">{t('recommendedTrajectory')}</h2></div></div><span className={`trajectory-status is-${advice.side}`}>{neutral ? t('openOption') : t('sidePreference', { side: t(right ? 'right' : 'left').toLowerCase() })}</span></div>
    <div className="trajectory-detailed-layout">
      <figure className="trajectory-figure"><svg viewBox="0 0 1000 510" role="img" aria-labelledby="trajectory-svg-title trajectory-svg-desc">
        <title id="trajectory-svg-title">{t('trajectoryDiagramTitle')}</title><desc id="trajectory-svg-desc">{advice.start}. {advice.firstLeg}. {legAdvice.join(' ')}</desc>
        <defs><marker id="trajectory-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" /></marker></defs>
        <rect className="trajectory-water" x="25" y="35" width="530" height="440" />
        <text className="trajectory-panel-title" x="290" y="25" textAnchor="middle">{c.firstBeat}</text>
        {[140, 240, 340, 440].map((x) => <line key={x} className="trajectory-zone-line" x1={x} y1="50" x2={x} y2="455" />)}
        {[185, 315].map((y) => <line key={y} className="trajectory-third-line" x1="40" y1={y} x2="540" y2={y} />)}
        {c.lanes.map((label, index) => <text key={label} className={`trajectory-lane-label${index === preferredLane ? ' is-preferred' : ''}`} x={laneX[index]} y="470" textAnchor="middle">{label}</text>)}
        {c.thirds.map((label, index) => <text key={label} className="trajectory-third-label" x="48" y={[385, 250, 120][index]}>{label}</text>)}
        <line className="start-line" x1="55" y1="445" x2="525" y2="445" />
        <text className="diagram-label" x="290" y="438" textAnchor="middle">{c.start}</text>
        <path className="windward-mark" d="M 278 76 L 290 53 L 302 76 Z" />
        <text className="diagram-label" x="290" y="48" textAnchor="middle">{c.mark} 1</text>
        <polyline className={`preferred-path${neutral ? ' is-neutral' : ''}`} points={firstBeatPoints} markerEnd="url(#trajectory-arrow)" />
        <circle className="decision-zone" cx={laneX[preferredLane]} cy="250" r="24" />

        <rect className="trajectory-water" x="580" y="35" width="395" height="440" />
        <text className="trajectory-panel-title" x="778" y="25" textAnchor="middle">{c.requested} · {courseLabel}</text>
        <polyline className="full-course-route" points={course.route} markerEnd="url(#trajectory-arrow)" />
        {course.alternateRoute && <polyline className="full-course-route" points={course.alternateRoute} style={{ opacity: .35 }} />}
        <circle className="course-start-point" cx={course.start.x} cy={course.start.y} r="7" />
        <text className="diagram-label" x={course.start.x} y={course.start.y + 22} textAnchor="middle">{course.start.label}</text>
        {course.marks.map((point) => <g key={point.label}><circle className="course-mark-point" cx={point.x} cy={point.y} r="8" /><text className="diagram-label" x={point.x} y={point.y - 14} textAnchor="middle">{point.label}</text></g>)}
        <rect className="course-finish-point" x={course.finish.x - 7} y={course.finish.y - 7} width="14" height="14" />
        <text className="diagram-label" x={course.finish.x} y={course.finish.y + 24} textAnchor="middle">{course.finish.label}</text>
      </svg></figure>

      <div className="first-beat-analysis">
        {c.thirds.map((third, index) => <article key={third}><span>{index + 1}</span><div><strong>{third} · {c.recommended}: {neutral ? c.lanes[2] : index === 2 ? c.lanes[right ? 3 : 1] : c.lanes[preferredLane]}</strong><p>{phases[index]}</p></div></article>)}
      </div>
      <div className="course-leg-analysis">
        {legAdvice.map((text, index) => <article key={text}><span>{c.leg} {index + 1}</span><p>{text}</p></article>)}
      </div>
      <div className="trajectory-notes"><strong>{advice.target}</strong><p><span>{t('why')} :</span> {advice.rationale}</p></div>
    </div>
    <p className="trajectory-disclaimer">{t('trajectoryDisclaimer')}</p>
  </section>
}