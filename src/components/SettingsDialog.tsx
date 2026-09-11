import { Check, Settings, X } from 'lucide-react'
import { usePreferences, type Language, type UnitSystem } from '../preferences'

const languages: Array<[Language, string]> = [['fr', 'Français'], ['en', 'English'], ['it', 'Italiano'], ['es', 'Español']]

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { language, units, setLanguage, setUnits, t } = usePreferences()
  if (!open) return null
  return <div className="settings-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <button className="settings-close" type="button" onClick={onClose} aria-label={t('close')}><X size={20} /></button>
      <div className="settings-heading"><Settings size={22} /><div><span>CoachBrief</span><h2 id="settings-title">{t('settings')}</h2></div></div>
      <fieldset><legend>{t('language')}</legend><div className="settings-options settings-languages">{languages.map(([value, label]) => <button type="button" className={language === value ? 'is-selected' : ''} onClick={() => setLanguage(value)} key={value}><span>{label}</span>{language === value && <Check size={17} />}</button>)}</div></fieldset>
      <fieldset><legend>{t('units')}</legend><div className="settings-options">{(['metric', 'imperial'] as UnitSystem[]).map((value) => <button type="button" className={units === value ? 'is-selected' : ''} onClick={() => setUnits(value)} key={value}><span><strong>{t(value)}</strong><small>{t(`${value}Detail` as 'metricDetail' | 'imperialDetail')}</small></span>{units === value && <Check size={17} />}</button>)}</div></fieldset>
      <p className="settings-saved">{t('saved')}</p>
    </section>
  </div>
}
