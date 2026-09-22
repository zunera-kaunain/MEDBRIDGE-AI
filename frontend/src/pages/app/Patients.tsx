import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { api } from '../../lib/api'
import { AppLayout } from '../../components/AppLayout'
import { Button, ErrorNotice, Field, SelectField } from '../../components/ui'
import {
  LANGUAGE_LABELS,
  type Gender,
  type Language,
  type Patient,
  type PatientSummary,
} from '../../types'

const EMPTY_FORM = {
  full_name: '',
  age: '',
  gender: 'female' as Gender,
  phone: '',
  email: '',
  preferred_language: 'kn' as Language,
}

export default function Patients() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<PatientSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState('')

  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async (q: string) => {
    setListError('')
    try {
      const params = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''
      setRows(await api<PatientSummary[]>(`/api/patients${params}`))
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Could not load patients')
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounced search — one request after typing settles, not one per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => load(query), 250)
    return () => clearTimeout(timer)
  }, [query, load])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setFormError('')
    setSaving(true)
    try {
      await api<Patient>('/api/patients', {
        method: 'POST',
        body: {
          full_name: form.full_name,
          age: Number(form.age),
          gender: form.gender,
          phone: form.phone || undefined,
          email: form.email || undefined,
          preferred_language: form.preferred_language,
        },
      })
      setForm(EMPTY_FORM)
      setAdding(false)
      await load(query)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save patient')
    } finally {
      setSaving(false)
    }
  }

  function update(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  return (
    <AppLayout>
      <div className="flex items-end justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-graphite">
            Clinic records
          </p>
          <h1 className="mt-1.5 font-display text-3xl font-medium">Patients</h1>
        </div>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="border border-seal px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-seal transition-colors hover:bg-seal hover:text-paper"
          >
            + Add Patient
          </button>
        )}
      </div>

      {adding && (
        <div className="mt-6 border border-rule bg-white px-6 py-6">
          <form onSubmit={handleCreate} className="space-y-5">
            {formError && <ErrorNotice message={formError} />}

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field
                label="Full name"
                required
                value={form.full_name}
                onChange={(e) => update('full_name', e.target.value)}
              />
              <Field
                label="Phone"
                type="tel"
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
              />
              <Field
                label="Email"
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
              />
              <Field
                label="Age"
                type="number"
                min={0}
                max={130}
                required
                value={form.age}
                onChange={(e) => update('age', e.target.value)}
              />
              <SelectField
                label="Gender"
                value={form.gender}
                onChange={(e) => update('gender', e.target.value)}
              >
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </SelectField>
            </div>

            <SelectField
              label="Language for patient card"
              value={form.preferred_language}
              onChange={(e) => update('preferred_language', e.target.value)}
            >
              {Object.entries(LANGUAGE_LABELS).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </SelectField>

            <div className="flex gap-3 pt-1">
              <Button type="submit" loading={saving}>
                Save patient
              </Button>
              <Button
                type="button"
                variant="quiet"
                onClick={() => {
                  setAdding(false)
                  setFormError('')
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="mt-8">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, phone, or ID"
          className="w-full max-w-sm border-b border-rule bg-transparent pb-1.5 text-[15px] outline-none placeholder:text-rule focus:border-seal"
        />
      </div>

      {listError && (
        <div className="mt-6">
          <ErrorNotice message={listError} />
        </div>
      )}

      <div className="mt-6 border border-rule bg-white">
        {loading ? (
          <div className="px-6 py-14 text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-graphite">
              Loading records…
            </p>
          </div>
        ) : rows.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="font-display text-lg">
              {query ? 'No patients match that search' : 'No patients yet'}
            </p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-graphite">
              {query
                ? 'Try a partial name, phone number, or ID.'
                : 'Add a patient to start recording consultations.'}
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-rule">
                {['ID', 'Name', 'Age / Sex', 'Language', 'Visits', 'Last seen'].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-5 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-graphite"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => navigate(`/app/patients/${p.id}`)}
                  className="cursor-pointer border-b border-rule last:border-0 hover:bg-wash/50"
                >
                  <td className="px-5 py-3 font-mono text-xs text-graphite">
                    {p.short_id}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-wash font-mono text-[10px] font-medium text-graphite">
                        {p.full_name
                          .split(' ')
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase()}
                      </span>
                      <span className="font-medium">{p.full_name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-graphite">
                    {p.age} / {p.gender.charAt(0).toUpperCase()}
                  </td>
                  <td className="px-5 py-3 text-graphite">
                    {LANGUAGE_LABELS[p.preferred_language]}
                  </td>
                  <td className="px-5 py-3 font-mono text-graphite">
                    {p.visit_count}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-graphite">
                    {p.last_visit
                      ? new Date(p.last_visit).toLocaleDateString('en-IN')
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppLayout>
  )
}