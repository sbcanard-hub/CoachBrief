import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { usePreferences, type Language } from '../preferences'

type OffshoreLanguage = Exclude<Language, 'fr'>
type TranslationSet = Record<string, string>

const translations: Record<OffshoreLanguage, TranslationSet> = {
  en: {
    'CoachBrief · Course au large': 'CoachBrief · Offshore racing',
    'Préparer une route qui évolue': 'Plan a route that evolves',
    'dans le temps et dans l’espace': 'over time and space',
    'Cette interface est séparée du petit parcours : on raisonne ici en route, tronçons, météo évolutive, courant, état de mer, caps, détroits et timing de passage.': 'This workspace is separate from the short-course module: here the focus is on route, legs, changing weather, current, sea state, headings, straits and passage timing.',
    'Course': 'Race', 'Départ et bateau': 'Start and boat', 'Nom de la course': 'Race name', 'Date de départ': 'Start date', 'Heure de départ': 'Start time',
    'Nom du bateau': 'Boat name', 'Nom ou numéro': 'Name or number', 'Type de bateau': 'Boat type', 'Vitesse moyenne de travail': 'Working average speed',
    'La vitesse moyenne sert au premier échantillonnage des tronçons. Le routage isochrone utilise ensuite la polaire active du bateau.': 'The average speed is used for the first sampling of route legs. Isochrone routing then uses the active boat polar.',
    'Route': 'Route', 'Départ, waypoints et arrivée': 'Start, waypoints and finish', 'Départ': 'Start', 'Arrivée': 'Finish', 'Nom': 'Name', 'Latitude': 'Latitude', 'Longitude': 'Longitude',
    'Ajouter un waypoint manuel': 'Add a manual waypoint', 'Carte de route': 'Route map',
    'Route directe en pointillés · routage isochrone en trait plein.': 'Direct route shown dashed · isochrone routing shown solid.',
    'Route directe en pointillés · aucun routage maritime valide.': 'Direct route shown dashed · no valid marine routing.',
    'Distance directe D → A': 'Direct distance D → A', 'Route météo calculée': 'Calculated weather route', 'Route météo partielle': 'Partial weather route',
    'Météo au passage': 'Weather along the route', 'Polaire bateau': 'Boat polar',
    'La polaire sélectionnée est aussi utilisée par le calcul d’isochrones ci-dessous.': 'The selected polar is also used by the isochrone calculation below.',
    'Routage météo': 'Weather routing', 'Isochrones': 'Isochrones', 'Pas de temps': 'Time step', 'Horizon': 'Horizon', 'Coefficient marée': 'Tide coefficient',
    'PM générique de secours': 'Fallback high water', 'Calculer le routage': 'Calculate routing', 'Calcul des isochrones…': 'Calculating isochrones…',
    'Pleines mers par port de référence SHOM': 'High waters by SHOM reference port',
    'Une date/heure par ligne. CoachBrief choisit la PM la plus proche de chaque nœud de routage.': 'One date/time per line. CoachBrief selects the closest high water for each routing node.',
    'Aucune PM saisie': 'No high water entered', 'Pourquoi cette route météo ?': 'Why this weather route?', 'Cap': 'Heading', 'Vent': 'Wind', 'Polaire': 'Polar',
    'Après mer': 'After sea-state penalty', 'Vitesse sol': 'Speed over ground', 'Courant': 'Current', 'Route retenue': 'Selected route',
    'Coupures de terre écartées': 'Land crossings rejected', 'Options coupant un TSS': 'Options crossing a TSS', 'Échantillons courant SHOM': 'SHOM current samples',
    'PM de port utilisées': 'Port high waters used', 'PM propagées ~12 h 25': 'High waters propagated ~12 h 25', 'Replis Open-Meteo': 'Open-Meteo fallbacks', 'Atlas SHOM utilisés': 'SHOM atlases used',
    'Aucun routage maritime valide trouvé avec ces paramètres. La ligne en pointillés représente uniquement la distance géométrique directe entre D et A ; elle n’est pas une route navigable.': 'No valid marine routing was found with these settings. The dashed line only represents the direct geometric distance between D and A; it is not a navigable route.',
  },
  it: {
    'CoachBrief · Course au large': 'CoachBrief · Regata d’altura', 'Préparer une route qui évolue': 'Preparare una rotta che evolve', 'dans le temps et dans l’espace': 'nel tempo e nello spazio',
    'Cette interface est séparée du petit parcours : on raisonne ici en route, tronçons, météo évolutive, courant, état de mer, caps, détroits et timing de passage.': 'Questo spazio è separato dal percorso corto: qui si ragiona su rotta, tratte, meteo evolutiva, corrente, stato del mare, rotte, stretti e tempi di passaggio.',
    'Course': 'Regata', 'Départ et bateau': 'Partenza e barca', 'Nom de la course': 'Nome della regata', 'Date de départ': 'Data di partenza', 'Heure de départ': 'Ora di partenza',
    'Nom du bateau': 'Nome della barca', 'Nom ou numéro': 'Nome o numero', 'Type de bateau': 'Tipo di barca', 'Vitesse moyenne de travail': 'Velocità media di lavoro',
    'La vitesse moyenne sert au premier échantillonnage des tronçons. Le routage isochrone utilise ensuite la polaire active du bateau.': 'La velocità media serve per il primo campionamento delle tratte. Il routing isocrono usa poi la polare attiva della barca.',
    'Route': 'Rotta', 'Départ, waypoints et arrivée': 'Partenza, waypoint e arrivo', 'Départ': 'Partenza', 'Arrivée': 'Arrivo', 'Nom': 'Nome', 'Latitude': 'Latitudine', 'Longitude': 'Longitudine',
    'Ajouter un waypoint manuel': 'Aggiungi un waypoint manuale', 'Carte de route': 'Carta della rotta',
    'Route directe en pointillés · routage isochrone en trait plein.': 'Rotta diretta tratteggiata · routing isocrono a linea continua.',
    'Route directe en pointillés · aucun routage maritime valide.': 'Rotta diretta tratteggiata · nessun routing marittimo valido.',
    'Distance directe D → A': 'Distanza diretta D → A', 'Route météo calculée': 'Rotta meteo calcolata', 'Route météo partielle': 'Rotta meteo parziale',
    'Météo au passage': 'Meteo lungo la rotta', 'Polaire bateau': 'Polare barca',
    'La polaire sélectionnée est aussi utilisée par le calcul d’isochrones ci-dessous.': 'La polare selezionata viene usata anche dal calcolo isocrono qui sotto.',
    'Routage météo': 'Routing meteo', 'Isochrones': 'Isocrone', 'Pas de temps': 'Passo temporale', 'Horizon': 'Orizzonte', 'Coefficient marée': 'Coefficiente di marea',
    'PM générique de secours': 'Alta marea di riserva', 'Calculer le routage': 'Calcola il routing', 'Calcul des isochrones…': 'Calcolo delle isocrone…',
    'Pleines mers par port de référence SHOM': 'Alte maree per porto SHOM di riferimento', 'Aucune PM saisie': 'Nessuna alta marea inserita',
    'Pourquoi cette route météo ?': 'Perché questa rotta meteo?', 'Cap': 'Rotta', 'Vent': 'Vento', 'Polaire': 'Polare', 'Après mer': 'Dopo penalità mare', 'Vitesse sol': 'Velocità sul fondo', 'Courant': 'Corrente',
    'Route retenue': 'Rotta selezionata', 'Coupures de terre écartées': 'Attraversamenti di terra scartati', 'Options coupant un TSS': 'Opzioni che attraversano un TSS', 'Échantillons courant SHOM': 'Campioni corrente SHOM',
    'Aucun routage maritime valide trouvé avec ces paramètres. La ligne en pointillés représente uniquement la distance géométrique directe entre D et A ; elle n’est pas une route navigable.': 'Nessun routing marittimo valido trovato con questi parametri. La linea tratteggiata rappresenta solo la distanza geometrica diretta tra D e A; non è una rotta navigabile.',
  },
  es: {
    'CoachBrief · Course au large': 'CoachBrief · Regata de altura', 'Préparer une route qui évolue': 'Preparar una ruta que evoluciona', 'dans le temps et dans l’espace': 'en el tiempo y en el espacio',
    'Cette interface est séparée du petit parcours : on raisonne ici en route, tronçons, météo évolutive, courant, état de mer, caps, détroits et timing de passage.': 'Este espacio está separado del recorrido corto: aquí se trabaja con ruta, tramos, meteorología cambiante, corriente, estado de la mar, rumbos, estrechos y tiempos de paso.',
    'Course': 'Regata', 'Départ et bateau': 'Salida y barco', 'Nom de la course': 'Nombre de la regata', 'Date de départ': 'Fecha de salida', 'Heure de départ': 'Hora de salida',
    'Nom du bateau': 'Nombre del barco', 'Nom ou numéro': 'Nombre o número', 'Type de bateau': 'Tipo de barco', 'Vitesse moyenne de travail': 'Velocidad media de trabajo',
    'La vitesse moyenne sert au premier échantillonnage des tronçons. Le routage isochrone utilise ensuite la polaire active du bateau.': 'La velocidad media se usa para el primer muestreo de los tramos. Después, el routing isócrono usa la polar activa del barco.',
    'Route': 'Ruta', 'Départ, waypoints et arrivée': 'Salida, waypoints y llegada', 'Départ': 'Salida', 'Arrivée': 'Llegada', 'Nom': 'Nombre', 'Latitude': 'Latitud', 'Longitude': 'Longitud',
    'Ajouter un waypoint manuel': 'Añadir un waypoint manual', 'Carte de route': 'Mapa de ruta',
    'Route directe en pointillés · routage isochrone en trait plein.': 'Ruta directa discontinua · routing isócrono en línea continua.',
    'Route directe en pointillés · aucun routage maritime valide.': 'Ruta directa discontinua · sin routing marítimo válido.',
    'Distance directe D → A': 'Distancia directa D → A', 'Route météo calculée': 'Ruta meteorológica calculada', 'Route météo partielle': 'Ruta meteorológica parcial',
    'Météo au passage': 'Meteorología en ruta', 'Polaire bateau': 'Polar del barco',
    'La polaire sélectionnée est aussi utilisée par le calcul d’isochrones ci-dessous.': 'La polar seleccionada también se usa en el cálculo de isócronas de abajo.',
    'Routage météo': 'Routing meteorológico', 'Isochrones': 'Isócronas', 'Pas de temps': 'Paso de tiempo', 'Horizon': 'Horizonte', 'Coefficient marée': 'Coeficiente de marea',
    'PM générique de secours': 'Pleamar genérica de respaldo', 'Calculer le routage': 'Calcular el routing', 'Calcul des isochrones…': 'Calculando isócronas…',
    'Pleines mers par port de référence SHOM': 'Pleamares por puerto SHOM de referencia', 'Aucune PM saisie': 'No se ha introducido ninguna pleamar',
    'Pourquoi cette route météo ?': '¿Por qué esta ruta meteorológica?', 'Cap': 'Rumbo', 'Vent': 'Viento', 'Polaire': 'Polar', 'Après mer': 'Tras penalización por mar', 'Vitesse sol': 'Velocidad sobre el fondo', 'Courant': 'Corriente',
    'Route retenue': 'Ruta seleccionada', 'Coupures de terre écartées': 'Cruces de tierra descartados', 'Options coupant un TSS': 'Opciones que cruzan un TSS', 'Échantillons courant SHOM': 'Muestras de corriente SHOM',
    'Aucun routage maritime valide trouvé avec ces paramètres. La ligne en pointillés représente uniquement la distance géométrique directe entre D et A ; elle n’est pas une route navigable.': 'No se encontró un routing marítimo válido con estos parámetros. La línea discontinua representa únicamente la distancia geométrica directa entre D y A; no es una ruta navegable.',
  },
}

