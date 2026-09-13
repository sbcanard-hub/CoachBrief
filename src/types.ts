export type BoatClass = 'Optimist' | '420' | 'ILCA'
export type CourseType = 'Banane' | 'Trapèze' | 'Triangle'
export type StartLineBias = 'Comité' | 'Neutre' | 'Pin'
export type FinishOrientation = 'Sous le vent' | 'Travers' | 'Au vent'
export type WeatherModelKey = 'best_match' | 'meteofrance_arome_france' | 'ecmwf_ifs' | 'icon_eu' | 'ncep_gfs_global'

export type ExpressReading = {
  id: string
  recordedAt: string
  windSpeed: string
  windDirection: string
  gust: string
  currentSpeed: string
  currentDirection: string
  pressure: string
  cloudCover: string
  notes: string
}

export type BriefingRequest = {
  location: string
  latitude: string
  longitude: string
  committeeLatitude?: string
  committeeLongitude?: string
  committeeAccuracy?: string
  pinLatitude?: string
  pinLongitude?: string
  pinAccuracy?: string
  weatherModel?: WeatherModelKey
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
  observationTime: string
  observedWindSpeed: string
  observedWindDirection: string
  observedGust: string
  observedWaveHeight: string
  observedCurrentSpeed: string
  observedCurrentDirection: string
  observedCloudCover: string
  observedPressure: string
  observationNotes: string
  /** Chronological on-water readings. The forecast remains stored separately. */
  expressReadings?: ExpressReading[]
}
