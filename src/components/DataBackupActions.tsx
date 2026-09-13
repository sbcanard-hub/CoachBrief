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
import { importCoachBriefData } from '../savedBriefings'
import { COACHBRIEF_PERSISTENT_DATA_CHANGED } from '../persistentDataEvents'
import './dataBackupActions.css'
import { usePreferences } from '../preferences'

const backupCopy = {
  fr: { sync: 'Synchronisation…', autoOk: 'Synchronisation automatique réussie', autoFail: 'Synchronisation automatique impossible', kept: 'Les données locales sont conservées.', never: 'jamais', complete: 'Sauvegarde complète créée', current: 'Données et préférences déjà à jour', restoreFail: 'Restauration impossible', cloudOk: 'Sauvegarde cloud réussie', cloudMerged: 'Données locales et cloud fusionnées', cloudMissing: 'Aucune sauvegarde cloud disponible pour ce compte.', label: 'Sauvegarde des données CoachBrief', all: 'Sauvegarder les données', restore: 'Restaurer', automatic: 'Synchronisation cloud automatique', enabled: 'Activée', disabled: 'Désactivée', saveCloud: 'Sauvegarder dans le cloud', restoreCloud: 'Restaurer depuis le cloud', last: 'Dernière synchronisation' },
  en: { sync: 'Syncing…', autoOk: 'Automatic sync completed', autoFail: 'Automatic sync failed', kept: 'Local data has been kept.', never: 'never', complete: 'Full backup created', current: 'Data and preferences are already up to date', restoreFail: 'Restore failed', cloudOk: 'Cloud backup completed', cloudMerged: 'Local and cloud data merged', cloudMissing: 'No cloud backup is available for this account.', label: 'CoachBrief data backup', all: 'Back up data', restore: 'Restore', automatic: 'Automatic cloud sync', enabled: 'Enabled', disabled: 'Disabled', saveCloud: 'Save to cloud', restoreCloud: 'Restore from cloud', last: 'Last sync' },
  it: { sync: 'Sincronizzazione…', autoOk: 'Sincronizzazione automatica riuscita', autoFail: 'Sincronizzazione automatica non riuscita', kept: 'I dati locali sono stati conservati.', never: 'mai', complete: 'Backup completo creato', current: 'Dati e preferenze sono già aggiornati', restoreFail: 'Ripristino non riuscito', cloudOk: 'Backup cloud riuscito', cloudMerged: 'Dati locali e cloud uniti', cloudMissing: 'Nessun backup cloud disponibile per questo account.', label: 'Backup dei dati CoachBrief', all: 'Salva i dati', restore: 'Ripristina', automatic: 'Sincronizzazione cloud automatica', enabled: 'Attivata', disabled: 'Disattivata', saveCloud: 'Salva nel cloud', restoreCloud: 'Ripristina dal cloud', last: 'Ultima sincronizzazione' },
  es: { sync: 'Sincronizando…', autoOk: 'Sincronización automática completada', autoFail: 'No se pudo sincronizar automáticamente', kept: 'Los datos locales se han conservado.', never: 'nunca', complete: 'Copia completa creada', current: 'Los datos y preferencias ya están actualizados', restoreFail: 'No se pudo restaurar', cloudOk: 'Copia en la nube completada', cloudMerged: 'Datos locales y de la nube combinados', cloudMissing: 'No hay ninguna copia en la nube para esta cuenta.', label: 'Copia de datos de CoachBrief', all: 'Guardar datos', restore: 'Restaurar', automatic: 'Sincronización automática en la nube', enabled: 'Activada', disabled: 'Desactivada', saveCloud: 'Guardar en la nube', restoreCloud: 'Restaurar desde la nube', last: 'Última sincronización' },
} as const

