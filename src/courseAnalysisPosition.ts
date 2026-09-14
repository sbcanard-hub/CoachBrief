export type CourseAnalysisPosition = {
  originLatitude: number
  originLongitude: number
  latitude: number
  longitude: number
}

const EVENT_NAME = 'coachbrief:course-analysis-position'
let currentPosition: CourseAnalysisPosition | null = null

export function publishCourseAnalysisPosition(position: CourseAnalysisPosition) {
  const unchanged = currentPosition
    && Math.abs(currentPosition.originLatitude - position.originLatitude) < 1e-7
    && Math.abs(currentPosition.originLongitude - position.originLongitude) < 1e-7
    && Math.abs(currentPosition.latitude - position.latitude) < 1e-7
    && Math.abs(currentPosition.longitude - position.longitude) < 1e-7
  if (unchanged) return
  currentPosition = position
  window.dispatchEvent(new CustomEvent<CourseAnalysisPosition>(EVENT_NAME, { detail: position }))
}

export function currentCourseAnalysisPosition() {
  return currentPosition
}

export function subscribeCourseAnalysisPosition(listener: (position: CourseAnalysisPosition) => void) {
  const handler = (event: Event) => listener((event as CustomEvent<CourseAnalysisPosition>).detail)
  window.addEventListener(EVENT_NAME, handler)
  return () => window.removeEventListener(EVENT_NAME, handler)
}