// Text rendered by the offshore forms and their child panels. Keep the three
// languages together so new labels cannot be translated for just one language.
const additionalTranslations: Record<string, [string, string, string]> = {
  'Sauvegarde': ['Save', 'Salvataggio', 'Guardado'],
  'Mes routes au large': ['My offshore routes', 'Le mie rotte d’altura', 'Mis rutas de altura'],
  'Nom de la route': ['Route name', 'Nome della rotta', 'Nombre de la ruta'],
  'Routes enregistrées': ['Saved routes', 'Rotte salvate', 'Rutas guardadas'],
  'Choisir une route…': ['Choose a route…', 'Scegli una rotta…', 'Elige una ruta…'],
  'Sauvegarde automatique': ['Automatic save', 'Salvataggio automatico', 'Guardado automático'],
  'Manuelle': ['Manual', 'Manuale', 'Manual'],
  'Automatique': ['Automatic', 'Automatico', 'Automático'],
  'Nouvelle préparation': ['New route plan', 'Nuova preparazione', 'Nueva preparación'],
  'Route liée à une sauvegarde': ['Saved route open', 'Rotta salvata aperta', 'Ruta guardada abierta'],
  'Enregistrer': ['Save', 'Salva', 'Guardar'],
  'Enregistrer sous': ['Save as', 'Salva con nome', 'Guardar como'],
  'Ouvrir': ['Open', 'Apri', 'Abrir'],
  'Supprimer': ['Delete', 'Elimina', 'Eliminar'],
  'Supprimer la route sélectionnée': ['Delete selected route', 'Elimina la rotta selezionata', 'Eliminar la ruta seleccionada'],
  'Monocoque': ['Monohull', 'Monoscafo', 'Monocasco'],
  'Multicoque': ['Multihull', 'Multiscafo', 'Multicasco'],
  'Autre': ['Other', 'Altro', 'Otro'],
  'Ville': ['City', 'Città', 'Ciudad'],
  'Port / marina': ['Port / marina', 'Porto / marina', 'Puerto / marina'],
  'Rechercher': ['Search', 'Cerca', 'Buscar'],
  'Ajouter un waypoint par nom': ['Add a waypoint by name', 'Aggiungi un waypoint per nome', 'Añadir un waypoint por nombre'],
  'Départ depuis ta position actuelle': ['Start from your current position', 'Parti dalla tua posizione attuale', 'Salida desde tu posición actual'],
  'Localisation…': ['Locating…', 'Localizzazione…', 'Localizando…'],
  'Utiliser ma position': ['Use my location', 'Usa la mia posizione', 'Usar mi ubicación'],
  'Déplace les marqueurs pour ajuster les points.': ['Drag markers to adjust the points.', 'Trascina i marcatori per regolare i punti.', 'Arrastra los marcadores para ajustar los puntos.'],
  'Mer + houle au passage': ['Sea and swell along the route', 'Mare e onda lungo la rotta', 'Mar y oleaje en ruta'],
  'Courant au passage': ['Current along the route', 'Corrente lungo la rotta', 'Corriente en ruta'],
  'Découpage tactique': ['Tactical legs', 'Tratte tattiche', 'Tramos tácticos'],
  'Tronçons de route et conditions estimées': ['Route legs and estimated conditions', 'Tratte e condizioni stimate', 'Tramos y condiciones estimadas'],
  'Analyser la route': ['Analyse route', 'Analizza la rotta', 'Analizar ruta'],
  'Analyse en cours…': ['Analysing…', 'Analisi in corso…', 'Analizando…'],
  'Actualiser l’analyse': ['Refresh analysis', 'Aggiorna l’analisi', 'Actualizar análisis'],
  'Route directe': ['Direct bearing', 'Rotta diretta', 'Rumbo directo'],
  'Passage estimé': ['Estimated passage', 'Passaggio stimato', 'Paso estimado'],
  'À calculer': ['Pending calculation', 'Da calcolare', 'Pendiente de cálculo'],
  'Mer': ['Sea', 'Mare', 'Mar'],
  'raf.': ['gust', 'raff.', 'racha'],
  'Source actuelle : Open-Meteo Forecast + Marine. La polaire et le routage permettent maintenant de dépasser l’hypothèse d’une vitesse constante.': ['Current source: Open-Meteo Forecast + Marine. The polar and routing replace the constant-speed assumption.', 'Fonte attuale: Open-Meteo Forecast + Marine. Polare e routing superano l’ipotesi di velocità costante.', 'Fuente actual: Open-Meteo Forecast + Marine. La polar y el cálculo de ruta sustituyen la hipótesis de velocidad constante.'],
  'Waypoint incomplet': ['Incomplete waypoint', 'Waypoint incompleto', 'Waypoint incompleto'],
  'Capacités du mode large': ['Offshore capabilities', 'Funzioni d’altura', 'Funciones de altura'],
  'Multi-modèles': ['Multiple models', 'Modelli multipli', 'Varios modelos'],
  'Courants et marées': ['Currents and tides', 'Correnti e maree', 'Corrientes y mareas'],
  'Mer et houle': ['Sea and swell', 'Mare e onda', 'Mar y oleaje'],
  'Route navigable': ['Navigable route', 'Rotta navigabile', 'Ruta navegable'],
  'Ex. Antibes ou Port Vauban…': ['E.g. Antibes or Port Vauban…', 'Es. Antibes o Port Vauban…', 'Ej. Antibes o Port Vauban…'],
  'Ex. Lorient ou Port de La Trinité…': ['E.g. Lorient or Port de La Trinité…', 'Es. Lorient o Port de La Trinité…', 'Ej. Lorient o Port de La Trinité…'],
  'Ex. Port Vauban, Lorient La Base…': ['E.g. Port Vauban, Lorient La Base…', 'Es. Port Vauban, Lorient La Base…', 'Ej. Port Vauban, Lorient La Base…'],
  'Ex. Antibes, Lorient, Saint-Malo…': ['E.g. Antibes, Lorient, Saint-Malo…', 'Es. Antibes, Lorient, Saint-Malo…', 'Ej. Antibes, Lorient, Saint-Malo…'],
  'Ex. Fastnet Rock, Raz de Sein, Belle-Île, Cap Lizard…': ['E.g. Fastnet Rock, Raz de Sein, Belle-Île, Cap Lizard…', 'Es. Fastnet Rock, Raz de Sein, Belle-Île, Cap Lizard…', 'Ej. Fastnet Rock, Raz de Sein, Belle-Île, Cap Lizard…'],
  'Recherche une ville.': ['Search for a city.', 'Cerca una città.', 'Busca una ciudad.'],
  'Recherche un port ou une marina précise.': ['Search for a specific port or marina.', 'Cerca un porto o una marina.', 'Busca un puerto o una marina.'],
  'La recherche est momentanément indisponible. Les coordonnées restent modifiables manuellement.': ['Search is temporarily unavailable. You can enter coordinates manually.', 'La ricerca non è disponibile. Puoi inserire le coordinate manualmente.', 'La búsqueda no está disponible. Puedes introducir las coordenadas manualmente.'],
  'Aucun résultat trouvé pour cette recherche.': ['No results found.', 'Nessun risultato trovato.', 'No se encontraron resultados.'],
  'La recherche de waypoint est momentanément indisponible.': ['Waypoint search is temporarily unavailable.', 'La ricerca di waypoint non è disponibile.', 'La búsqueda de waypoints no está disponible.'],
  'Aucun lieu trouvé pour cette recherche.': ['No place found.', 'Nessun luogo trovato.', 'No se encontró ningún lugar.'],
  'Glisse les waypoints pour changer l’ordre de passage. Sur téléphone, utilise les flèches ↑ ↓.': ['Drag waypoints to change their order. On a phone, use the ↑ ↓ arrows.', 'Trascina i waypoint per cambiarne l’ordine. Sul telefono usa le frecce ↑ ↓.', 'Arrastra los waypoints para cambiar su orden. En el teléfono usa las flechas ↑ ↓.'],
  'Glisser pour réordonner': ['Drag to reorder', 'Trascina per riordinare', 'Arrastrar para reordenar'],
  'Enregistre le bateau, D/A et waypoints, l’analyse météo, la polaire active, les réglages d’isochrones et le dernier routage calculé.': ['Save the boat, start/finish and waypoints, weather analysis, active polar, routing settings and latest calculated route.', 'Salva barca, partenza/arrivo e waypoint, analisi meteo, polare attiva, impostazioni e ultima rotta calcolata.', 'Guarda barco, salida/llegada y waypoints, análisis meteorológico, polar activa, ajustes y última ruta calculada.'],
  'Ces routes sont enregistrées sur l’appareil. Elles sont aussi incluses dans la sauvegarde globale CoachBrief : si la synchronisation Firebase est activée, elles suivent la même sauvegarde cloud que les briefings.': ['Routes are saved on this device. They are also included in the CoachBrief backup: if Firebase sync is enabled, they follow the same cloud backup as briefings.', 'Le rotte sono salvate sul dispositivo e incluse nel backup CoachBrief: con la sincronizzazione Firebase seguono lo stesso backup cloud dei briefing.', 'Las rutas se guardan en este dispositivo y en la copia de CoachBrief: con la sincronización Firebase siguen la misma copia en la nube que los briefings.'],
  'Sur le bateau ou au port, CoachBrief peut placer directement D à la position GPS du téléphone.': ['On board or in port, CoachBrief can place the start at your phone’s GPS position.', 'A bordo o in porto, CoachBrief può posizionare la partenza con il GPS del telefono.', 'A bordo o en puerto, CoachBrief puede situar la salida con el GPS del teléfono.'],
  'La recherche place automatiquement D ou A. Les coordonnées restent modifiables à la main, les marqueurs peuvent être déplacés sur la carte et les waypoints intermédiaires restent indépendants.': ['Search places the start or finish automatically. You can edit coordinates, drag map markers and adjust intermediate waypoints independently.', 'La ricerca posiziona automaticamente partenza o arrivo. Puoi modificare le coordinate, spostare i marcatori e regolare ogni waypoint.', 'La búsqueda coloca automáticamente la salida o la llegada. Puedes editar coordenadas, mover marcadores y ajustar cada waypoint.'],
  'La sélection est ajoutée automatiquement avant l’arrivée. Tu peux ensuite déplacer le waypoint sur la carte ou modifier ses coordonnées.': ['The selected waypoint is added before the finish. You can then drag it on the map or edit its coordinates.', 'Il waypoint selezionato viene aggiunto prima dell’arrivo. Puoi spostarlo sulla mappa o modificarne le coordinate.', 'El waypoint seleccionado se añade antes de la llegada. Puedes moverlo en el mapa o editar sus coordenadas.'],
  'CoachBrief place automatiquement le curseur': ['CoachBrief places marker', 'CoachBrief posiziona il marcatore', 'CoachBrief sitúa el marcador'],
  ', puis tu peux l’affiner directement sur la carte.': [', which you can adjust on the map.', ', che puoi regolare sulla mappa.', ', que puedes ajustar en el mapa.'],
  'CoachBrief échantillonne les conditions au milieu de chaque tronçon à son heure estimée de passage.': ['CoachBrief samples conditions at the midpoint of each leg at the estimated passage time.', 'CoachBrief campiona le condizioni a metà di ogni tratta all’ora di passaggio stimata.', 'CoachBrief toma las condiciones en el punto medio de cada tramo a la hora de paso estimada.'],
  'Compare Best Match, ECMWF, GFS, ICON et Météo-France pour mesurer la robustesse de la stratégie.': ['Compare Best Match, ECMWF, GFS, ICON and Météo-France to assess how robust the strategy is.', 'Confronta Best Match, ECMWF, GFS, ICON e Météo-France per valutare la solidità della strategia.', 'Compara Best Match, ECMWF, GFS, ICON y Météo-France para evaluar la solidez de la estrategia.'],
  'Utilise les atlas SHOM disponibles, les coefficients et les pleines mers des ports de référence.': ['Uses available SHOM atlases, tide coefficients and reference-port high waters.', 'Usa gli atlanti SHOM disponibili, i coefficienti e le alte maree dei porti di riferimento.', 'Usa los atlas SHOM disponibles, los coeficientes y las pleamares de los puertos de referencia.'],
  'Applique une perte de performance lorsque la mer ralentit le bateau sur la route calculée.': ['Accounts for performance loss when sea state slows the boat along the calculated route.', 'Considera la perdita di prestazioni quando il mare rallenta la barca lungo la rotta.', 'Tiene en cuenta la pérdida de rendimiento cuando el mar frena el barco en la ruta.'],
  'Écarte les branches traversant la terre, signale les TSS et respecte les waypoints imposés.': ['Rejects routes crossing land, flags traffic separation schemes and respects required waypoints.', 'Scarta le rotte che attraversano la terra, segnala gli schemi di separazione e rispetta i waypoint obbligati.', 'Descarta rutas que cruzan tierra, señala los dispositivos de separación y respeta los waypoints obligatorios.'],
  'Renseigne ou supprime chaque waypoint intermédiaire avant de calculer le routage. Aucun point imposé ne sera ignoré silencieusement.': ['Complete or remove each intermediate waypoint before routing. Required points are never silently ignored.', 'Completa o elimina ogni waypoint intermedio prima del routing. I punti obbligati non vengono ignorati.', 'Completa o elimina cada waypoint intermedio antes del cálculo. Ningún punto obligatorio se ignora.'],
  'Les données météo ou marines n’ont pas pu être récupérées. La géométrie de route reste disponible.': ['Weather or marine data could not be retrieved. Route geometry is still available.', 'Impossibile recuperare dati meteo o marini. La geometria della rotta rimane disponibile.', 'No se pudieron recuperar los datos meteorológicos o marinos. La geometría de la ruta sigue disponible.'],
  'Performance bateau': ['Boat performance', 'Prestazioni della barca', 'Rendimiento del barco'],
  'Polaires et vitesse cible': ['Polars and target speed', 'Polari e velocità obiettivo', 'Polares y velocidad objetivo'],
  'Polaire de démonstration': ['Demo polar', 'Polare dimostrativa', 'Polar de demostración'],
  'Polaire de démonstration active. Importe la polaire réelle du bateau pour fiabiliser le routage.': ['Demo polar active. Import your boat’s actual polar for reliable routing.', 'Polare dimostrativa attiva. Importa la polare reale della barca per un routing affidabile.', 'Polar de demostración activa. Importa la polar real del barco para un cálculo fiable.'],
  'Importer CSV / TXT': ['Import CSV / TXT', 'Importa CSV / TXT', 'Importar CSV / TXT'],
  'Format attendu : première colonne = TWA en degrés, première ligne = TWS en nœuds, cellules = vitesse bateau en nœuds. Séparateur « ; », virgule ou tabulation accepté.': ['Expected format: first column = TWA in degrees, first row = TWS in knots, cells = boat speed in knots. Semicolon, comma or tab separators accepted.', 'Formato: prima colonna = TWA in gradi, prima riga = TWS in nodi, celle = velocità in nodi. Separatore punto e virgola, virgola o tabulazione.', 'Formato: primera columna = TWA en grados, primera fila = TWS en nudos, celdas = velocidad en nudos. Separadores punto y coma, coma o tabulación.'],
  'Lance d’abord « Analyser la route » pour croiser la polaire avec le vent prévu sur chaque tronçon.': ['First run “Analyse route” to compare the polar with forecast wind on each leg.', 'Avvia prima « Analizza la rotta » per confrontare la polare con il vento previsto su ogni tratta.', 'Primero ejecuta « Analizar ruta » para cruzar la polar con el viento previsto en cada tramo.'],
  'Tronçons exploitables': ['Usable legs', 'Tratte utilizzabili', 'Tramos utilizables'],
  'Durée théorique polaire': ['Polar-based duration', 'Durata teorica della polare', 'Duración teórica de la polar'],
  'Vitesse cible': ['Target speed', 'Velocità obiettivo', 'Velocidad objetivo'],
  'Durée tronçon': ['Leg duration', 'Durata della tratta', 'Duración del tramo'],
  'Modèle météo': ['Weather model', 'Modello meteo', 'Modelo meteorológico'],
  'Vent utilisé :': ['Wind source:', 'Fonte del vento:', 'Fuente del viento:'],
  '. Mer et houle restent issues d’Open-Meteo Marine ; le courant SHOM reste prioritaire quand il est disponible.': ['. Sea and swell come from Open-Meteo Marine; SHOM current has priority when available.', '. Mare e onda provengono da Open-Meteo Marine; la corrente SHOM ha priorità se disponibile.', '. Mar y oleaje proceden de Open-Meteo Marine; la corriente SHOM tiene prioridad cuando está disponible.'],
  'Comparer les modèles météo': ['Compare weather models', 'Confronta i modelli meteo', 'Comparar modelos meteorológicos'],
  'CoachBrief refait un routage allégé avec Best Match, ECMWF, GFS, ICON et Météo-France. Le but est de vérifier si la stratégie reste proche malgré l’incertitude météo.': ['CoachBrief runs a lighter route calculation with Best Match, ECMWF, GFS, ICON and Météo-France to check whether the strategy stays similar despite forecast uncertainty.', 'CoachBrief ricalcola una rotta semplificata con Best Match, ECMWF, GFS, ICON e Météo-France per vedere se la strategia resta simile.', 'CoachBrief recalcula una ruta simplificada con Best Match, ECMWF, GFS, ICON y Météo-France para comprobar si la estrategia se mantiene.'],
  'Comparer les 5 modèles': ['Compare 5 models', 'Confronta 5 modelli', 'Comparar 5 modelos'],
  'Comparaison en cours…': ['Comparing…', 'Confronto in corso…', 'Comparando…'],
  'Relancer la comparaison': ['Compare again', 'Ripeti il confronto', 'Comparar de nuevo'],
  'Exemple ci-dessous — ces horaires ne sont pas utilisés tant que le champ reste vide.': ['Example below — these times are not used while the field is empty.', 'Esempio sotto: questi orari non vengono usati finché il campo è vuoto.', 'Ejemplo abajo: estos horarios no se usan mientras el campo esté vacío.'],
  'modèle sélectionné': ['selected model', 'modello selezionato', 'modelo seleccionado'],
  'hors horizon': ['outside horizon', 'fuori orizzonte', 'fuera del horizonte'],
  'Distance route': ['Route distance', 'Distanza della rotta', 'Distancia de la ruta'],
  'Durée calculée': ['Calculated duration', 'Durata calcolata', 'Duración calculada'],
  'Écart moyen de route': ['Average route separation', 'Scarto medio delle rotte', 'Separación media de rutas'],
  'Choisir ce modèle': ['Choose this model', 'Scegli questo modello', 'Elegir este modelo'],
  'Accord fort entre les modèles': ['Strong agreement between models', 'Forte accordo tra i modelli', 'Acuerdo sólido entre modelos'],
  'Accord moyen entre les modèles': ['Moderate agreement between models', 'Accordo moderato tra i modelli', 'Acuerdo moderado entre modelos'],
  'Divergence notable entre les modèles': ['Significant divergence between models', 'Divergenza significativa tra i modelli', 'Divergencia notable entre modelos'],
  'Le modèle trouve une arrivée dans l’horizon demandé.': ['The model reaches the finish within the requested horizon.', 'Il modello raggiunge l’arrivo entro l’orizzonte richiesto.', 'El modelo alcanza la llegada dentro del horizonte solicitado.'],
  'Le moteur n’atteint pas l’arrivée dans l’horizon avec ce modèle.': ['This model does not reach the finish within the horizon.', 'Questo modello non raggiunge l’arrivo entro l’orizzonte.', 'Este modelo no alcanza la llegada dentro del horizonte.'],
  'Ce modèle n’a pas fourni assez de données pour ce routage.': ['This model did not provide enough data for routing.', 'Questo modello non ha fornito dati sufficienti per il routing.', 'Este modelo no aportó suficientes datos para el cálculo.'],
  'Le routage n’a pas pu être calculé avec les données disponibles.': ['Routing could not be calculated with the available data.', 'Impossibile calcolare la rotta con i dati disponibili.', 'No se pudo calcular la ruta con los datos disponibles.'],
  'Waypoints de navigation': ['Navigation waypoints', 'Waypoint di navigazione', 'Waypoints de navegación'],
  'Exporter GPX': ['Export GPX', 'Esporta GPX', 'Exportar GPX'],
  'Changement de cap': ['Course change', 'Cambio di rotta', 'Cambio de rumbo'],
  'Point intermédiaire': ['Intermediate point', 'Punto intermedio', 'Punto intermedio'],
  'Cap à suivre': ['Heading to follow', 'Rotta da seguire', 'Rumbo a seguir'],
  'Distance depuis le point précédent': ['Distance from previous point', 'Distanza dal punto precedente', 'Distancia desde el punto anterior'],
  'Distance cumulée': ['Cumulative distance', 'Distanza cumulata', 'Distancia acumulada'],
  'Passage prévu': ['Expected passage', 'Passaggio previsto', 'Paso previsto'],
  'Modèle vent': ['Wind model', 'Modello vento', 'Modelo de viento'],
  'aucun': ['none', 'nessuno', 'ninguno'],
  'Effet moyen du courant sur la vitesse sol': ['Average current effect on speed over ground', 'Effetto medio della corrente sulla velocità sul fondo', 'Efecto medio de la corriente en la velocidad sobre el fondo'],
  'Perte moyenne liée à la mer': ['Average sea-state penalty', 'Perdita media dovuta al mare', 'Pérdida media por el estado del mar'],
  'Les modèles sont calculés l’un après l’autre pour éviter les conflits de source météo. Sur mobile, la comparaison complète peut prendre environ 30 à 45 s.': ['Models are calculated one at a time to avoid weather-source conflicts. On mobile, the full comparison can take about 30–45 seconds.', 'I modelli sono calcolati uno alla volta per evitare conflitti tra fonti meteo. Su telefono il confronto può durare 30–45 secondi.', 'Los modelos se calculan uno por uno para evitar conflictos entre fuentes. En móvil, la comparación puede tardar 30–45 segundos.'],
  'Aucun des modèles n’a pu produire un routage exploitable avec ces paramètres.': ['No model could produce a usable route with these settings.', 'Nessun modello ha prodotto una rotta utilizzabile con questi parametri.', 'Ningún modelo ha producido una ruta utilizable con estos ajustes.'],
  'Un accord fort indique que plusieurs modèles conduisent à une stratégie proche ; une divergence notable invite à considérer plusieurs scénarios plutôt qu’une route unique.': ['Strong agreement means several models suggest a similar strategy; divergence calls for considering several scenarios.', 'Un forte accordo indica una strategia simile tra i modelli; una divergenza invita a considerare più scenari.', 'Un acuerdo sólido indica estrategias similares; una divergencia invita a considerar varios escenarios.'],
  'À chaque pas, CoachBrief recalcule vent, courant et mer, applique la polaire puis élimine les branches qui coupent une côte détectée. Quand plusieurs pleines mers sont saisies pour Roscoff, Cherbourg ou Saint-Malo, le moteur utilise automatiquement la référence du bon atlas et la PM la plus proche dans le temps. La PM générique ne sert plus que de secours.': ['At each step CoachBrief recalculates wind, current and sea, applies the polar and rejects branches crossing detected land. With port high waters for Roscoff, Cherbourg or Saint-Malo, it uses the appropriate atlas and nearest time. The generic high water is only a fallback.', 'A ogni passo CoachBrief ricalcola vento, corrente e mare, applica la polare e scarta i percorsi che attraversano la costa. Usa l’atlante e l’alta marea del porto pertinenti; l’alta marea generica è solo di riserva.', 'En cada paso CoachBrief recalcula viento, corriente y mar, aplica la polar y descarta rutas que cruzan tierra. Usa el atlas y la pleamar del puerto adecuados; la pleamar genérica solo sirve de respaldo.'],
  'Les PM saisies par port sont prioritaires et évitent de propager artificiellement un même horaire entre Roscoff, Cherbourg et Saint-Malo. Lorsqu’aucune PM locale n’est fournie pour un atlas, le moteur garde le secours semi-diurne d’environ 12 h 25 à partir de la PM générique. Sans tuile SHOM locale, il revient automatiquement au courant Open-Meteo.': ['Port high waters take priority, avoiding an artificial shared time across Roscoff, Cherbourg and Saint-Malo. Without local times, the engine uses a roughly 12 h 25 semidiurnal fallback from the generic high water. Without a local SHOM tile it falls back to Open-Meteo current.', 'Le alte maree per porto hanno priorità. Senza orari locali, il motore usa il ciclo semidiurno di circa 12 h 25 dalla marea generica. Senza dati SHOM locali usa la corrente Open-Meteo.', 'Las pleamares por puerto tienen prioridad. Sin horarios locales, se usa un ciclo semidiurno de unas 12 h 25 desde la pleamar genérica. Sin datos SHOM locales se usa la corriente Open-Meteo.'],
  'Points pratiques à viser pour suivre la route météo retenue. Un WP est créé à chaque changement de cap important ou au plus tard tous les 10 nm.': ['Practical points for following the selected weather route. A waypoint is created at each major course change or at most every 10 nm.', 'Punti pratici per seguire la rotta scelta. Un waypoint viene creato a ogni cambio di rotta importante o almeno ogni 10 nm.', 'Puntos prácticos para seguir la ruta elegida. Se crea un waypoint en cada cambio importante de rumbo o como máximo cada 10 nm.'],
  'Ces waypoints sont liés à ce calcul météo. Relance le routage si l’heure de départ, le modèle météo, la polaire ou les conditions de courant changent.': ['These waypoints belong to this weather calculation. Recalculate if the start time, weather model, polar or current changes.', 'Questi waypoint appartengono al calcolo meteo. Ricalcola se cambiano partenza, modello, polare o corrente.', 'Estos waypoints pertenecen al cálculo meteorológico. Recalcula si cambian la salida, el modelo, la polar o la corriente.'],
  'Échantillons de la route retenue : ils montrent les conditions réellement utilisées par le moteur, pas une simple ligne géométrique.': ['Samples along the selected route show the conditions actually used by the engine.', 'I campioni della rotta scelta mostrano le condizioni effettivamente usate dal motore.', 'Las muestras de la ruta elegida muestran las condiciones utilizadas por el motor.'],
  'Ce diagnostic explique pourquoi le moteur a retenu ces caps. Il ne prouve pas à lui seul qu’une route plus côtière serait plus lente : pour cela, il faudra comparer explicitement une seconde route candidate avec les mêmes conditions météo.': ['This explains why these headings were selected. It does not prove a more coastal route would be slower; compare another candidate under the same weather conditions.', 'Spiega perché sono state scelte queste rotte. Non dimostra che una rotta più costiera sia più lenta: confronta una seconda rotta con lo stesso meteo.', 'Explica por qué se eligieron estos rumbos. No demuestra que una ruta más costera sea más lenta: compara otra ruta con la misma meteorología.'],
  'Calcul adaptatif, limité à environ 25 s pour éviter un blocage prolongé sur mobile.': ['Adaptive calculation, limited to about 25 seconds to avoid long stalls on mobile.', 'Calcolo adattivo limitato a circa 25 secondi per evitare blocchi sul telefono.', 'Cálculo adaptativo limitado a unos 25 segundos para evitar bloqueos en móvil.'],
}

