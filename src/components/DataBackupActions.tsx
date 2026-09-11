import { Check, CloudDownload, CloudUpload, Download, FileUp, LoaderCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { firebaseCloudAdapter, type CloudSyncSnapshot } from '../cloudSync'
import { onFirebaseAuthStateChanged, type FirebaseAccount } from '../firebase'
import {
  exportPortableCoachBriefData,
  importPortableCoachBriefData,
  portableCoachBriefDataToJson,
} from '../portableData'
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
  const [account, setAccount] = useState<FirebaseAccount | null>(null)
  const [isCloudSyncing, setIsCloudSyncing] = useState(false)

  useEffect(() => onFirebaseAuthStateChanged((nextAccount) => {
    setAccount(nextAccount)
    if (!nextAccount) setStatus('')
  }), [])

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

  async function saveToCloud() {
    if (isCloudSyncing) return
    setIsCloudSyncing(true)
    setStatus('Synchronisation…')
    try {
      const updatedAt = new Date().toISOString()
      const snapshot: CloudSyncSnapshot = {
        revision: crypto.randomUUID(),
        updatedAt,
        bundle: exportPortableCoachBriefData(),
      }
      await firebaseCloudAdapter.push(snapshot)
      setStatus('Sauvegarde cloud réussie')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'La synchronisation Firebase a échoué. Réessayez plus tard.')
    } finally {
      setIsCloudSyncing(false)
    }
  }

  async function restoreFromCloud() {
    if (isCloudSyncing) return
    setIsCloudSyncing(true)
    setStatus('Synchronisation…')
    try {
      const snapshot = await firebaseCloudAdapter.pull()
      if (!snapshot) throw new Error('Aucune sauvegarde cloud disponible pour ce compte.')
      importPortableCoachBriefData(JSON.stringify(snapshot.bundle), 'replace')
      setStatus('Restauration cloud réussie')
      window.setTimeout(() => window.location.reload(), 900)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'La synchronisation Firebase a échoué. Réessayez plus tard.')
    } finally {
      setIsCloudSyncing(false)
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
    {account && <>
      <button type="button" onClick={() => void saveToCloud()} disabled={isCloudSyncing} title="Sauvegarder toutes les données CoachBrief dans Firebase">
        <CloudUpload size={15} /> <span>Sauvegarder dans le cloud</span>
      </button>
      <button type="button" onClick={() => void restoreFromCloud()} disabled={isCloudSyncing} title="Restaurer la sauvegarde CoachBrief depuis Firebase">
        <CloudDownload size={15} /> <span>Restaurer depuis le cloud</span>
      </button>
    </>}
    {status && <small className="data-backup-status" role="status">
      {isCloudSyncing ? <LoaderCircle className="header-spin" size={12} /> : <Check size={12} />} {status}
    </small>}
  </div>
}
