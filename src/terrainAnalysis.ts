import { fetchElevations } from './elevation'

export type TerrainLevel = 'low' | 'medium' | 'high'
export type CoastalFlow = 'onshore' | 'offshore' | 'alongshore' | 'mixed'
export type TerrainSide = 'left' | 'neutral' | 'right'
export type ThermalQuadrant = 'Q1' | 'Q2' | 'Q3' | 'Q4'

export type TerrainAnalysis = {
  available: boolean
  sampleCount: number
  radiusKm: number
  centreElevation: number
  maxElevation: number
  relief: number
  upstreamMean: number
  upstreamMax: number
  leftMean: number
  rightMean: number
  coastalFlow: CoastalFlow
  blockingRisk: TerrainLevel
  leeRisk: TerrainLevel
  channelingRisk: TerrainLevel
  thermalPotential: TerrainLevel
  preferredSide: TerrainSide
  sideDifference: number
  confidence: TerrainLevel
  seaBearing?: number
  coastlineBearing?: number
  windSeaAngle?: number
  coastContrast?: number
  thermalQuadrant?: ThermalQuadrant
}

type Sample = { bearing: number; radiusKm: number; elevation: number }

function radians(value: number) { return value * Math.PI / 180 }
function degrees(value: number) { return value * 180 / Math.PI }
function normalize(value: number) { return ((value % 360) + 360) % 360 }
function angleDistance(a: number, b: number) { return Math.abs(((a - b + 540) % 360) - 180) }

function destination(latitude: number, longitude: number, bearing: number, distanceKm: number) {
  const radius = 6371
  const angular = distanceKm / radius
  const direction = radians(normalize(bearing))
  const lat1 = radians(latitude)
  const lon1 = radians(longitude)
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(direction))
  const lon2 = lon1 + Math.atan2(Math.sin(direction) * Math.sin(angular) * Math.cos(lat1), Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2))
  return { latitude: degrees(lat2), longitude: degrees(lon2) }
}

function level(value: number, medium: number, high: number): TerrainLevel {
  return value >= high ? 'high' : value >= medium ? 'medium' : 'low'
}

function sector(samples: Sample[], bearing: number, width = 46) {
  const selected = samples.filter((sample) => angleDistance(sample.bearing, bearing) <= width)
  const weighted = selected.map((sample) => ({ ...sample, weight: 1 / Math.max(1, sample.radiusKm) }))
  const weight = weighted.reduce((sum, sample) => sum + sample.weight, 0)
  return {
    mean: weight ? weighted.reduce((sum, sample) => sum + sample.elevation * sample.weight, 0) / weight : 0,
    max: selected.length ? Math.max(...selected.map((sample) => sample.elevation)) : 0,
    landFraction: selected.length ? selected.filter((sample) => sample.elevation > 3).length / selected.length : 0,
  }
}

function coastlineOrientation(samples: Sample[], bearings: number[]) {
  const sectors = bearings.map((bearing) => ({ bearing, landFraction: sector(samples, bearing, 24).landFraction }))
  const sea = sectors.reduce((best, current) => current.landFraction < best.landFraction ? current : best)
  const land = sectors.reduce((best, current) => current.landFraction > best.landFraction ? current : best)
  const contrast = land.landFraction - sea.landFraction
  if (contrast < .3) return null
  return {
    seaBearing: normalize(sea.bearing),
    coastlineBearing: normalize(sea.bearing + 90),
    contrast,
  }
}

function thermalQuadrantFromGeometry(windFrom: number, seaBearing: number): { quadrant: ThermalQuadrant; angle: number } {
  const angle = angleDistance(windFrom, seaBearing)
  if (angle <= 45) return { quadrant: 'Q4', angle }
  if (angle < 90) return { quadrant: 'Q3', angle }
  if (angle < 135) return { quadrant: 'Q1', angle }
  return { quadrant: 'Q2', angle }
}

/**
 * Micro-weather diagnostic based on an 80-point elevation stencil.
 * Near-field samples receive more weight so a headland, small hill or bay opening
 * close to the race area matters more than distant regional terrain.
 * It identifies exposure and blocking signals; it is intentionally not presented as CFD.
 */
