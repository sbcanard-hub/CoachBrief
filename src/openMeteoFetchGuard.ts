type BufferedResponse = {
  status: number
  statusText: string
  headers: [string, string][]
  body: ArrayBuffer
}

type BatchRequest = {
  request: Request
  model: string
  resolve: (value: BufferedResponse) => void
  reject: (reason?: unknown) => void
}

type Batch = {
  requests: BatchRequest[]
  timer: number
}

const nativeFetch = window.fetch.bind(window)
const inFlight = new Map<string, Promise<BufferedResponse>>()
const cache = new Map<string, { expiresAt: number; response: BufferedResponse }>()
const batches = new Map<string, Batch>()
const queue: Array<() => void> = []
let activeRequests = 0

const MAX_CONCURRENT_OPEN_METEO = 2
const CACHE_TTL_MS = 45_000
const MAX_RETRIES = 3
const BATCH_WINDOW_MS = 35
const COMPARISON_WIND_FIELDS = ['wind_direction_10m', 'wind_gusts_10m', 'wind_speed_10m']

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

function jsonBufferedResponse(payload: unknown, source: BufferedResponse): BufferedResponse {
  return {
    status: source.status,
    statusText: source.statusText,
    headers: [['content-type', 'application/json; charset=utf-8']],
    body: new TextEncoder().encode(JSON.stringify(payload)).buffer,
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

function batchDescriptor(request: Request) {
  const url = new URL(request.url)
  if (url.hostname !== 'api.open-meteo.com' || url.pathname !== '/v1/forecast') return null

  const hourly = (url.searchParams.get('hourly') ?? '').split(',').filter(Boolean).sort()
  if (hourly.length !== COMPARISON_WIND_FIELDS.length || hourly.some((field, index) => field !== COMPARISON_WIND_FIELDS[index])) return null

  const rawModels = url.searchParams.get('models')
  if (rawModels?.includes(',')) return null
  const model = rawModels || 'best_match'

  const baseParams = new URLSearchParams(url.searchParams)
  baseParams.delete('models')
  const sorted = Array.from(baseParams.entries()).sort(([a], [b]) => a.localeCompare(b))
  const normalized = new URLSearchParams(sorted)
  const key = `${url.origin}${url.pathname}?${normalized}`

  return { key, model, baseParams }
}

function extractModelPayload(payload: Record<string, unknown>, model: string) {
  const suffix = `_${model}`
  const result: Record<string, unknown> = { ...payload }

  for (const sectionName of ['hourly', 'hourly_units']) {
    const source = payload[sectionName]
    if (!source || typeof source !== 'object' || Array.isArray(source)) continue
    const section = source as Record<string, unknown>
    const target: Record<string, unknown> = {}
    if ('time' in section) target.time = section.time

    for (const [key, value] of Object.entries(section)) {
      if (key.endsWith(suffix)) target[key.slice(0, -suffix.length)] = value
    }
    result[sectionName] = target
  }

  result.model = model
  return result
}

async function flushBatch(key: string, baseParams: URLSearchParams) {
  const batch = batches.get(key)
  if (!batch) return
  batches.delete(key)

  const models = Array.from(new Set(batch.requests.map((item) => item.model)))
  const params = new URLSearchParams(baseParams)
  params.set('models', models.join(','))
  const combinedUrl = `https://api.open-meteo.com/v1/forecast?${params}`

  try {
    const combined = await fetchWithRetry(new Request(combinedUrl))
    if (combined.status < 200 || combined.status >= 300) {
      batch.requests.forEach((item) => item.resolve(combined))
      return
    }

    const text = new TextDecoder().decode(combined.body)
    const payload = JSON.parse(text) as Record<string, unknown>
    for (const item of batch.requests) {
      const response = jsonBufferedResponse(extractModelPayload(payload, item.model), combined)
      cache.set(item.request.url, { expiresAt: Date.now() + CACHE_TTL_MS, response })
      item.resolve(response)
    }
  } catch (error) {
    batch.requests.forEach((item) => item.reject(error))
  }
}

function fetchBatchedComparison(request: Request, descriptor: NonNullable<ReturnType<typeof batchDescriptor>>) {
  return new Promise<BufferedResponse>((resolve, reject) => {
    const existing = batches.get(descriptor.key)
    if (existing) {
      existing.requests.push({ request, model: descriptor.model, resolve, reject })
      return
    }

    const timer = window.setTimeout(() => void flushBatch(descriptor.key, descriptor.baseParams), BATCH_WINDOW_MS)
    batches.set(descriptor.key, {
      requests: [{ request, model: descriptor.model, resolve, reject }],
      timer,
    })
  })
}

window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const request = new Request(input, init)
  if (request.method !== 'GET' || !isOpenMeteoUrl(request.url)) return nativeFetch(input, init)

  const key = request.url
  const cached = cache.get(key)
  if (cached && cached.expiresAt > Date.now()) return bufferedToResponse(cached.response)
  if (cached) cache.delete(key)

  const descriptor = batchDescriptor(request)
  if (descriptor) return bufferedToResponse(await fetchBatchedComparison(request, descriptor))

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
