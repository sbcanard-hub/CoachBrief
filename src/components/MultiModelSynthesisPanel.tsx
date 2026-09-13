import { AlertTriangle, Compass, Gauge, TrendingDown, TrendingUp, Wind } from 'lucide-react'
import { buildMultiModelSynthesis } from '../modelSynthesis'
import type { WeatherModelKey } from '../types'
import './multiModelSynthesis.css'
import { usePreferences } from '../preferences'

type ModelPoint = {
  model: { key: WeatherModelKey; shortLabel: string }
  available: boolean
  speed: number | null
  direction: number | null
  hourly: Array<{ time: string; speed: number | null; direction: number | null }>
}

function strengthText(trend: ReturnType<typeof buildMultiModelSynthesis>['strengthTrend'], delta: number | null, language: 'fr' | 'en' | 'it' | 'es') {
  if (trend === 'renforcement') return `+${Math.abs(delta ?? 0).toFixed(1).replace('.', ',')} nd`
  if (trend === 'affaiblissement') return `−${Math.abs(delta ?? 0).toFixed(1).replace('.', ',')} nd`
  if (trend === 'stable') return { fr: 'Stable', en: 'Stable', it: 'Stabile', es: 'Estable' }[language]
  return { fr: 'Incertain', en: 'Uncertain', it: 'Incerto', es: 'Incierto' }[language]
}

function rotationText(trend: ReturnType<typeof buildMultiModelSynthesis>['rotationTrend'], delta: number | null, language: 'fr' | 'en' | 'it' | 'es') {
  const labels = {
    fr: { right: 'Droite', left: 'Gauche', split: 'Partagée', stable: 'Stable', uncertain: 'Incertaine' },
    en: { right: 'Right', left: 'Left', split: 'Split', stable: 'Stable', uncertain: 'Uncertain' },
    it: { right: 'Destra', left: 'Sinistra', split: 'Divisa', stable: 'Stabile', uncertain: 'Incerta' },
    es: { right: 'Derecha', left: 'Izquierda', split: 'Dividida', stable: 'Estable', uncertain: 'Incierta' },
  }[language]
  if (trend === 'droite') return `${labels.right} +${Math.abs(Math.round(delta ?? 0))}°`
  if (trend === 'gauche') return `${labels.left} −${Math.abs(Math.round(delta ?? 0))}°`
  if (trend === 'partagée') return labels.split
  if (trend === 'stable') return labels.stable
  return labels.uncertain
}

function directionText(value: number | null) {
  return value == null ? '—' : `${String(Math.round(value)).padStart(3, '0')}°`
}

