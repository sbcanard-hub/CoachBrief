export type GpxPoint = {
  latitude: number
  longitude: number
  name: string
}

export type GpxCourse = {
  points: GpxPoint[]
}

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

export function courseToGpx(points: GpxPoint[], title: string) {
  const waypoints = points.map((point) => `  <wpt lat="${point.latitude.toFixed(7)}" lon="${point.longitude.toFixed(7)}"><name>${escapeXml(point.name)}</name></wpt>`).join('\n')
  const routePoints = points.map((point) => `    <rtept lat="${point.latitude.toFixed(7)}" lon="${point.longitude.toFixed(7)}"><name>${escapeXml(point.name)}</name></rtept>`).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="CoachBrief" xmlns="http://www.topografix.com/GPX/1/1">\n<metadata><name>${escapeXml(title)}</name></metadata>\n${waypoints}\n  <rte>\n    <name>${escapeXml(title)}</name>\n${routePoints}\n  </rte>\n</gpx>\n`
}

function parsedPoint(element: Element, fallbackName: string): GpxPoint | null {
  const latitude = Number(element.getAttribute('lat'))
  const longitude = Number(element.getAttribute('lon'))
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  const name = element.querySelector('name')?.textContent?.trim() || fallbackName
  return { latitude, longitude, name }
}

export function parseCourseGpx(text: string): GpxCourse {
  const documentXml = new DOMParser().parseFromString(text, 'application/xml')
  if (documentXml.querySelector('parsererror')) throw new Error('Fichier GPX invalide')

  const waypointElements = Array.from(documentXml.querySelectorAll('wpt'))
  const routeElements = Array.from(documentXml.querySelectorAll('rtept'))
  const source = waypointElements.length >= 2 ? waypointElements : routeElements
  const points = source
    .map((element, index) => parsedPoint(element, `Point ${index + 1}`))
    .filter((point): point is GpxPoint => point != null)

  if (points.length < 2) throw new Error('Le GPX doit contenir au moins deux points')
  return { points }
}