for (const [source, [en, it, es]] of Object.entries(additionalTranslations)) {
  translations.en[source] = en
  translations.it[source] = it
  translations.es[source] = es
}

const originalText = new WeakMap<Text, string>()
const lastRenderedText = new WeakMap<Text, string>()
const originalAttributes = new WeakMap<Element, Record<string, string>>()
const lastRenderedAttributes = new WeakMap<Element, Record<string, string>>()

function translateDynamic(value: string, language: OffshoreLanguage): string {
  const dictionary = translations[language]
  if (dictionary[value]) return dictionary[value]
  if (value.startsWith('Temps théorique à ')) {
    if (language === 'en') return value.replace('Temps théorique à ', 'Theoretical time at ').replace(' · hors contraintes de navigation', ' · excluding navigation constraints')
    if (language === 'it') return value.replace('Temps théorique à ', 'Tempo teorico a ').replace(' · hors contraintes de navigation', ' · senza vincoli di navigazione')
    return value.replace('Temps théorique à ', 'Tiempo teórico a ').replace(' · hors contraintes de navigation', ' · sin restricciones de navegación')
  }
  if (value.startsWith('Type de recherche pour ')) {
    const label = value.slice('Type de recherche pour '.length)
    return language === 'en' ? `Search type for ${translateDynamic(label, language)}` : language === 'it' ? `Tipo di ricerca per ${translateDynamic(label, language)}` : `Tipo de búsqueda para ${translateDynamic(label, language)}`
  }
  if (/^(Déplacer|Monter|Descendre|Supprimer) .+/.test(value)) {
    const match = value.match(/^(Déplacer|Monter|Descendre|Supprimer) (.+)$/)
    if (match) {
      const verbs = { en: ['Move', 'Move up', 'Move down', 'Delete'], it: ['Sposta', 'Sposta su', 'Sposta giù', 'Elimina'], es: ['Mover', 'Subir', 'Bajar', 'Eliminar'] }
      const index = ['Déplacer', 'Monter', 'Descendre', 'Supprimer'].indexOf(match[1])
      return `${verbs[language][index]} ${match[2]}`
    }
  }
  if (value.startsWith('Durée : ')) {
    if (language === 'en') return value.replace('Durée : ', 'Duration: ').replace(' · ETA : ', ' · ETA: ').replace(' · écart vs directe : ', ' · difference vs direct: ')
    if (language === 'it') return value.replace('Durée : ', 'Durata: ').replace(' · ETA : ', ' · ETA: ').replace(' · écart vs directe : ', ' · scarto vs diretta: ')
    return value.replace('Durée : ', 'Duración: ').replace(' · ETA : ', ' · ETA: ').replace(' · écart vs directe : ', ' · diferencia vs directa: ')
  }
  if (value.startsWith('Petit trajet côtier · ') || value.startsWith('Trajet côtier court · ') || value.startsWith('Trajet intermédiaire · ') || value.startsWith('Route au large · ') || value.startsWith('Réglage standard · ')) {
    const presets = {
      en: ['Short coastal trip', 'Coastal trip', 'Intermediate trip', 'Offshore route', 'Standard settings', 'automatic settings', 'You can adjust them manually.'],
      it: ['Breve tratta costiera', 'Tratta costiera', 'Tratta intermedia', 'Rotta d’altura', 'Impostazioni standard', 'impostazioni automatiche', 'Puoi modificarle manualmente.'],
      es: ['Trayecto costero corto', 'Trayecto costero', 'Trayecto intermedio', 'Ruta de altura', 'Ajustes estándar', 'ajustes automáticos', 'Puedes modificarlos manualmente.'],
    }[language]
    return value.replace(/^(Petit trajet côtier|Trajet côtier court|Trajet intermédiaire|Route au large|Réglage standard)/, (match) => presets[['Petit trajet côtier', 'Trajet côtier court', 'Trajet intermédiaire', 'Route au large', 'Réglage standard'].indexOf(match)])
      .replace('réglage automatique', presets[5]).replace('Tu peux le modifier manuellement.', presets[6])
  }
  if (/^\d+ modèles exploitables$/.test(value)) {
    const count = value.match(/^\d+/)?.[0] ?? ''
    return language === 'en' ? `${count} usable models` : language === 'it' ? `${count} modelli utilizzabili` : `${count} modelos utilizables`
  }
  if (value.startsWith(' · écart de route max moyen ')) {
    return value.replace('écart de route max moyen', language === 'en' ? 'maximum average route separation' : language === 'it' ? 'massimo scarto medio delle rotte' : 'máxima separación media de rutas')
  }
  if (/^\d+ tronçons?$/.test(value)) {
    const count = value.match(/^\d+/)?.[0] ?? ''
    return language === 'en' ? `${count} legs` : language === 'it' ? `${count} tratte` : `${count} tramos`
  }
  if (/^\d+ PM valides?$/.test(value)) {
    const count = value.match(/^\d+/)?.[0] ?? ''
    return language === 'en' ? `${count} valid high waters` : language === 'it' ? `${count} alte maree valide` : `${count} pleamares válidas`
  }
  return value
}

