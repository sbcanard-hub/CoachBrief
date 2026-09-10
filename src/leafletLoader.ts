type LeafletWindow = Window & { L?: any }

const javascriptSources = [
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js',
]

const stylesheetSources = [
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css',
]

let leafletPromise: Promise<any> | null = null

function ensureStylesheet() {
  if (document.querySelector('link[data-coachbrief-leaflet]')) return
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = stylesheetSources[0]
  link.dataset.coachbriefLeaflet = 'true'
  link.onerror = () => {
    if (link.href.includes('unpkg.com')) link.href = stylesheetSources[1]
  }
  document.head.appendChild(link)
}

function loadScript(src: string, timeoutMs = 4500) {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    const timeout = window.setTimeout(() => {
      script.remove()
      reject(new Error(`Délai dépassé pour ${src}`))
    }, timeoutMs)

    script.src = src
    script.async = true
    script.crossOrigin = 'anonymous'
    script.onload = () => {
      window.clearTimeout(timeout)
      resolve()
    }
    script.onerror = () => {
      window.clearTimeout(timeout)
      script.remove()
      reject(new Error(`Chargement impossible pour ${src}`))
    }
    document.head.appendChild(script)
  })
}

export function loadLeaflet() {
  const leafletWindow = window as LeafletWindow
  if (leafletWindow.L) return Promise.resolve(leafletWindow.L)
  if (leafletPromise) return leafletPromise

  ensureStylesheet()
  leafletPromise = (async () => {
    for (const src of javascriptSources) {
      try {
        await loadScript(src)
        if (leafletWindow.L) return leafletWindow.L
      } catch {
        // Essayer la source suivante.
      }
    }
    leafletPromise = null
    throw new Error('La cartographie n’a pas pu être chargée. Vérifiez la connexion puis réessayez.')
  })()
  return leafletPromise
}
