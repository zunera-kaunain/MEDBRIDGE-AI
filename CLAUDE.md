# MedBridge AI — Project Context

## What this is

MedBridge AI is a real-time multilingual OPD documentation assistant for Indian
clinics. It is used **by doctors only** — OPD physicians and independent clinic
owners. Patients do not log in; the doctor enters patient details.

A doctor speaks during a consultation — naturally mixing Kannada+English or
Hindi+English mid-sentence — and the system produces:

1. A **live transcript**, appearing on screen as the doctor speaks.
2. A **structured OPD report** (symptoms, diagnosis, medications with dosage,
   follow-up) with a confidence score on every extracted field, editable before
   the doctor confirms it.
3. A **simplified patient explanation card** in the patient's language.
4. An **ABDM/FHIR R4-conformant record** with proper encounter timestamps.

The core technical problem is **code-switching**: no existing clinical ASR tool
handles "ನಿಮಗೆ viral fever ಇದೆ, paracetamol 500mg ತಗೊಳ್ಳಿ". Evaluate every
design decision against whether it helps or hurts code-switched recognition.

This is a final-year B.E. project (VTU, BAD685), graded on a written report and
a viva. **Explainability matters as much as functionality.** Prefer clear,
conventional code over clever code.

---

## Hard constraints

- **Budget: $5 of Claude API credit.** No other paid services. Everything else
  is local or free-tier. Cache aggressively during development.
- **No phone/SMS auth** — SMS gateways cost money. Google OAuth + email only.
- **One GPU laptop.** It runs Whisper, and in deployment it runs everything.
  The other two developers work against mock mode.
- **Six locked report objectives** (below). These are a contract.

Internet is available — offline operation is not required. Mock mode is retained
for parallel development and as a demo fallback, not for offline use.

---

## Objectives (from the verified Phase-I report — do not drift)

1. Real-time multilingual / code-switched speech recognition
2. Medical entity extraction using NLP
3. ABDM-compliant structured OPD report generation
4. Multilingual patient explanation in regional languages
5. Doctor dashboard with live transcription and report management
6. Evaluation on accuracy, efficiency, latency, and usability

**Objective 1 means genuine streaming** — transcript text appears while the
doctor is still speaking. Not record-then-process.

**Objective 3 means the report schema follows FHIR R4 / ABDM conventions** and
exports a conformant bundle. It does **not** mean integrating the live ABDM
Health Stack — that needs sandbox credentials we cannot obtain. Out of scope,
declared explicitly.

**Objective 6 is real code with real numbers.** See `eval/`.

---

## Honesty rules (these protect the viva)

- Doctor credential **collection**, not verification. Registration numbers are
  stored with `verification_status: "pending"`. There is no NMC register API
  available to us. Never let UI copy or report text imply real verification.
- ASR is formally evaluated for **Kannada+English and Hindi+English only**.
  Other pairs are enabled but best-effort and must be described that way.
- No real payment processing. Pricing tiers are UI only.

---

## Language matrix

| Capability | Languages |
|---|---|
| **ASR — evaluated** | Kannada+English, Hindi+English |
| **ASR — best-effort** | Tamil+English, Telugu+English, Malayalam+English |
| **Patient card output** | English, Hindi, Kannada, Tamil, Telugu, Malayalam |

The recording panel has a **consultation language selector**. The chosen pair is
passed to Whisper as a language hint (e.g. `language="kn"`) — auto-detection
locks onto one language and mangles code-switches, so hinting measurably
improves accuracy.

---

## Tech stack

### Backend
- **Python 3.11+**, **FastAPI** (async, WebSocket, `BackgroundTasks`)
- **Motor** — async MongoDB driver. Never synchronous `pymongo`.
- **Pydantic v2** — all models and settings
- **python-jose** — JWT (HS256) · **passlib[bcrypt]** — password hashing
- **faster-whisper** — streaming ASR, local on GPU. The only local model.
- **silero-vad** — silence-boundary segment finalization
- **Anthropic Claude API** — entity extraction, simplification, translation

### Model selection (cost discipline)
- `NLP_MODEL` = **Haiku 4.5** — entity extraction. Mechanical pattern-finding,
  no judgement required, cheapest tier.
- `CARD_MODEL` = **Sonnet 5** — patient-card simplification and translation.
  Phrasing quality is user-visible here.
- Never use Opus. Never use Sonnet for extraction.

### Frontend
- **React 18 + Vite + TypeScript**, **Tailwind CSS**
- **framer-motion**, **lucide-react**
- **Web Audio API** — mic capture, `AnalyserNode` waveform

