import { useEffect, useState, type FormEvent } from 'react'

import { api } from '../../lib/api'
import { Button, CaseSheet, Chip, ErrorNotice, Field, SelectField } from '../../components/ui'
import type {
  DoctorForRouting,
  Gender,
  Language,
  Patient,
  ReceptionistPatientCreate,
} from '../../types'

const GENDERS: Gender[] = ['male', 'female', 'other']
const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'kn', label: 'Kannada' },
  { value: 'ta', label: 'Tamil' },
  { value: 'te', label: 'Telugu' },
  { value: 'ml', label: 'Malayalam' },
]


export default function ReceptionistRegisterPatient() {
  const [doctors, setDoctors] = useState<DoctorForRouting[]>([])
  const [doctorsError, setDoctorsError] = useState('')

  const [fullName, setFullName] = useState('')
  const [age, setAge] = useState('')
  const [gender, setGender] = useState<Gender>('male')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [language, setLanguage] = useState<Language>('en')
  const [chiefComplaint, setChiefComplaint] = useState('')
  const [doctorId, setDoctorId] = useState('')
  const [suggestedId, setSuggestedId] = useState('')

  const [submitError, setSubmitError] = useState('')
  const [busy, setBusy] = useState(false)
  const [registered, setRegistered] = useState<Patient | null>(null)

  useEffect(() => {
    api<DoctorForRouting[]>('/api/receptionist/doctors', { role: 'receptionist' })
      .then((rows) => {
        setDoctors(rows)
        if (rows.length > 0) setDoctorId(rows[0].id)
      })
      .catch((err) =>
        setDoctorsError(err instanceof Error ? err.message : 'Could not load doctors'),
      )
  }, [])

  async function handleSuggest() {
    const ageNum = Number(age)
    if (!chiefComplaint.trim() || !age || Number.isNaN(ageNum)) return

    try {
      const res = await api<{ suggested_doctor_id: string | null }>(
        `/api/receptionist/suggest-doctor?chief_complaint=${encodeURIComponent(
          chiefComplaint,
        )}&age=${ageNum}`,
        { role: 'receptionist' },
      )
      if (res.suggested_doctor_id) {
        setSuggestedId(res.suggested_doctor_id)
        setDoctorId(res.suggested_doctor_id)
      }
    } catch {
      // Suggestion is a convenience, not a requirement — the dropdown
      // still works fine if this silently fails.
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitError('')

    const ageNum = Number(age)
    if (Number.isNaN(ageNum)) {
      setSubmitError('Age must be a number')
      return
    }
    if (!doctorId) {
      setSubmitError('Select a doctor')
      return
    }

    const payload: ReceptionistPatientCreate = {
      full_name: fullName,
      age: ageNum,
      gender,
      phone,
      email,
      preferred_language: language,
      chief_complaint: chiefComplaint || undefined,
      doctor_id: doctorId,
    }

    setBusy(true)
    try {
      const patient = await api<Patient>('/api/receptionist/patients', {
        method: 'POST',
        body: payload,
        role: 'receptionist',
      })
      setRegistered(patient)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not register patient')
    } finally {
      setBusy(false)
    }
  }

  function handleRegisterAnother() {
    setRegistered(null)
    setFullName('')
    setAge('')
    setGender('male')
    setPhone('')
    setEmail('')
    setLanguage('en')
    setChiefComplaint('')
    setSuggestedId('')
    if (doctors.length > 0) setDoctorId(doctors[0].id)
  }


  if (registered) {
    const doctor = doctors.find((d) => d.id === registered.doctor_id)
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-12">
        <CaseSheet
          eyebrow="Front desk · Patient registered"
          title={`${registered.full_name} (${registered.short_id})`}
          subtitle={`Assigned to ${doctor?.full_name ?? 'the selected doctor'}${
            doctor?.specialization ? ` — ${doctor.specialization}` : ''
          }`}
        >
          <Button onClick={handleRegisterAnother}>Register another patient</Button>
        </CaseSheet>
      </div>
    )
  }


  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <CaseSheet
        eyebrow="Front desk"
        title="Register a patient"
        subtitle="Add a chief complaint (optional) after age for an automatic doctor suggestion."
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          {submitError && <ErrorNotice message={submitError} />}
          {doctorsError && <ErrorNotice message={doctorsError} />}

          <Field
            label="Full name"
            name="full_name"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Age"
              name="age"
              type="number"
              min={0}
              max={130}
              required
              value={age}
              onChange={(e) => setAge(e.target.value)}
            />
            <SelectField
              label="Gender"
              name="gender"
              value={gender}
              onChange={(e) => setGender(e.target.value as Gender)}
            >
              {GENDERS.map((g) => (
                <option key={g} value={g}>
                  {g[0].toUpperCase() + g.slice(1)}
                </option>
              ))}
            </SelectField>
          </div>

          <Field
            label="Phone"
            name="phone"
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />

          <Field
            label="Email"
            name="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <SelectField
            label="Preferred language"
            name="language"
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </SelectField>

          <Field
            label="Chief complaint (optional)"
            name="chief_complaint"
            hint="What the patient came in for — used to suggest a doctor, not a diagnosis."
            value={chiefComplaint}
            onChange={(e) => setChiefComplaint(e.target.value)}
            onBlur={handleSuggest}
          />

          <div>
            <SelectField
              label="Assign to doctor"
              name="doctor_id"
              required
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
            >
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.full_name}
                  {d.specialization ? ` — ${d.specialization}` : ''}
                </option>
              ))}
            </SelectField>
            {suggestedId && suggestedId === doctorId && (
              <div className="mt-2">
                <Chip tone="seal">Suggested</Chip>
              </div>
            )}
          </div>

          <div className="pt-2">
            <Button type="submit" loading={busy}>
              Register patient
            </Button>
          </div>
        </form>
      </CaseSheet>
    </div>
  )
}
