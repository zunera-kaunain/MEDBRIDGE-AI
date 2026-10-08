import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { api } from '../../lib/api'
import { PublicNav } from '../../components/PublicNav'
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
  const navigate = useNavigate()
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
  const [doctorQuery, setDoctorQuery] = useState('')
  const [showDoctorList, setShowDoctorList] = useState(false)
  const [suggestedId, setSuggestedId] = useState('')

  // "Assign to doctor" supports both typing and picking, but with a
  // dropdown styled to match the rest of the app rather than the browser's
  // native <datalist> popup (which can't be restyled). doctorQuery is what
  // the person sees/types; doctorId is only set once the text exactly
  // matches a known doctor OR a suggestion is clicked, so submission always
  // carries a real doctor id, never a typed string.
  const doctorOptions = doctors.map((d) => ({
    id: d.id,
    label: d.full_name + (d.specialization ? ` — ${d.specialization}` : ''),
  }))
  const filteredDoctorOptions = doctorOptions.filter((o) =>
    o.label.toLowerCase().includes(doctorQuery.toLowerCase()),
  )

  function handleDoctorInput(value: string) {
    setDoctorQuery(value)
    const match = doctorOptions.find((o) => o.label.toLowerCase() === value.toLowerCase())
    setDoctorId(match ? match.id : '')
  }

  function selectDoctor(option: { id: string; label: string }) {
    setDoctorQuery(option.label)
    setDoctorId(option.id)
    setShowDoctorList(false)
  }

  const [submitError, setSubmitError] = useState('')
  const [busy, setBusy] = useState(false)
  const [registered, setRegistered] = useState<Patient | null>(null)

  useEffect(() => {
    // Deliberately does NOT preselect a doctor — an unselected dropdown is
    // the honest default. The ONLY way doctorId gets set before the
    // receptionist picks manually is a real suggestion from
    // /suggest-doctor, driven by an actual chief complaint + age.
    api<DoctorForRouting[]>('/api/receptionist/doctors', { role: 'receptionist' })
      .then(setDoctors)
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
        const match = doctorOptions.find((o) => o.id === res.suggested_doctor_id)
        if (match) setDoctorQuery(match.label)
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
    setDoctorId('')
    setDoctorQuery('')
    setShowDoctorList(false)
  }


  if (registered) {
    const doctor = doctors.find((d) => d.id === registered.doctor_id)
    return (
      <div className="min-h-screen">
        <PublicNav />
        <div className="flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-lg">
            <button
              onClick={() => navigate('/receptionist')}
              className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-graphite hover:text-ink"
            >
              ← Back
            </button>
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
        </div>
      </div>
    )
  }


  return (
    <div className="min-h-screen">
      <PublicNav />
      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          <button
            onClick={() => navigate(-1)}
            className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-graphite hover:text-ink"
          >
            ← Back
          </button>
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

            <div className="relative">
              <Field
                label="Assign to doctor"
                name="doctor_id"
                required
                placeholder="Type or choose a doctor"
                autoComplete="off"
                value={doctorQuery}
                onChange={(e) => handleDoctorInput(e.target.value)}
                onFocus={() => setShowDoctorList(true)}
                onBlur={() => setTimeout(() => setShowDoctorList(false), 120)}
              />
              {showDoctorList && filteredDoctorOptions.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-2xl border border-rule/80 bg-white/90 shadow-[0_12px_28px_-16px_rgba(22,33,28,0.45)]">
                  {filteredDoctorOptions.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onMouseDown={() => selectDoctor(o)}
                      className="block w-full border-b border-rule px-3 py-2 text-left text-[15px] text-ink last:border-b-0 hover:bg-wash"
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              )}
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
      </div>
    </div>
  )
}
