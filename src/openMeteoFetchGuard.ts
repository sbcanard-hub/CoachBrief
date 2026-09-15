type BufferedResponse = {
  status: number
  statusText: string
  headers: [string, string][]
  body: ArrayBuffer
}

const nativeFetch = window.fetch.bind(window)
const inFlight = new Map<string, Promise<BufferedResponse>>()
const cache = new Map<string, { expiresAt: number; response: BufferedResponse }>()
const queue: Array<() => void> = []
let activeRequests = 0

const MAX_CONCURRENT_OPEN_METEO = 2
const CACHE_TTL_MS = 45_000
const MAX_RETRIES = 3

function isOpenMeteoUrl(url: string) {
  try {
    const host = new URL(url, window.location.href).hostname
    return host === 'open-meteo.com' || host.endsWith('.open-meteo.com')
  } catch {
    return false
  }
}

function bufferedToResponse(buffered: BufferedResponse) {
  return new Response(buffered.body.slice(0), {
    status: buffered.status,
    statusText: buffered.statusText,
    headers: buffered.headers,
  })
}

async function bufferResponse(response: Response): Promise<BufferedResponse> {
  return {
    status: response.status,
    statusText: response.statusText,
    headers: Array.from(response.headers.entries()),
    body: await response.arrayBuffer(),
  }
}

function acquireSlot() {
  if (activeRequests < MAX_CONCURRENT_OPEN_METEO) {
    activeRequests += 1
    return Promise.resolve()
  }
  return new Promise<void>((resolve) => {
    queue.push(() => {
      activeRequests += 1
      resolve()
    })
  })
}

function releaseSlot() {
  activeRequests = Math.max(0, activeRequests - 1)
  const next = queue.shift()
  next?.()
}

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms))
}

async function fetchWithRetry(request: Request): Promise<BufferedResponse> {
  await acquireSlot()
  try {
    let lastResponse: Response | null = null

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      const response = await nativeFetch(request.clone())
      lastResponse = response

      const retryable = response.status === 429 || response.status === 502 || response.status === 503 || response.status === 504
      if (!retryable || attempt === MAX_RETRIES) return bufferResponse(response)

      const retryAfterHeader = response.headers.get('retry-after')
      const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN
      const retryDelay = Number.isFinite(retryAfterSeconds)
        ? Math.max(500, retryAfterSeconds * 1000)
        : 700 * (attempt + 1)

      await wait(retryDelay)
    }

    if (lastResponse) return bufferResponse(lastResponse)
    throw new Error('Open-Meteo request failed before receiving a response')
  } finally {
    releaseSlot()
  }
}

window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const request = new Request(input, init)
  if (request.method !== 'GET' || !isOpenMeteoUrl(request.url)) return nativeFetch(input, init)

  const key = request.url
  const cached = cache.get(key)
  if (cached && cached.expiresAt > Date.now()) return bufferedToResponse(cached.response)
  if (cached) cache.delete(key)

  let pending = inFlight.get(key)
  if (!pending) {
    pending = fetchWithRetry(request)
      .then((response) => {
        if (response.status >= 200 && response.status < 300) {
          cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, response })
        }
        return response
      })
      .finally(() => inFlight.delete(key))
    inFlight.set(key, pending)
  }

  return bufferedToResponse(await pending)
}
