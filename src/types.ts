export type BoatClass = 'Optimist' | '420' | 'ILCA'
export type CourseType = 'Banane' | 'Trapèze' | 'Triangle'

export type BriefingRequest = {
  location: string
  date: string
  startTime: string
  endTime: string
  boatClass: BoatClass
  courseType: CourseType
}