export function MultiModelSynthesisPanel({ comparisons }: { comparisons: ModelPoint[] }) {
  const { language } = usePreferences()
  const c = {
    fr: { step: 'Lecture coach · synthèse automatique', title: 'Ce que disent vraiment les modèles', confidence: 'Confiance multi-modèles', consensus: 'Consensus', available: 'modèles indépendants disponibles', wind: 'Vent central', unavailable: 'plage indisponible', direction: 'Direction centrale', dispersionUnavailable: 'dispersion indisponible', dispersion: 'dispersion', strength: 'Évolution force', rotation: 'Rotation', window: 'sur la fenêtre sélectionnée', outlier: 'Modèle isolé', outliers: 'Modèles isolés', outlierEnd: 'À surveiller comme scénario alternatif plutôt que comme tendance principale.', briefing: 'Pour le briefing :', method: 'La majorité est calculée entre AROME, ECMWF, ICON‑EU et GFS. Best Match reste visible comme contrôle mais ne compte pas comme un vote indépendant.' },
    en: { step: 'Coach view · automatic synthesis', title: 'What the models are really saying', confidence: 'Multi-model confidence', consensus: 'Consensus', available: 'independent models available', wind: 'Central wind', unavailable: 'range unavailable', direction: 'Central direction', dispersionUnavailable: 'spread unavailable', dispersion: 'spread', strength: 'Wind-strength trend', rotation: 'Rotation', window: 'over the selected window', outlier: 'Outlying model', outliers: 'Outlying models', outlierEnd: 'Monitor as an alternative scenario rather than the main trend.', briefing: 'For the briefing:', method: 'The majority is calculated from AROME, ECMWF, ICON‑EU and GFS. Best Match remains visible as a check but does not count as an independent vote.' },
    it: { step: 'Lettura coach · sintesi automatica', title: 'Cosa indicano davvero i modelli', confidence: 'Affidabilità multi-modello', consensus: 'Consenso', available: 'modelli indipendenti disponibili', wind: 'Vento centrale', unavailable: 'intervallo non disponibile', direction: 'Direzione centrale', dispersionUnavailable: 'dispersione non disponibile', dispersion: 'dispersione', strength: 'Evoluzione intensità', rotation: 'Rotazione', window: 'nella finestra selezionata', outlier: 'Modello isolato', outliers: 'Modelli isolati', outlierEnd: 'Da monitorare come scenario alternativo anziché come tendenza principale.', briefing: 'Per il briefing:', method: 'La maggioranza è calcolata tra AROME, ECMWF, ICON‑EU e GFS. Best Match resta visibile come controllo ma non conta come voto indipendente.' },
    es: { step: 'Lectura del entrenador · síntesis automática', title: 'Lo que realmente indican los modelos', confidence: 'Confianza multimodelo', consensus: 'Consenso', available: 'modelos independientes disponibles', wind: 'Viento central', unavailable: 'intervalo no disponible', direction: 'Dirección central', dispersionUnavailable: 'dispersión no disponible', dispersion: 'dispersión', strength: 'Evolución de fuerza', rotation: 'Rotación', window: 'en la ventana seleccionada', outlier: 'Modelo aislado', outliers: 'Modelos aislados', outlierEnd: 'Debe vigilarse como escenario alternativo y no como tendencia principal.', briefing: 'Para el briefing:', method: 'La mayoría se calcula entre AROME, ECMWF, ICON‑EU y GFS. Best Match sigue visible como control, pero no cuenta como voto independiente.' },
  }[language]
  const synthesis = buildMultiModelSynthesis(comparisons)
  const confidenceLabel = {
    fr: { 'Élevée': 'Élevée', Moyenne: 'Moyenne', Faible: 'Faible' },
    en: { 'Élevée': 'High', Moyenne: 'Medium', Faible: 'Low' },
    it: { 'Élevée': 'Alta', Moyenne: 'Media', Faible: 'Bassa' },
    es: { 'Élevée': 'Alta', Moyenne: 'Media', Faible: 'Baja' },
  }[language][synthesis.confidence]
  const trendLabel = {
    fr: { renforcement: 'renforcement', affaiblissement: 'affaiblissement', stable: 'stable', incertaine: 'incertaine' },
    en: { renforcement: 'strengthening', affaiblissement: 'weakening', stable: 'stable', incertaine: 'uncertain' },
    it: { renforcement: 'rinforzo', affaiblissement: 'attenuazione', stable: 'stabile', incertaine: 'incerta' },
    es: { renforcement: 'refuerzo', affaiblissement: 'debilitamiento', stable: 'estable', incertaine: 'incierta' },
  }[language][synthesis.strengthTrend]
  const localizedHeadline = {
    fr: `${synthesis.consensusCount} modèle(s) indépendant(s) convergent vers ${synthesis.speedRange ? `${synthesis.speedRange[0]}–${synthesis.speedRange[1]} nd` : 'une plage incertaine'}, autour de ${directionText(synthesis.meanDirection)}. Confiance ${confidenceLabel.toLowerCase()} (${synthesis.confidenceScore}/100).`,
    en: `${synthesis.consensusCount} independent model(s) converge on ${synthesis.speedRange ? `${synthesis.speedRange[0]}–${synthesis.speedRange[1]} kt` : 'an uncertain range'}, around ${directionText(synthesis.meanDirection)}. ${confidenceLabel} confidence (${synthesis.confidenceScore}/100).`,
    it: `${synthesis.consensusCount} modello/i indipendente/i convergono su ${synthesis.speedRange ? `${synthesis.speedRange[0]}–${synthesis.speedRange[1]} nd` : 'un intervallo incerto'}, intorno a ${directionText(synthesis.meanDirection)}. Affidabilità ${confidenceLabel.toLowerCase()} (${synthesis.confidenceScore}/100).`,
    es: `${synthesis.consensusCount} modelo(s) independiente(s) convergen en ${synthesis.speedRange ? `${synthesis.speedRange[0]}–${synthesis.speedRange[1]} nd` : 'un intervalo incierto'}, alrededor de ${directionText(synthesis.meanDirection)}. Confianza ${confidenceLabel.toLowerCase()} (${synthesis.confidenceScore}/100).`,
  }[language]
  const localizedAdvice = {
    fr: synthesis.advice,
    en: synthesis.confidence === 'Élevée' ? 'The model signal is consistent: use it as the main scenario, then adjust it to the sailing area and on-water readings.' : synthesis.confidence === 'Moyenne' ? 'The trend is usable but needs confirmation. Give more weight to METAR, local effects and the coach’s reading.' : 'The spread is significant. Do not lock the briefing to one model; favour observations and prepare several scenarios.',
    it: synthesis.confidence === 'Élevée' ? 'Il segnale dei modelli è coerente: usalo come scenario principale, poi adattalo al campo di regata e ai rilievi in acqua.' : synthesis.confidence === 'Moyenne' ? 'La tendenza è utilizzabile ma va confermata. Dai più peso a METAR, effetti locali e rilievo del coach.' : 'La dispersione è significativa. Non basare il briefing su un solo modello; privilegia le osservazioni e prepara più scenari.',
    es: synthesis.confidence === 'Élevée' ? 'La señal de los modelos es coherente: úsala como escenario principal y ajústala al campo de regatas y a las lecturas en el agua.' : synthesis.confidence === 'Moyenne' ? 'La tendencia es utilizable, pero debe confirmarse. Da más peso al METAR, a los efectos locales y a la lectura del entrenador.' : 'La dispersión es importante. No cierres el briefing sobre un solo modelo; prioriza las observaciones y prepara varios escenarios.',
  }[language]
  const strengthIcon = synthesis.strengthTrend === 'renforcement'
    ? <TrendingUp size={18} />
    : synthesis.strengthTrend === 'affaiblissement'
      ? <TrendingDown size={18} />
      : <Wind size={18} />

  return <section className="multi-model-synthesis" aria-labelledby="multi-model-synthesis-title">
    <div className="multi-model-synthesis-heading">
      <div>
        <span className="step-label">{c.step}</span>
        <h3 id="multi-model-synthesis-title">{c.title}</h3>
      </div>
      <div className={`multi-model-confidence is-${synthesis.confidence.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}`}>
        <small>{c.confidence}</small>
        <strong>{confidenceLabel} · {synthesis.confidenceScore}/100</strong>
      </div>
    </div>

    <p className="multi-model-headline">{localizedHeadline}</p>

    <div className="multi-model-kpis">
      <article>
        <span><Gauge size={17} /></span>
        <div><small>{c.consensus}</small><strong>{synthesis.consensusCount}/{synthesis.independentAvailable}</strong><p>{c.available}</p></div>
      </article>
      <article>
        <span><Wind size={17} /></span>
        <div><small>{c.wind}</small><strong>{synthesis.meanSpeed == null ? '—' : `${synthesis.meanSpeed.toFixed(1).replace('.0', '')} nd`}</strong><p>{synthesis.speedRange ? `${synthesis.speedRange[0].toString().replace('.', ',')}–${synthesis.speedRange[1].toString().replace('.', ',')} nd` : c.unavailable}</p></div>
      </article>
      <article>
        <span><Compass size={17} /></span>
        <div><small>{c.direction}</small><strong>{directionText(synthesis.meanDirection)}</strong><p>{synthesis.directionSpread == null ? c.dispersionUnavailable : `${c.dispersion} ±${Math.round(synthesis.directionSpread)}°`}</p></div>
      </article>
      <article>
        <span>{strengthIcon}</span>
        <div><small>{c.strength}</small><strong>{strengthText(synthesis.strengthTrend, synthesis.strengthDelta, language)}</strong><p>{trendLabel}</p></div>
      </article>
      <article>
        <span><Compass size={17} /></span>
        <div><small>{c.rotation}</small><strong>{rotationText(synthesis.rotationTrend, synthesis.rotationDelta, language)}</strong><p>{c.window}</p></div>
      </article>
    </div>

    {synthesis.outliers.length > 0 && <div className="multi-model-outliers">
      <AlertTriangle size={17} />
      <p><strong>{synthesis.outliers.length > 1 ? c.outliers : c.outlier}:</strong> {synthesis.outliers.join(', ')}. {c.outlierEnd}</p>
    </div>}

    <div className="multi-model-advice">
      <strong>{c.briefing}</strong>
      <p>{localizedAdvice}</p>
    </div>

    <small className="multi-model-method">{c.method}</small>
  </section>
}
