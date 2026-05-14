"""Boletas de honorarios — Nivel 1 (asistente).

El SII no expone API pública para emitir boletas de honorarios, así que este
módulo solo trackea el ciclo de vida: crear pendientes cuando se cobra una cita,
listarlas para que el psicólogo/a las emita en sii.cl, y marcar el folio
después de la emisión manual.
"""
from datetime import date as date_type, datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc

from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.doctor import Doctor
from app.models.appointment import Appointment
from app.models.boleta import BoletaHonorarios, BoletaStatus
from app.schemas.boleta import (
    BoletaCreate, BoletaUpdate, BoletaIssue,
    BoletaResponse, BoletaListResponse,
)
from app.api.deps import get_current_user

router = APIRouter(prefix="/boletas", tags=["Boletas de honorarios"])


def _doctor_for_user(db: Session, user: User) -> Doctor:
    if user.role != UserRole.doctor:
        raise HTTPException(status_code=403, detail="Solo psicólogos/as gestionan sus boletas")
    doc = db.query(Doctor).filter(Doctor.user_id == user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Perfil de psicólogo/a no encontrado")
    return doc


def _serialize(b: BoletaHonorarios) -> BoletaResponse:
    patient_name = None
    patient_rut = None
    patient_email = None
    if b.patient:
        patient_name = f"{b.patient.first_name} {b.patient.last_name}"
        patient_rut = b.patient.rut
        patient_email = b.patient.email
    doctor_name = None
    if b.doctor and b.doctor.user:
        doctor_name = f"Ps. {b.doctor.user.first_name} {b.doctor.user.last_name}"
    appointment_date = b.appointment.appointment_date if b.appointment else None

    return BoletaResponse(
        id=b.id,
        doctor_id=b.doctor_id,
        patient_id=b.patient_id,
        appointment_id=b.appointment_id,
        amount_clp=b.amount_clp,
        glosa=b.glosa,
        service_date=b.service_date,
        status=b.status,
        folio=b.folio,
        emitted_at=b.emitted_at,
        attachment_id=b.attachment_id,
        notes=b.notes or "",
        created_at=b.created_at,
        updated_at=b.updated_at,
        patient_name=patient_name,
        patient_rut=patient_rut,
        patient_email=patient_email,
        doctor_name=doctor_name,
        appointment_date=appointment_date,
    )


def _query_for_doctor(db: Session, doctor_id: int):
    return (
        db.query(BoletaHonorarios)
        .options(
            joinedload(BoletaHonorarios.patient),
            joinedload(BoletaHonorarios.doctor).joinedload(Doctor.user),
            joinedload(BoletaHonorarios.appointment),
        )
        .filter(BoletaHonorarios.doctor_id == doctor_id)
    )


@router.get("", response_model=BoletaListResponse)
def list_my_boletas(
    status: Optional[BoletaStatus] = Query(default=None),
    from_date: Optional[date_type] = Query(default=None, alias="from"),
    to_date: Optional[date_type] = Query(default=None, alias="to"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista las boletas del psicólogo/a actual, con filtros opcionales."""
    doc = _doctor_for_user(db, current_user)
    q = _query_for_doctor(db, doc.id)
    if status:
        q = q.filter(BoletaHonorarios.status == status)
    if from_date:
        q = q.filter(BoletaHonorarios.service_date >= from_date)
    if to_date:
        q = q.filter(BoletaHonorarios.service_date <= to_date)
    items = q.order_by(desc(BoletaHonorarios.service_date), desc(BoletaHonorarios.id)).all()

    pending = [b for b in items if b.status == BoletaStatus.pending]
    issued  = [b for b in items if b.status == BoletaStatus.issued]
    return BoletaListResponse(
        items=[_serialize(b) for b in items],
        pending_count=len(pending),
        issued_count=len(issued),
        pending_amount_clp=sum(b.amount_clp for b in pending),
    )


@router.get("/pending-summary")
def pending_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Resumen ligero para el badge del dashboard."""
    doc = _doctor_for_user(db, current_user)
    pending = (
        db.query(BoletaHonorarios)
        .filter(
            BoletaHonorarios.doctor_id == doc.id,
            BoletaHonorarios.status == BoletaStatus.pending,
        )
        .all()
    )
    return {
        "pending_count": len(pending),
        "pending_amount_clp": sum(b.amount_clp for b in pending),
    }


@router.get("/{boleta_id}", response_model=BoletaResponse)
def get_boleta(boleta_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    doc = _doctor_for_user(db, current_user)
    b = _query_for_doctor(db, doc.id).filter(BoletaHonorarios.id == boleta_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Boleta no encontrada")
    return _serialize(b)


@router.post("", response_model=BoletaResponse, status_code=201)
def create_boleta(
    data: BoletaCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Crea una boleta manualmente. Caso poco común — normalmente las crea el hook de pago."""
    doc = _doctor_for_user(db, current_user)
    patient = db.query(User).filter(User.id == data.patient_id, User.role == UserRole.patient).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")

    if data.appointment_id:
        appt = (
            db.query(Appointment)
            .filter(Appointment.id == data.appointment_id, Appointment.doctor_id == doc.id)
            .first()
        )
        if not appt:
            raise HTTPException(status_code=404, detail="Cita no encontrada o no es tuya")

    b = BoletaHonorarios(
        doctor_id=doc.id,
        patient_id=data.patient_id,
        appointment_id=data.appointment_id,
        amount_clp=data.amount_clp,
        glosa=data.glosa or "Atención psicológica",
        service_date=data.service_date,
        notes=data.notes or "",
    )
    db.add(b)
    db.commit()
    db.refresh(b)
    return _serialize(_query_for_doctor(db, doc.id).filter(BoletaHonorarios.id == b.id).first())


@router.patch("/{boleta_id}", response_model=BoletaResponse)
def update_boleta(
    boleta_id: int,
    data: BoletaUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Editar glosa, monto o notas — solo si está pending."""
    doc = _doctor_for_user(db, current_user)
    b = (
        db.query(BoletaHonorarios)
        .filter(BoletaHonorarios.id == boleta_id, BoletaHonorarios.doctor_id == doc.id)
        .first()
    )
    if not b:
        raise HTTPException(status_code=404, detail="Boleta no encontrada")
    if b.status != BoletaStatus.pending:
        raise HTTPException(status_code=400, detail="Solo se puede editar una boleta pendiente")

    if data.glosa is not None:
        b.glosa = data.glosa
    if data.amount_clp is not None:
        b.amount_clp = data.amount_clp
    if data.notes is not None:
        b.notes = data.notes
    db.commit()
    return _serialize(_query_for_doctor(db, doc.id).filter(BoletaHonorarios.id == b.id).first())


@router.patch("/{boleta_id}/issue", response_model=BoletaResponse)
def mark_issued(
    boleta_id: int,
    data: BoletaIssue,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Marcar boleta como emitida — el psicólogo/a ya la creó manualmente en sii.cl."""
    doc = _doctor_for_user(db, current_user)
    b = (
        db.query(BoletaHonorarios)
        .filter(BoletaHonorarios.id == boleta_id, BoletaHonorarios.doctor_id == doc.id)
        .first()
    )
    if not b:
        raise HTTPException(status_code=404, detail="Boleta no encontrada")
    if b.status == BoletaStatus.issued:
        raise HTTPException(status_code=400, detail="Esta boleta ya está marcada como emitida")
    b.status = BoletaStatus.issued
    b.folio = data.folio.strip()
    b.emitted_at = data.emitted_at or datetime.utcnow()
    db.commit()
    return _serialize(_query_for_doctor(db, doc.id).filter(BoletaHonorarios.id == b.id).first())


@router.patch("/{boleta_id}/cancel", response_model=BoletaResponse)
def cancel_boleta(
    boleta_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cancelar una boleta (ej: pago reembolsado, cita anulada)."""
    doc = _doctor_for_user(db, current_user)
    b = (
        db.query(BoletaHonorarios)
        .filter(BoletaHonorarios.id == boleta_id, BoletaHonorarios.doctor_id == doc.id)
        .first()
    )
    if not b:
        raise HTTPException(status_code=404, detail="Boleta no encontrada")
    b.status = BoletaStatus.cancelled
    db.commit()
    return _serialize(_query_for_doctor(db, doc.id).filter(BoletaHonorarios.id == b.id).first())


@router.delete("/{boleta_id}", status_code=204)
def delete_boleta(
    boleta_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Borrar definitivamente — solo si nunca fue emitida."""
    doc = _doctor_for_user(db, current_user)
    b = (
        db.query(BoletaHonorarios)
        .filter(BoletaHonorarios.id == boleta_id, BoletaHonorarios.doctor_id == doc.id)
        .first()
    )
    if not b:
        raise HTTPException(status_code=404, detail="Boleta no encontrada")
    if b.status == BoletaStatus.issued:
        raise HTTPException(status_code=400, detail="No se puede borrar una boleta ya emitida; cancelala en su lugar")
    db.delete(b)
    db.commit()
