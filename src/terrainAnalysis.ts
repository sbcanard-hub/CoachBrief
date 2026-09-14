export type TerrainLevel = 'low' | 'medium' | 'high'
export type CoastalFlow = 'onshore' | 'offshore' | 'alongshore' | 'mixed'
export type TerrainSide = 'left' | 'neutral' | 'right'

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
}

type ElevationResponse = { elevation?: Array<number | null> }

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

/**
 * Diagnostic mesoscale based on a 24-point elevation stencil.
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
  const bearings = Array.from({ length: 8 }, (_, index) => index * 45)
  const radii = [2, 5, 10]
  const locations = [{ latitude, longitude, bearing: 0, radiusKm: 0 }, ...radii.flatMap((radiusKm) =>
    bearings.map((bearing) => ({ ...destination(latitude, longitude, bearing, radiusKm), bearing, radiusKm })),
  )]
  const params = new URLSearchParams({
    latitude: locations.map((point) => point.latitude.toFixed(5)).join(','),
    longitude: locations.map((point) => point.longitude.toFixed(5)).join(','),
  })
  try {
    const response = await fetch(`https://api.open-meteo.com/v1/elevation?${params}`)
    if (!response.ok) return undefined
    const data = await response.json() as ElevationResponse
    if (!Array.isArray(data.elevation) || data.elevation.length !== locations.length) return undefined
    const elevations = data.elevation.map((value) => typeof value === 'number' && Number.isFinite(value) ? value : 0)
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

    return {
      available: true,
      sampleCount: samples.length,
      radiusKm: 10,
      centreElevation: Math.round(centreElevation),
      maxElevation: Math.round(maxElevation),
      relief: Math.round(relief),
      upstreamMean: Math.round(upstream.mean),
      upstreamMax: Math.round(upstream.max),
      leftMean: Math.round(left.mean),
      rightMean: Math.round(right.mean),
      coastalFlow,
      blockingRisk: level(blockingIndex, 45, 140),
      leeRisk: level(obstacle * (offshore ? 1.25 : 1), 35, 120),
      channelingRisk: level(Math.max(0, walls - corridor) + (alongshore ? 35 : 0), 45, 120),
      thermalPotential: level(thermalIndex, .7, 1.8),
      preferredSide,
      sideDifference: Math.round(sideDifference),
      confidence: samples.length >= 20 && relief >= 25 ? 'high' : samples.length >= 16 ? 'medium' : 'low',
    }
  } catch {
    return undefined
  }
}