### Infrastructure
- **MongoDB Atlas M0** — free tier
- **Cloudflare Tunnel** (or Tailscale Funnel) — public HTTPS + WebSocket
- **WeasyPrint** — HTML to PDF export

### Explicitly NOT used
- No Celery, no Redis — `BackgroundTasks` suffices
- No IndicTrans2 — Claude handles translation (may return as an eval baseline)
- No Ollama — internet is available
- No OpenAI, no Twilio, no SMS gateway
- WhatsApp delivery uses `wa.me` deep links

---

## Deployment: one machine, one URL

```
        GPU laptop
        ┌────────────────────────────────┐
        │  FastAPI (single process)      │
        │   ├── /            React build │
        │   ├── /api/*       REST        │
        │   ├── /ws/*        WebSocket   │
        │   └── faster-whisper (GPU)     │
        └──────────────┬─────────────────┘
                       │ Cloudflare Tunnel
                       ▼
              https://<public-url>
                       │
                       ▼
              MongoDB Atlas (cloud)
```

FastAPI serves the built frontend directly:

```python
app.mount("/", StaticFiles(directory="frontend/dist", html=True), name="static")
```

Mount this **after** all API and WebSocket routes, or it will shadow them.

Free cloud hosts do not provide GPUs, so cloud-hosting the backend would make
real-time ASR impossible. This is framed in the report as a deliberate **edge
deployment**: the application runs on clinic-side hardware and patient audio is
never transmitted to a third-party inference provider — consistent with DPDP Act
expectations and Indian hospital IT policy.

Note that development is still split across three machines (see Working style);
only deployment is single-machine.

---

## Repository layout

```
backend/
  main.py, config.py, database.py, seed.py
  models/      <- Pydantic schemas ONLY, no logic
  routers/     <- auth, doctors, patients, sessions, analytics
  services/    <- ALL AI calls: asr, streaming, vad, nlp, card,
                 fhir, report, mocks
  websocket/   <- audio streaming handler
  middleware/  <- JWT dependency
  utils/       <- offsets, confidence, cache
  tests/

frontend/src/
  pages/       <- public/, auth/, app/
  components/  <- RecordingPanel, LiveTranscript, ReportPanel,
                 PatientCardPanel, ConfidenceBadge, ...
  hooks/       <- useStreamingTranscript, useRecording, useReport
  lib/, types/

eval/          <- Chapter 5 of the report
  data/audio/, data/ground_truth.jsonl
  run_asr_eval.py, run_nlp_eval.py, run_latency_eval.py
  results/
```

---

## Architectural rules

1. **All AI calls live in `services/`.** Routers never call a model directly.
2. **Mock mode must always work.** `USE_MOCK=true` makes ASR, NLP and card
   generation return fixtures, including a simulated streaming transcript. The
   full flow must work with no API key and no GPU.
3. **Cache Claude responses during development.** Hash the transcript, store the
   result. Re-running the same extraction while tuning prompts must not cost
   money. See `utils/cache.py`.
4. **Streaming uses rolling re-transcription**, never independent per-chunk
   transcription (garbage at boundaries) and never record-then-process
   (violates objective 1).
5. **Every extracted field carries a confidence score.** A safety property,
   not a UI flourish.
6. **Every report field traces back to a transcript offset.** Focusing a field
   highlights its source text.
7. **Patient records are append-only.** Reports are editable before
   confirmation, immutable after. Medical records.
8. **Timestamps are modelled separately** — encounter start, encounter end,
   report generated, doctor confirmed. ABDM distinguishes them.

---

## Streaming ASR design

```
Client: continuous capture -> 1s PCM chunks -> WebSocket
                    |
Server: append to rolling buffer
        every ~2s -> transcribe buffer tail -> emit {type: "partial"}
        silero-vad detects >700ms silence
                  -> finalize segment -> emit {type: "final"}
                  -> clear finalized audio from buffer
```

- Finalized segments render as solid text; the partial renders as grey italic.
- **Partials will visibly rewrite themselves** as context arrives. Correct
  behaviour — style them as provisional.
- Entity extraction runs **once on stop**, as a `BackgroundTask`. Streaming
  transcription, batch extraction.

---

## Core data model