function todayFileStamp() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function DataBackupActions() {
  const { language } = usePreferences()
  const c = backupCopy[language]
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
      const localBundle = exportPortableCoachBriefData()
      if (loadLastCloudSync(account.id)?.fingerprint === portableDataFingerprint(localBundle)) return
      syncingRef.current = true
      setIsCloudSyncing(true)
      setStatus(c.sync)
      try {
        const cloud = await firebaseCloudAdapter.pull()
        if (cloud) importCoachBriefData(JSON.stringify(cloud.bundle.data), 'merge')
        const bundle = exportPortableCoachBriefData()
        const updatedAt = new Date().toISOString()
        await firebaseCloudAdapter.push({ revision: crypto.randomUUID(), updatedAt, bundle })
        rememberCloudSync(account.id, bundle, updatedAt)
        setLastSyncAt(updatedAt)
        setStatus(c.autoOk)
      } catch (error) {
        setStatus(error instanceof Error ? `${c.autoFail}: ${error.message}` : `${c.autoFail}. ${c.kept}`)
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
  }, [account, automaticSync, c])

  function changeAutomaticSync(enabled: boolean) {
    const preferences = { ...loadKnowledgePreferences(), automaticCloudSync: enabled }
    setAutomaticSync(enabled)
    saveKnowledgePreferences(preferences)
    // Le nouvel écouteur est installé après le rendu qui active l'option.
    if (enabled) window.setTimeout(() => window.dispatchEvent(new Event(COACHBRIEF_PERSISTENT_DATA_CHANGED)), 0)
  }

  function formattedLastSync() {
    if (!lastSyncAt) return c.never
    return new Intl.DateTimeFormat(language, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(lastSyncAt))
  }

  function downloadAllData() {
    const blob = new Blob([portableCoachBriefDataToJson()], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `coachbrief-sauvegarde-${todayFileStamp()}.json`
    link.click()
    URL.revokeObjectURL(url)
    setStatus(c.complete)
  }

  async function restoreAllData(file: File | undefined) {
    if (!file) return
    try {
      const result = importPortableCoachBriefData(await file.text(), 'merge')
      const changes = result.importedCount + result.replacedCount
      setStatus(changes
        ? `${result.importedCount} ajout${result.importedCount > 1 ? 's' : ''} · ${result.replacedCount} mise${result.replacedCount > 1 ? 's' : ''} à jour`
        : c.current)
      window.setTimeout(() => window.location.reload(), 900)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : c.restoreFail)
    } finally {
      if (importRef.current) importRef.current.value = ''
    }
  }

  async function saveToCloud() {
    if (isCloudSyncing) return
    setIsCloudSyncing(true)
    setStatus(c.sync)
    try {
      const cloud = await firebaseCloudAdapter.pull()
      if (cloud) importCoachBriefData(JSON.stringify(cloud.bundle.data), 'merge')
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
      setStatus(c.cloudOk)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'La synchronisation Firebase a échoué. Réessayez plus tard.')
    } finally {
      setIsCloudSyncing(false)
    }
  }

  async function restoreFromCloud() {
    if (isCloudSyncing) return
    setIsCloudSyncing(true)
    setStatus(c.sync)
    try {
      const snapshot = await firebaseCloudAdapter.pull()
      if (!snapshot) throw new Error(c.cloudMissing)
      if (account) {
        rememberCloudSync(account.id, snapshot.bundle, snapshot.updatedAt)
        setLastSyncAt(snapshot.updatedAt)
      }
      importPortableCoachBriefData(JSON.stringify(snapshot.bundle), 'merge')
      setStatus(c.cloudMerged)
      window.setTimeout(() => window.location.reload(), 900)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'La synchronisation Firebase a échoué. Réessayez plus tard.')
    } finally {
      setIsCloudSyncing(false)
    }
  }

  return <div className="data-backup-actions" aria-label={c.label}>
    <input
      ref={importRef}
      type="file"
      accept=".json,application/json"
      hidden
      onChange={(event) => void restoreAllData(event.target.files?.[0])}
    />
    <button type="button" onClick={downloadAllData} title="Sauvegarder tous les briefings, la mémoire locale et les préférences">
      <Download size={15} /> <span>{c.all}</span>
    </button>
    <button type="button" onClick={() => importRef.current?.click()} title="Restaurer ou fusionner une sauvegarde CoachBrief">
      <FileUp size={15} /> <span>{c.restore}</span>
    </button>
    {account && <>
      <label className="automatic-cloud-sync">
        <span>{c.automatic}</span>
        <select value={automaticSync ? 'enabled' : 'disabled'} onChange={(event) => changeAutomaticSync(event.target.value === 'enabled')}>
          <option value="enabled">{c.enabled}</option>
          <option value="disabled">{c.disabled}</option>
        </select>
      </label>
      <button type="button" onClick={() => void saveToCloud()} disabled={isCloudSyncing} title="Sauvegarder toutes les données CoachBrief dans Firebase">
        <CloudUpload size={15} /> <span>{c.saveCloud}</span>
      </button>
      <button type="button" onClick={() => void restoreFromCloud()} disabled={isCloudSyncing} title="Restaurer la sauvegarde CoachBrief depuis Firebase">
        <CloudDownload size={15} /> <span>{c.restoreCloud}</span>
      </button>
    </>}
    {account && <small className="last-cloud-sync" aria-live="polite">
      {isCloudSyncing ? c.sync : `${c.last}: ${formattedLastSync()}`}
    </small>}
    {status && <small className="data-backup-status" role="status">
      {isCloudSyncing ? <LoaderCircle className="header-spin" size={12} /> : <Check size={12} />} {status}
    </small>}
  </div>
}
