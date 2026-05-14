"""Endpoints de exportación a Excel (.xlsx).

Cada endpoint genera un archivo Excel y lo devuelve como descarga directa.
Cada export tiene reglas de permisos específicas.
"""
from datetime import datetime, date as date_type, timedelta
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.doctor import Doctor
from app.models.specialty import Specialty
from app.models.clinic import Clinic
from app.models.appointment import Appointment, AppointmentStatus
from app.models.payment import Payment, PaymentStatus
from app.models.mood_entry import MoodEntry
from app.models.homework import HomeworkAssignment, HomeworkStatus
from app.models.questionnaire import QuestionnaireAssignment
from app.models.tutor import TutorRelationship
from app.models.company import Company, CompanyMembership
from app.api.deps import get_current_user, require_admin
from app.services.exports import excel_response

router = APIRouter(prefix="/exports", tags=["Exports Excel"])


def _today_iso() -> str:
    return date_type.today().isoformat()


# ─── Citas ───────────────────────────────────────────────────────────────

@router.get("/appointments")
def export_appointments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Citas:
       - admin/recepción: todas
       - doctor: las suyas
       - paciente: las suyas
    """
    q = db.query(Appointment).options(
        joinedload(Appointment.patient),
        joinedload(Appointment.doctor).joinedload(Doctor.user),
        joinedload(Appointment.doctor).joinedload(Doctor.specialty),
    )
    scope = "Todas las citas"
    if current_user.role == UserRole.doctor:
        doc = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
        if not doc:
            raise HTTPException(status_code=404, detail="Psicólogo/a no encontrado/a")
        q = q.filter(Appointment.doctor_id == doc.id)
        scope = f"Ps. {current_user.first_name} {current_user.last_name}"
    elif current_user.role == UserRole.patient:
        q = q.filter(Appointment.patient_id == current_user.id)
        scope = f"{current_user.first_name} {current_user.last_name}"
    elif current_user.role not in (UserRole.admin, UserRole.receptionist):
        raise HTTPException(status_code=403, detail="Sin permiso")

    rows = []
    for a in q.order_by(Appointment.appointment_date.desc(), Appointment.start_time.desc()).all():
        rows.append({
            "id": a.id,
            "fecha": a.appointment_date,
            "hora_inicio": a.start_time,
            "hora_fin": a.end_time,
            "estado": a.status.value if a.status else "",
            "modalidad": a.modality,
            "paciente": f"{a.patient.first_name} {a.patient.last_name}" if a.patient else "",
            "paciente_email": a.patient.email if a.patient else "",
            "paciente_rut": a.patient.rut if a.patient else "",
            "doctor": (
                f"Ps. {a.doctor.user.first_name} {a.doctor.user.last_name}"
                if a.doctor and a.doctor.user else ""
            ),
            "especialidad": a.doctor.specialty.name if a.doctor and a.doctor.specialty else "",
            "motivo": a.reason or "",
            "cancelacion": a.cancellation_reason or "",
            "cubierta_por_empresa": a.paid_by_company_id is not None,
            "creada": a.created_at,
        })

    headers = [
        {"key": "id",                "label": "ID",                "width": 8},
        {"key": "fecha",             "label": "Fecha",             "width": 12},
        {"key": "hora_inicio",       "label": "Hora inicio",       "width": 10},
        {"key": "hora_fin",          "label": "Hora fin",          "width": 10},
        {"key": "estado",            "label": "Estado",            "width": 14},
        {"key": "modalidad",         "label": "Modalidad",         "width": 12},
        {"key": "paciente",          "label": "Paciente",          "width": 28},
        {"key": "paciente_email",    "label": "Email paciente",    "width": 32},
        {"key": "paciente_rut",      "label": "RUT paciente",      "width": 14},
        {"key": "doctor",            "label": "Profesional",       "width": 28},
        {"key": "especialidad",      "label": "Especialidad",      "width": 20},
        {"key": "motivo",            "label": "Motivo",            "width": 30},
        {"key": "cancelacion",       "label": "Razón cancelación", "width": 26},
        {"key": "cubierta_por_empresa", "label": "Cubierta por empresa", "width": 16},
        {"key": "creada",            "label": "Creada",            "width": 18},
    ]
    return excel_response(
        rows, headers, f"citas_{_today_iso()}",
        sheet_name="Citas",
        title="Reporte de citas",
        subtitle=f"{scope} · Generado {datetime.now().strftime('%d-%m-%Y %H:%M')} · {len(rows)} registros",
    )


# ─── Pacientes (admin) ───────────────────────────────────────────────────

@router.get("/patients")
def export_patients(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    rows_data = db.query(User).filter(User.role == UserRole.patient).order_by(User.first_name).all()
    today = date_type.today()
    rows = []
    for p in rows_data:
        age = None
        if p.birth_date:
            age = today.year - p.birth_date.year - ((today.month, today.day) < (p.birth_date.month, p.birth_date.day))
        appts_total = db.query(Appointment).filter(Appointment.patient_id == p.id).count()
        rows.append({
            "id": p.id,
            "nombre": p.first_name,
            "apellido": p.last_name,
            "email": p.email,
            "telefono": p.phone or "",
            "rut": p.rut or "",
            "edad": age if age is not None else "",
            "fecha_nacimiento": p.birth_date,
            "direccion": p.address or "",
            "prevision": p.health_insurance or "",
            "estado": p.patient_status or "active",
            "activo": p.is_active,
            "doctor_asignado_id": p.assigned_doctor_id or "",
            "citas_totales": appts_total,
            "registrado": p.created_at,
        })

    headers = [
        {"key": "id",                  "label": "ID",                 "width": 8},
        {"key": "nombre",              "label": "Nombre",             "width": 18},
        {"key": "apellido",            "label": "Apellido",           "width": 18},
        {"key": "email",               "label": "Email",              "width": 32},
        {"key": "telefono",            "label": "Teléfono",           "width": 16},
        {"key": "rut",                 "label": "RUT",                "width": 14},
        {"key": "edad",                "label": "Edad",               "width": 8},
        {"key": "fecha_nacimiento",    "label": "Fecha nacimiento",   "width": 16},
        {"key": "direccion",           "label": "Dirección",          "width": 32},
        {"key": "prevision",           "label": "Previsión",          "width": 18},
        {"key": "estado",              "label": "Estado clínico",     "width": 14},
        {"key": "activo",              "label": "Cuenta activa",      "width": 12},
        {"key": "doctor_asignado_id",  "label": "Doctor asignado",    "width": 12},
        {"key": "citas_totales",       "label": "Citas totales",      "width": 12},
        {"key": "registrado",          "label": "Registrado",         "width": 18},
    ]
    return excel_response(
        rows, headers, f"pacientes_{_today_iso()}",
        sheet_name="Pacientes",
        title="Listado de pacientes",
        subtitle=f"Generado {datetime.now().strftime('%d-%m-%Y %H:%M')} · {len(rows)} pacientes",
    )


# ─── Pagos (admin) ───────────────────────────────────────────────────────

@router.get("/payments")
def export_payments(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    rows_data = db.query(Payment).options(
        joinedload(Payment.appointment).joinedload(Appointment.patient),
        joinedload(Payment.appointment).joinedload(Appointment.doctor).joinedload(Doctor.user),
    ).order_by(Payment.created_at.desc()).all()
    rows = []
    for p in rows_data:
        a = p.appointment
        rows.append({
            "id": p.id,
            "appointment_id": p.appointment_id,
            "monto": p.amount,
            "moneda": p.currency,
            "estado": p.status.value if p.status else "",
            "proveedor": p.provider or "",
            "provider_id": p.provider_id or "",
            "paciente": f"{a.patient.first_name} {a.patient.last_name}" if a and a.patient else "",
            "paciente_email": a.patient.email if a and a.patient else "",
            "doctor": (
                f"Ps. {a.doctor.user.first_name} {a.doctor.user.last_name}"
                if a and a.doctor and a.doctor.user else ""
            ),
            "cita_fecha": a.appointment_date if a else "",
            "creado": p.created_at,
            "actualizado": p.updated_at,
        })

    headers = [
        {"key": "id",                "label": "ID",             "width": 8},
        {"key": "appointment_id",    "label": "Cita ID",        "width": 10},
        {"key": "monto",             "label": "Monto",          "width": 12},
        {"key": "moneda",            "label": "Moneda",         "width": 8},
        {"key": "estado",            "label": "Estado",         "width": 14},
        {"key": "proveedor",         "label": "Proveedor",      "width": 14},
        {"key": "provider_id",       "label": "ID proveedor",   "width": 24},
        {"key": "paciente",          "label": "Paciente",       "width": 28},
        {"key": "paciente_email",    "label": "Email",          "width": 30},
        {"key": "doctor",            "label": "Profesional",    "width": 28},
        {"key": "cita_fecha",        "label": "Fecha cita",     "width": 12},
        {"key": "creado",            "label": "Creado",         "width": 18},
        {"key": "actualizado",       "label": "Actualizado",    "width": 18},
    ]
    return excel_response(
        rows, headers, f"pagos_{_today_iso()}",
        sheet_name="Pagos",
        title="Historial de pagos",
        subtitle=f"Generado {datetime.now().strftime('%d-%m-%Y %H:%M')} · {len(rows)} pagos",
    )


# ─── Diario emocional (paciente / doctor de ese paciente) ────────────────

def _can_view_patient_data(current_user: User, patient_id: int, db: Session) -> bool:
    if current_user.role == UserRole.patient and current_user.id == patient_id:
        return True
    if current_user.role in (UserRole.doctor, UserRole.admin, UserRole.receptionist):
        return True
    if current_user.role == UserRole.tutor:
        link = db.query(TutorRelationship).filter(
            TutorRelationship.patient_id == patient_id,
            TutorRelationship.tutor_user_id == current_user.id,
        ).first()
        return link is not None
    return False


@router.get("/mood/patient/{patient_id}")
def export_mood(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not _can_view_patient_data(current_user, patient_id, db):
        raise HTTPException(status_code=403, detail="Sin permiso")
    patient = db.query(User).filter(User.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")

    rows_data = db.query(MoodEntry).filter(MoodEntry.patient_id == patient_id).order_by(MoodEntry.date.asc()).all()
    rows = [{
        "fecha": e.date,
        "score": e.score,
        "etiqueta": _mood_label(e.score),
        "nota": e.note or "",
        "registrado": e.created_at,
    } for e in rows_data]
    headers = [
        {"key": "fecha",      "label": "Fecha",       "width": 12},
        {"key": "score",      "label": "Score (1-10)","width": 12},
        {"key": "etiqueta",   "label": "Etiqueta",    "width": 16},
        {"key": "nota",       "label": "Nota",        "width": 50},
        {"key": "registrado", "label": "Registrado",  "width": 18},
    ]
    return excel_response(
        rows, headers, f"diario_emocional_{patient.first_name}_{patient.last_name}_{_today_iso()}",
        sheet_name="Diario emocional",
        title=f"Diario emocional · {patient.first_name} {patient.last_name}",
        subtitle=f"Generado {datetime.now().strftime('%d-%m-%Y %H:%M')} · {len(rows)} registros",
    )


def _mood_label(s):
    if s <= 2: return "Muy bajo"
    if s <= 4: return "Bajo"
    if s == 5: return "Neutro"
    if s <= 7: return "Bien"
    return "Excelente"


# ─── Tareas (paciente / doctor) ──────────────────────────────────────────

@router.get("/homework/patient/{patient_id}")
def export_homework(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not _can_view_patient_data(current_user, patient_id, db):
        raise HTTPException(status_code=403, detail="Sin permiso")
    patient = db.query(User).filter(User.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")

    rows_data = (
        db.query(HomeworkAssignment)
        .options(joinedload(HomeworkAssignment.doctor).joinedload(Doctor.user))
        .filter(HomeworkAssignment.patient_id == patient_id)
        .order_by(HomeworkAssignment.created_at.desc())
        .all()
    )
    rows = [{
        "id": h.id,
        "titulo": h.title,
        "descripcion": h.description or "",
        "estado": h.status.value if hasattr(h.status, "value") else str(h.status),
        "fecha_limite": h.due_date,
        "doctor": (
            f"Ps. {h.doctor.user.first_name} {h.doctor.user.last_name}"
            if h.doctor and h.doctor.user else ""
        ),
        "feedback_paciente": h.patient_feedback or "",
        "asignada": h.created_at,
        "completada": h.completed_at,
    } for h in rows_data]
    headers = [
        {"key": "id",                "label": "ID",             "width": 8},
        {"key": "titulo",            "label": "Título",         "width": 30},
        {"key": "descripcion",       "label": "Descripción",    "width": 50},
        {"key": "estado",            "label": "Estado",         "width": 12},
        {"key": "fecha_limite",      "label": "Fecha límite",   "width": 14},
        {"key": "doctor",            "label": "Profesional",    "width": 28},
        {"key": "feedback_paciente", "label": "Feedback paciente", "width": 40},
        {"key": "asignada",          "label": "Asignada",       "width": 18},
        {"key": "completada",        "label": "Completada",     "width": 18},
    ]
    return excel_response(
        rows, headers, f"tareas_{patient.first_name}_{patient.last_name}_{_today_iso()}",
        sheet_name="Tareas",
        title=f"Tareas entre sesiones · {patient.first_name} {patient.last_name}",
        subtitle=f"Generado {datetime.now().strftime('%d-%m-%Y %H:%M')} · {len(rows)} tareas",
    )


# ─── Cuestionarios psicológicos (paciente / doctor) ──────────────────────

@router.get("/questionnaires/patient/{patient_id}")
def export_questionnaires(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not _can_view_patient_data(current_user, patient_id, db):
        raise HTTPException(status_code=403, detail="Sin permiso")
    patient = db.query(User).filter(User.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")

    rows_data = (
        db.query(QuestionnaireAssignment)
        .options(joinedload(QuestionnaireAssignment.doctor).joinedload(Doctor.user))
        .filter(QuestionnaireAssignment.patient_id == patient_id)
        .order_by(QuestionnaireAssignment.created_at.desc())
        .all()
    )
    rows = [{
        "id": a.id,
        "cuestionario": a.code.upper(),
        "estado": a.status,
        "score": a.score,
        "score_maximo": a.max_score,
        "severidad": a.severity_label or "",
        "crisis_detectada": bool(a.crisis_flagged),
        "doctor": (
            f"Ps. {a.doctor.user.first_name} {a.doctor.user.last_name}"
            if a.doctor and a.doctor.user else ""
        ),
        "nota_doctor": a.doctor_note or "",
        "comentario_paciente": a.patient_comment or "",
        "asignado": a.created_at,
        "completado": a.completed_at,
    } for a in rows_data]
    headers = [
        {"key": "id",                  "label": "ID",            "width": 8},
        {"key": "cuestionario",        "label": "Cuestionario",  "width": 14},
        {"key": "estado",              "label": "Estado",        "width": 12},
        {"key": "score",               "label": "Score",         "width": 8},
        {"key": "score_maximo",        "label": "Score máx",     "width": 10},
        {"key": "severidad",           "label": "Severidad",     "width": 18},
        {"key": "crisis_detectada",    "label": "Crisis",        "width": 10},
        {"key": "doctor",              "label": "Profesional",   "width": 28},
        {"key": "nota_doctor",         "label": "Nota del prof", "width": 32},
        {"key": "comentario_paciente", "label": "Comentario paciente", "width": 36},
        {"key": "asignado",            "label": "Asignado",      "width": 18},
        {"key": "completado",          "label": "Completado",    "width": 18},
    ]
    return excel_response(
        rows, headers, f"cuestionarios_{patient.first_name}_{patient.last_name}_{_today_iso()}",
        sheet_name="Cuestionarios",
        title=f"Cuestionarios psicológicos · {patient.first_name} {patient.last_name}",
        subtitle=f"Generado {datetime.now().strftime('%d-%m-%Y %H:%M')} · {len(rows)} registros",
    )


# ─── Empresas (admin) ────────────────────────────────────────────────────

@router.get("/companies")
def export_companies(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    rows_data = db.query(Company).order_by(Company.name).all()
    rows = []
    for c in rows_data:
        members_active = db.query(CompanyMembership).filter(
            CompanyMembership.company_id == c.id, CompanyMembership.is_active == True
        ).count()
        members_total = db.query(CompanyMembership).filter(
            CompanyMembership.company_id == c.id
        ).count()
        rows.append({
            "id": c.id,
            "nombre": c.name,
            "rut": c.rut or "",
            "billing_email": c.billing_email or "",
            "contacto_nombre": c.contact_name or "",
            "contacto_telefono": c.contact_phone or "",
            "pool_actual": c.sessions_pool,
            "pool_usado_total": c.sessions_used,
            "tope_mensual_empleado": c.monthly_cap_per_employee or "",
            "empleados_activos": members_active,
            "empleados_total": members_total,
            "activa": c.is_active,
            "creada": c.created_at,
        })
    headers = [
        {"key": "id",                     "label": "ID",                "width": 8},
        {"key": "nombre",                 "label": "Empresa",           "width": 30},
        {"key": "rut",                    "label": "RUT",               "width": 14},
        {"key": "billing_email",          "label": "Email facturación", "width": 32},
        {"key": "contacto_nombre",        "label": "Contacto",          "width": 24},
        {"key": "contacto_telefono",      "label": "Teléfono",          "width": 16},
        {"key": "pool_actual",            "label": "Pool actual",       "width": 12},
        {"key": "pool_usado_total",       "label": "Pool usado total",  "width": 14},
        {"key": "tope_mensual_empleado",  "label": "Tope mensual/empleado", "width": 14},
        {"key": "empleados_activos",      "label": "Empleados activos", "width": 14},
        {"key": "empleados_total",        "label": "Empleados total",   "width": 14},
        {"key": "activa",                 "label": "Activa",            "width": 10},
        {"key": "creada",                 "label": "Creada",            "width": 18},
    ]
    return excel_response(
        rows, headers, f"empresas_{_today_iso()}",
        sheet_name="Empresas",
        title="Listado de empresas / convenios B2B",
        subtitle=f"Generado {datetime.now().strftime('%d-%m-%Y %H:%M')} · {len(rows)} empresas",
    )


@router.get("/company/{company_id}/usage")
def export_company_usage(
    company_id: int,
    days: int = Query(default=180, ge=1, le=730),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Uso de sesiones de una empresa (admin platform o company_admin de esa empresa)."""
    c = db.query(Company).filter(Company.id == company_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    if current_user.role == UserRole.admin:
        pass
    elif current_user.role == UserRole.company_admin and c.company_admin_user_id == current_user.id:
        pass
    else:
        raise HTTPException(status_code=403, detail="Sin permiso")

    since = date_type.today() - timedelta(days=days)
    rows_data = (
        db.query(Appointment)
        .options(
            joinedload(Appointment.patient),
            joinedload(Appointment.doctor).joinedload(Doctor.user),
            joinedload(Appointment.doctor).joinedload(Doctor.specialty),
        )
        .filter(
            Appointment.paid_by_company_id == company_id,
            Appointment.appointment_date >= since,
        )
        .order_by(Appointment.appointment_date.desc())
        .all()
    )
    rows = [{
        "fecha": a.appointment_date,
        "hora": a.start_time,
        "empleado": f"{a.patient.first_name} {a.patient.last_name}" if a.patient else "",
        "empleado_email": a.patient.email if a.patient else "",
        "doctor": (
            f"Ps. {a.doctor.user.first_name} {a.doctor.user.last_name}"
            if a.doctor and a.doctor.user else ""
        ),
        "especialidad": a.doctor.specialty.name if a.doctor and a.doctor.specialty else "",
        "modalidad": a.modality,
        "estado": a.status.value if a.status else "",
    } for a in rows_data]
    headers = [
        {"key": "fecha",          "label": "Fecha",        "width": 12},
        {"key": "hora",           "label": "Hora",         "width": 10},
        {"key": "empleado",       "label": "Empleado",     "width": 28},
        {"key": "empleado_email", "label": "Email",        "width": 32},
        {"key": "doctor",         "label": "Profesional",  "width": 28},
        {"key": "especialidad",   "label": "Especialidad", "width": 20},
        {"key": "modalidad",      "label": "Modalidad",    "width": 12},
        {"key": "estado",         "label": "Estado",       "width": 14},
    ]
    return excel_response(
        rows, headers, f"uso_{c.name.replace(' ', '_')}_{_today_iso()}",
        sheet_name="Uso B2B",
        title=f"Uso del pool · {c.name}",
        subtitle=f"Últimos {days} días · Generado {datetime.now().strftime('%d-%m-%Y %H:%M')} · {len(rows)} sesiones",
    )


# ─── Tutores (admin) ─────────────────────────────────────────────────────

@router.get("/tutors")
def export_tutors(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    rows_data = (
        db.query(TutorRelationship)
        .options(joinedload(TutorRelationship.patient))
        .order_by(TutorRelationship.created_at.desc())
        .all()
    )
    rows = [{
        "id": t.id,
        "tutor_nombre": t.name,
        "relacion": t.relationship_label,
        "tutor_email": t.email or "",
        "tutor_telefono": t.phone or "",
        "tutor_rut": t.rut or "",
        "tutor_legal": bool(t.is_legal_guardian),
        "tiene_cuenta": t.tutor_user_id is not None,
        "alerta_crisis": bool(t.notify_on_crisis),
        "recibe_citas": bool(t.notify_on_appointments),
        "ve_perfil_completo": bool(t.can_view_full_profile),
        "paciente": f"{t.patient.first_name} {t.patient.last_name}" if t.patient else "",
        "paciente_email": t.patient.email if t.patient else "",
        "creado": t.created_at,
    } for t in rows_data]
    headers = [
        {"key": "id",                  "label": "ID",              "width": 8},
        {"key": "tutor_nombre",        "label": "Tutor",           "width": 28},
        {"key": "relacion",            "label": "Relación",        "width": 18},
        {"key": "tutor_email",         "label": "Email tutor",     "width": 32},
        {"key": "tutor_telefono",      "label": "Teléfono",        "width": 16},
        {"key": "tutor_rut",           "label": "RUT",             "width": 14},
        {"key": "tutor_legal",         "label": "Tutor legal",     "width": 12},
        {"key": "tiene_cuenta",        "label": "Tiene cuenta",    "width": 12},
        {"key": "alerta_crisis",       "label": "Alerta crisis",   "width": 12},
        {"key": "recibe_citas",        "label": "Recibe citas",    "width": 12},
        {"key": "ve_perfil_completo",  "label": "Ve perfil completo", "width": 14},
        {"key": "paciente",            "label": "Paciente",        "width": 28},
        {"key": "paciente_email",      "label": "Email paciente",  "width": 32},
        {"key": "creado",              "label": "Creado",          "width": 18},
    ]
    return excel_response(
        rows, headers, f"tutores_{_today_iso()}",
        sheet_name="Tutores",
        title="Listado de tutores y contactos de crisis",
        subtitle=f"Generado {datetime.now().strftime('%d-%m-%Y %H:%M')} · {len(rows)} tutores",
    )


# ─── Doctores (admin) ────────────────────────────────────────────────────

@router.get("/doctors")
def export_doctors(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    rows_data = db.query(Doctor).options(
        joinedload(Doctor.user),
        joinedload(Doctor.specialty),
        joinedload(Doctor.clinic),
    ).all()
    rows = [{
        "id": d.id,
        "nombre": d.user.first_name if d.user else "",
        "apellido": d.user.last_name if d.user else "",
        "email": d.user.email if d.user else "",
        "telefono": d.user.phone if d.user else "",
        "rut": d.user.rut if d.user else "",
        "especialidad": d.specialty.name if d.specialty else "",
        "clinica": d.clinic.name if d.clinic else "",
        "licencia": d.license_number,
        "duracion_consulta_min": d.consultation_duration,
        "precio_clp": d.consultation_price,
        "activo": d.is_active,
    } for d in rows_data]
    headers = [
        {"key": "id",                    "label": "ID",            "width": 8},
        {"key": "nombre",                "label": "Nombre",        "width": 18},
        {"key": "apellido",              "label": "Apellido",      "width": 18},
        {"key": "email",                 "label": "Email",         "width": 32},
        {"key": "telefono",              "label": "Teléfono",      "width": 16},
        {"key": "rut",                   "label": "RUT",           "width": 14},
        {"key": "especialidad",          "label": "Especialidad",  "width": 22},
        {"key": "clinica",               "label": "Clínica",       "width": 22},
        {"key": "licencia",              "label": "Licencia",      "width": 16},
        {"key": "duracion_consulta_min", "label": "Duración (min)","width": 12},
        {"key": "precio_clp",            "label": "Precio CLP",    "width": 14},
        {"key": "activo",                "label": "Activo",        "width": 10},
    ]
    return excel_response(
        rows, headers, f"profesionales_{_today_iso()}",
        sheet_name="Profesionales",
        title="Listado de profesionales",
        subtitle=f"Generado {datetime.now().strftime('%d-%m-%Y %H:%M')} · {len(rows)} profesionales",
    )
