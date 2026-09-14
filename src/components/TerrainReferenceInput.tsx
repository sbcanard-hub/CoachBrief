import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import type { BriefingRequest } from '../types'
import { usePreferences } from '../preferences'
import { removeTerrainReferenceImage, saveTerrainReferenceImage, terrainReferenceImage } from '../terrainReference'

const copy = {
  fr: { title: 'Référence locale du plan d’eau', help: 'Ajoutez une capture Google Earth avec son attribution visible, puis qualifiez ce qu’elle montre. L’image reste sur cet appareil ; les annotations suivent le briefing.', add: 'Ajouter une capture', replace: 'Remplacer', remove: 'Supprimer', image: 'Capture de référence', side: 'Zone la plus ouverte', effect: 'Effet principal visible', notes: 'Lecture du relief', placeholder: 'Ex. cap à droite, vallon dans l’axe, immeubles proches de la côte…', neutral: 'Aucun côté net', left: 'Gauche', right: 'Droite', none: 'À déterminer', lee: 'Dévent', channel: 'Canalisation', acceleration: 'Accélération au cap', thermal: 'Brise thermique', attribution: 'Conservez impérativement les crédits Google et du fournisseur visibles sur la capture.' },
  en: { title: 'Local sailing-area reference', help: 'Add a Google Earth capture with visible attribution, then describe what it shows. The image stays on this device; annotations follow the briefing.', add: 'Add capture', replace: 'Replace', remove: 'Remove', image: 'Reference capture', side: 'Most open area', effect: 'Main visible effect', notes: 'Terrain reading', placeholder: 'E.g. headland right, valley on axis, buildings near shore…', neutral: 'No clear side', left: 'Left', right: 'Right', none: 'To determine', lee: 'Wind shadow', channel: 'Channelling', acceleration: 'Headland acceleration', thermal: 'Sea breeze', attribution: 'Keep Google and imagery-provider credits fully visible in the capture.' },
  it: { title: 'Riferimento locale del campo', help: 'Aggiungi una cattura Google Earth con attribuzione visibile e descrivi ciò che mostra. L’immagine resta su questo dispositivo; le annotazioni seguono il briefing.', add: 'Aggiungi cattura', replace: 'Sostituisci', remove: 'Elimina', image: 'Cattura di riferimento', side: 'Zona più aperta', effect: 'Effetto principale visibile', notes: 'Lettura del rilievo', placeholder: 'Es. promontorio a destra, valle sull’asse, edifici vicino alla costa…', neutral: 'Nessun lato netto', left: 'Sinistra', right: 'Destra', none: 'Da determinare', lee: 'Copertura', channel: 'Canalizzazione', acceleration: 'Accelerazione al capo', thermal: 'Brezza termica', attribution: 'Mantieni visibili i crediti Google e del fornitore delle immagini.' },
  es: { title: 'Referencia local del campo', help: 'Añade una captura Google Earth con atribución visible y describe lo que muestra. La imagen permanece en este dispositivo; las anotaciones siguen el briefing.', add: 'Añadir captura', replace: 'Sustituir', remove: 'Eliminar', image: 'Captura de referencia', side: 'Zona más abierta', effect: 'Efecto principal visible', notes: 'Lectura del relieve', placeholder: 'Ej. cabo a la derecha, valle en el eje, edificios junto a la costa…', neutral: 'Sin lado claro', left: 'Izquierda', right: 'Derecha', none: 'Por determinar', lee: 'Desvente', channel: 'Canalización', acceleration: 'Aceleración en el cabo', thermal: 'Brisa térmica', attribution: 'Mantén visibles los créditos de Google y del proveedor de imágenes.' },
} as const

export function TerrainReferenceInput({ request, onChange }: { request: BriefingRequest; onChange: (patch: Partial<BriefingRequest>) => void }) {
  const { language } = usePreferences()
  const c = copy[language]
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [preview, setPreview] = useState(() => terrainReferenceImage(request.terrainReferenceId))
  const [status, setStatus] = useState('')

  useEffect(() => { setPreview(terrainReferenceImage(request.terrainReferenceId)) }, [request.terrainReferenceId])

  async function importImage(file?: File) {
    if (!file) return
    try {
      const saved = await saveTerrainReferenceImage(file, request.terrainReferenceId)
      setPreview(saved.image)
      onChange({ terrainReferenceId: saved.id, terrainReferenceName: file.name })
      setStatus(file.name)
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Image impossible') }
    finally { if (inputRef.current) inputRef.current.value = '' }
  }

  function remove() {
    removeTerrainReferenceImage(request.terrainReferenceId)
    setPreview('')
    setStatus('')
    onChange({ terrainReferenceId: '', terrainReferenceName: '', terrainReferenceNotes: '', terrainReferenceSide: 'Neutre', terrainReferenceEffect: '' })
  }

  return <section className="terrain-reference-input">
    <div><h3>{c.title}</h3><p>{c.help}</p></div>
    {preview && <img src={preview} alt={c.image} />}
    <div className="terrain-reference-actions">
      <input ref={inputRef} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void importImage(event.target.files?.[0])} />
      <button type="button" onClick={() => inputRef.current?.click()}><ImagePlus size={15} /> {preview ? c.replace : c.add}</button>
      {preview && <button type="button" onClick={remove}><Trash2 size={15} /> {c.remove}</button>}
      {status && <small>{status}</small>}
    </div>
    <div className="terrain-reference-fields">
      <label className="field"><span>{c.side}</span><select value={request.terrainReferenceSide || 'Neutre'} onChange={(event) => onChange({ terrainReferenceSide: event.target.value as BriefingRequest['terrainReferenceSide'] })}><option value="Neutre">{c.neutral}</option><option value="Gauche">{c.left}</option><option value="Droite">{c.right}</option></select></label>
      <label className="field"><span>{c.effect}</span><select value={request.terrainReferenceEffect || ''} onChange={(event) => onChange({ terrainReferenceEffect: event.target.value as BriefingRequest['terrainReferenceEffect'] })}><option value="">{c.none}</option><option value="devent">{c.lee}</option><option value="canalisation">{c.channel}</option><option value="acceleration">{c.acceleration}</option><option value="thermique">{c.thermal}</option></select></label>
    </div>
    <label className="field field-wide"><span>{c.notes}</span><textarea rows={2} value={request.terrainReferenceNotes || ''} placeholder={c.placeholder} onChange={(event) => onChange({ terrainReferenceNotes: event.target.value })} /></label>
    <small className="terrain-reference-attribution">{c.attribution}</small>
  </section>
}
