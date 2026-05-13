"""Tareas/ejercicios entre sesiones — asignadas por el profesional al paciente."""
from datetime import date as date_type, datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.doctor import Doctor
from app.models.homework import HomeworkAssignment, HomeworkStatus
from app.schemas.homework import (
    HomeworkCreate, HomeworkUpdate, HomeworkComplete, HomeworkResponse, HomeworkStats,
)
from app.services.notifications import enqueue
from app.api.deps import get_current_user

router = APIRouter(prefix="/homework", tags=["Tareas entre sesiones"])


def _serialize(h: HomeworkAssignment) -> HomeworkResponse:
    doc_name = None
    doc_spec = None
    if h.doctor and h.doctor.user:
        doc_name = f"Dr(a). {h.doctor.user.first_name} {h.doctor.user.last_name}"
    if h.doctor and h.doctor.specialty:
        doc_spec = h.doctor.specialty.name
    pat_name = None
    if h.patient:
        pat_name = f"{h.patient.first_name} {h.patient.last_name}"
    return HomeworkResponse(
        id=h.id,
        doctor_id=h.doctor_id,
        doctor_name=doc_name,
        doctor_specialty=doc_spec,
        patient_id=h.patient_id,
        patient_name=pat_name,
        title=h.title,
        description=h.description or "",
        due_date=h.due_date,
        status=h.status.value if hasattr(h.status, "value") else h.status,
        patient_feedback=h.patient_feedback or "",
        created_at=h.created_at,
        completed_at=h.completed_at,
        updated_at=h.updated_at,
    )


