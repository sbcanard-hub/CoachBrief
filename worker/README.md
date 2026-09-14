# Relais de traces CoachBrief

Ce dossier contient le Worker Cloudflare chargé de récupérer les ressources publiques MetaSail et TracTrac pour CoachBrief.

## Réglages Cloudflare Builds

- **Root directory** : `worker`
- **Build command** : laisser vide
- **Deploy command** : `npx wrangler deploy`
- **Production branch** : `main`

Le Worker expose :

- `GET /health` pour vérifier le déploiement ;
- `POST /fetch` avec un corps JSON `{ "url": "https://..." }`.

Sécurité intégrée : HTTPS obligatoire, liste blanche stricte des domaines MetaSail/TracTrac, contrôle des redirections, CORS limité à CoachBrief et réponse limitée à 5 Mo.
