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
- premières sources locales METAR autour de la Côte d’Azur (LFMD, LFMN, LFTH), classées par distance au plan d’eau ;
- vérification automatique du build avec GitHub Actions.

## Sources météo

Open-Meteo est appelé directement depuis le navigateur pour les prévisions météo et marines.

Les METAR AviationWeather sont, à ce stade, proposés en consultation externe. L’API officielle AviationWeather ne permet pas les requêtes CORS directes depuis le navigateur ; un relais serveur léger sera nécessaire pour les intégrer automatiquement à une application statique hébergée sur GitHub Pages.

## Développement

```bash
npm ci
npm run dev
```

Vérification de production :

```bash
npm run build
```

Le déploiement GitHub Pages est configuré pour le sous-chemin `/CoachBrief/`.
