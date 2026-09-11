# CoachBrief

CoachBrief est une application web de briefing météo et tactique pour entraîneurs et régatiers.

## Principes de données

CoachBrief fonctionne d’abord en mode local et reste utilisable sans compte. Les briefings, parcours, observations et retours terrain peuvent être sauvegardés puis exportés dans un fichier portable pour éviter de dépendre d’un seul appareil.

### Mémoire personnelle

La mémoire personnelle est privée par défaut. Elle apprend à partir des briefings sauvegardés et des retours réellement renseignés après les manches.

Les seuils sont volontairement progressifs :

- 1 manche : indication ;
- 2 à 3 manches : tendance émergente ;
- 4 à 6 manches : confiance moyenne ;
- 7 manches et plus : confiance forte si les observations restent cohérentes.

Le score n’est pas fondé uniquement sur le nombre de manches. Il combine aussi la similarité des conditions, la régularité des écarts et la récence des retours.

### Base commune

L’interface prévoit trois modes :

- Personnel ;
- Base commune ;
- Perso + commune.

La base commune utilise des seuils adaptés à des données multi-utilisateurs :

- 3 à 5 observations : signal faible ;
- 6 à 12 : tendance intéressante ;
- 13 à 25 : bonne confiance ;
- au-delà : confiance renforcée selon cohérence, similarité et récence.

Le partage communautaire reste volontaire. Les notes privées ne sont pas destinées à être publiées dans la base commune.

### Sauvegarde et synchronisation

Le format portable sauvegarde les briefings, parcours, météo/METAR, retours terrain et préférences de connaissance. La restauration fusionne les éléments par identifiant et conserve les versions les plus récentes.

Une interface `CoachBriefCloudAdapter` sépare volontairement le moteur métier du futur fournisseur cloud. Elle prévoit :

- authentification d’un compte ;
- synchronisation privée multi-appareils ;
- versions/révisions des données ;
- alimentation et consultation d’une base commune.

Le fournisseur cloud n’est pas encore configuré dans le dépôt public : l’interface fonctionne donc actuellement en local/portable, sans prétendre effectuer une synchronisation distante inexistante.

## Développement

```bash
npm install
npm run build
```

Le site est déployé via GitHub Pages depuis la branche `main`.
