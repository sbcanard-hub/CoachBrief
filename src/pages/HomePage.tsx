import { FormEvent, useState } from 'react'
import { ArrowRight, CalendarDays, Clock3, Flag, MapPin, Sailboat, Wind } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { BriefingRequest } from '../types'

const initialForm: BriefingRequest = {
  location: '',
  date: '',
  startTime: '',
  endTime: '',
  boatClass: 'Optimist',
  courseType: 'Banane',
}

export function HomePage() {
  const navigate = useNavigate()
  const [form, setForm] = useState(initialForm)

  function updateField(field: keyof BriefingRequest, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
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
        <p className="hero-copy">Préparez votre briefing météo de régate en quelques instants. Renseignez les informations de course, nous nous occupons du reste.</p>
      </section>

      <section className="brief-card" aria-labelledby="brief-title">
        <div className="card-heading">
          <div>
            <span className="step-label">Nouveau briefing</span>
            <h2 id="brief-title">Votre prochaine régate</h2>
          </div>
          <span className="step-number">01</span>
        </div>

        <form onSubmit={submit}>
          <label className="field field-wide">
            <span><MapPin size={16} /> Lieu de la régate</span>
            <input required name="location" placeholder="ex. Baie d'Antibes" value={form.location} onChange={(e) => updateField('location', e.target.value)} />
          </label>

          <div className="form-row">
            <label className="field">
              <span><CalendarDays size={16} /> Date</span>
              <input required type="date" name="date" value={form.date} onChange={(e) => updateField('date', e.target.value)} />
            </label>
            <label className="field">
              <span><Clock3 size={16} /> Début</span>
              <input required type="time" name="startTime" value={form.startTime} onChange={(e) => updateField('startTime', e.target.value)} />
            </label>
            <label className="field">
              <span><Clock3 size={16} /> Fin</span>
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
