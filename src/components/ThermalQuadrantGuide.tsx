import './thermalQuadrantGuide.css'

type Quadrant = 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'Q1/Q3'

type Props = {
  active: Quadrant
  language: 'fr' | 'en' | 'it' | 'es'
}

const copy = {
  fr: {
    title: 'Théorie des cadrans thermiques', axis: 'Axe de la brise thermique', land: 'TERRE', sea: 'MER',
    q1: 'SIDE-OFF · favorable', q2: 'OFFSHORE · défavorable', q3: 'SIDE-ON · très favorable', q4: 'ONSHORE · défavorable',
    q1d: 'Vent de terre oblique : il s’atténue et s’aligne progressivement avec l’appel d’air.',
    q2d: 'Vent de terre dos à la mer : il fait bouchon et gêne l’établissement du thermique.',
    q3d: 'Vent de mer oblique : il s’accouple directement au gradient thermique et favorise un établissement précoce.',
    q4d: 'Vent de mer frontal ou parallèle : il s’oppose à la convection et peut saturer la couche limite.',
    active: 'Cadran estimé', uncertain: 'Cadran oblique à confirmer', legend: 'Les numéros et libellés restent prioritaires sur la couleur.'
  },
  en: {
    title: 'Thermal quadrant theory', axis: 'Thermal-breeze axis', land: 'LAND', sea: 'SEA',
    q1: 'SIDE-OFF · favourable', q2: 'OFFSHORE · unfavourable', q3: 'SIDE-ON · very favourable', q4: 'ONSHORE · unfavourable',
    q1d: 'Oblique land wind: it weakens and progressively aligns with the thermal inflow.',
    q2d: 'Direct offshore land wind: it blocks and makes the thermal harder to establish.',
    q3d: 'Oblique sea wind: it couples with the thermal gradient and favours earlier development.',
    q4d: 'Direct or alongshore sea wind: it opposes convection and can saturate the boundary layer.',
    active: 'Estimated quadrant', uncertain: 'Oblique quadrant to confirm', legend: 'Numbers and labels take priority over colour.'
  },
  it: {
    title: 'Teoria dei quadranti termici', axis: 'Asse della brezza termica', land: 'TERRA', sea: 'MARE',
    q1: 'SIDE-OFF · favorevole', q2: 'OFFSHORE · sfavorevole', q3: 'SIDE-ON · molto favorevole', q4: 'ONSHORE · sfavorevole',
    q1d: 'Vento di terra obliquo: si attenua e si allinea progressivamente con il richiamo d’aria.',
    q2d: 'Vento di terra diretto verso il largo: ostacola l’instaurarsi della termica.',
    q3d: 'Vento di mare obliquo: si accoppia al gradiente termico e favorisce un avvio precoce.',
    q4d: 'Vento di mare frontale o parallelo: si oppone alla convezione e può saturare lo strato limite.',
    active: 'Quadrante stimato', uncertain: 'Quadrante obliquo da confermare', legend: 'Numeri e testi hanno priorità sul colore.'
  },
  es: {
    title: 'Teoría de los cuadrantes térmicos', axis: 'Eje de la brisa térmica', land: 'TIERRA', sea: 'MAR',
    q1: 'SIDE-OFF · favorable', q2: 'OFFSHORE · desfavorable', q3: 'SIDE-ON · muy favorable', q4: 'ONSHORE · desfavorable',
    q1d: 'Viento de tierra oblicuo: se debilita y se alinea progresivamente con la entrada térmica.',
    q2d: 'Viento de tierra directo hacia el mar: bloquea y dificulta el establecimiento de la térmica.',
    q3d: 'Viento de mar oblicuo: se acopla al gradiente térmico y favorece un establecimiento temprano.',
    q4d: 'Viento de mar frontal o paralelo: se opone a la convección y puede saturar la capa límite.',
    active: 'Cuadrante estimado', uncertain: 'Cuadrante oblicuo por confirmar', legend: 'Los números y etiquetas tienen prioridad sobre el color.'
  },
} as const

