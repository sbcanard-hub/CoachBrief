# CoachBrief

CoachBrief est une application web de briefing météo et tactique pour la régate.

## État du prototype

La branche de travail ajoute désormais :

- fiche de régate : lieu, date, horaires, classe et type de parcours ;
- paramètres tactiques : heure de manche, axe, ligne favorable, désaxage de la bouée au vent et orientation de l’arrivée ;
- carte interactive du plan d’eau : recherche du lieu puis placement précis du centre de parcours ;
- météo réelle via Open-Meteo sur le point cartographique choisi ;
- données marines quand disponibles : vagues, température de mer et courant ;
- moteur dynamique des 7 piles de Bernot ;
- synthèse tactique recalculée selon les données de course et météo ;
- observations terrain facultatives du coach : heure, vent, direction, rafale, vagues, courant, nébulosité, pression et note libre ;
- comparaison automatique du relevé terrain avec le modèle à l’heure la plus proche ;
- remontée des écarts terrain / modèle dans la hiérarchie Bernot et dans la synthèse coach ;
- sources locales METAR Côte d’Azur (LFMD, LFMN, LFTH), classées par distance au plan d’eau ;
- récupération automatique des METAR AviationWeather côté GitHub ;
- comparaison METAR / modèle lorsque le briefing concerne aujourd’hui et qu’une heure modèle proche est disponible ;
- vérification automatique du build avec GitHub Actions.

## Sources météo et observations

Open-Meteo est appelé directement depuis le navigateur pour les prévisions météo et marines.

AviationWeather.gov ne permet pas les requêtes CORS directes depuis le navigateur. CoachBrief contourne proprement cette limite sans serveur supplémentaire : le workflow GitHub Pages récupère les derniers METAR côté GitHub, écrit `public/metar-latest.json`, puis construit le site. Un déploiement programmé chaque heure renouvelle ce cache sans créer de commit météo.

Les METAR sont des observations locales actuelles, pas des prévisions. Ils servent à confronter le modèle à la réalité observée ; ils ne remplacent pas les observations du coach sur le plan d’eau.

Le relevé saisi par le coach est volontairement traité comme une observation ponctuelle. CoachBrief calcule l’écart avec le modèle quand une heure comparable existe et augmente la priorité des facteurs locaux si cet écart devient significatif, sans extrapoler automatiquement ce relevé à toute la manche.

## Développement

```bash
npm ci
npm run dev
```

Vérification de production :

```bash
python3 scripts/fetch_metar.py
npm run build
```

Le déploiement GitHub Pages est configuré pour le sous-chemin `/CoachBrief/`.
