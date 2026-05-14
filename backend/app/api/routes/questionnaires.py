"""Cuestionarios psicológicos validados (PHQ-9, GAD-7, WHO-5).

Flujo:
1. Doctor asigna un cuestionario al paciente
2. Paciente lo completa
3. Sistema calcula score + severidad
4. Si crítico (ideación suicida en PHQ-9) → notifica tutores y doctor
"""
from datetime import date as date_type, datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.doctor import Doctor
from app.models.questionnaire import QuestionnaireAssignment
from app.schemas.questionnaire import (
    QuestionnaireMetadata, QuestionnaireFull,
    AssignmentCreate, AssignmentSubmit, AssignmentResponse, HistoryPoint,
)
from app.services import questionnaires_catalog as catalog
from app.services.notifications import enqueue
from app.api.routes.tutors import notify_tutors_of_crisis
from app.api.deps import get_current_user

router = APIRouter(prefix="/questionnaires", tags=["Cuestionarios psicológicos"])


def _doctor_profile(db: Session, user: User) -> Doctor:
    if user.role != UserRole.doctor:
        raise HTTPException(status_code=403, detail="Solo profesionales")
    doc = db.query(Doctor).filter(Doctor.user_id == user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Perfil de profesional no encontrado")
    return doc


def _can_view_patient(current_user: User, patient_id: int, db: Session) -> bool:
    if current_user.role == UserRole.patient and current_user.id == patient_id:
        return True
    if current_user.role in (UserRole.doctor, UserRole.admin, UserRole.receptionist):
        return True
    if current_user.role == UserRole.tutor:
        from app.models.tutor import TutorRelationship
        link = db.query(TutorRelationship).filter(
            TutorRelationship.patient_id == patient_id,
            TutorRelationship.tutor_user_id == current_user.id,
        ).first()
        return link is not None
    return False


def _serialize(a: QuestionnaireAssignment) -> AssignmentResponse:
    q_meta = catalog.get_questionnaire(a.code)
    doc_name = None
    if a.doctor and a.doctor.user:
        doc_name = f"Ps. {a.doctor.user.first_name} {a.doctor.user.last_name}"
    pat_name = None
    if a.patient:
        pat_name = f"{a.patient.first_name} {a.patient.last_name}"
    return AssignmentResponse(
        id=a.id,
        code=a.code,
        short_name=q_meta["short_name"] if q_meta else a.code.upper(),
        questionnaire_name=q_meta["name"] if q_meta else a.code,
        doctor_id=a.doctor_id,
        doctor_name=doc_name,
        patient_id=a.patient_id,
        patient_name=pat_name,
        status=a.status,
        due_date=a.due_date,
        doctor_note=a.doctor_note or "",
        answers=a.answers,
        score=a.score,
        max_score=a.max_score,
        severity_code=a.severity_code,
        severity_label=a.severity_label,
        severity_tone=a.severity_tone,
        action_hint=a.action_hint,
        crisis_flagged=bool(a.crisis_flagged),
        patient_comment=a.patient_comment or "",
        created_at=a.created_at,
        completed_at=a.completed_at,
    )


def _full_query(db: Session):
    return db.query(QuestionnaireAssignment).options(
        joinedload(QuestionnaireAssignment.doctor).joinedload(Doctor.user),
        joinedload(QuestionnaireAssignment.patient),
    )


# ─── Catálogo ────────────────────────────────────────────────────────────

@router.get("/", response_model=List[QuestionnaireMetadata])
def list_questionnaires():
    """Lista de cuestionarios disponibles (metadata, sin preguntas)."""
    return catalog.list_metadata()


@router.get("/{code}", response_model=QuestionnaireFull)
def get_questionnaire_full(code: str):
    """Cuestionario completo con preguntas y escala. Usado por el paciente para responder."""
    q = catalog.get_questionnaire(code)
    if not q:
        raise HTTPException(status_code=404, detail="Cuestionario no encontrado")
    return {
        "code": q["code"],
        "name": q["name"],
        "short_name": q["short_name"],
        "description": q["description"],
        "duration_minutes": q["duration_minutes"],
        "scoring_note": q["scoring_note"],
        "frequency_recommendation": q["frequency_recommendation"],
        "num_questions": len(q["questions"]),
        "max_score": (len(q["questions"]) * max(o["value"] for o in q["scale_options"])),
        "instructions": q["instructions"],
        "scale_options": q["scale_options"],
        "questions": q["questions"],
    }


# ─── Asignaciones ───────────────────────────────────────────────────────

@router.post("/assignments", response_model=AssignmentResponse, status_code=201)
def create_assignment(
    data: AssignmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doctor = _doctor_profile(db, current_user)
    if not catalog.get_questionnaire(data.code):
        raise HTTPException(status_code=400, detail="Código de cuestionario inválido")
    patient = db.query(User).filter(User.id == data.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")

    a = QuestionnaireAssignment(
        doctor_id=doctor.id,
        patient_id=patient.id,
        code=data.code,
        status="pending",
        due_date=data.due_date,
        doctor_note=data.doctor_note or "",
    )
    db.add(a)
    db.commit()
    db.refresh(a)

    q_meta = catalog.get_questionnaire(data.code)
    enqueue("questionnaire_assigned", {
        "recipient_role": "patient",
        "to_email": patient.email,
        "to_phone": patient.phone,
        "to_name": f"{patient.first_name} {patient.last_name}",
        "doctor_name": f"Ps. {current_user.first_name} {current_user.last_name}",
        "questionnaire_name": q_meta["name"],
        "questionnaire_short": q_meta["short_name"],
        "due_date": str(data.due_date) if data.due_date else "",
    })

    return _serialize(_full_query(db).filter(QuestionnaireAssignment.id == a.id).first())


@router.delete("/assignments/{aid}", status_code=204)
def delete_assignment(
    aid: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doctor = _doctor_profile(db, current_user)
    a = db.query(QuestionnaireAssignment).filter(QuestionnaireAssignment.id == aid).first()
    if not a:
        raise HTTPException(status_code=404, detail="No encontrada")
    if a.doctor_id != doctor.id and current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Sin permiso")
    db.delete(a)
    db.commit()


@router.post("/assignments/{aid}/submit", response_model=AssignmentResponse)
def submit_assignment(
    aid: int,
    data: AssignmentSubmit,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.patient:
        raise HTTPException(status_code=403, detail="Solo pacientes pueden responder")
    a = db.query(QuestionnaireAssignment).filter(QuestionnaireAssignment.id == aid).first()
    if not a:
        raise HTTPException(status_code=404, detail="No encontrada")
    if a.patient_id != current_user.id:
        raise HTTPException(status_code=403, detail="No es tu cuestionario")
    if a.status == "completed":
        # Permitir re-submit (sobrescribir) — actualiza score
        pass

    try:
        result = catalog.score_answers(a.code, data.answers)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    a.answers = data.answers
    a.score = result["score"]
    a.max_score = result["max_score"]
    a.severity_code = result["severity_code"]
    a.severity_label = result["severity_label"]
    a.severity_tone = result["severity_tone"]
    a.action_hint = result["action_hint"]
    a.crisis_flagged = result["crisis"]
    a.patient_comment = data.patient_comment or ""
    a.status = "completed"
    a.completed_at = datetime.utcnow()
    db.commit()
    db.refresh(a)

    # Notificar al doctor que se completó
    full = _full_query(db).filter(QuestionnaireAssignment.id == a.id).first()
    if full and full.doctor and full.doctor.user:
        enqueue("questionnaire_completed", {
            "recipient_role": "doctor",
            "to_email": full.doctor.user.email,
            "to_phone": full.doctor.user.phone,
            "to_name": f"{full.doctor.user.first_name} {full.doctor.user.last_name}",
            "patient_name": f"{current_user.first_name} {current_user.last_name}",
            "questionnaire_short": full.code.upper(),
            "score": a.score,
            "max_score": a.max_score,
            "severity_label": a.severity_label,
            "crisis": a.crisis_flagged,
        })

    # Si flag de crisis (PHQ-9 ideación suicida) → notificar tutores + alertar doctor con prioridad
    if a.crisis_flagged:
        try:
            notify_tutors_of_crisis(
                db, current_user,
                score=1,  # marcador de crisis (no es score de mood)
                note=result.get("crisis_message") or f"Respuesta crítica en {a.code.upper()}",
            )
        except Exception:
            pass

    return _serialize(full)


# ─── Listados ────────────────────────────────────────────────────────────

@router.get("/assignments/me", response_model=List[AssignmentResponse])
def my_assignments(
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.patient:
        raise HTTPException(status_code=403, detail="Solo pacientes")
    q = _full_query(db).filter(QuestionnaireAssignment.patient_id == current_user.id)
    if status in ("pending", "completed"):
        q = q.filter(QuestionnaireAssignment.status == status)
    rows = q.order_by(
        QuestionnaireAssignment.status.asc(),
        QuestionnaireAssignment.created_at.desc(),
    ).all()
    return [_serialize(r) for r in rows]


@router.get("/assignments/patient/{patient_id}", response_model=List[AssignmentResponse])
def patient_assignments(
    patient_id: int,
    status: Optional[str] = Query(None),
    code: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not _can_view_patient(current_user, patient_id, db):
        raise HTTPException(status_code=403, detail="Sin permiso")
    q = _full_query(db).filter(QuestionnaireAssignment.patient_id == patient_id)
    if status in ("pending", "completed"):
        q = q.filter(QuestionnaireAssignment.status == status)
    if code:
        q = q.filter(QuestionnaireAssignment.code == code)
    rows = q.order_by(QuestionnaireAssignment.created_at.desc()).all()
    return [_serialize(r) for r in rows]


@router.get("/assignments/patient/{patient_id}/history/{code}", response_model=List[HistoryPoint])
def patient_history(
    patient_id: int,
    code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Historial de scores de un cuestionario específico, para gráfico de evolución."""
    if not _can_view_patient(current_user, patient_id, db):
        raise HTTPException(status_code=403, detail="Sin permiso")
    rows = (
        db.query(QuestionnaireAssignment)
        .filter(
            QuestionnaireAssignment.patient_id == patient_id,
            QuestionnaireAssignment.code == code,
            QuestionnaireAssignment.status == "completed",
            QuestionnaireAssignment.completed_at.isnot(None),
        )
        .order_by(QuestionnaireAssignment.completed_at.asc())
        .all()
    )
    return [
        HistoryPoint(
            completed_at=r.completed_at,
            score=r.score,
            max_score=r.max_score,
            severity_code=r.severity_code or "",
            severity_tone=r.severity_tone or "",
        )
        for r in rows
    ]


@router.get("/assignments/doctor/recent", response_model=List[AssignmentResponse])
def doctor_recent(
    days: int = Query(default=30, ge=1, le=180),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Asignaciones del doctor en los últimos N días para dashboard."""
    doctor = _doctor_profile(db, current_user)
    since = datetime.utcnow() - timedelta(days=days)
    rows = (
        _full_query(db)
        .filter(
            QuestionnaireAssignment.doctor_id == doctor.id,
            QuestionnaireAssignment.created_at >= since,
        )
        .order_by(QuestionnaireAssignment.status.asc(), QuestionnaireAssignment.created_at.desc())
        .all()
    )
    return [_serialize(r) for r in rows]


@router.get("/assignments/{aid}", response_model=AssignmentResponse)
def get_assignment(
    aid: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    a = _full_query(db).filter(QuestionnaireAssignment.id == aid).first()
    if not a:
        raise HTTPException(status_code=404, detail="No encontrada")
    if not _can_view_patient(current_user, a.patient_id, db):
        raise HTTPException(status_code=403, detail="Sin permiso")
    return _serialize(a)
