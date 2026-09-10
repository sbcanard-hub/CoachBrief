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
- duplication rapide d’un briefing pour préparer une manche ou une journée suivante ;
- effacement automatique des observations terrain de la manche précédente lors d’une duplication ;
- saisie post-course de la réalité : vent, direction, rafale, vagues, courant et retour du coach ;
- historique `prévision → METAR → relevé avant départ → réalité` ;
- lecture circulaire correcte des rotations autour de 0° / 360° ;
- calibration par plan d’eau à partir des manches terminées ;
- biais moyen et erreur absolue moyenne en force et direction ;
- graphiques chronologiques des écarts modèle / réalité ;
- suggestion de correction locale directement dans un nouveau briefing ;
- calibration contextuelle par secteur de vent et plage de force ;
- repli explicite vers la calibration générale du plan d’eau s’il n’y a pas assez de manches comparables ;
- aperçu du vent brut puis corrigé avant application ;
- application ou retrait manuel de la correction sans modifier la prévision brute sauvegardée ;
- propagation de la correction choisie au briefing, à Bernot, à l’évolution horaire et au dimensionnement ;
- sauvegarde du METAR le plus proche avec les nouveaux briefings ;
- comparaison de fiabilité `Open-Meteo / METAR / relevé coach` face à la réalité post-course ;
- stockage local des variantes, briefings et retours post-course, sans serveur supplémentaire ;
- vérification automatique du build avec GitHub Actions.

## Sources météo et observations

Open-Meteo est appelé directement depuis le navigateur pour les prévisions météo et marines.

AviationWeather.gov ne permet pas les requêtes CORS directes depuis le navigateur. CoachBrief contourne proprement cette limite sans serveur supplémentaire : le workflow GitHub Pages récupère les derniers METAR côté GitHub, écrit `public/metar-latest.json`, puis construit le site. Un déploiement programmé chaque heure renouvelle ce cache sans créer de commit météo.

Les METAR sont des observations locales actuelles, pas des prévisions. Ils servent à confronter le modèle à la réalité observée ; ils ne remplacent pas les observations du coach sur le plan d’eau.

Lorsqu’un briefing est sauvegardé, CoachBrief conserve désormais l’observation du METAR disponible à la station la plus proche, avec l’heure du rapport et la distance au plan d’eau. Cette donnée peut ensuite être comparée à la réalité post-course. Cette comparaison doit rester prudente : l’heure et l’exposition de l’aéroport peuvent différer de celles de la manche et du plan d’eau.

Le relevé saisi par le coach est volontairement traité comme une observation ponctuelle. CoachBrief calcule l’écart avec le modèle quand une heure comparable existe et augmente la priorité des facteurs locaux si cet écart devient significatif, sans extrapoler automatiquement ce relevé à toute la manche.

## Dimensionnement, dessin, variantes et GPX

Le calculateur actuel est une estimation coach volontairement simple et calibrable. Il estime une VMG au près selon la classe et le vent, puis dimensionne le premier bord autour d’un temps cible de 11 à 12 minutes. Il ne constitue pas une longueur réglementaire : la taille de la flotte, le courant, le clapot, la visibilité et la zone disponible restent prioritaires.

La prévisualisation place le parcours autour du centre de plan d’eau sélectionné et applique l’axe ainsi que le désaxage de la bouée au vent. Elle dessine ensuite une géométrie schématique propre au type de parcours : banane, triangle ou trapèze.

Les points sont déplaçables à la souris ou au tactile via les marqueurs Leaflet. Le bouton Recalculer restaure le tracé issu du calcul automatique. L’export GPX écrit les points nommés du parcours ; l’import accepte les waypoints GPX ou, à défaut, les points d’une route GPX.

Un tracé ajusté peut être enregistré comme variante avec un nom libre, par exemple `Axe 090°`, `Vent mollissant` ou `Rotation droite`. Les variantes sont stockées dans `localStorage` pour le plan d’eau et le type de parcours concernés. Quand une variante est active, déplacer une marque met à jour automatiquement sa géométrie sauvegardée. Le tracé automatique reste toujours disponible comme point de départ.

## Briefings sauvegardés et duplication

Depuis l’écran de résultats, le bouton `Enregistrer` crée une copie locale du briefing. CoachBrief sauvegarde la demande complète de régate, les observations terrain, un instantané météo Open-Meteo, l’observation METAR la plus proche lorsqu’elle est disponible ainsi que le parcours actuellement affiché et ses variantes.

