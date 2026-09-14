const IMAGE_PREFIX = 'coachbrief:terrain-reference:v1:'

export function terrainReferenceImage(id: string | undefined) {
  if (!id) return ''
  try { return localStorage.getItem(`${IMAGE_PREFIX}${id}`) || '' } catch { return '' }
}

export async function saveTerrainReferenceImage(file: File, existingId?: string) {
  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Lecture de l’image impossible'))
    reader.readAsDataURL(file)
  })
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image()
    element.onload = () => resolve(element)
    element.onerror = () => reject(new Error('Image invalide'))
    element.src = source
  })
  const scale = Math.min(1, 1200 / Math.max(image.width, image.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.width * scale))
  canvas.height = Math.max(1, Math.round(image.height * scale))
  canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height)
  const compressed = canvas.toDataURL('image/jpeg', .72)
  const id = existingId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  localStorage.setItem(`${IMAGE_PREFIX}${id}`, compressed)
  return { id, image: compressed }
}

export function removeTerrainReferenceImage(id: string | undefined) {
  if (!id) return
  try { localStorage.removeItem(`${IMAGE_PREFIX}${id}`) } catch { /* local storage unavailable */ }
}
