"""PDF export of a confirmed consultation report.

Produces a clean, printable clinic letterhead-style document.
"""

import io

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
from models.report import Report

_INK = colors.HexColor("#16211c")
_GRAPHITE = colors.HexColor("#6b7268")
_RULE = colors.HexColor("#dcd7cb")
_SEAL = colors.HexColor("#1f4d3f")


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

    story.append(Paragraph("CONSULTATION REPORT", styles["doc_title"]))
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