export function ThermalQuadrantGuide({ active, language }: Props) {
  const c = copy[language]
  const label = active === 'Q1/Q3' ? c.uncertain : c.active
  return <div className="thermal-quadrants" aria-label={c.title}>
    <div className="thermal-quadrants__heading"><strong>{c.title}</strong><span>{label} : <b>{active}</b></span></div>

    <svg className="thermal-quadrants__scene" viewBox="0 0 720 390" role="img" aria-labelledby="thermal-quadrant-title thermal-quadrant-desc">
      <title id="thermal-quadrant-title">{c.title}</title>
      <desc id="thermal-quadrant-desc">Q1 side-off, Q2 offshore, Q3 side-on, Q4 onshore. {c.land} à gauche de la côte, {c.sea} à droite et sous la côte.</desc>
      <defs>
        <linearGradient id="thermal-land-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e7e2c9" />
          <stop offset="100%" stopColor="#b8bd91" />
        </linearGradient>
        <linearGradient id="thermal-sea-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#dceff8" />
          <stop offset="100%" stopColor="#b9deee" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width="720" height="390" className="thermal-quadrants__sea-bg" />
      <path d="M0 0 H720 V118 C640 112 575 132 525 154 C470 178 426 173 376 158 C310 138 250 146 196 174 C128 210 74 224 0 244 Z" className="thermal-quadrants__land-bg" />
      <path d="M0 244 C74 224 128 210 196 174 C250 146 310 138 376 158 C426 173 470 178 525 154 C575 132 640 112 720 118" className="thermal-quadrants__coast" />

      <text x="72" y="155" className="thermal-quadrants__terrain-label thermal-quadrants__terrain-label--land">{c.land}</text>
      <text x="648" y="190" textAnchor="middle" className="thermal-quadrants__terrain-label thermal-quadrants__terrain-label--sea">{c.sea}</text>

      <g transform="translate(180 14)">
        <circle cx="180" cy="180" r="142" className="thermal-quadrants__ring"/>
        <path d="M180 180 L180 38 A142 142 0 0 1 322 180 Z" className={`thermal-quadrants__zone thermal-quadrants__zone--fav ${active === 'Q1' || active === 'Q1/Q3' ? 'is-active' : ''}`}/>
        <path d="M180 180 L38 180 A142 142 0 0 1 180 38 Z" className={`thermal-quadrants__zone thermal-quadrants__zone--bad ${active === 'Q2' ? 'is-active' : ''}`}/>
        <path d="M180 180 L180 322 A142 142 0 0 1 38 180 Z" className={`thermal-quadrants__zone thermal-quadrants__zone--fav ${active === 'Q3' || active === 'Q1/Q3' ? 'is-active' : ''}`}/>
        <path d="M180 180 L322 180 A142 142 0 0 1 180 322 Z" className={`thermal-quadrants__zone thermal-quadrants__zone--bad ${active === 'Q4' ? 'is-active' : ''}`}/>
        <line x1="180" y1="24" x2="180" y2="336" className="thermal-quadrants__axis"/>
        <line x1="24" y1="180" x2="336" y2="180" className="thermal-quadrants__axis"/>
        <path d="M180 18 l-10 20 h20 z" className="thermal-quadrants__arrow"/>
        <text x="180" y="14" textAnchor="middle" className="thermal-quadrants__axis-label">{c.axis}</text>
        <text x="248" y="110" className="thermal-quadrants__q">Q1</text>
        <text x="83" y="110" className="thermal-quadrants__q">Q2</text>
        <text x="83" y="268" className="thermal-quadrants__q">Q3</text>
        <text x="248" y="268" className="thermal-quadrants__q">Q4</text>
        <circle cx="180" cy="180" r="16" className="thermal-quadrants__hub"/>
      </g>
    </svg>

    <div className="thermal-quadrants__cards">
      <article className={active === 'Q1' || active === 'Q1/Q3' ? 'is-active' : ''}><strong>Q1 · {c.q1}</strong><span>{c.q1d}</span></article>
      <article className={active === 'Q2' ? 'is-active' : ''}><strong>Q2 · {c.q2}</strong><span>{c.q2d}</span></article>
      <article className={active === 'Q3' || active === 'Q1/Q3' ? 'is-active' : ''}><strong>Q3 · {c.q3}</strong><span>{c.q3d}</span></article>
      <article className={active === 'Q4' ? 'is-active' : ''}><strong>Q4 · {c.q4}</strong><span>{c.q4d}</span></article>
    </div>
    <small className="thermal-quadrants__legend">{c.legend}</small>
  </div>
}
