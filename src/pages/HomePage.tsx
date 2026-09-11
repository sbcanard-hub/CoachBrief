import { FormEvent, useState } from 'react'
import { ArrowRight, CalendarDays, Clock3, CloudSun, Compass, Copy, Flag, Gauge, MapPin, Navigation, Sailboat, Waves, Wind } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { MapPicker } from '../components/MapPicker'
import type { BriefingRequest } from '../types'
import { usePreferences } from '../preferences'

const initialForm: BriefingRequest = {
  location: '',
  latitude: '',
  longitude: '',
  committeeLatitude: '',
  committeeLongitude: '',
  committeeAccuracy: '',
  date: '',
  startTime: '',
  endTime: '',
  raceTime: '',
  boatClass: 'Optimist',
  courseType: 'Banane',
  courseAxis: '080',
  startLineBias: 'Neutre',
  windwardOffset: '0',
  finishOrientation: 'Sous le vent',
  observationTime: '',
  observedWindSpeed: '',
  observedWindDirection: '',
  observedGust: '',
  observedWaveHeight: '',
  observedCurrentSpeed: '',
  observedCurrentDirection: '',
  observedCloudCover: '',
  observedPressure: '',
  observationNotes: '',
}

type HomeNavigationState = {
  prefill?: BriefingRequest
  duplicate?: boolean
}

function duplicatedForm(request: BriefingRequest) {
  return {
    ...request,
    committeeLatitude: '',
    committeeLongitude: '',
    committeeAccuracy: '',
    observationTime: '',
    observedWindSpeed: '',
    observedWindDirection: '',
    observedGust: '',
    observedWaveHeight: '',
    observedCurrentSpeed: '',
    observedCurrentDirection: '',
    observedCloudCover: '',
    observedPressure: '',
    observationNotes: '',
  }
}

