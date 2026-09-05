# CoachBrief

CoachBrief est une application web de préparation météo pour les régates de voile. Cette première version permet de renseigner le lieu, la date et les horaires d'une course, puis d'accéder à une page de briefing prête à recevoir les futures données météo.

## Fonctionnalités

- formulaire de préparation d'une régate ;
- validation native des champs obligatoires ;
- transmission des informations vers la page de résultats ;
- page de résultats vide prévue pour intégrer le vent, les rafales et la houle ;
- interface responsive adaptée au mobile et au bureau.

## Installation

Prérequis : [Node.js](https://nodejs.org/) 20 ou une version plus récente.

```bash
git clone <url-du-depot>
cd CoachBrief
npm install
npm run dev
```

Ouvrez ensuite l'adresse indiquée par Vite (généralement `http://localhost:5173`).

## Utilisation

1. Saisissez le lieu de la régate.
2. Choisissez la date, l'heure de début et l'heure de fin.
3. Cliquez sur **Préparer mon briefing**.
4. La page de résultats affiche le contexte de la régate et l'emplacement réservé aux données météo.

## Scripts

| Commande | Description |
| --- | --- |
| `npm run dev` | Lance le serveur de développement avec rechargement à chaud. |
| `npm run build` | Vérifie TypeScript et génère la version de production dans `dist/`. |
| `npm run lint` | Analyse le code avec ESLint. |
| `npm run preview` | Prévisualise localement la version de production. |

## Déploiement sur GitHub Pages

Le workflow [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) construit et publie automatiquement l'application sur GitHub Pages à chaque envoi sur la branche `main`. Il peut également être lancé manuellement depuis l'onglet **Actions**.

Pour activer le premier déploiement, ouvrez **Settings > Pages** dans le dépôt GitHub et choisissez **GitHub Actions** comme source. Le chemin de base `/CoachBrief/`, configuré dans `vite.config.ts`, permet à GitHub Pages de charger correctement les ressources générées sous l'URL du dépôt.

La navigation utilise des URL avec fragment (par exemple `/#/resultats`) afin qu'un rechargement ou un accès direct à une page fonctionne sur l'hébergement statique de GitHub Pages.

## Architecture

```text
src/
├── components/       # Composants d'interface réutilisables
├── pages/            # Pages associées aux routes
├── App.tsx           # Routage et structure générale
├── main.tsx          # Point d'entrée React
├── styles.css        # Système visuel global et responsive
└── types.ts          # Types partagés
```

La navigation repose sur React Router. Le formulaire transmet pour l'instant les données via l'état de navigation : une future couche de service pourra appeler une API météo sans modifier la structure des pages.
