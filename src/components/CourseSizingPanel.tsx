import { useEffect, useMemo, useState } from 'react'
import { Compass, Ruler, Sailboat } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { calculateCourseSizing } from '../courseSizing'
import type { BoatClass, BriefingRequest, CourseType } from '../types'
import { CoursePreview } from './CoursePreview'
import { IodaCoursePreview } from './IodaCoursePreview'
import { usePreferences } from '../preferences'

type CourseSizingPanelProps = {
  boatClass: BoatClass
  courseType: CourseType
  windSpeed: number
  latitude: number
  longitude: number
  courseAxis: number
  windwardOffset: number
}

export function CourseSizingPanel({ boatClass, courseType, windSpeed, latitude, longitude, courseAxis, windwardOffset }: CourseSizingPanelProps) {
  const { t, length, language } = usePreferences()
  const c = {
    fr: { step: 'Dimensionnement & tracé', title: 'Parcours recommandé', estimate: 'Estimation coach · à calibrer', firstLegLength: 'Longueur du premier près', recommended: 'conseillée', firstLeg: 'premier bord', boatClass: 'Classe', wind: 'Vent utilisé', range: 'Fourchette', vmg: 'VMG estimée', target: 'Objectif de calcul : environ', minutes: 'minutes', targetEnd: 'sur le premier bord pour le bateau de tête.', disclaimer: 'La carte dessine une géométrie complète adaptée au type de parcours choisi. C’est une aide de préparation : les instructions de course, la flotte, le clapot, le courant, la visibilité et la zone disponible restent prioritaires.', empty: 'Placez précisément le plan d’eau pour afficher le parcours complet sur la carte.', ioda: 'Parcours IODA officiel : départ → 1 (bâbord) → 2 (bâbord) → porte 3S/3P → arrivée au terme du second près.', notes: { Banane: 'Sur une banane, ce premier bord sert de base ; ajuster ensuite le nombre de tours au temps cible de la manche.', 'Trapèze': 'Sur un trapèze, contrôler ensuite la longueur et l’angle des travers pour conserver le temps cible global.', Triangle: 'Sur un triangle, vérifier que les bords de reaching restent suffisamment longs pour être tactiquement lisibles.' } },
    en: { step: 'Sizing & layout', title: 'Recommended course', estimate: 'Coach estimate · calibration required', firstLegLength: 'First-leg length', recommended: 'recommended', firstLeg: 'first leg', boatClass: 'Class', wind: 'Wind used', range: 'Range', vmg: 'Estimated VMG', target: 'Calculation target: about', minutes: 'minutes', targetEnd: 'on the first leg for the leading boat.', disclaimer: 'The map now draws a complete geometry suited to the selected course type. This is a planning aid: sailing instructions, fleet, chop, current, visibility and available space remain the priorities.', empty: 'Set the sailing area precisely to display the complete course on the map.', ioda: 'Official IODA course: Start → 1 (port) → 2 (port) → 3S/3P gate → finish at the end of the second windward leg.', notes: { Banane: 'For a windward/leeward course, use this first leg as the basis, then adjust the number of laps to the target race time.', 'Trapèze': 'For a trapezoid, then check reach lengths and angles to preserve the overall target time.', Triangle: 'For a triangle, ensure the reaching legs remain long enough to be tactically meaningful.' } },
    it: { step: 'Dimensionamento e tracciato', title: 'Percorso consigliato', estimate: 'Stima del coach · da calibrare', firstLegLength: 'Lunghezza della prima bolina', recommended: 'consigliata', firstLeg: 'prima bolina', boatClass: 'Classe', wind: 'Vento utilizzato', range: 'Intervallo', vmg: 'VMG stimata', target: 'Obiettivo del calcolo: circa', minutes: 'minuti', targetEnd: 'sulla prima bolina per la barca in testa.', disclaimer: 'La mappa disegna una geometria completa adatta al tipo di percorso scelto. È un aiuto alla preparazione: istruzioni di regata, flotta, onda, corrente, visibilità e spazio disponibile restano prioritari.', empty: "Posiziona con precisione l’area di regata per visualizzare l’intero percorso sulla mappa.", ioda: 'Percorso IODA ufficiale: partenza → 1 → 2 → cancello 3S/3P → arrivo al termine della seconda bolina.', notes: { Banane: 'Per una bolina/poppa, questa prima bolina è la base; adatta poi il numero di giri al tempo obiettivo della prova.', 'Trapèze': 'Per un trapezio, controlla poi lunghezza e angolo dei traversi per mantenere il tempo obiettivo complessivo.', Triangle: 'Per un triangolo, verifica che i lati al traverso siano abbastanza lunghi da risultare tatticamente leggibili.' } },
    es: { step: 'Dimensionamiento y trazado', title: 'Recorrido recomendado', estimate: 'Estimación del entrenador · por calibrar', firstLegLength: 'Longitud del primer tramo', recommended: 'recomendada', firstLeg: 'primer tramo', boatClass: 'Clase', wind: 'Viento utilizado', range: 'Intervalo', vmg: 'VMG estimada', target: 'Objetivo del cálculo: unos', minutes: 'minutos', targetEnd: 'en el primer tramo para el barco de cabeza.', disclaimer: 'El mapa dibuja una geometría completa adaptada al tipo de recorrido elegido. Es una ayuda de preparación: las instrucciones de regata, la flota, el oleaje, la corriente, la visibilidad y el espacio disponible siguen siendo prioritarios.', empty: 'Sitúa con precisión el campo de regatas para mostrar el recorrido completo en el mapa.', ioda: 'Recorrido IODA oficial: salida → 1 → 2 → puerta 3S/3P → llegada al final de la segunda ceñida.', notes: { Banane: 'En un barlovento/sotavento, este primer tramo sirve de base; ajusta después el número de vueltas al tiempo objetivo de la prueba.', 'Trapèze': 'En un trapecio, comprueba después la longitud y el ángulo de los traveses para conservar el tiempo objetivo total.', Triangle: 'En un triángulo, comprueba que los tramos de través sean suficientemente largos para resultar tácticamente claros.' } },
  }[language]
  const sizing = calculateCourseSizing(boatClass, courseType, windSpeed)
  const [firstLegNm, setFirstLegNm] = useState(sizing.firstLegNm)
  useEffect(() => { setFirstLegNm(sizing.firstLegNm) }, [boatClass, courseType, sizing.firstLegNm])
  const firstLegOptions = useMemo(() => Array.from({ length: 39 }, (_, index) => (index + 2) * 0.05), [])
  const firstLegMeters = Math.round(firstLegNm * 1852 / 10) * 10
  const firstLegMinutes = Math.max(1, Math.round(firstLegNm / sizing.estimatedVmg * 60))
  const hasPoint = Number.isFinite(latitude) && Number.isFinite(longitude)
  const { state } = useLocation()
  const request = state as BriefingRequest | null
  const rawCourseType = (request as (BriefingRequest & { courseType?: string }) | null)?.courseType
  const isIoda = request?.iodaCourse === true || rawCourseType === 'IODA'
  const committeeLatitude = Number(request?.committeeLatitude)
  const committeeLongitude = Number(request?.committeeLongitude)
  const hasCommittee = request?.committeeLatitude !== '' && request?.committeeLongitude !== '' && Number.isFinite(committeeLatitude) && Number.isFinite(committeeLongitude)

  return (
    <section className="course-sizing" aria-labelledby="course-sizing-title">
      <div className="course-sizing-heading">
        <div><Ruler size={18} /><div><span className="step-label">{c.step}</span><h2 id="course-sizing-title">{isIoda ? 'IODA' : c.title}</h2></div></div>
        <span>{c.estimate}</span>
      </div>

      <div className="course-sizing-layout">
        <div className="course-sizing-data">
          <div className="course-sizing-main"><strong>{firstLegNm.toFixed(2).replace('.', ',')} <small>NM</small></strong><span>≈ {length(firstLegMeters, 0)} · {c.firstLeg}</span></div>
          <label className="course-sizing-length-control">
            <span>{c.firstLegLength}</span>
            <select value={firstLegNm.toFixed(2)} onChange={(event) => setFirstLegNm(Number(event.target.value))}>
              {firstLegOptions.map((value) => <option key={value} value={value.toFixed(2)}>
                {value.toFixed(2).replace('.', ',')} NM{value === sizing.firstLegNm ? ` · ${c.recommended}` : ''}
              </option>)}
            </select>
          </label>
          <div className="course-sizing-metrics">
            <article><Sailboat size={16} /><div><small>{c.boatClass}</small><strong>{boatClass}</strong></div></article>
            <article><Compass size={16} /><div><small>{c.wind}</small><strong>{Math.round(sizing.windSpeed)} {t('windUnit')}</strong></div></article>
            <article><Ruler size={16} /><div><small>{c.range}</small><strong>{sizing.minNm.toFixed(2).replace('.', ',')}–{sizing.maxNm.toFixed(2).replace('.', ',')} NM</strong></div></article>
            <article><Compass size={16} /><div><small>{c.vmg}</small><strong>{sizing.estimatedVmg.toFixed(1).replace('.', ',')} {t('windUnit')}</strong></div></article>
          </div>
          <p>{c.target} <strong>{firstLegMinutes} {c.minutes}</strong> {c.targetEnd} {isIoda ? c.ioda : c.notes[courseType]}</p>
          <small className="course-sizing-disclaimer">{c.disclaimer}</small>
        </div>

        {hasPoint ? isIoda ? <IodaCoursePreview key={`IODA:${latitude}:${longitude}:${courseAxis}:${windwardOffset}`}
          latitude={latitude}
          longitude={longitude}
          axis={courseAxis}
          windwardOffset={windwardOffset}
          firstLegNm={firstLegNm}
          committeeLatitude={hasCommittee ? committeeLatitude : undefined}
          committeeLongitude={hasCommittee ? committeeLongitude : undefined}
          committeeAccuracy={request?.committeeAccuracy || ''}
        /> : <CoursePreview key={`${courseType}:${latitude}:${longitude}`}
          latitude={latitude}
          longitude={longitude}
          axis={courseAxis}
          windwardOffset={windwardOffset}
          firstLegNm={firstLegNm}
          courseType={courseType}
          committeeLatitude={hasCommittee ? committeeLatitude : undefined}
          committeeLongitude={hasCommittee ? committeeLongitude : undefined}
          committeeAccuracy={request?.committeeAccuracy || ''}
        /> : <div className="course-preview-empty">{c.empty}</div>}
      </div>
    </section>
  )
}