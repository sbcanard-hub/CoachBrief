import type { Language } from '../preferences'

export const legalFooterCopy: Record<Language, { rights: string; navigation: string; about: string; legal: string; privacy: string; terms: string }> = {
  fr: { rights: 'Tous droits réservés.', navigation: 'Informations sur CoachBrief', about: 'À propos', legal: 'Mentions légales', privacy: 'Confidentialité', terms: 'Conditions d’utilisation' },
  en: { rights: 'All rights reserved.', navigation: 'About CoachBrief', about: 'About', legal: 'Legal notice', privacy: 'Privacy', terms: 'Terms of use' },
  it: { rights: 'Tutti i diritti riservati.', navigation: 'Informazioni su CoachBrief', about: 'Chi siamo', legal: 'Note legali', privacy: 'Privacy', terms: 'Condizioni d’uso' },
  es: { rights: 'Todos los derechos reservados.', navigation: 'Información sobre CoachBrief', about: 'Acerca de', legal: 'Aviso legal', privacy: 'Privacidad', terms: 'Condiciones de uso' },
}
