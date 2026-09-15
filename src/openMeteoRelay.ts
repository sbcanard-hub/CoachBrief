const RELAY_URL = 'https://coachbriefrelay.sbcanard.workers.dev'

const OPEN_METEO_HOSTS = new Set([
  'api.open-meteo.com',
  'marine-api.open-meteo.com',
  'geocoding-api.open-meteo.com',
  'elevation-api.open-meteo.com',
  'historical-forecast-api.open-meteo.com',
  'archive-api.open-meteo.com',
])

let installed = false

function requestUrl(input: RequestInfo | URL) {
  if (input instanceof Request) return input.url
  return String(input)
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit) {
  if (init?.method) return init.method.toUpperCase()
  if (input instanceof Request) return input.method.toUpperCase()
  return 'GET'
}

export function installOpenMeteoRelay() {
  if (installed || !import.meta.env.PROD || typeof window === 'undefined') return
  installed = true

  const nativeFetch = window.fetch.bind(window)

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = requestUrl(input)
    let target: URL
    try {
      target = new URL(url, window.location.href)
    } catch {
      return nativeFetch(input, init)
    }

    if (!OPEN_METEO_HOSTS.has(target.hostname.toLowerCase()) || requestMethod(input, init) !== 'GET') {
      return nativeFetch(input, init)
    }

    try {
      const relayResponse = await nativeFetch(`${RELAY_URL}/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target.href }),
        signal: init?.signal,
      })
      if (relayResponse.ok) return relayResponse
    } catch {
      // Le repli direct conserve le comportement historique si le relais est momentanément indisponible.
    }

    return nativeFetch(input, init)
  }
}
