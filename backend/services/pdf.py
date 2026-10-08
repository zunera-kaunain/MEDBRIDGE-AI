"""PDF export of consultation reports and patient cards.

Reports use reportlab directly (Latin text only, fast, no browser needed).
Patient cards use a headless browser (Playwright) instead — Kannada,
Hindi, Tamil, Telugu, and Malayalam all require script shaping (conjuncts,
vowel reordering) that reportlab cannot do; a real browser engine renders
them correctly because it's the same engine that renders them on screen.
"""

import base64
import io
from pathlib import Path

from playwright.async_api import async_playwright
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from models.doctor import Doctor
from models.patient import Patient
from models.report import PatientCard, ReferralSummary, Report

_INK = colors.HexColor("#16211c")
_GRAPHITE = colors.HexColor("#6b7268")
_RULE = colors.HexColor("#dcd7cb")
_SEAL = colors.HexColor("#1f4d3f")

FONT_DIR = Path(__file__).parent.parent / "fonts"

_FONT_FILES = {
    "kn": "NotoSansKannada-Regular.ttf",
    "hi": "NotoSansDevanagari-Regular.ttf",
    "ta": "NotoSansTamil-Regular.ttf",
    "te": "NotoSansTelugu-Regular.ttf",
    "ml": "NotoSansMalayalam-Regular.ttf",
    "en": "NotoSans-Regular.ttf",
}


# ---------------------------------------------------------------------------
# Consultation report — reportlab, Latin text only
# ---------------------------------------------------------------------------

def _styles():
    base = getSampleStyleSheet()
    return {
        "clinic": ParagraphStyle(
            "clinic", parent=base["Title"], fontSize=17, leading=20,
            textColor=_INK, spaceAfter=1,
        ),
        "clinic_sub": ParagraphStyle(
            "clinic_sub", parent=base["Normal"], fontSize=9,
            textColor=_GRAPHITE, spaceAfter=0,
        ),
        "doc_title": ParagraphStyle(
            "doc_title", parent=base["Normal"], fontSize=10,
            textColor=_GRAPHITE, spaceBefore=6, spaceAfter=0,
        ),
        "heading": ParagraphStyle(
            "heading", parent=base["Normal"], fontSize=9,
            textColor=_SEAL, spaceBefore=14, spaceAfter=5,
            leading=11,
        ),
        "body": ParagraphStyle(
            "body", parent=base["Normal"], fontSize=10.5, leading=15,
            textColor=_INK,
        ),
        "meta_label": ParagraphStyle(
            "meta_label", parent=base["Normal"], fontSize=7.5,
            textColor=_GRAPHITE,
        ),
        "meta_value": ParagraphStyle(
            "meta_value", parent=base["Normal"], fontSize=10,
            textColor=_INK, spaceAfter=0,
        ),
        "footer": ParagraphStyle(
            "footer", parent=base["Normal"], fontSize=7.5,
            textColor=_GRAPHITE,
        ),
    }


def _rule():
    return HRFlowable(width="100%", thickness=0.75, color=_RULE, spaceBefore=2, spaceAfter=2)


def _meta_block(styles, label: str, value: str):
    return [
        Paragraph(label.upper(), styles["meta_label"]),
        Paragraph(value, styles["meta_value"]),
    ]


