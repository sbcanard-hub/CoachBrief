import { FormEvent, useEffect, useState } from 'react'
import { LogIn, LogOut, X } from 'lucide-react'
import {
  isFirebaseConfigured,
  onFirebaseAuthStateChanged,
  signInWithEmailAndPassword,
  signOutFromFirebase,
  type FirebaseAccount,
} from '../firebase'
import { usePreferences } from '../preferences'

const authCopy = {
  fr: { connected: 'Connecté', signOut: 'Déconnexion', signIn: 'Connexion', firebaseSignIn: 'Se connecter avec Firebase', missingConfig: 'Configuration Firebase manquante', close: 'Fermer', intro: 'Accédez à votre compte CoachBrief avec votre e-mail et votre mot de passe.', email: 'Adresse e-mail', password: 'Mot de passe', loading: 'Connexion…', submit: 'Se connecter', failed: 'Connexion impossible.' },
  en: { connected: 'Signed in', signOut: 'Sign out', signIn: 'Sign in', firebaseSignIn: 'Sign in with Firebase', missingConfig: 'Firebase configuration missing', close: 'Close', intro: 'Access your CoachBrief account with your email address and password.', email: 'Email address', password: 'Password', loading: 'Signing in…', submit: 'Sign in', failed: 'Unable to sign in.' },
  it: { connected: 'Connesso', signOut: 'Disconnetti', signIn: 'Accedi', firebaseSignIn: 'Accedi con Firebase', missingConfig: 'Configurazione Firebase mancante', close: 'Chiudi', intro: 'Accedi al tuo account CoachBrief con indirizzo e-mail e password.', email: 'Indirizzo e-mail', password: 'Password', loading: 'Accesso…', submit: 'Accedi', failed: 'Accesso non riuscito.' },
  es: { connected: 'Sesión iniciada', signOut: 'Cerrar sesión', signIn: 'Iniciar sesión', firebaseSignIn: 'Iniciar sesión con Firebase', missingConfig: 'Falta la configuración de Firebase', close: 'Cerrar', intro: 'Accede a tu cuenta CoachBrief con tu correo electrónico y contraseña.', email: 'Correo electrónico', password: 'Contraseña', loading: 'Iniciando sesión…', submit: 'Iniciar sesión', failed: 'No se pudo iniciar sesión.' },
} as const

export function AuthControl() {
  const { language } = usePreferences()
  const c = authCopy[language]
  const [account, setAccount] = useState<FirebaseAccount | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => onFirebaseAuthStateChanged(setAccount), [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setError('')
    setIsLoading(true)
    try {
      await signInWithEmailAndPassword(String(data.get('email')), String(data.get('password')))
      setIsOpen(false)
    } catch (reason) {
      setError(reason instanceof Error && language === 'fr' ? reason.message : c.failed)
    } finally {
      setIsLoading(false)
    }
  }

  if (account) {
    return <button type="button" onClick={signOutFromFirebase} title={`${c.connected}: ${account.email}`}>
      <LogOut size={15} /> <span>{c.signOut}</span>
    </button>
  }

  return <>
    <button type="button" onClick={() => setIsOpen(true)} disabled={!isFirebaseConfigured} title={isFirebaseConfigured ? c.firebaseSignIn : c.missingConfig}>
      <LogIn size={15} /> <span>{c.signIn}</span>
    </button>
    {isOpen && <div className="auth-overlay" role="presentation" onMouseDown={() => setIsOpen(false)}>
      <section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="auth-close" type="button" onClick={() => setIsOpen(false)} aria-label={c.close}><X size={18} /></button>
        <h2 id="auth-title">{c.signIn}</h2>
        <p>{c.intro}</p>
        <form onSubmit={(event) => void submit(event)}>
          <label htmlFor="auth-email">{c.email}</label>
          <input id="auth-email" name="email" type="email" autoComplete="email" required autoFocus />
          <label htmlFor="auth-password">{c.password}</label>
          <input id="auth-password" name="password" type="password" autoComplete="current-password" required />
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button type="submit" disabled={isLoading}>{isLoading ? c.loading : c.submit}</button>
        </form>
      </section>
    </div>}
  </>
}
