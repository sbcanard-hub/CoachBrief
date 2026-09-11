import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type Language = 'fr' | 'en' | 'it' | 'es'
export type UnitSystem = 'metric' | 'imperial'

const STORAGE_KEY = 'coachbrief.preferences.v1'
const locales: Record<Language, string> = { fr: 'fr-FR', en: 'en-GB', it: 'it-IT', es: 'es-ES' }

const messages = {
  fr: { settings: 'Paramètres', language: 'Langue', units: 'Unités', close: 'Fermer', saved: 'Les choix sont enregistrés sur cet appareil.', metric: 'Métrique / nautique', imperial: 'Impérial / nautique', metricDetail: '°C, nœuds, hPa, km, m', imperialDetail: '°F, nœuds, inHg, miles nautiques, pieds', briefings: 'Mes briefings', help: 'Aide', more: 'Plus', weather: 'Météo de régate', footer: "Conçu pour ceux qui regardent l'horizon." },
  en: { settings: 'Settings', language: 'Language', units: 'Units', close: 'Close', saved: 'Your choices are saved on this device.', metric: 'Metric / nautical', imperial: 'Imperial / nautical', metricDetail: '°C, knots, hPa, km, m', imperialDetail: '°F, knots, inHg, nautical miles, feet', briefings: 'My briefings', help: 'Help', more: 'More', weather: 'Regatta weather', footer: 'Designed for those who watch the horizon.' },
  it: { settings: 'Impostazioni', language: 'Lingua', units: 'Unità', close: 'Chiudi', saved: 'Le preferenze sono salvate su questo dispositivo.', metric: 'Metrico / nautico', imperial: 'Imperiale / nautico', metricDetail: '°C, nodi, hPa, km, m', imperialDetail: '°F, nodi, inHg, miglia nautiche, piedi', briefings: 'I miei briefing', help: 'Aiuto', more: 'Altro', weather: 'Meteo regata', footer: "Pensato per chi guarda l'orizzonte." },
  es: { settings: 'Ajustes', language: 'Idioma', units: 'Unidades', close: 'Cerrar', saved: 'Tus preferencias se guardan en este dispositivo.', metric: 'Métrico / náutico', imperial: 'Imperial / náutico', metricDetail: '°C, nudos, hPa, km, m', imperialDetail: '°F, nudos, inHg, millas náuticas, pies', briefings: 'Mis briefings', help: 'Ayuda', more: 'Más', weather: 'Meteo de regata', footer: 'Diseñado para quienes miran el horizonte.' },
} as const
type MessageKey = keyof typeof messages.fr

type Preferences = {
  language: Language; units: UnitSystem; locale: string
  setLanguage: (language: Language) => void; setUnits: (units: UnitSystem) => void
  t: (key: MessageKey) => string
  temperature: (celsius: number, digits?: number) => string
  pressure: (hPa: number, digits?: number) => string
  distance: (km: number, digits?: number) => string
  length: (metres: number, digits?: number) => string
  temperatureUnit: '°C' | '°F'; pressureUnit: 'hPa' | 'inHg'; distanceUnit: 'km' | 'NM'; lengthUnit: 'm' | 'ft'
}

const PreferencesContext = createContext<Preferences | null>(null)
const number = (value: number, digits: number, locale: string) => new Intl.NumberFormat(locale, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value)

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    try { const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}').language; return ['fr', 'en', 'it', 'es'].includes(value) ? value : 'fr' } catch { return 'fr' }
  })
  const [units, setUnits] = useState<UnitSystem>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}').units === 'imperial' ? 'imperial' : 'metric' } catch { return 'metric' }
  })
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify({ language, units })); document.documentElement.lang = language }, [language, units])
  const value = useMemo<Preferences>(() => {
    const locale = locales[language]
    return {
      language, units, locale, setLanguage, setUnits, t: (key) => messages[language][key] || messages.fr[key],
      temperature: (v, d = 0) => `${number(units === 'imperial' ? v * 9 / 5 + 32 : v, d, locale)} ${units === 'imperial' ? '°F' : '°C'}`,
      pressure: (v, d = units === 'imperial' ? 2 : 0) => `${number(units === 'imperial' ? v * 0.0295299831 : v, d, locale)} ${units === 'imperial' ? 'inHg' : 'hPa'}`,
      distance: (v, d = 0) => `${number(units === 'imperial' ? v / 1.852 : v, d, locale)} ${units === 'imperial' ? 'NM' : 'km'}`,
      length: (v, d = 1) => `${number(units === 'imperial' ? v * 3.28084 : v, d, locale)} ${units === 'imperial' ? 'ft' : 'm'}`,
      temperatureUnit: units === 'imperial' ? '°F' : '°C', pressureUnit: units === 'imperial' ? 'inHg' : 'hPa', distanceUnit: units === 'imperial' ? 'NM' : 'km', lengthUnit: units === 'imperial' ? 'ft' : 'm',
    }
  }, [language, units])
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}

export function usePreferences() {
  const value = useContext(PreferencesContext)
  if (!value) throw new Error('usePreferences must be used inside PreferencesProvider')
  return value
}
