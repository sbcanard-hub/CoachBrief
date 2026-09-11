import type { CoachBriefPortableBundle } from './portableData'

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
  signIn(): Promise<CloudAccount>
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
  configured: false,
  authentication: false,
  privateSync: false,
  communityKnowledge: false,
}

export const CLOUD_SYNC_NOTE = 'Le contrat de synchronisation est prêt. Un fournisseur cloud avec authentification doit encore être configuré avant d’activer les comptes, la sauvegarde automatique et la base commune multi-utilisateurs.'
