export type FirebaseAccount = {
  id: string
  email: string
  idToken: string
  refreshToken: string
  expiresAt: number
}

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const missingFirebaseVariables = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key)

export const isFirebaseConfigured = missingFirebaseVariables.length === 0
const AUTH_STORAGE_KEY = 'coachbrief.firebase.auth'
const listeners = new Set<(account: FirebaseAccount | null) => void>()

function readStoredAccount(): FirebaseAccount | null {
  try {
    const value = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!value) return null
    const account = JSON.parse(value) as FirebaseAccount
    return account.expiresAt > Date.now() ? account : null
  } catch {
    return null
  }
}

let currentAccount = readStoredAccount()

function publish(account: FirebaseAccount | null) {
  currentAccount = account
  if (account) localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(account))
  else localStorage.removeItem(AUTH_STORAGE_KEY)
  listeners.forEach((listener) => listener(account))
}

export function onFirebaseAuthStateChanged(listener: (account: FirebaseAccount | null) => void) {
  listeners.add(listener)
  listener(currentAccount)
  return () => {
    listeners.delete(listener)
  }
}

export async function signInWithEmailAndPassword(email: string, password: string): Promise<FirebaseAccount> {
  if (!isFirebaseConfigured) {
    throw new Error(`Configuration Firebase incomplète : ${missingFirebaseVariables.join(', ')}`)
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  )
  const result = await response.json() as {
    localId?: string
    email?: string
    idToken?: string
    refreshToken?: string
    expiresIn?: string
    error?: { message?: string }
  }

  if (!response.ok || !result.localId || !result.email || !result.idToken || !result.refreshToken) {
    const knownErrors: Record<string, string> = {
      EMAIL_NOT_FOUND: 'Aucun compte ne correspond à cette adresse.',
      INVALID_PASSWORD: 'Mot de passe incorrect.',
      INVALID_LOGIN_CREDENTIALS: 'Adresse e-mail ou mot de passe incorrect.',
      USER_DISABLED: 'Ce compte a été désactivé.',
    }
    throw new Error(knownErrors[result.error?.message ?? ''] ?? 'Connexion Firebase impossible.')
  }

  const account = {
    id: result.localId,
    email: result.email,
    idToken: result.idToken,
    refreshToken: result.refreshToken,
    expiresAt: Date.now() + Number(result.expiresIn ?? 3600) * 1000,
  }
  publish(account)
  return account
}

export function signOutFromFirebase() {
  publish(null)
}
