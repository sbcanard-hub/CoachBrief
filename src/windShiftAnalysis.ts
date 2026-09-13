import type { ExpressReading } from './types'

export const DEFAULT_SIGNIFICANT_SHIFT_DEGREES = 5
export const MIN_WIND_SHIFT_READINGS = 3

export type WindShiftPattern = 'oscillating' | 'progressive' | 'irregular' | 'stable'

export type WindShiftPoint = {
  recordedAt: string
  direction: number
  unwrappedDirection: number
}

export type WindShiftAnalysis = {
  sufficient: boolean
  points: WindShiftPoint[]
  meanDirection?: number
  meanUnwrappedDirection?: number
  amplitude?: number
  maxLeft?: number
  maxRight?: number
  trend?: 'left' | 'right' | 'stable'
  shiftCount: number
  averageRhythmMinutes?: number
  pattern?: WindShiftPattern
}

function normalize(value: number) { return ((value % 360) + 360) % 360 }
function shortestDelta(from: number, to: number) { return ((to - from + 540) % 360) - 180 }

/** Analyse only the current briefing's timestamped express readings. */
export function analyzeWindShifts(
  readings: ExpressReading[] = [],
  threshold = DEFAULT_SIGNIFICANT_SHIFT_DEGREES,
): WindShiftAnalysis {
  const valid = readings
    .map((reading) => ({ reading, direction: Number(reading.windDirection), time: new Date(reading.recordedAt).getTime() }))
    .filter(({ reading, direction, time }) => reading.windDirection.trim() !== '' && Number.isFinite(direction) && Number.isFinite(time))
    .sort((a, b) => a.time - b.time)

  const points: WindShiftPoint[] = []
  valid.forEach(({ reading, direction }, index) => {
    const normalized = normalize(direction)
    const previous = index ? valid[index - 1] : undefined
    const previousPoint = index ? points[index - 1] : undefined
    points.push({
      recordedAt: reading.recordedAt,
      direction: normalized,
      unwrappedDirection: previous && previousPoint
        ? previousPoint.unwrappedDirection + shortestDelta(normalize(previous.direction), normalized)
        : normalized,
    })
  })
  if (points.length < MIN_WIND_SHIFT_READINGS) return { sufficient: false, points, shiftCount: 0 }

  const radians = points.map((point) => point.direction * Math.PI / 180)
  const meanDirection = normalize(Math.atan2(
    radians.reduce((sum, value) => sum + Math.sin(value), 0),
    radians.reduce((sum, value) => sum + Math.cos(value), 0),
  ) * 180 / Math.PI)
  const meanUnwrappedDirection = points.reduce((sum, point) => sum + point.unwrappedDirection, 0) / points.length
  const deviations = points.map((point) => point.unwrappedDirection - meanUnwrappedDirection)
  const maxLeft = Math.abs(Math.min(0, ...deviations))
  const maxRight = Math.max(0, ...deviations)
  const amplitude = Math.max(maxLeft, maxRight)

  // A small zig-zag detector: a leg must travel the threshold before it is
  // counted, and must reverse by the same amount before another leg is counted.
  const shiftTimes: number[] = []
  let leg: -1 | 0 | 1 = 0
  let extreme = points[0].unwrappedDirection
  for (let index = 1; index < points.length; index += 1) {
    const value = points[index].unwrappedDirection
    if (leg === 0) {
      const delta = value - extreme
      if (Math.abs(delta) >= threshold) {
        leg = delta > 0 ? 1 : -1
        extreme = value
        shiftTimes.push(new Date(points[index].recordedAt).getTime())
      }
    } else if ((leg === 1 && value > extreme) || (leg === -1 && value < extreme)) {
      extreme = value
    } else if (Math.abs(value - extreme) >= threshold) {
      leg = leg === 1 ? -1 : 1
      extreme = value
      shiftTimes.push(new Date(points[index].recordedAt).getTime())
    }
  }
  const intervals = shiftTimes.slice(1).map((time, index) => (time - shiftTimes[index]) / 60_000).filter((value) => value > 0)
  const averageRhythmMinutes = intervals.length ? intervals.reduce((sum, value) => sum + value, 0) / intervals.length : undefined
  const trendDelta = points.at(-1)!.unwrappedDirection - points[0].unwrappedDirection
  const trend = Math.abs(trendDelta) < threshold ? 'stable' : trendDelta > 0 ? 'right' : 'left'
  const intervalMean = averageRhythmMinutes ?? 0
  const intervalDeviation = intervals.length > 1
    ? Math.sqrt(intervals.reduce((sum, value) => sum + (value - intervalMean) ** 2, 0) / intervals.length)
    : Infinity
  const regular = shiftTimes.length >= 3 && intervals.length >= 2 && intervalDeviation / intervalMean <= 0.45
  const progressive = trend !== 'stable' && shiftTimes.length <= 2 && Math.abs(trendDelta) >= threshold
  const pattern: WindShiftPattern = regular ? 'oscillating' : progressive ? 'progressive' : shiftTimes.length >= 2 ? 'irregular' : 'stable'

  return { sufficient: true, points, meanDirection, meanUnwrappedDirection, amplitude, maxLeft, maxRight, trend, shiftCount: shiftTimes.length, averageRhythmMinutes, pattern }
}
