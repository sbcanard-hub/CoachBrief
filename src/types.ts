export type BoatClass = 'Optimist' | '420' | 'ILCA'
export type CourseType = 'Banane' | 'Trapèze' | 'Triangle'
export type StartLineBias = 'Comité' | 'Neutre' | 'Pin'
export type FinishOrientation = 'Sous le vent' | 'Travers' | 'Au vent'

export type BriefingRequest = {
  location: string
  latitude: string
  longitude: string
  date: string
  startTime: string
  endTime: string
  raceTime: string
  boatClass: BoatClass
  courseType: CourseType
  courseAxis: string
  startLineBias: StartLineBias
  windwardOffset: string
  finishOrientation: FinishOrientation
}
