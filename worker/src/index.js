const TRACE_HOSTS = new Set([
  'app.metasail.fr',
  'live.tractrac.com',
])

const OPEN_METEO_HOSTS = new Set([
  'api.open-meteo.com',
  'marine-api.open-meteo.com',
  'geocoding-api.open-meteo.com',
  'elevation-api.open-meteo.com',
  'historical-forecast-api.open-meteo.com',
  'archive-api.open-meteo.com',
])

const ALLOWED_HOSTS = new Set([...TRACE_HOSTS, ...OPEN_METEO_HOSTS])

const ALLOWED_ORIGINS = new Set([
  'https://sbcanard-hub.github.io',
])

const MAX_BYTES = 5 * 1024 * 1024
const MAX_REDIRECTS = 4

function corsHeaders(request) {
  const origin = request.headers.get('Origin')
  const allowedOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : ''
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  }
}

function json(request, body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  })
}

function parseAllowedUrl(value) {
  let target
  try {
    target = new URL(value)
  } catch {
    throw new Error('URL invalide')
  }
  if (target.protocol !== 'https:' || !ALLOWED_HOSTS.has(target.hostname.toLowerCase())) {
    throw new Error('Destination non autorisée par le relais CoachBrief')
  }
  target.username = ''
  target.password = ''
  return target
}

function cacheTtlFor(target) {
  return OPEN_METEO_HOSTS.has(target.hostname.toLowerCase()) ? 120 : 3600
}

async function fetchAllowed(target) {
  let current = target
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const upstream = await fetch(current, {
      redirect: 'manual',
      headers: {
        'Accept': 'application/json, application/gpx+xml, application/xml, text/html;q=0.9, */*;q=0.5',
        'User-Agent': 'CoachBrief/1.0 (+https://sbcanard-hub.github.io/CoachBrief/)',
      },
      cf: {
        cacheEverything: true,
        cacheTtl: cacheTtlFor(current),
      },
    })

    if (upstream.status >= 300 && upstream.status < 400) {
      const location = upstream.headers.get('Location')
      if (!location) throw new Error('Redirection sans destination')
      current = parseAllowedUrl(new URL(location, current).href)
      continue
    }

    const announcedSize = Number(upstream.headers.get('Content-Length') || 0)
    if (announcedSize > MAX_BYTES) throw new Error('La réponse dépasse la limite de 5 Mo')

    const body = await upstream.arrayBuffer()
    if (body.byteLength > MAX_BYTES) throw new Error('La réponse dépasse la limite de 5 Mo')

    return { upstream, body, finalUrl: current.href }
  }
  throw new Error('Trop de redirections')
}

export default {
  async fetch(request) {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) })
    }

    if (request.method === 'GET' && url.pathname === '/health') {
      return json(request, { ok: true, service: 'coachbrief-relay', weather: true })
    }

    if (request.method !== 'POST' || url.pathname !== '/fetch') {
      return json(request, { error: 'Route inconnue' }, 404)
    }

    const origin = request.headers.get('Origin')
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return json(request, { error: 'Origine non autorisée' }, 403)
    }

    let payload
    try {
      payload = await request.json()
    } catch {
      return json(request, { error: 'Corps JSON invalide' }, 400)
    }

    try {
      const target = parseAllowedUrl(payload?.url)
      const { upstream, body, finalUrl } = await fetchAllowed(target)
      const contentType = upstream.headers.get('Content-Type') || 'application/octet-stream'
      const isWeather = OPEN_METEO_HOSTS.has(target.hostname.toLowerCase())
      return new Response(body, {
        status: upstream.status,
        headers: {
          ...corsHeaders(request),
          'Content-Type': contentType,
          'Cache-Control': `public, max-age=${isWeather ? 120 : 300}`,
          'X-CoachBrief-Source': target.hostname,
          'X-CoachBrief-Final-Url': finalUrl,
        },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Récupération impossible'
      return json(request, { error: message }, 400)
    }
  },
}