def build_report_pdf(report: Report, patient: Patient, doctor: Doctor) -> bytes:
    """Render a confirmed report as a PDF and return the raw bytes."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        topMargin=18 * mm, bottomMargin=18 * mm,
        leftMargin=20 * mm, rightMargin=20 * mm,
    )
    styles = _styles()
    story = []

    # --- Letterhead ---------------------------------------------------
    clinic_name = doctor.clinic_name or doctor.full_name
    story.append(Paragraph(clinic_name, styles["clinic"]))

    doctor_line = f"{doctor.full_name}"
    if doctor.qualification or doctor.specialization:
        doctor_line += f" · {doctor.qualification or ''} {doctor.specialization or ''}".rstrip()
    story.append(Paragraph(doctor_line, styles["clinic_sub"]))

    if getattr(doctor, "clinic_address", None):
        story.append(Paragraph(doctor.clinic_address, styles["clinic_sub"]))

    story.append(Spacer(1, 4 * mm))
    story.append(_rule())
    story.append(Spacer(1, 4 * mm))

    story.append(Paragraph("CONSULTATION CASE SHEET", styles["doc_title"]))
    story.append(Spacer(1, 3 * mm))

    # --- Patient / meta strip ------------------------------------------
    meta_table = Table(
        [[
            _meta_block(styles, "Patient", patient.full_name),
            _meta_block(styles, "Patient ID", patient.short_id),
            _meta_block(styles, "Age / Gender", f"{patient.age} / {patient.gender.value.title()}"),
            _meta_block(styles, "Confirmed", report.confirmed_at.strftime("%d %b %Y, %H:%M")
                        if report.confirmed_at else "—"),
        ]],
        colWidths=[45 * mm, 30 * mm, 35 * mm, 45 * mm],
    )
    meta_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 3 * mm))
    story.append(_rule())

    # --- Clinical content ------------------------------------------------
    if report.chief_complaint:
        story.append(Paragraph("CHIEF COMPLAINT", styles["heading"]))
        story.append(Paragraph(report.chief_complaint.text, styles["body"]))

    if report.symptoms:
        story.append(Paragraph("SYMPTOMS", styles["heading"]))
        for s in report.symptoms:
            story.append(Paragraph(f"•  {s.text}", styles["body"]))

    if report.diagnosis:
        story.append(Paragraph("DIAGNOSIS", styles["heading"]))
        for d in report.diagnosis:
            story.append(Paragraph(f"•  {d.text}", styles["body"]))

    if report.family_history:
        story.append(Paragraph("FAMILY HISTORY", styles["heading"]))
        for h in report.family_history:
            story.append(Paragraph(f"•  {h.text}", styles["body"]))

    if report.medications:
        story.append(Paragraph("MEDICATIONS", styles["heading"]))

        cell_style = ParagraphStyle(
            "cell", parent=styles["body"], fontSize=9, leading=12,
        )
        header_style = ParagraphStyle(
            "cell_header", parent=cell_style, textColor=_GRAPHITE,
            fontName="Helvetica-Bold",
        )

        def cell(text: str, style=cell_style) -> Paragraph:
            return Paragraph(text, style)

        rows = [[
            cell("Medicine", header_style),
            cell("Dosage", header_style),
            cell("Frequency", header_style),
            cell("Duration", header_style),
            cell("Instructions", header_style),
        ]]
        for m in report.medications:
            rows.append([
                cell(m.name.text),
                cell(m.dosage.text if m.dosage else "—"),
                cell(m.frequency.text if m.frequency else "—"),
                cell(m.duration.text if m.duration else "—"),
                cell(m.instructions.text if m.instructions else "—"),
            ])

        med_table = Table(rows, colWidths=[28 * mm, 22 * mm, 26 * mm, 22 * mm, 42 * mm])
        med_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LINEBELOW", (0, 0), (-1, 0), 0.75, _RULE),
            ("LINEBELOW", (0, 1), (-1, -1), 0.5, _RULE),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ("TOPPADDING", (0, 0), (-1, -1), 7),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(med_table)

    if report.followup.duration or report.followup.instructions:
        story.append(Paragraph("FOLLOW-UP", styles["heading"]))
        if report.followup.duration:
            story.append(Paragraph(f"Return: {report.followup.duration.text}", styles["body"]))
        if report.followup.instructions:
            story.append(Paragraph(report.followup.instructions.text, styles["body"]))

    # --- Footer -----------------------------------------------------------
    story.append(Spacer(1, 10 * mm))
    story.append(_rule())
    story.append(Spacer(1, 3 * mm))
    story.append(Paragraph(
        "Generated with AI assistance and reviewed and confirmed by the attending "
        "doctor prior to issue. Doctor credentials are self-reported and not "
        "independently verified by MedBridge AI.",
        styles["footer"],
    ))

    doc.build(story)
    return buffer.getvalue()


# ---------------------------------------------------------------------------
# Referral letter — reportlab, same style as the report, letter layout
# ---------------------------------------------------------------------------

def build_referral_pdf(
    referral: ReferralSummary, patient: Patient, doctor: Doctor
) -> bytes:
    """Render a referral letter as a PDF and return the raw bytes.

    Clinician-to-clinician handoff document, addressed to the specialist
    named on the referral — deliberately plainer than the consultation
    report (no medication table, no follow-up section), since a receiving
    specialist needs the reason and the relevant clinical summary, not
    the full OPD note.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        topMargin=18 * mm, bottomMargin=18 * mm,
        leftMargin=20 * mm, rightMargin=20 * mm,
    )
    styles = _styles()
    story = []

    # --- Letterhead ---------------------------------------------------
    clinic_name = doctor.clinic_name or doctor.full_name
    story.append(Paragraph(clinic_name, styles["clinic"]))

    doctor_line = f"{doctor.full_name}"
    if doctor.qualification or doctor.specialization:
        doctor_line += f" · {doctor.qualification or ''} {doctor.specialization or ''}".rstrip()
    story.append(Paragraph(doctor_line, styles["clinic_sub"]))

    if getattr(doctor, "clinic_address", None):
        story.append(Paragraph(doctor.clinic_address, styles["clinic_sub"]))

    story.append(Spacer(1, 4 * mm))
    story.append(_rule())
    story.append(Spacer(1, 4 * mm))

    story.append(Paragraph("REFERRAL LETTER", styles["doc_title"]))
    story.append(Spacer(1, 3 * mm))

    # --- To / Re block --------------------------------------------------
    to_line = referral.specialist_name or "The Attending Specialist"
    if referral.department:
        to_line += f", {referral.department}"

    story.append(Paragraph(referral.generated_at.strftime("%d %b %Y"), styles["body"]))
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph(f"To: {to_line}", styles["body"]))
    story.append(Spacer(1, 2 * mm))
    story.append(Paragraph(
        f"Re: {patient.full_name} "
        f"({patient.age} / {patient.gender.value.title()}, ID {patient.short_id})",
        styles["body"],
    ))
    story.append(Spacer(1, 4 * mm))
    story.append(_rule())

    # --- Body -------------------------------------------------------------
    story.append(Paragraph("REASON FOR REFERRAL", styles["heading"]))
    story.append(Paragraph(referral.reason, styles["body"]))

    if referral.chief_complaint:
        story.append(Paragraph("CHIEF COMPLAINT", styles["heading"]))
        story.append(Paragraph(referral.chief_complaint, styles["body"]))

    if referral.diagnosis:
        story.append(Paragraph("DIAGNOSIS", styles["heading"]))
        for d in referral.diagnosis:
            story.append(Paragraph(f"•  {d}", styles["body"]))

    if referral.icd_codes:
        story.append(Paragraph("ICD-10-CM CODES", styles["heading"]))
        for c in referral.icd_codes:
            story.append(Paragraph(f"•  {c}", styles["body"]))

    if referral.medications:
        story.append(Paragraph("CURRENT MEDICATIONS", styles["heading"]))
        for m in referral.medications:
            story.append(Paragraph(f"•  {m}", styles["body"]))

    # --- Signature ----------------------------------------------------
    story.append(Spacer(1, 12 * mm))
    story.append(Paragraph("Regards,", styles["body"]))
    story.append(Spacer(1, 10 * mm))
    story.append(Paragraph(doctor.full_name, styles["body"]))
    if doctor.registration_number:
        story.append(Paragraph(
            f"Reg. No. {doctor.registration_number}"
            + (f" ({doctor.state_medical_council})" if doctor.state_medical_council else ""),
            styles["clinic_sub"],
        ))

    # --- Footer -----------------------------------------------------------
    story.append(Spacer(1, 10 * mm))
    story.append(_rule())
    story.append(Spacer(1, 3 * mm))
    story.append(Paragraph(
        "Generated with AI assistance and reviewed and confirmed by the attending "
        "doctor prior to issue. Doctor credentials are self-reported and not "
        "independently verified by MedBridge AI.",
        styles["footer"],
    ))

    doc.build(story)
    return buffer.getvalue()


