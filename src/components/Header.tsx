import { Sailboat } from 'lucide-react'
import { Link } from 'react-router-dom'

export function Header() {
  return (
    <header className="site-header">
      <Link className="brand" to="/" aria-label="Retour à l'accueil CoachBrief">
        <span className="brand-mark"><Sailboat size={22} strokeWidth={1.8} /></span>
        <span>CoachBrief</span>
      </Link>
      <span className="header-label">Météo de régate</span>
    </header>
  )
}
