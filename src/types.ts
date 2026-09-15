export type BoatClass = 'Optimist' | '420' | 'ILCA'
export type CourseType = 'Banane' | 'Trapèze' | 'Triangle'
export type StartLineBias = 'Comité' | 'Neutre' | 'Pin'
export type FinishOrientation = 'Sous le vent' | 'Travers' | 'Au vent'
export type WeatherModelKey = 'best_match' | 'meteofrance_arome_france' | 'ecmwf_ifs' | 'icon_eu' | 'ncep_gfs_global'
export type CourseAxisMode = 'manual' | 'model_wind'

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
  /** Stable id while an existing saved briefing is reopened and edited. */
  savedBriefingId?: string
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
  /** Records whether the course axis was entered by the coach or derived from the selected forecast model. */
  courseAxisMode?: CourseAxisMode
  /** Preserves the coach's last manual value while model-wind mode updates courseAxis. */
  manualCourseAxis?: string
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
  /** Optional, user-provided local terrain reference; the compressed image remains on the current device. */
  terrainReferenceId?: string
  terrainReferenceName?: string
  terrainReferenceNotes?: string
  terrainReferenceSide?: 'Gauche' | 'Neutre' | 'Droite'
  terrainReferenceEffect?: '' | 'devent' | 'canalisation' | 'acceleration' | 'thermique'
  /** Chronological on-water readings. The forecast remains stored separately. */
  expressReadings?: ExpressReading[]
}
