import { FormEvent, useEffect, useState } from 'react'
import { LogIn, LogOut, X } from 'lucide-react'
import {
  isFirebaseConfigured,
  onFirebaseAuthStateChanged,
  signInWithEmailAndPassword,
  signOutFromFirebase,
  type FirebaseAccount,
} from '../firebase'

export function AuthControl() {
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
      setError(reason instanceof Error ? reason.message : 'Connexion impossible.')
    } finally {
      setIsLoading(false)
    }
  }

  if (account) {
    return <button type="button" onClick={signOutFromFirebase} title={`Connecté : ${account.email}`}>
      <LogOut size={15} /> <span>Déconnexion</span>
    </button>
  }

  return <>
    <button type="button" onClick={() => setIsOpen(true)} disabled={!isFirebaseConfigured} title={isFirebaseConfigured ? 'Se connecter avec Firebase' : 'Configuration Firebase manquante'}>
      <LogIn size={15} /> <span>Connexion</span>
    </button>
    {isOpen && <div className="auth-overlay" role="presentation" onMouseDown={() => setIsOpen(false)}>
      <section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="auth-close" type="button" onClick={() => setIsOpen(false)} aria-label="Fermer"><X size={18} /></button>
        <h2 id="auth-title">Connexion</h2>
        <p>Accédez à votre compte CoachBrief avec votre e-mail et votre mot de passe.</p>
        <form onSubmit={(event) => void submit(event)}>
          <label htmlFor="auth-email">Adresse e-mail</label>
          <input id="auth-email" name="email" type="email" autoComplete="email" required autoFocus />
          <label htmlFor="auth-password">Mot de passe</label>
          <input id="auth-password" name="password" type="password" autoComplete="current-password" required />
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button type="submit" disabled={isLoading}>{isLoading ? 'Connexion…' : 'Se connecter'}</button>
        </form>
      </section>
    </div>}
  </>
}