def _doctor_profile(db: Session, user: User) -> Doctor:
    if user.role != UserRole.doctor:
        raise HTTPException(status_code=403, detail="Solo profesionales pueden asignar tareas")
    doc = db.query(Doctor).filter(Doctor.user_id == user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Perfil de profesional no encontrado")
    return doc


def _full_query(db: Session):
    return db.query(HomeworkAssignment).options(
        joinedload(HomeworkAssignment.doctor).joinedload(Doctor.user),
        joinedload(HomeworkAssignment.doctor).joinedload(Doctor.specialty),
        joinedload(HomeworkAssignment.patient),
    )


# ─── Crear / editar / borrar (doctor) ──────────────────────────────────────

@router.post("/", response_model=HomeworkResponse, status_code=201)
def create_homework(
    data: HomeworkCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doctor = _doctor_profile(db, current_user)
    patient = db.query(User).filter(User.id == data.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")

    h = HomeworkAssignment(
        doctor_id=doctor.id,
        patient_id=patient.id,
        title=data.title,
        description=data.description or "",
        due_date=data.due_date,
        status=HomeworkStatus.pending,
    )
    db.add(h)
    db.commit()
    db.refresh(h)

    enqueue("homework_assigned", {
        "recipient_role": "patient",
        "to_email": patient.email,
        "to_phone": patient.phone,
        "to_name": f"{patient.first_name} {patient.last_name}",
        "doctor_name": f"Dr(a). {current_user.first_name} {current_user.last_name}",
        "homework_title": data.title,
        "homework_due_date": str(data.due_date) if data.due_date else "",
    })

    return _serialize(
        _full_query(db).filter(HomeworkAssignment.id == h.id).first()
    )


@router.patch("/{hw_id}", response_model=HomeworkResponse)
def update_homework(
    hw_id: int,
    data: HomeworkUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doctor = _doctor_profile(db, current_user)
    h = db.query(HomeworkAssignment).filter(HomeworkAssignment.id == hw_id).first()
    if not h:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    if h.doctor_id != doctor.id:
        raise HTTPException(status_code=403, detail="No es tu tarea para editar")
    if h.status == HomeworkStatus.completed:
        raise HTTPException(status_code=400, detail="No se puede editar una tarea completada")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(h, k, v)
    db.commit()
    db.refresh(h)
    return _serialize(_full_query(db).filter(HomeworkAssignment.id == h.id).first())


@router.delete("/{hw_id}", status_code=204)
def delete_homework(
    hw_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doctor = _doctor_profile(db, current_user)
    h = db.query(HomeworkAssignment).filter(HomeworkAssignment.id == hw_id).first()
    if not h:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    if h.doctor_id != doctor.id and current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="No es tu tarea")
    db.delete(h)
    db.commit()


# ─── Acciones del paciente ────────────────────────────────────────────────

@router.patch("/{hw_id}/complete", response_model=HomeworkResponse)
def complete_homework(
    hw_id: int,
    data: HomeworkComplete,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    h = db.query(HomeworkAssignment).filter(HomeworkAssignment.id == hw_id).first()
    if not h:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    if h.patient_id != current_user.id:
        raise HTTPException(status_code=403, detail="No es tu tarea")
    if h.status == HomeworkStatus.completed:
        # idempotente
        return _serialize(_full_query(db).filter(HomeworkAssignment.id == h.id).first())

    h.status = HomeworkStatus.completed
    h.completed_at = datetime.utcnow()
    h.patient_feedback = data.patient_feedback or ""
    db.commit()
    db.refresh(h)

    # Notificar al doctor
    h_full = _full_query(db).filter(HomeworkAssignment.id == h.id).first()
    if h_full and h_full.doctor and h_full.doctor.user:
        doc_user = h_full.doctor.user
        enqueue("homework_completed", {
            "recipient_role": "doctor",
            "to_email": doc_user.email,
            "to_phone": doc_user.phone,
            "to_name": f"{doc_user.first_name} {doc_user.last_name}",
            "patient_name": f"{current_user.first_name} {current_user.last_name}",
            "homework_title": h.title,
            "patient_feedback": h.patient_feedback,
        })

    return _serialize(h_full)


@router.patch("/{hw_id}/uncomplete", response_model=HomeworkResponse)
def uncomplete_homework(
    hw_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """El paciente puede revertir 'completada' si la marcó por error."""
    h = db.query(HomeworkAssignment).filter(HomeworkAssignment.id == hw_id).first()
    if not h:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    if h.patient_id != current_user.id:
        raise HTTPException(status_code=403, detail="No es tu tarea")
    h.status = HomeworkStatus.pending
    h.completed_at = None
    db.commit()
    db.refresh(h)
    return _serialize(_full_query(db).filter(HomeworkAssignment.id == h.id).first())


# ─── Listados ────────────────────────────────────────────────────────────

@router.get("/me", response_model=List[HomeworkResponse])
def my_homework(
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.patient:
        raise HTTPException(status_code=403, detail="Solo pacientes")
    q = _full_query(db).filter(HomeworkAssignment.patient_id == current_user.id)
    if status in ("pending", "completed"):
        q = q.filter(HomeworkAssignment.status == HomeworkStatus(status))
    rows = q.order_by(
        HomeworkAssignment.status.asc(),  # pending primero
        HomeworkAssignment.due_date.asc().nulls_last(),
        HomeworkAssignment.created_at.desc(),
    ).all()
    return [_serialize(r) for r in rows]


@router.get("/me/stats", response_model=HomeworkStats)
def my_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.patient:
        raise HTTPException(status_code=403, detail="Solo pacientes")
    rows = db.query(HomeworkAssignment).filter(HomeworkAssignment.patient_id == current_user.id).all()
    total = len(rows)
    pending = sum(1 for r in rows if r.status == HomeworkStatus.pending)
    completed = sum(1 for r in rows if r.status == HomeworkStatus.completed)
    today = date_type.today()
    overdue = sum(1 for r in rows if r.status == HomeworkStatus.pending and r.due_date and r.due_date < today)
    rate = (completed / total) if total else None
    return HomeworkStats(
        total=total, pending=pending, completed=completed,
        overdue=overdue, completion_rate=round(rate, 2) if rate is not None else None,
    )


@router.get("/patient/{patient_id}", response_model=List[HomeworkResponse])
def patient_homework(
    patient_id: int,
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    allowed = current_user.role in (UserRole.doctor, UserRole.admin, UserRole.receptionist)
    if not allowed and current_user.role == UserRole.tutor:
        from app.models.tutor import TutorRelationship
        link = db.query(TutorRelationship).filter(
            TutorRelationship.patient_id == patient_id,
            TutorRelationship.tutor_user_id == current_user.id,
        ).first()
        allowed = link is not None
    if not allowed:
        raise HTTPException(status_code=403, detail="Sin permiso")
    q = _full_query(db).filter(HomeworkAssignment.patient_id == patient_id)
    if status in ("pending", "completed"):
        q = q.filter(HomeworkAssignment.status == HomeworkStatus(status))
    rows = q.order_by(
        HomeworkAssignment.created_at.desc(),
    ).all()
    return [_serialize(r) for r in rows]


@router.get("/doctor/recent", response_model=List[HomeworkResponse])
def doctor_recent(
    days: int = Query(default=30, ge=1, le=180),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tareas activas/recientes asignadas por el doctor — para su dashboard."""
    doctor = _doctor_profile(db, current_user)
    since = datetime.utcnow() - timedelta(days=days)
    rows = (
        _full_query(db)
        .filter(
            HomeworkAssignment.doctor_id == doctor.id,
            HomeworkAssignment.created_at >= since,
        )
        .order_by(
            HomeworkAssignment.status.asc(),  # pendientes primero
            HomeworkAssignment.created_at.desc(),
        )
        .all()
    )
    return [_serialize(r) for r in rows]
