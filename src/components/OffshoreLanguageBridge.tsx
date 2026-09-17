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
    'Routage météo': 'Routing meteorológico', 'Isochrones': 'Isócronas', 'Pas de temps': 'Paso de tiempo', 'Horizon': 'Orizzonte', 'Coefficient marée': 'Coeficiente de marea',
    'PM générique de secours': 'Pleamar genérica de respaldo', 'Calculer le routage': 'Calcular el routing', 'Calcul des isochrones…': 'Calculando isócronas…',
    'Pleines mers par port de référence SHOM': 'Pleamares por puerto SHOM de referencia', 'Aucune PM saisie': 'No se ha introducido ninguna pleamar',
    'Pourquoi cette route météo ?': '¿Por qué esta ruta meteorológica?', 'Cap': 'Rumbo', 'Vent': 'Viento', 'Polaire': 'Polar', 'Après mer': 'Tras penalización por mar', 'Vitesse sol': 'Velocidad sobre el fondo', 'Courant': 'Corriente',
    'Route retenue': 'Ruta seleccionada', 'Coupures de terre écartées': 'Cruces de tierra descartados', 'Options coupant un TSS': 'Opciones que cruzan un TSS', 'Échantillons courant SHOM': 'Muestras de corriente SHOM',
    'Aucun routage maritime valide trouvé avec ces paramètres. La ligne en pointillés représente uniquement la distance géométrique directe entre D et A ; elle n’est pas une route navigable.': 'No se encontró un routing marítimo válido encontrado con estos parámetros. La línea discontinua representa únicamente la distancia geométrica directa entre D y A; no es una ruta navegable.',
  },
}

const originalText = new WeakMap<Text, string>()
const lastRenderedText = new WeakMap<Text, string>()
const originalAttributes = new WeakMap<Element, Record<string, string>>()
const lastRenderedAttributes = new WeakMap<Element, Record<string, string>>()

function translateDynamic(value: string, language: OffshoreLanguage) {
  const dictionary = translations[language]
  if (dictionary[value]) return dictionary[value]
  if (value.startsWith('Temps théorique à ')) {
    if (language === 'en') return value.replace('Temps théorique à ', 'Theoretical time at ').replace(' · hors contraintes de navigation', ' · excluding navigation constraints')
    if (language === 'it') return value.replace('Temps théorique à ', 'Tempo teorico a ').replace(' · hors contraintes de navigation', ' · senza vincoli di navigazione')
    return value.replace('Temps théorique à ', 'Tiempo teórico a ').replace(' · hors contraintes de navigation', ' · sin restricciones de navegación')
  }
  if (value.startsWith('Durée : ')) {
    if (language === 'en') return value.replace('Durée : ', 'Duration: ').replace(' · ETA : ', ' · ETA: ').replace(' · écart vs directe : ', ' · difference vs direct: ')
    if (language === 'it') return value.replace('Durée : ', 'Durata: ').replace(' · ETA : ', ' · ETA: ').replace(' · écart vs directe : ', ' · scarto vs diretta: ')
    return value.replace('Durée : ', 'Duración: ').replace(' · ETA : ', ' · ETA: ').replace(' · écart vs directe : ', ' · diferencia vs directa: ')
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
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [language, location.pathname])

  return null
}
