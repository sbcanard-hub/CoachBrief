export const COACHBRIEF_PERSISTENT_DATA_CHANGED = 'coachbrief:persistent-data-changed'

export function notifyPersistentDataChanged() {
  window.dispatchEvent(new Event(COACHBRIEF_PERSISTENT_DATA_CHANGED))
}
