import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../../lib/auth'
import {
  Button,
  CaseSheet,
  ErrorNotice,
  Field,
  SelectField,
} from '../../components/ui'

const COUNCILS = [
  'Karnataka Medical Council',
  'Tamil Nadu Medical Council',
  'Kerala State Medical Council',
  'Telangana State Medical Council',
  'Andhra Pradesh Medical Council',
  'Maharashtra Medical Council',
  'Delhi Medical Council',
  'National Medical Commission',
]

// Suggestions only — both fields stay free-text inputs (via <datalist>), so
// a qualification/specialization not on this list can still be typed in
// directly. Specialization labels are worded to match the substring
// keywords services/routing.py looks for (e.g. "Cardiology" contains
// "cardiolog"), so picking one of these keeps the receptionist's
// doctor-suggestion feature working correctly.
const QUALIFICATIONS = [
  'MBBS',
  'MD',
  'MS',
  'DNB',
  'DM',
  'MCh',
  'BDS',
  'MDS',
  'BAMS',
  'BHMS',
  'BUMS',
  'PG Diploma',
]

const SPECIALIZATIONS = [
  'General Medicine',
  'General Surgery',
  'Paediatrics',
  'Obstetrics & Gynaecology',
  'Orthopaedics',
  'Cardiology',
  'Dermatology',
  'ENT (Otolaryngology)',
  'Ophthalmology',
  'Psychiatry',
  'Neurology',
  'Nephrology',
  'Gastroenterology',
  'Pulmonology',
  'Endocrinology',
  'Urology',
  'Oncology',
  'Radiology',
  'Anaesthesiology',
  'Emergency Medicine',
  'Family Medicine',
  'Pathology',
  'Dentistry',
]

export default function CompleteProfile() {
  const { saveProfile } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    qualification: '',
    specialization: '',
    registration_number: '',
    state_medical_council: COUNCILS[0],
    year_of_registration: new Date().getFullYear(),
    clinic_name: '',
    clinic_address: '',
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function update(key: keyof typeof form, value: string | number) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await saveProfile(form)
      navigate('/app')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save details')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <CaseSheet
        eyebrow="MedBridge AI · Practitioner details"
        title="Your professional details"
        subtitle="Your registration number appears on every report you generate."
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && <ErrorNotice message={error} />}

          <div className="grid grid-cols-2 gap-5">
            <Field
              label="Qualification"
              name="qualification"
              required
              placeholder="MBBS, MD"
              list="qualification-options"
              autoComplete="off"
              value={form.qualification}
              onChange={(e) => update('qualification', e.target.value)}
            />
            <Field
              label="Specialisation"
              name="specialization"
              required
              placeholder="General Medicine"
              list="specialization-options"
              autoComplete="off"
              value={form.specialization}
              onChange={(e) => update('specialization', e.target.value)}
            />
          </div>

          {/* Pick from the list or just type your own — these are
              suggestions, not a restriction. */}
          <datalist id="qualification-options">
            {QUALIFICATIONS.map((q) => (
              <option key={q} value={q} />
            ))}
          </datalist>
          <datalist id="specialization-options">
            {SPECIALIZATIONS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>

          <Field
            label="Registration number"
            name="registration_number"
            required
            placeholder="KMC 12345"
            value={form.registration_number}
            onChange={(e) => update('registration_number', e.target.value)}
          />

          <div className="grid grid-cols-2 gap-5">
            <SelectField
              label="Medical council"
              name="state_medical_council"
              value={form.state_medical_council}
              onChange={(e) => update('state_medical_council', e.target.value)}
            >
              {COUNCILS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </SelectField>
            <Field
              label="Year of registration"
              name="year_of_registration"
              type="number"
              min={1950}
              max={new Date().getFullYear()}
              required
              value={form.year_of_registration}
              onChange={(e) =>
                update('year_of_registration', Number(e.target.value))
              }
            />
          </div>

          <Field
            label="Clinic name"
            name="clinic_name"
            value={form.clinic_name}
            onChange={(e) => update('clinic_name', e.target.value)}
          />

          <Field
            label="Clinic address"
            name="clinic_address"
            value={form.clinic_address}
            onChange={(e) => update('clinic_address', e.target.value)}
          />

          {/* The honesty rule, stated where the doctor will actually read it. */}
          <p className="border-l-2 border-rule pl-3 text-xs leading-relaxed text-graphite">
            MedBridge records these details on your reports. It does not check
            them against the Indian Medical Register, so your account stays
            marked <span className="text-caution">verification pending</span>.
          </p>

          <div className="pt-1">
            <Button type="submit" loading={busy}>
              Save and continue
            </Button>
          </div>
        </form>
      </CaseSheet>
    </div>
  )
}