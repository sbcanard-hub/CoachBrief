import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { usePreferences, type Language } from '../preferences'
import './legal.css'

type LegalDocument = 'legal' | 'privacy' | 'terms'
type Section = { title: string; paragraphs?: string[]; bullets?: string[] }
type LegalCopy = {
  back: string
  updated: string
  documents: Record<LegalDocument, { title: string; introduction: string; sections: Section[] }>
}

const common = {
  editor: 'Sébastien Canard',
  address: '250 boulevard des Horizons, 06220 Vallauris, France',
  email: 'sbcanard@free.fr',
  host: 'GitHub, Inc., 88 Colin P Kelly Jr Street, San Francisco, CA 94107, United States',
}

const copies: Record<Language, LegalCopy> = {
  fr: {
    back: 'Retour à l’accueil', updated: 'Dernière mise à jour : 14 septembre 2026',
    documents: {
      legal: {
        title: 'Mentions légales', introduction: 'Informations relatives à l’édition et à l’hébergement de CoachBrief.',
        sections: [
          { title: 'Éditeur et directeur de la publication', paragraphs: [`CoachBrief est actuellement édité à titre personnel et non commercial par ${common.editor}.`, `Adresse : ${common.address}`, `Contact : ${common.email}`] },
          { title: 'Hébergement', paragraphs: [`Le site est hébergé par ${common.host}.`, 'Le stockage facultatif des comptes et sauvegardes privées repose sur les services Google Firebase Authentication et Cloud Firestore.'] },
          { title: 'Propriété intellectuelle', paragraphs: ['La structure, les textes, les analyses, l’identité visuelle et les développements propres à CoachBrief sont protégés par le droit de la propriété intellectuelle. Sauf mention ou licence contraire, toute reproduction, adaptation ou diffusion au-delà de l’usage privé nécessite l’autorisation préalable de l’éditeur.', 'Les logiciels, cartes, polices, données météorologiques et autres contenus tiers restent soumis aux droits et licences de leurs fournisseurs respectifs.'] },
          { title: 'Contact', paragraphs: [`Toute question ou demande peut être adressée à ${common.email}.`] },
        ],
      },
      privacy: {
        title: 'Politique de confidentialité', introduction: 'Cette page explique quelles données CoachBrief utilise, pourquoi et comment exercer vos droits.',
        sections: [
          { title: 'Responsable du traitement', paragraphs: [`Le responsable du traitement est ${common.editor}, ${common.address}. Contact : ${common.email}.`] },
          { title: 'Données utilisées', bullets: ['préférences de langue et d’unités enregistrées dans le navigateur ;', 'briefings, observations, débriefings et séances d’entraînement saisis par l’utilisateur ;', 'profils nominatifs des coureurs, auto-évaluations, analyses de navigation et commentaires du coach ;', 'adresse e-mail, identifiant technique et jetons de session lors de la connexion Firebase ;', 'positions GPS du coach, événements géolocalisés et traces GPX importées, uniquement lorsque l’utilisateur active ou fournit ces données.'] },
          { title: 'Finalités et fonctionnement', paragraphs: ['Ces données servent à faire fonctionner l’application, produire les analyses demandées, enregistrer les contenus sur l’appareil et, lorsque l’utilisateur le choisit, synchroniser une sauvegarde privée entre ses appareils.', 'L’accès GPS dépend de l’autorisation donnée au navigateur. Le mode ponctuel ne relève la position qu’au moment demandé ; les modes continu et intelligent enregistrent une trace pendant la séance.'] },
          { title: 'Stockage, destinataires et services externes', paragraphs: ['Par défaut, les données CoachBrief restent dans le stockage local du navigateur. Lorsque la synchronisation cloud est utilisée, l’adresse de compte et la sauvegarde privée sont traitées par Google Firebase. CoachBrief ne vend pas les données personnelles.', 'GitHub Pages assure l’hébergement. Open-Meteo, OpenStreetMap/Overpass, AviationWeather, Google Fonts et les réseaux de diffusion nécessaires à Leaflet peuvent recevoir des informations techniques de connexion ainsi que les lieux ou coordonnées nécessaires à la requête. Leurs propres politiques s’appliquent.'] },
          { title: 'Durée de conservation', paragraphs: ['Les données locales sont conservées jusqu’à leur suppression dans CoachBrief ou l’effacement des données du navigateur. Les sauvegardes cloud sont conservées jusqu’à leur remplacement, leur suppression ou une demande d’effacement adressée à l’éditeur.'] },
          { title: 'Vos droits', paragraphs: [`Vous pouvez demander l’accès, la rectification, l’effacement, la limitation ou l’opposition lorsque ces droits s’appliquent en écrivant à ${common.email}. Vous pouvez également introduire une réclamation auprès de la CNIL (cnil.fr).`] },
          { title: 'Cookies et stockage local', paragraphs: ['CoachBrief n’utilise pas de cookie publicitaire. Il utilise le stockage local et des éléments techniques nécessaires aux préférences, à l’authentification et aux sauvegardes. Des fournisseurs externes peuvent conserver leurs propres journaux techniques.'] },
        ],
      },
      terms: {
        title: 'Conditions d’utilisation', introduction: 'CoachBrief est actuellement proposé gratuitement à titre personnel comme outil d’aide au briefing et à l’analyse.',
        sections: [
          { title: 'Aide à la décision uniquement', paragraphs: ['Les prévisions, cartes, calculs et recommandations sont indicatifs. Ils ne remplacent pas les bulletins officiels, les avis de sécurité, l’observation sur l’eau, les règles de course, la veille VHF ni le jugement du responsable de navigation. Chaque utilisateur reste responsable de ses décisions et de la sécurité de son équipage.'] },
          { title: 'Données saisies et traces de tiers', paragraphs: ['L’utilisateur demeure responsable de l’exactitude et de la licéité des informations importées ou saisies. Avant d’enregistrer, importer ou partager la position d’un bateau ou d’une personne — notamment d’un mineur — il lui appartient d’obtenir les autorisations nécessaires et d’informer les personnes concernées.'] },
          { title: 'Disponibilité', paragraphs: ['Le service peut évoluer, être interrompu ou contenir des erreurs. Les données de tiers et les services réseau peuvent être retardés, indisponibles ou inexacts. Il est recommandé de conserver une sauvegarde des informations importantes.'] },
          { title: 'Usage et propriété intellectuelle', paragraphs: ['L’usage personnel normal de CoachBrief est autorisé. L’extraction, la copie substantielle, la revente ou la réutilisation du service et de ses contenus propres sans autorisation sont interdites, sous réserve des licences applicables aux composants tiers.'] },
          { title: 'Évolution commerciale', paragraphs: ['Avant toute mise en vente ou souscription payante, ces conditions seront remplacées ou complétées par des conditions contractuelles et commerciales précisant notamment le prix, le paiement, la durée, la résiliation, la rétractation et la médiation.'] },
        ],
      },
    },
  },
  en: {
    back: 'Back to home', updated: 'Last updated: 14 September 2026',
    documents: {
      legal: { title: 'Legal notice', introduction: 'Information about the publishing and hosting of CoachBrief.', sections: [
        { title: 'Publisher and publication director', paragraphs: [`CoachBrief is currently published on a personal, non-commercial basis by ${common.editor}.`, `Address: ${common.address}`, `Contact: ${common.email}`] },
        { title: 'Hosting', paragraphs: [`The website is hosted by ${common.host}.`, 'Optional account and private-backup storage uses Google Firebase Authentication and Cloud Firestore.'] },
        { title: 'Intellectual property', paragraphs: ['CoachBrief’s structure, texts, analyses, visual identity and original developments are protected by intellectual-property law. Unless otherwise stated or licensed, reproduction, adaptation or distribution beyond private use requires prior permission from the publisher.', 'Third-party software, maps, fonts, weather data and other content remain subject to their providers’ rights and licences.'] },
        { title: 'Contact', paragraphs: [`Questions and requests may be sent to ${common.email}.`] },
      ] },
      privacy: { title: 'Privacy policy', introduction: 'This page explains which data CoachBrief uses, why it is used and how to exercise your rights.', sections: [
        { title: 'Controller', paragraphs: [`The data controller is ${common.editor}, ${common.address}. Contact: ${common.email}.`] },
        { title: 'Data used', bullets: ['language and unit preferences stored in the browser;', 'briefings, observations, debriefs and training sessions entered by the user;', 'named sailor profiles, self-assessments, sailing analyses and coach comments;', 'email address, technical identifier and session tokens when signing in through Firebase;', 'coach GPS positions, geolocated events and imported GPX tracks, only when the user enables or supplies this data.'] },
        { title: 'Purposes and operation', paragraphs: ['Data is used to operate the application, produce requested analyses, save content on the device and, when selected by the user, synchronise a private backup between devices.', 'GPS access requires browser permission. Point mode reads the position only when requested; continuous and smart modes record a track during the session.'] },
        { title: 'Storage, recipients and external services', paragraphs: ['By default, CoachBrief data remains in the browser’s local storage. When cloud synchronisation is used, the account email and private backup are processed by Google Firebase. CoachBrief does not sell personal data.', 'Hosting is provided by GitHub Pages. Open-Meteo, OpenStreetMap/Overpass, AviationWeather, Google Fonts and the delivery networks required by Leaflet may receive connection data and the places or coordinates needed for a request. Their own policies apply.'] },
        { title: 'Retention', paragraphs: ['Local data remains until it is deleted in CoachBrief or the browser data is cleared. Cloud backups remain until replacement, deletion or an erasure request sent to the publisher.'] },
        { title: 'Your rights', paragraphs: [`You may request access, correction, erasure, restriction or objection where applicable by writing to ${common.email}. You may also lodge a complaint with the French data-protection authority, CNIL (cnil.fr).`] },
        { title: 'Cookies and local storage', paragraphs: ['CoachBrief does not use advertising cookies. It uses local storage and technical items required for preferences, authentication and backups. External providers may retain their own technical logs.'] },
      ] },
      terms: { title: 'Terms of use', introduction: 'CoachBrief is currently provided free of charge on a personal basis as a briefing and analysis aid.', sections: [
        { title: 'Decision aid only', paragraphs: ['Forecasts, maps, calculations and recommendations are indicative. They do not replace official bulletins, safety notices, on-water observation, racing rules, VHF watch or the judgement of the person responsible for navigation. Each user remains responsible for decisions and crew safety.'] },
        { title: 'Entered data and third-party tracks', paragraphs: ['Users are responsible for the accuracy and lawful use of imported or entered information. Before recording, importing or sharing the location of a boat or person—especially a minor—they must obtain the necessary permission and inform the people concerned.'] },
        { title: 'Availability', paragraphs: ['The service may change, be interrupted or contain errors. Third-party data and network services may be delayed, unavailable or inaccurate. Users should keep a backup of important information.'] },
        { title: 'Use and intellectual property', paragraphs: ['Normal personal use is permitted. Substantial extraction, copying, resale or reuse of the service and its original content without permission is prohibited, subject to licences covering third-party components.'] },
        { title: 'Future commercial service', paragraphs: ['Before any sale or paid subscription, these terms will be replaced or supplemented by contractual and commercial terms covering price, payment, duration, cancellation, withdrawal rights and mediation.'] },
      ] },
    },
  },
  it: {
    back: 'Torna alla pagina iniziale', updated: 'Ultimo aggiornamento: 14 settembre 2026',
    documents: {
      legal: { title: 'Note legali', introduction: 'Informazioni sulla pubblicazione e sull’hosting di CoachBrief.', sections: [
        { title: 'Editore e direttore della pubblicazione', paragraphs: [`CoachBrief è attualmente pubblicato a titolo personale e non commerciale da ${common.editor}.`, `Indirizzo: ${common.address}`, `Contatto: ${common.email}`] },
        { title: 'Hosting', paragraphs: [`Il sito è ospitato da ${common.host}.`, 'La gestione facoltativa degli account e dei backup privati utilizza Google Firebase Authentication e Cloud Firestore.'] },
        { title: 'Proprietà intellettuale', paragraphs: ['La struttura, i testi, le analisi, l’identità visiva e gli sviluppi originali di CoachBrief sono protetti dalla normativa sulla proprietà intellettuale. Salvo diversa indicazione o licenza, riproduzione, adattamento o diffusione oltre l’uso privato richiedono l’autorizzazione preventiva dell’editore.', 'Software, mappe, caratteri, dati meteo e altri contenuti di terzi restano soggetti ai diritti e alle licenze dei rispettivi fornitori.'] },
        { title: 'Contatto', paragraphs: [`Domande e richieste possono essere inviate a ${common.email}.`] },
      ] },
      privacy: { title: 'Informativa sulla privacy', introduction: 'Questa pagina spiega quali dati utilizza CoachBrief, perché e come esercitare i propri diritti.', sections: [
        { title: 'Titolare del trattamento', paragraphs: [`Il titolare del trattamento è ${common.editor}, ${common.address}. Contatto: ${common.email}.`] },
        { title: 'Dati utilizzati', bullets: ['preferenze di lingua e unità memorizzate nel browser;', 'briefing, osservazioni, debrief e sessioni di allenamento inseriti dall’utente;', 'profili nominativi dei velisti, autovalutazioni, analisi di navigazione e commenti del coach;', 'indirizzo e-mail, identificativo tecnico e token di sessione durante l’accesso Firebase;', 'posizioni GPS del coach, eventi geolocalizzati e tracce GPX importate, solo quando l’utente attiva o fornisce questi dati.'] },
        { title: 'Finalità e funzionamento', paragraphs: ['I dati servono al funzionamento dell’applicazione, alle analisi richieste, al salvataggio sul dispositivo e, se scelto dall’utente, alla sincronizzazione di un backup privato tra dispositivi.', 'L’accesso GPS richiede il permesso del browser. La modalità puntuale rileva la posizione solo su richiesta; le modalità continua e intelligente registrano una traccia durante la sessione.'] },
        { title: 'Archiviazione, destinatari e servizi esterni', paragraphs: ['Per impostazione predefinita i dati restano nella memoria locale del browser. Con la sincronizzazione cloud, e-mail e backup privato sono trattati da Google Firebase. CoachBrief non vende dati personali.', 'GitHub Pages ospita il sito. Open-Meteo, OpenStreetMap/Overpass, AviationWeather, Google Fonts e le reti necessarie a Leaflet possono ricevere dati tecnici di connessione e luoghi o coordinate necessari alla richiesta. Si applicano le loro politiche.'] },
        { title: 'Conservazione', paragraphs: ['I dati locali restano fino alla cancellazione in CoachBrief o nel browser. I backup cloud restano fino a sostituzione, cancellazione o richiesta di eliminazione all’editore.'] },
        { title: 'Diritti', paragraphs: [`È possibile richiedere accesso, rettifica, cancellazione, limitazione o opposizione, quando applicabili, scrivendo a ${common.email}. È inoltre possibile presentare reclamo alla CNIL (cnil.fr).`] },
        { title: 'Cookie e memoria locale', paragraphs: ['CoachBrief non usa cookie pubblicitari. Utilizza memoria locale ed elementi tecnici necessari a preferenze, autenticazione e backup. I fornitori esterni possono conservare propri log tecnici.'] },
      ] },
      terms: { title: 'Condizioni d’uso', introduction: 'CoachBrief è attualmente offerto gratuitamente a titolo personale come ausilio al briefing e all’analisi.', sections: [
        { title: 'Solo ausilio decisionale', paragraphs: ['Previsioni, mappe, calcoli e raccomandazioni sono indicativi. Non sostituiscono bollettini ufficiali, avvisi di sicurezza, osservazione in acqua, regole di regata, ascolto VHF o giudizio del responsabile della navigazione. Ogni utente resta responsabile delle decisioni e della sicurezza dell’equipaggio.'] },
        { title: 'Dati inseriti e tracce di terzi', paragraphs: ['L’utente è responsabile dell’esattezza e della liceità delle informazioni importate o inserite. Prima di registrare, importare o condividere la posizione di una barca o persona, in particolare di un minore, deve ottenere le autorizzazioni necessarie e informare gli interessati.'] },
        { title: 'Disponibilità', paragraphs: ['Il servizio può evolvere, interrompersi o contenere errori. Dati di terzi e servizi di rete possono essere tardivi, indisponibili o inesatti. Si consiglia di conservare un backup delle informazioni importanti.'] },
        { title: 'Uso e proprietà intellettuale', paragraphs: ['È consentito il normale uso personale. Estrazione, copia sostanziale, rivendita o riutilizzo del servizio e dei contenuti originali senza autorizzazione sono vietati, fatte salve le licenze dei componenti di terzi.'] },
        { title: 'Futura offerta commerciale', paragraphs: ['Prima di qualsiasi vendita o abbonamento a pagamento, queste condizioni saranno sostituite o integrate da condizioni contrattuali e commerciali relative a prezzo, pagamento, durata, recesso, diritto di ripensamento e mediazione.'] },
      ] },
    },
  },
  es: {
    back: 'Volver al inicio', updated: 'Última actualización: 14 de septiembre de 2026',
    documents: {
      legal: { title: 'Aviso legal', introduction: 'Información sobre la edición y el alojamiento de CoachBrief.', sections: [
        { title: 'Editor y director de la publicación', paragraphs: [`CoachBrief es publicado actualmente a título personal y no comercial por ${common.editor}.`, `Dirección: ${common.address}`, `Contacto: ${common.email}`] },
        { title: 'Alojamiento', paragraphs: [`El sitio está alojado por ${common.host}.`, 'La gestión opcional de cuentas y copias privadas utiliza Google Firebase Authentication y Cloud Firestore.'] },
        { title: 'Propiedad intelectual', paragraphs: ['La estructura, los textos, los análisis, la identidad visual y los desarrollos originales de CoachBrief están protegidos por la normativa de propiedad intelectual. Salvo indicación o licencia contraria, la reproducción, adaptación o difusión más allá del uso privado requiere la autorización previa del editor.', 'El software, los mapas, las fuentes, los datos meteorológicos y otros contenidos de terceros siguen sujetos a los derechos y licencias de sus proveedores.'] },
        { title: 'Contacto', paragraphs: [`Las consultas y solicitudes pueden enviarse a ${common.email}.`] },
      ] },
      privacy: { title: 'Política de privacidad', introduction: 'Esta página explica qué datos utiliza CoachBrief, por qué y cómo ejercer sus derechos.', sections: [
        { title: 'Responsable del tratamiento', paragraphs: [`El responsable del tratamiento es ${common.editor}, ${common.address}. Contacto: ${common.email}.`] },
        { title: 'Datos utilizados', bullets: ['preferencias de idioma y unidades guardadas en el navegador;', 'briefings, observaciones, debriefs y sesiones de entrenamiento introducidos por el usuario;', 'perfiles nominativos de los regatistas, autoevaluaciones, análisis de navegación y comentarios del entrenador;', 'dirección de correo, identificador técnico y tokens de sesión al conectarse con Firebase;', 'posiciones GPS del entrenador, eventos geolocalizados y trazas GPX importadas, solo cuando el usuario activa o proporciona estos datos.'] },
        { title: 'Finalidad y funcionamiento', paragraphs: ['Los datos sirven para hacer funcionar la aplicación, producir los análisis solicitados, guardar contenido en el dispositivo y, cuando el usuario lo elige, sincronizar una copia privada entre dispositivos.', 'El acceso GPS requiere permiso del navegador. El modo puntual obtiene la posición solo cuando se solicita; los modos continuo e inteligente registran una traza durante la sesión.'] },
        { title: 'Almacenamiento, destinatarios y servicios externos', paragraphs: ['Por defecto, los datos permanecen en el almacenamiento local del navegador. Con la sincronización cloud, el correo de la cuenta y la copia privada son tratados por Google Firebase. CoachBrief no vende datos personales.', 'GitHub Pages aloja el sitio. Open-Meteo, OpenStreetMap/Overpass, AviationWeather, Google Fonts y las redes necesarias para Leaflet pueden recibir datos técnicos de conexión y los lugares o coordenadas necesarios para una consulta. Se aplican sus propias políticas.'] },
        { title: 'Conservación', paragraphs: ['Los datos locales permanecen hasta que se eliminan en CoachBrief o se borran los datos del navegador. Las copias cloud permanecen hasta su sustitución, eliminación o una solicitud de borrado al editor.'] },
        { title: 'Derechos', paragraphs: [`Puede solicitar acceso, rectificación, supresión, limitación u oposición, cuando correspondan, escribiendo a ${common.email}. También puede presentar una reclamación ante la CNIL (cnil.fr).`] },
        { title: 'Cookies y almacenamiento local', paragraphs: ['CoachBrief no utiliza cookies publicitarias. Usa almacenamiento local y elementos técnicos necesarios para preferencias, autenticación y copias de seguridad. Los proveedores externos pueden conservar sus propios registros técnicos.'] },
      ] },
      terms: { title: 'Condiciones de uso', introduction: 'CoachBrief se ofrece actualmente de forma gratuita y personal como ayuda para el briefing y el análisis.', sections: [
        { title: 'Solo ayuda a la decisión', paragraphs: ['Las previsiones, mapas, cálculos y recomendaciones son orientativos. No sustituyen los boletines oficiales, avisos de seguridad, observación en el agua, reglas de regata, escucha VHF ni el criterio del responsable de navegación. Cada usuario sigue siendo responsable de sus decisiones y de la seguridad de la tripulación.'] },
        { title: 'Datos introducidos y trazas de terceros', paragraphs: ['El usuario es responsable de la exactitud y legalidad de la información importada o introducida. Antes de registrar, importar o compartir la posición de un barco o una persona, especialmente un menor, debe obtener las autorizaciones necesarias e informar a las personas afectadas.'] },
        { title: 'Disponibilidad', paragraphs: ['El servicio puede evolucionar, interrumpirse o contener errores. Los datos de terceros y servicios de red pueden retrasarse, no estar disponibles o ser inexactos. Se recomienda conservar una copia de la información importante.'] },
        { title: 'Uso y propiedad intelectual', paragraphs: ['Se permite el uso personal normal. Quedan prohibidas la extracción, copia sustancial, reventa o reutilización del servicio y de sus contenidos originales sin autorización, sin perjuicio de las licencias de componentes de terceros.'] },
        { title: 'Futura oferta comercial', paragraphs: ['Antes de cualquier venta o suscripción de pago, estas condiciones serán sustituidas o completadas por condiciones contractuales y comerciales sobre precio, pago, duración, cancelación, desistimiento y mediación.'] },
      ] },
    },
  },
}

export function LegalPage({ document }: { document: LegalDocument }) {
  const { language } = usePreferences()
  const copy = copies[language]
  const page = copy.documents[document]

  return <main className="legal-page">
    <Link className="legal-back" to="/"><ArrowLeft size={17} />{copy.back}</Link>
    <header>
      <p>CoachBrief</p>
      <h1>{page.title}</h1>
      <span>{page.introduction}</span>
      <small>{copy.updated}</small>
    </header>
    <div className="legal-sections">
      {page.sections.map((section) => <section key={section.title}>
        <h2>{section.title}</h2>
        {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        {section.bullets && <ul>{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>}
      </section>)}
    </div>
  </main>
}
