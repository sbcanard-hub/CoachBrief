import { Compass, Ruler, Sailboat } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { calculateCourseSizing } from '../courseSizing'
import type { BoatClass, BriefingRequest, CourseType } from '../types'
import { CoursePreview } from './CoursePreview'

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
  const sizing = calculateCourseSizing(boatClass, courseType, windSpeed)
  const hasPoint = Number.isFinite(latitude) && Number.isFinite(longitude)
  const { state } = useLocation()
  const request = state as BriefingRequest | null
  const committeeLatitude = Number(request?.committeeLatitude)
  const committeeLongitude = Number(request?.committeeLongitude)
  const hasCommittee = request?.committeeLatitude !== '' && request?.committeeLongitude !== '' && Number.isFinite(committeeLatitude) && Number.isFinite(committeeLongitude)

  return (
    <section className="course-sizing" aria-labelledby="course-sizing-title">
      <div className="course-sizing-heading">
        <div><Ruler size={18} /><div><span className="step-label">Dimensionnement & tracé</span><h2 id="course-sizing-title">Parcours recommandé</h2></div></div>
        <span>Estimation coach · à calibrer</span>
      </div>

      <div className="course-sizing-layout">
        <div className="course-sizing-data">
          <div className="course-sizing-main"><strong>{sizing.firstLegNm.toFixed(2).replace('.', ',')} <small>NM</small></strong><span>≈ {sizing.firstLegMeters} m · premier bord</span></div>
          <div className="course-sizing-metrics">
            <article><Sailboat size={16} /><div><small>Classe</small><strong>{boatClass}</strong></div></article>
            <article><Compass size={16} /><div><small>Vent utilisé</small><strong>{Math.round(sizing.windSpeed)} nd</strong></div></article>
            <article><Ruler size={16} /><div><small>Fourchette</small><strong>{sizing.minNm.toFixed(2).replace('.', ',')}–{sizing.maxNm.toFixed(2).replace('.', ',')} NM</strong></div></article>
            <article><Compass size={16} /><div><small>VMG estimée</small><strong>{sizing.estimatedVmg.toFixed(1).replace('.', ',')} nd</strong></div></article>
          </div>
          <p>Objectif de calcul : environ <strong>{sizing.targetMinutes} minutes</strong> sur le premier bord pour le bateau de tête. {sizing.note}</p>
          <small className="course-sizing-disclaimer">La carte dessine maintenant une géométrie complète adaptée au type de parcours choisi. C’est une aide de préparation : les instructions de course, la flotte, le clapot, le courant, la visibilité et la zone disponible restent prioritaires.</small>
        </div>

        {hasPoint ? <CoursePreview
          latitude={latitude}
          longitude={longitude}
          axis={courseAxis}
          windwardOffset={windwardOffset}
          firstLegNm={sizing.firstLegNm}
          courseType={courseType}
          committeeLatitude={hasCommittee ? committeeLatitude : undefined}
          committeeLongitude={hasCommittee ? committeeLongitude : undefined}
          committeeAccuracy={request?.committeeAccuracy || ''}
        /> : <div className="course-preview-empty">Placez précisément le plan d’eau pour afficher le parcours complet sur la carte.</div>}
      </div>
    </section>
  )
}