```python
class Doctor(BaseModel):
    id: str
    email: EmailStr
    auth_provider: Literal["google", "email"]
    full_name: str
    qualification: str                    # MBBS, MD, ...
    specialization: str
    registration_number: str              # medical council reg no.
    state_medical_council: str
    year_of_registration: int
    clinic_name: str | None
    clinic_address: str | None
    credential_document_url: str | None
    verification_status: Literal["pending", "verified", "rejected"] = "pending"
    created_at: datetime

class Patient(BaseModel):
    id: str
    doctor_id: str                        # entered and owned by the doctor
    full_name: str
    age: int
    gender: Literal["male", "female", "other"]
    phone: str | None
    abha_id: str | None                   # optional, not validated
    preferred_language: str
    created_at: datetime

class ExtractedField(BaseModel):
    text: str
    confidence: float                     # 0.0 to 1.0
    transcript_offset: tuple[int, int] | None
    edited_by_doctor: bool = False

class Session(BaseModel):
    id: str
    doctor_id: str
    patient_id: str
    language_pair: str                    # "kn-en", "hi-en", ...
    encounter_start: datetime
    encounter_end: datetime | None
    transcript: str
    audio_duration_sec: float

class Report(BaseModel):
    session_id: str
    symptoms: list[ExtractedField]
    diagnosis: list[ExtractedField]
    medications: list[Medication]         # name, dosage, frequency, duration
    followup: FollowUp
    generated_at: datetime
    confirmed_at: datetime | None
    confirmed: bool = False
```

Confidence thresholds: `>= 0.85` high (green), `0.60-0.85` medium (amber),
`< 0.60` low (red).

---

## FHIR R4 export (objective 3)

Bundle type `OPConsultRecord`:

| Resource | Source |
|---|---|
| `Patient` | `Patient` model |
| `Practitioner` | `Doctor` — **registration_number is the required identifier** |
| `Encounter` | `encounter_start` / `encounter_end`, class = AMB (outpatient) |
| `Condition` | `Report.diagnosis` |
| `MedicationRequest` | `Report.medications` |
| `Observation` | `Report.symptoms` |
| `DocumentReference` | Generated PDF |

Out of scope, state explicitly: HIP registration, real ABHA linkage, consent
manager integration.

---

## API surface

```
POST   /auth/google                  OAuth exchange -> JWT
POST   /auth/register                Email + password
POST   /auth/login
GET    /auth/me
POST   /api/doctor/profile           Complete onboarding (credentials)
POST   /api/doctor/credential-doc    Certificate upload

GET    /api/patients/search?q=
POST   /api/patients                 Doctor creates patient record
GET    /api/patient/{id}/history

POST   /api/session/start            {patient_id, language_pair}
POST   /api/session/{id}/stop        Ends encounter, queues extraction
GET    /api/session/{id}/report
PATCH  /api/session/{id}/report      Doctor edits
POST   /api/session/{id}/confirm     Locks the report
POST   /api/session/{id}/patient-card
GET    /api/session/{id}/pdf
GET    /api/session/{id}/fhir        FHIR R4 bundle

GET    /api/analytics/summary

WS     /ws/session/{id}              Audio in -> partial/final transcript out
```

---

## Environment variables

```bash
MONGODB_URL=mongodb+srv://...
DB_NAME=medbridge
JWT_SECRET=32_random_chars_minimum
JWT_ALGORITHM=HS256
JWT_EXPIRE_HOURS=8

GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

ANTHROPIC_API_KEY=...
NLP_MODEL=claude-haiku-4-5-20251001     # extraction — cheap
CARD_MODEL=claude-sonnet-5              # patient card — quality

WHISPER_MODEL=medium                    # drop to "small" if VRAM < 4GB
WHISPER_COMPUTE_TYPE=int8
STREAM_PARTIAL_INTERVAL_MS=2000
VAD_SILENCE_MS=700

USE_MOCK=true                           # full flow, no key, no GPU
CACHE_LLM_RESPONSES=true                # dev only — protects the $5
```

---

## Working style

Development runs across three machines even though deployment is single-machine:

| Member | Owns | Machine |
|---|---|---|
| A | `services/asr.py`, `vad.py`, streaming, all of `eval/` | GPU laptop |
| B | Routers, models, MongoDB, auth, FHIR, PDF | Any, mock mode |
| C | Entire React app, all routes, design system, tier gating | Any, mock mode |

- **Vertical slices, not layers.** One complete path end-to-end
  (model -> router -> test), not "all the models" then "all the routers".
- **Follow existing patterns.** Read an existing router before writing a new one.
- **Write the test with the code.**
- **Small commits.** One working slice each.
- **Non-obvious decisions go in `DECISIONS.md`** with a one-paragraph rationale.
  This file is what the team defends in the viva.

## Things to avoid

- No new dependencies without asking — each one is something to explain.
- Never call AI services from routers or the frontend.
- Never break mock mode.
- Never call Claude in a loop without checking the cache first.
- Do not generate large amounts of code at once. Every file must be read and
  understood before commit.
- Do not silently change `models/` or `types/` — those are the contracts
  between three developers working in parallel.
