import type { ReactNode } from 'react'

export interface LegalSection {
  heading: string
  body: ReactNode
}

export interface LegalDoc {
  label: string
  title: string
  intro: string
  sections: LegalSection[]
}

/** Text of the Privacy Policy and Terms of Use. Used by the full pages and by the popups. */

export const PRIVACY: LegalDoc = {
  label: 'Privacy',
  title: 'Privacy Policy',
  intro:
    'MedBridge AI helps doctors document consultations. This page explains what information the app handles, who can see it, and which outside services process it. MedBridge AI is a final-year academic project, so please read the note on demo data at the end.',
  sections: [
    {
      heading: 'What we collect',
      body: (
        <>
          <p>
            <strong>Staff accounts:</strong> name, email address and a password (stored
            only as a hash). Doctors also add professional details such as qualification,
            specialisation and registration number.
          </p>
          <p>
            <strong>Patient details:</strong> name, age, gender, phone, email, preferred
            language and chief complaint, entered by the front desk or the doctor.
          </p>
          <p>
            <strong>Consultations:</strong> a live transcript, the structured clinical
            report made from it (symptoms, diagnosis, medicines, follow-up) and the
            patient card. The audio is processed as it streams and is not saved; only its
            length is kept.
          </p>
          <p>
            <strong>Activity log:</strong> a record of which account opened or changed
            which record, and when. It does not contain the medical content itself.
          </p>
        </>
      ),
    },
    {
      heading: 'Consent',
      body: (
        <p>
          A consultation is only recorded after the doctor confirms the patient has
          agreed to it. Patients can refuse, and the doctor can still treat them without
          using the recording feature.
        </p>
      ),
    },
    {
      heading: 'Who can see it',
      body: (
        <>
          <p>
            A doctor sees the patients assigned to them and their consultation records.
            Front desk staff see patient registration details and the status of a visit,
            but never the transcript, report, diagnosis, medicines or patient card.
          </p>
          <p>
            Patients do not have accounts. They receive their own card by email when the
            doctor sends it.
          </p>
        </>
      ),
    },
    {
      heading: 'Outside services',
      body: (
        <p>
          To work, parts of a consultation are sent to outside services: the Anthropic API
          (Claude) to extract the report and write the patient card, the US National
          Library of Medicine API to look up ICD-10 codes, and Gmail to deliver emails and
          password-reset links. If you use Google sign-in, Google confirms your identity.
          Speech-to-text runs on the clinic's own server.
        </p>
      ),
    },
    {
      heading: 'Safety and review',
      body: (
        <p>
          AI output can be wrong. Every report, warning and patient card is a draft until
          the doctor reviews it. Data is protected by sign-in, role-based access, hashed
          passwords and limits on repeated sign-in attempts.
        </p>
      ),
    },
    {
      heading: 'Deleting your data',
      body: (
        <p>
          You can delete your account from your profile page. A doctor's deletion also
          removes their patients, consultations, reports and cards. A receptionist's
          deletion removes only the account.
        </p>
      ),
    },
    {
      heading: 'Demo data',
      body: (
        <p>
          This is a capstone prototype. Use sample or consented data only, not real
          patient records, unless the clinic has approved it.
        </p>
      ),
    },
  ],
}

export const TERMS: LegalDoc = {
  label: 'Terms',
  title: 'Terms of Use',
  intro:
    'By creating an account or using MedBridge AI you agree to these terms. They are short on purpose.',
  sections: [
    {
      heading: '1. A documentation aid, not a medical device',
      body: (
        <p>
          MedBridge AI helps write up consultations. It does not diagnose, treat or
          replace a doctor's judgement.
        </p>
      ),
    },
    {
      heading: '2. The doctor is responsible',
      body: (
        <p>
          Every transcript, report, ICD-10 code and patient card must be reviewed by the
          doctor before it is used or shared. The doctor stays responsible for all
          clinical decisions.
        </p>
      ),
    },
    {
      heading: '3. Warnings are not complete',
      body: (
        <p>
          The drug-interaction check covers a limited set of known pairs. No warning does
          not mean a combination is safe.
        </p>
      ),
    },
    {
      heading: '4. Patient cards and translations',
      body: (
        <p>
          Patient cards are machine-translated explanations. They support, and do not
          replace, what the doctor tells the patient.
        </p>
      ),
    },
    {
      heading: '5. Patient consent',
      body: (
        <p>
          You must have the patient's consent before recording a consultation. Do not
          record anyone who has not agreed.
        </p>
      ),
    },
    {
      heading: '6. Your account',
      body: (
        <p>
          Keep your password private and use only your own account. Do not share your
          sign-in or enter information you are not allowed to handle.
        </p>
      ),
    },
    {
      heading: '7. Academic project, no warranty',
      body: (
        <p>
          MedBridge AI is a final-year capstone prototype, provided as is, without any
          warranty. It is not approved for unsupervised clinical use. See the Privacy
          Policy for how data is handled.
        </p>
      ),
    },
  ],
}