function translated(value: string, language: Language) {
  return language === 'fr' ? value : translateDynamic(value, language)
}

function translateTextNode(node: Text, language: Language) {
  const current = node.nodeValue ?? ''
  if (!current.trim()) return
  const previousRendered = lastRenderedText.get(node)
  let original = originalText.get(node)
  if (original == null || (previousRendered != null && current !== previousRendered)) {
    original = current
    originalText.set(node, original)
  }
  const leading = original.match(/^\s*/)?.[0] ?? ''
  const trailing = original.match(/\s*$/)?.[0] ?? ''
  const next = `${leading}${translated(original.trim(), language)}${trailing}`
  if (node.nodeValue !== next) node.nodeValue = next
  lastRenderedText.set(node, next)
}

function translateAttributes(element: Element, language: Language) {
  const attributes = ['placeholder', 'title', 'aria-label']
  let originals = originalAttributes.get(element)
  if (!originals) {
    originals = {}
    originalAttributes.set(element, originals)
  }
  let rendered = lastRenderedAttributes.get(element)
  if (!rendered) {
    rendered = {}
    lastRenderedAttributes.set(element, rendered)
  }
  for (const attribute of attributes) {
    const current = element.getAttribute(attribute)
    if (!current) continue
    if (!(attribute in originals) || (attribute in rendered && current !== rendered[attribute])) originals[attribute] = current
    const next = translated(originals[attribute], language)
    if (current !== next) element.setAttribute(attribute, next)
    rendered[attribute] = next
  }
}

function translateTree(root: Element, language: Language) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node) {
    translateTextNode(node as Text, language)
    node = walker.nextNode()
  }
  translateAttributes(root, language)
  root.querySelectorAll('*').forEach((element) => translateAttributes(element, language))
}

export function OffshoreLanguageBridge() {
  const { language } = usePreferences()
  const location = useLocation()

  useEffect(() => {
    if (location.pathname !== '/large') return
    const translate = () => {
      const root = document.querySelector('.offshore-page')
      if (root) translateTree(root, language)
    }
    translate()
    const observer = new MutationObserver(() => queueMicrotask(translate))
    observer.observe(document.body, {
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['placeholder', 'title', 'aria-label'],
      subtree: true,
    })
    return () => observer.disconnect()
  }, [language, location.pathname])

  return null
}
