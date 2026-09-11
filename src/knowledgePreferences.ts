import { notifyPersistentDataChanged } from './persistentDataEvents'

export type KnowledgeMode = 'personal' | 'community' | 'mixed'

export type KnowledgePreferences = {
  mode: KnowledgeMode
  contributeToCommunity: boolean
  automaticCloudSync: boolean
}

const STORAGE_KEY = 'coachbrief:knowledge-preferences:v1'

const DEFAULT_PREFERENCES: KnowledgePreferences = {
  mode: 'personal',
  contributeToCommunity: false,
  automaticCloudSync: false,
}

export function loadKnowledgePreferences(): KnowledgePreferences {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_PREFERENCES
    const parsed = JSON.parse(raw) as Partial<KnowledgePreferences>
    const mode: KnowledgeMode = parsed.mode === 'community' || parsed.mode === 'mixed' ? parsed.mode : 'personal'
    return {
      mode,
      contributeToCommunity: parsed.contributeToCommunity === true,
      automaticCloudSync: parsed.automaticCloudSync === true,
    }
  } catch {
    return DEFAULT_PREFERENCES
  }
}

export function saveKnowledgePreferences(preferences: KnowledgePreferences) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
  notifyPersistentDataChanged()
}

export function knowledgeModeLabel(mode: KnowledgeMode) {
  if (mode === 'community') return 'Base commune'
  if (mode === 'mixed') return 'Perso + commune'
  return 'Mémoire personnelle'
}
