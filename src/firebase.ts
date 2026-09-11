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
    return JSON.parse(value) as FirebaseAccount
  } catch {
    return null
  }
}

let currentAccount = readStoredAccount()
let refreshPromise: Promise<FirebaseAccount> | null = null

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

async function refreshFirebaseAccount(account: FirebaseAccount): Promise<FirebaseAccount> {
  let response: Response
  try {
    response = await fetch(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(firebaseConfig.apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: account.refreshToken }),
    })
  } catch {
    throw new Error('Connexion à Firebase impossible. Vérifiez votre accès Internet.')
  }

  const result = await response.json() as {
    user_id?: string
    id_token?: string
    refresh_token?: string
    expires_in?: string
  }
  if (!response.ok || !result.user_id || !result.id_token || !result.refresh_token) {
    publish(null)
    throw new Error('Votre session Firebase a expiré. Reconnectez-vous.')
  }

  const refreshed = {
    id: result.user_id,
    email: account.email,
    idToken: result.id_token,
    refreshToken: result.refresh_token,
    expiresAt: Date.now() + Number(result.expires_in ?? 3600) * 1000,
  }
  publish(refreshed)
  return refreshed
}

export async function getAuthenticatedFirebaseAccount(): Promise<FirebaseAccount | null> {
  if (!currentAccount) return null
  if (currentAccount.expiresAt > Date.now() + 60_000) return currentAccount

  refreshPromise ??= refreshFirebaseAccount(currentAccount).finally(() => {
    refreshPromise = null
  })
  return refreshPromise
}

export function signOutFromFirebase() {
  publish(null)
}