La page `Mes briefings` permet de rouvrir une régate. Les paramètres sont réinjectés dans le briefing, la météo est à nouveau actualisée par l’application et le tracé sauvegardé est restauré sur la carte. L’instantané météo ancien reste présent dans la sauvegarde pour l’historique et l’export.

Le bouton `Dupliquer` repart du briefing choisi avec le même plan d’eau, la même classe, le même parcours et les mêmes paramètres tactiques. Le formulaire est prérempli pour ne modifier que la date, l’heure ou les réglages utiles. Les observations terrain de la manche précédente sont volontairement effacées afin d’éviter de mélanger deux situations réelles différentes.

Un briefing complet peut être exporté en JSON CoachBrief puis importé sur un autre appareil. Le GPX reste le format léger destiné au tracé seul ; le JSON transporte l’ensemble du briefing.

## Historique, calibration locale et fiabilité des sources

Après une manche, `Mes briefings` permet d’ajouter la réalité observée : vent moyen, direction, rafale, hauteur de vague, courant et commentaire du coach.

Chaque briefing affiche alors quatre états lorsque les données sont disponibles : l’instantané de prévision conservé au moment de la préparation, le METAR sauvegardé, le relevé terrain saisi avant le départ et la réalité post-course.

La zone `Calibration par plan d’eau` regroupe les manches terminées autour d’un même point géographique. Elle calcule le biais moyen du modèle, l’erreur absolue moyenne et affiche une chronologie des écarts en force et en direction. Les différences angulaires sont calculées sur un cercle : par exemple 350° vers 010° correspond à +20° et non à -340°.

Dans un nouveau briefing, CoachBrief cherche d’abord des manches terminées correspondant au même secteur de vent et à la même plage de force : `0–5 nd`, `6–10 nd`, `11–15 nd` ou `16 nd et +`. À partir de deux manches comparables, cette calibration contextuelle est utilisée pour la suggestion. Sinon, l’application l’indique et revient à la calibration générale du plan d’eau.

La correction locale n’est jamais activée automatiquement. Le coach choisit de l’appliquer ou de la retirer. Lorsqu’elle est active, elle corrige la force et la direction du vent dans la vue courante, l’évolution horaire, le moteur Bernot et le dimensionnement du parcours.

La zone `Fiabilité modèle / METAR / coach` compare séparément chaque source à la réalité post-course. Pour chaque source, CoachBrief affiche le nombre de comparaisons disponibles, l’erreur absolue moyenne en force et en direction ainsi que le biais moyen. Les anciens briefings sans instantané METAR restent compatibles ; la série METAR se constituera progressivement avec les nouvelles sauvegardes.

La prévision Open-Meteo brute continue d’être conservée dans les sauvegardes et l’historique. Ce choix évite de réinjecter les corrections précédentes dans le calcul des biais futurs et de créer une boucle de calibration artificielle.

Le stockage reste volontairement local pour ce prototype. Il n’y a pas encore de synchronisation automatique entre téléphone et ordinateur, mais l’export/import JSON permet déjà un transfert manuel complet, y compris la réalité post-course et les instantanés disponibles.

## Impression et PDF

Sur l’écran de briefing, le bouton `Imprimer / PDF` déclenche l’impression native du navigateur. Une feuille de style A4 dédiée masque automatiquement la navigation, les commandes GPX et les contrôles interactifs pour ne garder que la fiche utile au coach.

La mise en page d’impression conserve l’en-tête de régate, les paramètres tactiques, les observations terrain, les METAR disponibles, la météo à la manche, le calcul du parcours, la carte, l’évolution horaire, les 7 piles de Bernot et la synthèse tactique. Les explications `Pourquoi` des recommandations sont développées à l’impression. Le navigateur peut ensuite imprimer sur papier ou enregistrer directement le document en PDF. Le titre du document reprend le lieu et la date afin de produire un nom de fichier plus utile lors de l’enregistrement.

## Suite du prototype

La prochaine étape naturelle est de rendre la calibration encore plus fine : tenir compte de la saison et de l’heure de la journée, puis proposer un score de confiance combiné qui privilégie automatiquement la source historiquement la plus fiable sans masquer les données brutes.

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
