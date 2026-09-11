import type { CoachBriefPortableBundle } from './portableData'
import {
  getAuthenticatedFirebaseAccount,
  isFirebaseConfigured,
  signInWithEmailAndPassword,
  signOutFromFirebase,
} from './firebase'

export type CloudAccount = {
  id: string
  email?: string
  displayName?: string
}

export type CloudSyncState = 'not-configured' | 'signed-out' | 'syncing' | 'synced' | 'error'

export type CloudSyncSnapshot = {
  revision: string
  updatedAt: string
  bundle: CoachBriefPortableBundle
}

export interface CoachBriefCloudAdapter {
  getAccount(): Promise<CloudAccount | null>
  signIn(email: string, password: string): Promise<CloudAccount>
  signOut(): Promise<void>
  pull(): Promise<CloudSyncSnapshot | null>
  push(snapshot: CloudSyncSnapshot): Promise<CloudSyncSnapshot>
}

export type CloudSyncCapabilities = {
  configured: boolean
  authentication: boolean
  privateSync: boolean
  communityKnowledge: boolean
}

export const CLOUD_SYNC_CAPABILITIES: CloudSyncCapabilities = {
  configured: isFirebaseConfigured,
  authentication: isFirebaseConfigured,
  privateSync: isFirebaseConfigured,
  communityKnowledge: false,
}

export const CLOUD_SYNC_NOTE = isFirebaseConfigured
  ? 'La sauvegarde privée Firebase est disponible pour le compte connecté.'
  : 'Configurez Firebase pour activer l’authentification et la sauvegarde privée.'

const LAST_SYNC_PREFIX = 'coachbrief:cloud-sync:v1:'

type LastCloudSync = { fingerprint: string; syncedAt: string }

export function portableDataFingerprint(bundle: CoachBriefPortableBundle) {
  // Les dates d'export changent à chaque lecture sans représenter une modification des données.
  const stableBundle = {
    ...bundle,
    exportedAt: '',
    data: { ...bundle.data, exportedAt: '' },
  }
  const input = JSON.stringify(stableBundle)
  let hash = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `${input.length}-${(hash >>> 0).toString(16)}`
}

export function loadLastCloudSync(accountId: string): LastCloudSync | null {
  try {
    const raw = localStorage.getItem(`${LAST_SYNC_PREFIX}${accountId}`)
    return raw ? JSON.parse(raw) as LastCloudSync : null
  } catch {
    return null
  }
}

export function rememberCloudSync(accountId: string, bundle: CoachBriefPortableBundle, syncedAt: string) {
  localStorage.setItem(`${LAST_SYNC_PREFIX}${accountId}`, JSON.stringify({
    fingerprint: portableDataFingerprint(bundle),
    syncedAt,
  } satisfies LastCloudSync))
}

type FirestoreDocument = {
  fields?: {
    ownerId?: { stringValue?: string }
    snapshot?: { stringValue?: string }
  }
}

function firestoreDocumentUrl(userId: string) {
  const projectId = encodeURIComponent(import.meta.env.VITE_FIREBASE_PROJECT_ID)
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${encodeURIComponent(userId)}/privateData/coachbrief`
}

function syncError(status: number): Error {
  if (status === 401) return new Error('Votre session Firebase a expiré. Reconnectez-vous.')
  if (status === 403) return new Error('Firebase a refusé l’accès à ces données privées.')
  if (status === 404) return new Error('La base Firestore n’est pas disponible pour ce projet.')
  if (status === 413) return new Error('La sauvegarde CoachBrief dépasse la taille acceptée par Firestore.')
  return new Error('La synchronisation Firebase a échoué. Réessayez plus tard.')
}

function isCloudSyncSnapshot(value: unknown): value is CloudSyncSnapshot {
  if (!value || typeof value !== 'object') return false
  const snapshot = value as Partial<CloudSyncSnapshot>
  const bundle = snapshot.bundle as Partial<CoachBriefPortableBundle> | undefined
  return typeof snapshot.revision === 'string'
    && typeof snapshot.updatedAt === 'string'
    && bundle?.format === 'coachbrief-portable'
    && bundle.version === 1
}

async function authenticatedAccount() {
  if (!isFirebaseConfigured) throw new Error('La configuration Firebase est incomplète.')
  const account = await getAuthenticatedFirebaseAccount()
  if (!account) throw new Error('Connectez-vous à Firebase pour synchroniser vos données.')
  return account
}

async function firestoreRequest(method: 'GET' | 'PATCH', body?: string) {
  const account = await authenticatedAccount()
  let response: Response
  try {
    response = await fetch(firestoreDocumentUrl(account.id), {
      method,
      headers: {
        Authorization: `Bearer ${account.idToken}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body,
    })
  } catch {
    throw new Error('Connexion à Firebase impossible. Vérifiez votre accès Internet.')
  }
  return { account, response }
}

export async function pull(): Promise<CloudSyncSnapshot | null> {
  const { account, response } = await firestoreRequest('GET')
  if (response.status === 404) return null
  if (!response.ok) throw syncError(response.status)

  const document = await response.json() as FirestoreDocument
  if (document.fields?.ownerId?.stringValue !== account.id || !document.fields.snapshot?.stringValue) {
    throw new Error('La sauvegarde Firebase reçue est invalide ou n’appartient pas au compte connecté.')
  }
  try {
    const snapshot = JSON.parse(document.fields.snapshot.stringValue) as unknown
    if (!isCloudSyncSnapshot(snapshot)) throw new Error()
    return snapshot
  } catch {
    throw new Error('La sauvegarde Firebase reçue est illisible.')
  }
}

export async function push(snapshot: CloudSyncSnapshot): Promise<CloudSyncSnapshot> {
  if (!isCloudSyncSnapshot(snapshot)) throw new Error('La sauvegarde CoachBrief à synchroniser est invalide.')
  const account = await authenticatedAccount()
  const body = JSON.stringify({
    fields: {
      ownerId: { stringValue: account.id },
      snapshot: { stringValue: JSON.stringify(snapshot) },
    },
  })
  const { response } = await firestoreRequest('PATCH', body)
  if (!response.ok) throw syncError(response.status)
  return snapshot
}

export const firebaseCloudAdapter: CoachBriefCloudAdapter = {
  async getAccount() {
    const account = await getAuthenticatedFirebaseAccount()
    return account ? { id: account.id, email: account.email } : null
  },
  async signIn(email, password) {
    const account = await signInWithEmailAndPassword(email, password)
    return { id: account.id, email: account.email }
  },
  async signOut() {
    signOutFromFirebase()
  },
  pull,
  push,
}