export function HomePage() {
  const { units, pressureUnit, lengthUnit } = usePreferences()
  const navigate = useNavigate()
  const navigation = useLocation().state as HomeNavigationState | null
  const [form, setForm] = useState<BriefingRequest>(() => {
    if (!navigation?.prefill) return initialForm
    return navigation.duplicate ? duplicatedForm(navigation.prefill) : navigation.prefill
  })

  function updateField(field: keyof BriefingRequest, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  // The form always keeps its reference values (metres and hPa); only the control's presentation changes.
  function displayedReference(value: string | undefined, kind: 'length' | 'pressure') {
    if (!value || units === 'metric') return value || ''
    const converted = kind === 'length' ? Number(value) * 3.28084 : Number(value) * 0.0295299831
    return Number.isFinite(converted) ? String(Number(converted.toFixed(kind === 'length' ? 2 : 3))) : value
  }
  function updateReference(field: keyof BriefingRequest, shown: string, kind: 'length' | 'pressure') {
    if (!shown || units === 'metric') return updateField(field, shown)
    const reference = kind === 'length' ? Number(shown) / 3.28084 : Number(shown) / 0.0295299831
    updateField(field, Number.isFinite(reference) ? String(reference) : shown)
  }

  function updateMapPoint(latitude: string, longitude: string) {
    setForm((current) => ({ ...current, latitude, longitude }))
  }

  function updateCommitteePoint(latitude: string, longitude: string, accuracy: string) {
    setForm((current) => ({ ...current, committeeLatitude: latitude, committeeLongitude: longitude, committeeAccuracy: accuracy }))
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    navigate('/resultats', { state: form })
  }

  return (
    <main className="home-page">
      <section className="hero">
        <div className="eyebrow"><Wind size={15} /> Le bon plan, avant le départ</div>
        <h1>La météo claire.<br /><em>La course en tête.</em></h1>
        <p className="hero-copy">Préparez votre briefing météo et tactique de régate en quelques instants. Renseignez le plan d'eau, la course et le parcours : CoachBrief rassemble ensuite les éléments utiles au coach.</p>
      </section>

      <section className="brief-card" aria-labelledby="brief-title">
        <div className="card-heading">
          <div>
            <span className="step-label">{navigation?.duplicate ? 'Duplication rapide' : 'Nouveau briefing'}</span>
            <h2 id="brief-title">{navigation?.duplicate ? 'Préparer la manche suivante' : 'Votre prochaine régate'}</h2>
            {navigation?.duplicate && <p className="observation-intro"><Copy size={13} /> Parcours et paramètres repris. Les observations terrain et la position GPS du comité ont été effacées.</p>}
          </div>
          <span className="step-number">01</span>
        </div>

        <form onSubmit={submit}>
          <div className="form-section-title"><span>01</span> Course & météo</div>

          <label className="field field-wide">
            <span><MapPin size={16} /> Lieu de la régate</span>
            <input required name="location" placeholder="ex. Baie d'Antibes" value={form.location} onChange={(e) => updateField('location', e.target.value)} />
          </label>

          <MapPicker
            location={form.location}
            latitude={form.latitude}
            longitude={form.longitude}
            committeeLatitude={form.committeeLatitude || ''}
            committeeLongitude={form.committeeLongitude || ''}
            committeeAccuracy={form.committeeAccuracy || ''}
            onPointChange={updateMapPoint}
            onCommitteeChange={updateCommitteePoint}
          />

          <div className="form-row">
            <label className="field">
              <span><CalendarDays size={16} /> Date</span>
              <input required type="date" name="date" value={form.date} onChange={(e) => updateField('date', e.target.value)} />
            </label>
            <label className="field">
              <span><Clock3 size={16} /> Début météo</span>
              <input required type="time" name="startTime" value={form.startTime} onChange={(e) => updateField('startTime', e.target.value)} />
            </label>
            <label className="field">
              <span><Clock3 size={16} /> Fin météo</span>
              <input required type="time" name="endTime" value={form.endTime} onChange={(e) => updateField('endTime', e.target.value)} />
            </label>
          </div>

          <div className="form-row form-row-two">
            <label className="field">
              <span><Sailboat size={16} /> Classe</span>
              <select name="boatClass" value={form.boatClass} onChange={(e) => updateField('boatClass', e.target.value)}>
                <option value="Optimist">Optimist</option>
                <option value="420">420</option>
                <option value="ILCA">ILCA</option>
              </select>
            </label>
            <label className="field">
              <span><Flag size={16} /> Parcours</span>
              <select name="courseType" value={form.courseType} onChange={(e) => updateField('courseType', e.target.value)}>
                <option value="Banane">Banane</option>
                <option value="Trapèze">Trapèze</option>
                <option value="Triangle">Triangle</option>
              </select>
            </label>
          </div>

          <div className="form-section-title"><span>02</span> Paramètres tactiques</div>

          <div className="form-row tactical-form-row">
            <label className="field">
              <span><Clock3 size={16} /> Heure de manche</span>
              <input required type="time" name="raceTime" value={form.raceTime} onChange={(e) => updateField('raceTime', e.target.value)} />
            </label>
            <label className="field">
              <span><Compass size={16} /> Axe du parcours</span>
              <div className="input-with-unit">
                <input required type="number" min="0" max="359" step="1" name="courseAxis" value={form.courseAxis} onChange={(e) => updateField('courseAxis', e.target.value)} />
                <span>°</span>
              </div>
            </label>
            <label className="field">
              <span><Navigation size={16} /> Ligne favorable</span>
              <select name="startLineBias" value={form.startLineBias} onChange={(e) => updateField('startLineBias', e.target.value)}>
                <option value="Comité">Comité</option>
                <option value="Neutre">Neutre</option>
                <option value="Pin">Pin</option>
              </select>
            </label>
          </div>

          <div className="form-row form-row-two">
            <label className="field">
              <span><Compass size={16} /> Désaxage bouée au vent</span>
              <div className="input-with-unit">
                <input required type="number" min="-30" max="30" step="1" name="windwardOffset" value={form.windwardOffset} onChange={(e) => updateField('windwardOffset', e.target.value)} />
                <span>°</span>
              </div>
              <small className="field-help">Négatif = gauche · positif = droite</small>
            </label>
            <label className="field">
              <span><Flag size={16} /> Orientation arrivée</span>
              <select name="finishOrientation" value={form.finishOrientation} onChange={(e) => updateField('finishOrientation', e.target.value)}>
                <option value="Sous le vent">Sous le vent</option>
                <option value="Travers">Travers</option>
                <option value="Au vent">Au vent</option>
              </select>
            </label>
          </div>

          <div className="form-section-title observation-title"><span>03</span> Observations terrain <small>facultatif</small></div>
          <p className="observation-intro">À remplir si vous avez déjà un relevé sur le plan d’eau. Ces valeurs servent à confronter le modèle à ce que vous observez réellement.</p>

          <div className="form-row tactical-form-row">
            <label className="field">
              <span><Clock3 size={16} /> Heure du relevé</span>
              <input type="time" name="observationTime" value={form.observationTime} onChange={(e) => updateField('observationTime', e.target.value)} />
            </label>
            <label className="field">
              <span><Wind size={16} /> Vent observé</span>
              <div className="input-with-unit"><input type="number" min="0" max="80" step="0.1" name="observedWindSpeed" value={form.observedWindSpeed} onChange={(e) => updateField('observedWindSpeed', e.target.value)} /><span>nd</span></div>
            </label>
            <label className="field">
              <span><Compass size={16} /> Direction observée</span>
              <div className="input-with-unit"><input type="number" min="0" max="359" step="1" name="observedWindDirection" value={form.observedWindDirection} onChange={(e) => updateField('observedWindDirection', e.target.value)} /><span>°</span></div>
            </label>
          </div>

          <div className="form-row tactical-form-row">
            <label className="field">
              <span><Wind size={16} /> Rafale observée</span>
              <div className="input-with-unit"><input type="number" min="0" max="100" step="0.1" name="observedGust" value={form.observedGust} onChange={(e) => updateField('observedGust', e.target.value)} /><span>nd</span></div>
            </label>
            <label className="field">
              <span><Waves size={16} /> Vagues</span>
              <div className="input-with-unit"><input type="number" min="0" max={units === 'imperial' ? 33 : 10} step="0.1" name="observedWaveHeight" value={displayedReference(form.observedWaveHeight, 'length')} onChange={(e) => updateReference('observedWaveHeight', e.target.value, 'length')} /><span>{lengthUnit}</span></div>
            </label>
            <label className="field">
              <span><CloudSun size={16} /> Nébulosité</span>
              <div className="input-with-unit"><input type="number" min="0" max="100" step="5" name="observedCloudCover" value={form.observedCloudCover} onChange={(e) => updateField('observedCloudCover', e.target.value)} /><span>%</span></div>
            </label>
          </div>

          <div className="form-row tactical-form-row">
            <label className="field">
              <span><Navigation size={16} /> Courant observé</span>
              <div className="input-with-unit"><input type="number" min="0" max="8" step="0.1" name="observedCurrentSpeed" value={form.observedCurrentSpeed} onChange={(e) => updateField('observedCurrentSpeed', e.target.value)} /><span>nd</span></div>
            </label>
            <label className="field">
              <span><Compass size={16} /> Direction courant</span>
              <div className="input-with-unit"><input type="number" min="0" max="359" step="1" name="observedCurrentDirection" value={form.observedCurrentDirection} onChange={(e) => updateField('observedCurrentDirection', e.target.value)} /><span>°</span></div>
            </label>
            <label className="field">
              <span><Gauge size={16} /> Pression observée</span>
              <div className="input-with-unit"><input type="number" min={units === 'imperial' ? 28 : 950} max={units === 'imperial' ? 31 : 1050} step={units === 'imperial' ? 0.01 : 0.1} name="observedPressure" value={displayedReference(form.observedPressure, 'pressure')} onChange={(e) => updateReference('observedPressure', e.target.value, 'pressure')} /><span>{pressureUnit}</span></div>
            </label>
          </div>

          <label className="field field-wide">
            <span><Flag size={16} /> Note du coach</span>
            <textarea name="observationNotes" rows={3} placeholder="ex. davantage de pression à droite, risées sous nuage, mer plus courte près de la côte…" value={form.observationNotes} onChange={(e) => updateField('observationNotes', e.target.value)} />
          </label>

          <button type="submit">Préparer mon briefing <ArrowRight size={19} /></button>
        </form>
      </section>

      <section className="benefits" aria-label="Avantages">
        <p><strong>01</strong><span>Une lecture<br />simple et rapide</span></p>
        <p><strong>02</strong><span>Les données utiles<br />au bon moment</span></p>
        <p><strong>03</strong><span>Plus de sérénité<br />sur l'eau</span></p>
      </section>
    </main>
  )
}
