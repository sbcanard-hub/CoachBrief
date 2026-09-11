import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { en } from './i18n/en'
import { es } from './i18n/es'
import { fr, type TranslationKey } from './i18n/fr'
import { it } from './i18n/it'

export type Language = 'fr' | 'en' | 'it' | 'es'
export type UnitSystem = 'metric' | 'imperial'

const STORAGE_KEY = 'coachbrief.preferences.v1'
const locales: Record<Language, string> = { fr: 'fr-FR', en: 'en-GB', it: 'it-IT', es: 'es-ES' }
const catalogues = { fr, en, it, es }

type Variables = Record<string, string | number>
const interpolate = (message: string, variables?: Variables) => variables
  ? message.replace(/\{(\w+)\}/g, (match, key: string) => String(variables[key] ?? match))
  : message

type Preferences = {
  language: Language; units: UnitSystem; locale: string
  setLanguage: (language: Language) => void; setUnits: (units: UnitSystem) => void
  t: (key: TranslationKey, variables?: Variables) => string
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
      language, units, locale, setLanguage, setUnits, t: (key, variables) => interpolate(catalogues[language][key] || fr[key], variables),
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
