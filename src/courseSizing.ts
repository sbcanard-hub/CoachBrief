import type { BoatClass, CourseType } from './types'

export type CourseSizing = {
  firstLegNm: number
  firstLegMeters: number
  minNm: number
  maxNm: number
  estimatedVmg: number
  targetMinutes: number
  windSpeed: number
  note: string
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function estimatedUpwindVmg(boatClass: BoatClass, windSpeed: number) {
  if (boatClass === 'Optimist') return clamp(1.5 + windSpeed * 0.12, 1.9, 3.6)
  if (boatClass === '420') return clamp(3.0 + windSpeed * 0.20, 3.6, 6.1)
  return clamp(2.7 + windSpeed * 0.18, 3.2, 5.6)
}

function targetFirstLegMinutes(boatClass: BoatClass) {
  if (boatClass === '420') return 11
  return 12
}

function courseNote(courseType: CourseType) {
  if (courseType === 'Trapèze') return 'Sur un trapèze, contrôler ensuite la longueur et l’angle des travers pour conserver le temps cible global.'
  if (courseType === 'Triangle') return 'Sur un triangle, vérifier que les bords de reaching restent suffisamment longs pour être tactiquement lisibles.'
  return 'Sur une banane, ce premier bord sert de base ; ajuster ensuite le nombre de tours au temps cible de la manche.'
}

export function calculateCourseSizing(boatClass: BoatClass, courseType: CourseType, windSpeed: number): CourseSizing {
  const safeWind = clamp(Number.isFinite(windSpeed) ? windSpeed : 10, 3, 30)
  const estimatedVmg = estimatedUpwindVmg(boatClass, safeWind)
  const targetMinutes = targetFirstLegMinutes(boatClass)
  const firstLegNm = estimatedVmg * targetMinutes / 60
  const roundedNm = Math.round(firstLegNm * 20) / 20

  return {
    firstLegNm: roundedNm,
    firstLegMeters: Math.round(roundedNm * 1852 / 10) * 10,
    minNm: Math.round(roundedNm * 0.88 * 20) / 20,
    maxNm: Math.round(roundedNm * 1.12 * 20) / 20,
    estimatedVmg: Math.round(estimatedVmg * 10) / 10,
    targetMinutes,
    windSpeed: safeWind,
    note: courseNote(courseType),
  }
}
