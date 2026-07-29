/**
 * MedBridge AI — shared types.
 *
 * This file MIRRORS backend/models/. If you change a Pydantic model, change
 * this file in the SAME commit. These types are the contract between three
 * developers working in parallel — silent drift here causes runtime errors
 * that are painful to trace.
 *
 * All datetimes are ISO 8601 strings over the wire.
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export type Gender = 'male' | 'female' | 'other'
export type AuthProvider = 'google' | 'email'
export type VerificationStatus = 'pending' | 'verified' | 'rejected'

/** Patient card output languages. */
export type Language = 'en' | 'hi' | 'kn' | 'ta' | 'te' | 'ml'

/** Consultation input pairs. kn-en and hi-en are formally evaluated. */
export type LanguagePair = 'kn-en' | 'hi-en' | 'ta-en' | 'te-en' | 'ml-en' | 'en'

export type SessionStatus =
  | 'recording'
  | 'processing'
  | 'ready'
  | 'confirmed'
  | 'failed'

export const LANGUAGE_LABELS: Record<Language, string> = {
  en: 'English',
  hi: 'हिन्दी',
  kn: 'ಕನ್ನಡ',
  ta: 'தமிழ்',
  te: 'తెలుగు',
  ml: 'മലയാളം',
}

export const LANGUAGE_PAIR_LABELS: Record<LanguagePair, string> = {
  'kn-en': 'Kannada + English',
  'hi-en': 'Hindi + English',
  'ta-en': 'Tamil + English',
  'te-en': 'Telugu + English',
  'ml-en': 'Malayalam + English',
  en: 'English only',
}

// ---------------------------------------------------------------------------
// Core primitive
// ---------------------------------------------------------------------------

export interface ExtractedField {
  text: string
  confidence: number // 0.0 – 1.0
  transcript_offset: [number, number] | null
  edited_by_doctor: boolean
}

export type ConfidenceLevel = 'high' | 'medium' | 'low'

export function confidenceLevel(c: number): ConfidenceLevel {
  if (c >= 0.85) return 'high'
  if (c >= 0.6) return 'medium'
  return 'low'
}

// ---------------------------------------------------------------------------
// Doctor
// ---------------------------------------------------------------------------

export interface DoctorPublic {
  id: string
  email: string
  full_name: string
  qualification: string | null
  specialization: string | null
  registration_number: string | null
  state_medical_council: string | null
  clinic_name: string | null
  verification_status: VerificationStatus
  profile_complete: boolean
  created_at: string
}

export interface DoctorProfileInput {
  qualification: string
  specialization: string
  registration_number: string
  state_medical_council: string
  year_of_registration: number
  clinic_name?: string
  clinic_address?: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
  doctor: DoctorPublic
}

// ---------------------------------------------------------------------------
// Patient
// ---------------------------------------------------------------------------

export interface PatientCreate {
  full_name: string
  age: number
  gender: Gender
  phone?: string
  abha_id?: string
  preferred_language: Language
}

export interface Patient {
  id: string
  doctor_id: string
  full_name: string
  age: number
  gender: Gender
  phone: string | null
  abha_id: string | null
  preferred_language: Language
  created_at: string
}

export interface PatientSummary {
  id: string
  full_name: string
  age: number
  gender: Gender
  preferred_language: Language
  last_visit: string | null
  visit_count: number
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

export interface SessionCreate {
  patient_id: string
  language_pair: LanguagePair
}

export interface Session {
  id: string
  doctor_id: string
  patient_id: string
  language_pair: LanguagePair
  status: SessionStatus
  transcript: string
  audio_duration_sec: number
  encounter_start: string
  encounter_end: string | null
  report_generated_at: string | null
  confirmed_at: string | null
}

export interface TranscriptSegment {
  text: string
  start_sec: number
  end_sec: number
  char_offset: [number, number]
}

// ---------------------------------------------------------------------------
// WebSocket events  (/ws/session/{id})
//
// Client sends raw PCM audio. Server sends these.
// PARTIAL rewrites itself as audio arrives — render grey/italic.
// FINAL is settled — render solid and append.
// ---------------------------------------------------------------------------

export interface PartialEvent {
  type: 'partial'
  text: string
}

export interface FinalEvent {
  type: 'final'
  segment: TranscriptSegment
}

export interface StatusEvent {
  type: 'status'
  status: SessionStatus
}

export interface ErrorEvent {
  type: 'error'
  message: string
}

export type TranscriptEvent =
  | PartialEvent
  | FinalEvent
  | StatusEvent
  | ErrorEvent

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

export interface Medication {
  name: ExtractedField
  dosage: ExtractedField | null
  frequency: ExtractedField | null
  duration: ExtractedField | null
  instructions: ExtractedField | null
}

export interface FollowUp {
  duration: ExtractedField | null
  instructions: ExtractedField | null
  referral: ExtractedField | null
}

export interface Report {
  id: string
  session_id: string
  doctor_id: string
  patient_id: string
  chief_complaint: ExtractedField | null
  symptoms: ExtractedField[]
  diagnosis: ExtractedField[]
  medications: Medication[]
  followup: FollowUp
  notes: string
  generated_at: string
  confirmed: boolean
  confirmed_at: string | null
}

export interface ReportUpdate {
  chief_complaint?: ExtractedField
  symptoms?: ExtractedField[]
  diagnosis?: ExtractedField[]
  medications?: Medication[]
  followup?: FollowUp
  notes?: string
}

// ---------------------------------------------------------------------------
// Patient card
// ---------------------------------------------------------------------------

export interface PatientCard {
  id: string
  session_id: string
  language: Language
  greeting: string
  condition_explanation: string
  medication_instructions: string[]
  followup_instructions: string
  warning_signs: string[]
  generated_at: string
}