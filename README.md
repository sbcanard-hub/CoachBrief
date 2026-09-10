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
- calculateur de premier bord selon la classe et le vent prévu à la manche ;
- estimation en milles nautiques et mètres, avec fourchette de réglage et VMG simplifiée ;
- prévisualisation cartographique du parcours complet selon le type choisi : banane, triangle ou trapèze ;
- ligne de départ, marques numérotées, arrivée et séquence de passage affichées sur la carte ;
- déplacement manuel du départ, des bouées et de l’arrivée directement sur la carte ;
- remise à zéro du tracé à partir de l’axe et du dimensionnement calculé ;
- import et export GPX des points du parcours ;
- variantes de parcours enregistrables par plan d’eau et type de parcours ;
- bascule instantanée entre tracé automatique et variantes sauvegardées ;
- mise à jour automatique d’une variante active quand une marque est déplacée ;
- stockage local des variantes sur l’appareil, sans serveur supplémentaire ;
- vérification automatique du build avec GitHub Actions.

## Sources météo et observations

Open-Meteo est appelé directement depuis le navigateur pour les prévisions météo et marines.

AviationWeather.gov ne permet pas les requêtes CORS directes depuis le navigateur. CoachBrief contourne proprement cette limite sans serveur supplémentaire : le workflow GitHub Pages récupère les derniers METAR côté GitHub, écrit `public/metar-latest.json`, puis construit le site. Un déploiement programmé chaque heure renouvelle ce cache sans créer de commit météo.

Les METAR sont des observations locales actuelles, pas des prévisions. Ils servent à confronter le modèle à la réalité observée ; ils ne remplacent pas les observations du coach sur le plan d’eau.

Le relevé saisi par le coach est volontairement traité comme une observation ponctuelle. CoachBrief calcule l’écart avec le modèle quand une heure comparable existe et augmente la priorité des facteurs locaux si cet écart devient significatif, sans extrapoler automatiquement ce relevé à toute la manche.

## Dimensionnement, dessin, variantes et GPX

Le calculateur actuel est une estimation coach volontairement simple et calibrable. Il estime une VMG au près selon la classe et le vent, puis dimensionne le premier bord autour d’un temps cible de 11 à 12 minutes. Il ne constitue pas une longueur réglementaire : la taille de la flotte, le courant, le clapot, la visibilité et la zone disponible restent prioritaires.

La prévisualisation place le parcours autour du centre de plan d’eau sélectionné et applique l’axe ainsi que le désaxage de la bouée au vent. Elle dessine ensuite une géométrie schématique propre au type de parcours : banane, triangle ou trapèze.

Les points sont déplaçables à la souris ou au tactile via les marqueurs Leaflet. Le bouton Recalculer restaure le tracé issu du calcul automatique. L’export GPX écrit les points nommés du parcours ; l’import accepte les waypoints GPX ou, à défaut, les points d’une route GPX.

Un tracé ajusté peut être enregistré comme variante avec un nom libre, par exemple `Axe 090°`, `Vent mollissant` ou `Rotation droite`. Les variantes sont stockées dans `localStorage` pour le plan d’eau et le type de parcours concernés. Quand une variante est active, déplacer une marque met à jour automatiquement sa géométrie sauvegardée. Le tracé automatique reste toujours disponible comme point de départ.

Ce stockage est volontairement local pour le prototype : une variante enregistrée sur un téléphone ou un ordinateur n’est pas encore synchronisée automatiquement vers un autre appareil. L’export GPX permet déjà de transférer un tracé entre appareils.

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
