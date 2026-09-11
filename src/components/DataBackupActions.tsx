import { Check, CloudDownload, CloudUpload, Download, FileUp, LoaderCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
  firebaseCloudAdapter,
  loadLastCloudSync,
  portableDataFingerprint,
  rememberCloudSync,
  type CloudSyncSnapshot,
} from '../cloudSync'
import { onFirebaseAuthStateChanged, type FirebaseAccount } from '../firebase'
import {
  exportPortableCoachBriefData,
  importPortableCoachBriefData,
  portableCoachBriefDataToJson,
} from '../portableData'
import { loadKnowledgePreferences, saveKnowledgePreferences } from '../knowledgePreferences'
import { COACHBRIEF_PERSISTENT_DATA_CHANGED } from '../persistentDataEvents'
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
  const [automaticSync, setAutomaticSync] = useState(() => loadKnowledgePreferences().automaticCloudSync)
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)
  const syncingRef = useRef(false)

  useEffect(() => onFirebaseAuthStateChanged((nextAccount) => {
    setAccount(nextAccount)
    setLastSyncAt(nextAccount ? loadLastCloudSync(nextAccount.id)?.syncedAt ?? null : null)
    if (!nextAccount) setStatus('')
  }), [])

  useEffect(() => {
    if (!account || !automaticSync) return
    let timer: number | undefined

    async function synchronizeChangedData() {
      if (syncingRef.current || !account) return
      const bundle = exportPortableCoachBriefData()
      if (loadLastCloudSync(account.id)?.fingerprint === portableDataFingerprint(bundle)) return
      syncingRef.current = true
      setIsCloudSyncing(true)
      setStatus('Synchronisation…')
      try {
        const updatedAt = new Date().toISOString()
        await firebaseCloudAdapter.push({ revision: crypto.randomUUID(), updatedAt, bundle })
        rememberCloudSync(account.id, bundle, updatedAt)
        setLastSyncAt(updatedAt)
        setStatus('Synchronisation automatique réussie')
      } catch (error) {
        setStatus(error instanceof Error ? `Synchronisation automatique impossible : ${error.message}` : 'Synchronisation automatique impossible. Les données locales sont conservées.')
      } finally {
        syncingRef.current = false
        setIsCloudSyncing(false)
      }
    }

    const schedule = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => void synchronizeChangedData(), 350)
    }
    window.addEventListener(COACHBRIEF_PERSISTENT_DATA_CHANGED, schedule)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener(COACHBRIEF_PERSISTENT_DATA_CHANGED, schedule)
    }
  }, [account, automaticSync])

  function changeAutomaticSync(enabled: boolean) {
    const preferences = { ...loadKnowledgePreferences(), automaticCloudSync: enabled }
    setAutomaticSync(enabled)
    saveKnowledgePreferences(preferences)
    // Le nouvel écouteur est installé après le rendu qui active l'option.
    if (enabled) window.setTimeout(() => window.dispatchEvent(new Event(COACHBRIEF_PERSISTENT_DATA_CHANGED)), 0)
  }

  function formattedLastSync() {
    if (!lastSyncAt) return 'jamais'
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(lastSyncAt))
  }

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
      if (account) {
        rememberCloudSync(account.id, snapshot.bundle, updatedAt)
        setLastSyncAt(updatedAt)
      }
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
      if (account) {
        rememberCloudSync(account.id, snapshot.bundle, snapshot.updatedAt)
        setLastSyncAt(snapshot.updatedAt)
      }
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
      <label className="automatic-cloud-sync">
        <span>Synchronisation cloud automatique</span>
        <select value={automaticSync ? 'enabled' : 'disabled'} onChange={(event) => changeAutomaticSync(event.target.value === 'enabled')}>
          <option value="enabled">Activée</option>
          <option value="disabled">Désactivée</option>
        </select>
      </label>
      <button type="button" onClick={() => void saveToCloud()} disabled={isCloudSyncing} title="Sauvegarder toutes les données CoachBrief dans Firebase">
        <CloudUpload size={15} /> <span>Sauvegarder dans le cloud</span>
      </button>
      <button type="button" onClick={() => void restoreFromCloud()} disabled={isCloudSyncing} title="Restaurer la sauvegarde CoachBrief depuis Firebase">
        <CloudDownload size={15} /> <span>Restaurer depuis le cloud</span>
      </button>
    </>}
    {account && <small className="last-cloud-sync" aria-live="polite">
      {isCloudSyncing ? 'Synchronisation…' : `Dernière synchronisation : ${formattedLastSync()}`}
    </small>}
    {status && <small className="data-backup-status" role="status">
      {isCloudSyncing ? <LoaderCircle className="header-spin" size={12} /> : <Check size={12} />} {status}
    </small>}
  </div>
}