# ---------------------------------------------------------------------------
# Patient card — Playwright, needed for correct Indic script rendering
# ---------------------------------------------------------------------------

def _font_data_uri(language: str) -> str | None:
    """Base64-embed the font so the HTML is fully self-contained —
    no internet needed at render time, no risk of a missing font file
    silently falling back to something that can't render the script.
    """
    filename = _FONT_FILES.get(language, _FONT_FILES["en"])
    path = FONT_DIR / filename
    if not path.exists():
        return None
    data = base64.b64encode(path.read_bytes()).decode()
    return f"data:font/truetype;charset=utf-8;base64,{data}"


def _card_html(card: PatientCard, patient_name: str) -> str:
    font_uri = _font_data_uri(card.language.value)
    font_face = (
        f"@font-face {{ font-family: 'CardFont'; src: url({font_uri}) format('truetype'); }}"
        if font_uri else ""
    )

    meds = "".join(f"<li>{line}</li>" for line in card.medication_instructions)
    warnings = "".join(f"<li>{sign}</li>" for sign in card.warning_signs)

    return f"""
    <html>
    <head>
    <meta charset="utf-8">
    <style>
        {font_face}
        body {{
            font-family: 'CardFont', 'Noto Sans', sans-serif;
            color: #16211c;
            padding: 32px 40px;
            line-height: 1.6;
        }}
        h1 {{ font-size: 20px; margin-bottom: 4px; }}
        .rule {{ border-top: 1px solid #dcd7cb; margin: 16px 0; }}
        h2 {{
            font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em;
            color: #1f4d3f; margin: 20px 0 8px 0;
        }}
        p {{ font-size: 13px; margin: 4px 0; }}
        ul {{ margin: 4px 0; padding-left: 20px; font-size: 13px; }}
        .warning-box {{
            border-left: 3px solid #a33; background: #fbeeec;
            padding: 12px 16px; margin-top: 8px;
        }}
        .warning-box h2 {{ color: #a33; margin-top: 0; }}
    </style>
    </head>
    <body>
        <h1>Visit summary for {patient_name}</h1>
        <div class="rule"></div>
        <p>{card.greeting}</p>

        <h2>Your Condition</h2>
        <p>{card.condition_explanation}</p>

        <h2>Your Medicines</h2>
        <ul>{meds}</ul>

        <h2>Follow-up</h2>
        <p>{card.followup_instructions}</p>

        <div class="warning-box">
            <h2>Return immediately if</h2>
            <ul>{warnings}</ul>
        </div>
    </body>
    </html>
    """


async def build_card_pdf(card: PatientCard, patient_name: str) -> bytes:
    """Render a patient explanation card as a PDF using a real browser
    engine, so complex Indic script shaping (conjuncts, vowel reordering)
    renders correctly — something reportlab cannot do on its own.
    """
    html = _card_html(card, patient_name)

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.set_content(html)
        pdf_bytes = await page.pdf(
            format="A4",
            margin={"top": "0", "bottom": "0", "left": "0", "right": "0"},
        )
        await browser.close()

    return pdf_bytes