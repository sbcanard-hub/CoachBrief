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
- sauvegarde d’un briefing complet depuis l’écran de résultats ;
- bibliothèque `Mes briefings` avec réouverture et suppression ;
- conservation des paramètres, observations terrain, instantané météo et tracé/variante actif ;
- restauration du parcours exact lors de la réouverture ;
- import et export JSON d’un briefing complet pour le transférer entre appareils ;
- impression A4 dédiée et export PDF via la fonction native du navigateur ;
- stockage local des variantes et briefings, sans serveur supplémentaire ;
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

## Briefings sauvegardés

Depuis l’écran de résultats, le bouton `Enregistrer` crée une copie locale du briefing. CoachBrief sauvegarde la demande complète de régate, les observations terrain, un instantané météo récupéré au moment de l’enregistrement ainsi que le parcours actuellement affiché et ses variantes.

La page `Mes briefings` permet de rouvrir une régate. Les paramètres sont réinjectés dans le briefing, la météo est à nouveau actualisée par l’application et le tracé sauvegardé est restauré sur la carte. L’instantané météo ancien reste présent dans la sauvegarde pour l’historique et l’export.

Un briefing complet peut être exporté en JSON CoachBrief puis importé sur un autre appareil. Le GPX reste le format léger destiné au tracé seul ; le JSON transporte l’ensemble du briefing.

Le stockage reste volontairement local pour ce prototype. Il n’y a pas encore de synchronisation automatique entre téléphone et ordinateur, mais l’export/import JSON permet déjà un transfert manuel complet.

## Impression et PDF

Sur l’écran de briefing, le bouton `Imprimer / PDF` déclenche l’impression native du navigateur. Une feuille de style A4 dédiée masque automatiquement la navigation, les commandes GPX et les contrôles interactifs pour ne garder que la fiche utile au coach.

La mise en page d’impression conserve l’en-tête de régate, les paramètres tactiques, les observations terrain, les METAR disponibles, la météo à la manche, le calcul du parcours, la carte, l’évolution horaire, les 7 piles de Bernot et la synthèse tactique. Les explications `Pourquoi` des recommandations sont développées à l’impression. Le navigateur peut ensuite imprimer sur papier ou enregistrer directement le document en PDF.

## Suite du prototype

La prochaine étape naturelle est la duplication rapide d’un briefing pour une nouvelle manche ou une nouvelle journée de régate, puis l’ajout d’un historique permettant de comparer les prévisions, les observations et ce qui s’est réellement passé sur l’eau.

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
