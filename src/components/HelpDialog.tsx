import { CircleHelp, Cloud, Download, HardDrive, RefreshCw, Upload, X } from 'lucide-react'

type HelpDialogProps = {
  open: boolean
  onClose: () => void
}

export function HelpDialog({ open, onClose }: HelpDialogProps) {
  if (!open) return null

  return <div className="help-overlay" role="presentation" onMouseDown={onClose}>
    <section
      className="help-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="coachbrief-help-title"
      onMouseDown={(event) => event.stopPropagation()}
    >
      <button className="help-close" type="button" onClick={onClose} aria-label="Fermer l’aide">
        <X size={20} />
      </button>

      <div className="help-heading">
        <CircleHelp size={24} />
        <div>
          <p className="help-kicker">Aide rapide</p>
          <h2 id="coachbrief-help-title">Comment fonctionne CoachBrief ?</h2>
        </div>
      </div>

      <div className="help-grid">
        <article>
          <HardDrive size={20} />
          <h3>LOCAL</h3>
          <p>Le briefing est enregistré uniquement sur cet appareil et dans ce navigateur. Il ne peut pas apparaître automatiquement sur votre téléphone ou un autre ordinateur.</p>
        </article>

        <article>
          <Cloud size={20} />
          <h3>CLOUD</h3>
          <p>Le briefing est enregistré dans votre espace Firebase privé. Il peut être retrouvé sur vos autres appareils lorsque vous êtes connecté avec le même compte.</p>
        </article>

        <article>
          <Upload size={20} />
          <h3>Sauvegarder dans le cloud</h3>
          <p>Depuis le menu, utilisez ce bouton pour envoyer vos données locales vers le cloud. C’est l’étape nécessaire pour retrouver un briefing sur un autre appareil.</p>
        </article>

        <article>
          <Download size={20} />
          <h3>Restaurer depuis le cloud</h3>
          <p>Sur le nouvel appareil, utilisez ce bouton pour récupérer les données déjà présentes dans votre espace cloud.</p>
        </article>

        <article>
          <RefreshCw size={20} />
          <h3>Synchronisation automatique</h3>
          <p>Si elle est activée, CoachBrief synchronise les données cloud sans que vous ayez à relancer manuellement la sauvegarde à chaque modification.</p>
        </article>
      </div>

      <div className="help-tip">
        <strong>Un briefing n’apparaît pas sur le téléphone ?</strong>
        <span>Vérifiez d’abord qu’il est marqué CLOUD sur l’ordinateur, puis restaurez les données cloud sur le téléphone.</span>
      </div>
    </section>
  </div>
}