export async function fetchTerrainAnalysis(
  latitude: number,
  longitude: number,
  windFrom: number,
  courseAxis: number,
  windSpeed: number,
  airTemperature: number,
  seaTemperature: number | null | undefined,
  cloudCover: number,
): Promise<TerrainAnalysis | undefined> {
  if (![latitude, longitude, windFrom, courseAxis, windSpeed].every(Number.isFinite)) return undefined
  const bearings = Array.from({ length: 16 }, (_, index) => index * 22.5)
  const radii = [0.25, 0.5, 1, 2, 5]
  const locations = [{ latitude, longitude, bearing: 0, radiusKm: 0 }, ...radii.flatMap((radiusKm) =>
    bearings.map((bearing) => ({ ...destination(latitude, longitude, bearing, radiusKm), bearing, radiusKm })),
  )]
  try {
    const rawElevations = await fetchElevations(locations)
    const validCount = rawElevations.filter((value): value is number => value !== null).length
    if (validCount < Math.ceil(locations.length * .8)) return undefined
    const centreFallback = rawElevations[0] ?? 0
    const elevations = rawElevations.map((value) => value ?? centreFallback)
    const centreElevation = elevations[0]
    const samples: Sample[] = locations.slice(1).map((point, index) => ({ bearing: point.bearing, radiusKm: point.radiusKm, elevation: elevations[index + 1] }))
    const upstream = sector(samples, windFrom)
    const downstream = sector(samples, windFrom + 180)
    const left = sector(samples, courseAxis - 90)
    const right = sector(samples, courseAxis + 90)
    const maxElevation = Math.max(centreElevation, ...samples.map((sample) => sample.elevation))
    const relief = Math.max(0, maxElevation - Math.min(centreElevation, ...samples.map((sample) => sample.elevation)))
    const obstacle = Math.max(0, upstream.max - centreElevation)
    const speedProtection = Math.max(0.55, Math.min(1.55, 10 / Math.max(3, windSpeed)))
    const blockingIndex = obstacle * speedProtection
    const offshore = upstream.landFraction >= .55 && downstream.landFraction < .45
    const onshore = upstream.landFraction < .45 && downstream.landFraction >= .55
    const alongshore = Math.abs(left.landFraction - right.landFraction) >= .45 && !offshore && !onshore
    const coastalFlow: CoastalFlow = offshore ? 'offshore' : onshore ? 'onshore' : alongshore ? 'alongshore' : 'mixed'
    const sideDifference = left.mean - right.mean
    const preferredSide: TerrainSide = Math.abs(sideDifference) < 18 ? 'neutral' : sideDifference > 0 ? 'right' : 'left'
    const corridor = Math.min(left.mean, right.mean)
    const walls = Math.max(left.mean, right.mean)
    const thermalIndex = seaTemperature == null ? 0 : Math.max(0, airTemperature - seaTemperature) * Math.max(0, 1 - cloudCover / 100) * Math.max(.35, 1 - windSpeed / 20)
    const coast = coastlineOrientation(samples, bearings)
    const quadrant = coast ? thermalQuadrantFromGeometry(windFrom, coast.seaBearing) : null

    return {
      available: true,
      sampleCount: samples.length,
      radiusKm: 5,
      centreElevation: Math.round(centreElevation),
      maxElevation: Math.round(maxElevation),
      relief: Math.round(relief),
      upstreamMean: Math.round(upstream.mean),
      upstreamMax: Math.round(upstream.max),
      leftMean: Math.round(left.mean),
      rightMean: Math.round(right.mean),
      coastalFlow,
      blockingRisk: level(blockingIndex, 22, 85),
      leeRisk: level(obstacle * (offshore ? 1.25 : 1), 18, 70),
      channelingRisk: level(Math.max(0, walls - corridor) + (alongshore ? 25 : 0), 25, 75),
      thermalPotential: level(thermalIndex, .7, 1.8),
      preferredSide,
      sideDifference: Math.round(sideDifference),
      confidence: samples.length >= 64 && relief >= 15 ? 'high' : samples.length >= 48 ? 'medium' : 'low',
      ...(coast ? {
        seaBearing: Math.round(coast.seaBearing),
        coastlineBearing: Math.round(coast.coastlineBearing),
        coastContrast: Number(coast.contrast.toFixed(2)),
      } : {}),
      ...(quadrant ? {
        thermalQuadrant: quadrant.quadrant,
        windSeaAngle: Math.round(quadrant.angle),
      } : {}),
    }
  } catch {
    return undefined
  }
}
