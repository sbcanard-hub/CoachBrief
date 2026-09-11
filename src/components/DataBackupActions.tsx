import { Check, Download, FileUp } from 'lucide-react'
import { useRef, useState } from 'react'
import { importPortableCoachBriefData, portableCoachBriefDataToJson } from '../portableData'
import './dataBackupActions.css'

function todayFileStamp() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function DataBackupActions() {
  const importRef = useRef<HTMLInputElement | null>(null)
  const [status, setStatus] = useState('')

  function downloadAllData() {
    const blob = new Blob([portableCoachBriefDataToJson()], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `coachbrief-sauvegarde-${todayFileStamp()}.json`
    link.click()
    URL.revokeObjectURL(url)
    setStatus('Sauvegarde complète créée')
  }

  async function restoreAllData(file: File | undefined) {
    if (!file) return
    try {
      const result = importPortableCoachBriefData(await file.text(), 'merge')
      const changes = result.importedCount + result.replacedCount
      setStatus(changes
        ? `${result.importedCount} ajout${result.importedCount > 1 ? 's' : ''} · ${result.replacedCount} mise${result.replacedCount > 1 ? 's' : ''} à jour`
        : 'Données et préférences déjà à jour')
      window.setTimeout(() => window.location.reload(), 900)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Restauration impossible')
    } finally {
      if (importRef.current) importRef.current.value = ''
    }
  }

  return <div className="data-backup-actions" aria-label="Sauvegarde des données CoachBrief">
    <input
      ref={importRef}
      type="file"
      accept=".json,application/json"
      hidden
      onChange={(event) => void restoreAllData(event.target.files?.[0])}
    />
    <button type="button" onClick={downloadAllData} title="Sauvegarder tous les briefings, la mémoire locale et les préférences">
      <Download size={15} /> <span>Sauvegarder les données</span>
    </button>
    <button type="button" onClick={() => importRef.current?.click()} title="Restaurer ou fusionner une sauvegarde CoachBrief">
      <FileUp size={15} /> <span>Restaurer</span>
    </button>
    {status && <small className="data-backup-status" role="status"><Check size={12} /> {status}</small>}
  </div>
}
