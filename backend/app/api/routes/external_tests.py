"""Tests psicológicos aplicados FUERA del sistema digital.

Sirve para registrar resultados de tests con copyright o que requieren
administración profesional cara a cara (WAIS, Rorschach, MMPI, BDI-II, etc.).

El sistema solo guarda metadata (nombre del test, score, interpretación) —
NO incluye los items del test, que son propiedad de sus respectivos autores.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.doctor import Doctor
from app.models.external_test import ExternalTestResult
from app.schemas.external_test import (
    ExternalTestCatalogItem, ExternalTestCreate, ExternalTestUpdate,
    ExternalTestResponse, TEST_CATALOG,
)
from app.api.deps import get_current_user

router = APIRouter(prefix="/external-tests", tags=["Tests externos"])


def _catalog_lookup() -> dict[str, dict]:
    return {item["code"]: item for item in TEST_CATALOG}


def _doctor_profile_or_403(db: Session, user: User) -> Doctor:
    if user.role not in (UserRole.doctor, UserRole.admin):
        raise HTTPException(status_code=403, detail="Solo profesionales pueden registrar tests externos")
    if user.role == UserRole.doctor:
        doc = db.query(Doctor).filter(Doctor.user_id == user.id).first()
        if not doc:
            raise HTTPException(status_code=404, detail="Perfil de profesional no encontrado")
        return doc
    # admin: usa el primer doctor o requiere especificación; por simplicidad limitamos a doctor
    raise HTTPException(status_code=403, detail="Solo profesionales pueden crear estos registros")


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


def _serialize(t: ExternalTestResult, catalog: dict[str, dict] = None) -> ExternalTestResponse:
    catalog = catalog or _catalog_lookup()
    cat_entry = catalog.get(t.test_code)
    doc_name = None
    if t.doctor and t.doctor.user:
        doc_name = f"Ps. {t.doctor.user.first_name} {t.doctor.user.last_name}"
    return ExternalTestResponse(
        id=t.id,
        patient_id=t.patient_id,
        doctor_id=t.doctor_id,
        doctor_name=doc_name,
        test_code=t.test_code,
        test_name=t.test_name,
        category=cat_entry["category"] if cat_entry else "Otros",
        applied_at=t.applied_at,
        score=t.score,
        severity_label=t.severity_label,
        interpretation=t.interpretation or "",
        follow_up_date=t.follow_up_date,
        attachment_id=t.attachment_id,
        notes=t.notes or "",
        created_at=t.created_at,
        updated_at=t.updated_at,
    )


# ─── Catálogo público ─────────────────────────────────────────────────────

@router.get("/catalog", response_model=List[ExternalTestCatalogItem])
def list_catalog():
    """Lista de tests soportados (solo nombres + categorías, sin items).
    El profesional aplica el test con su propia copia licenciada y registra el resultado.
    """
    return TEST_CATALOG


# ─── CRUD ─────────────────────────────────────────────────────────────────

@router.post("/patient/{patient_id}", response_model=ExternalTestResponse, status_code=201)
def create_result(
    patient_id: int,
    data: ExternalTestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doctor = _doctor_profile_or_403(db, current_user)
    patient = db.query(User).filter(User.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")

    catalog = _catalog_lookup()
    if data.test_code != "other" and data.test_code not in catalog:
        raise HTTPException(status_code=400, detail="Código de test inválido")

    if data.test_code == "other":
        if not data.test_name or not data.test_name.strip():
            raise HTTPException(status_code=400, detail="Debes especificar el nombre del test")
        test_name = data.test_name.strip()
    else:
        test_name = catalog[data.test_code]["name"]

    obj = ExternalTestResult(
        patient_id=patient_id,
        doctor_id=doctor.id,
        test_code=data.test_code,
        test_name=test_name,
        applied_at=data.applied_at,
        score=data.score,
        severity_label=data.severity_label,
        interpretation=data.interpretation or "",
        follow_up_date=data.follow_up_date,
        attachment_id=data.attachment_id,
        notes=data.notes or "",
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return _serialize(
        db.query(ExternalTestResult)
        .options(joinedload(ExternalTestResult.doctor).joinedload(Doctor.user))
        .filter(ExternalTestResult.id == obj.id)
        .first()
    )


@router.patch("/{result_id}", response_model=ExternalTestResponse)
def update_result(
    result_id: int,
    data: ExternalTestUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    obj = db.query(ExternalTestResult).filter(ExternalTestResult.id == result_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="No encontrado")
    doctor = _doctor_profile_or_403(db, current_user)
    if obj.doctor_id != doctor.id and current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Solo podés editar tus propios registros")

    catalog = _catalog_lookup()
    updates = data.model_dump(exclude_none=True)
    # Si cambió el test_code, recalcular el test_name
    if "test_code" in updates:
        if updates["test_code"] != "other" and updates["test_code"] not in catalog:
            raise HTTPException(status_code=400, detail="Código de test inválido")
        if updates["test_code"] == "other":
            if not updates.get("test_name", "").strip():
                raise HTTPException(status_code=400, detail="Debes especificar el nombre del test")
        else:
            updates["test_name"] = catalog[updates["test_code"]]["name"]

    for k, v in updates.items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return _serialize(
        db.query(ExternalTestResult)
        .options(joinedload(ExternalTestResult.doctor).joinedload(Doctor.user))
        .filter(ExternalTestResult.id == obj.id)
        .first()
    )


@router.delete("/{result_id}", status_code=204)
def delete_result(
    result_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    obj = db.query(ExternalTestResult).filter(ExternalTestResult.id == result_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="No encontrado")
    doctor = _doctor_profile_or_403(db, current_user)
    if obj.doctor_id != doctor.id and current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Sin permiso")
    db.delete(obj)
    db.commit()


@router.get("/patient/{patient_id}", response_model=List[ExternalTestResponse])
def list_for_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not _can_view_patient(current_user, patient_id, db):
        raise HTTPException(status_code=403, detail="Sin permiso")
    rows = (
        db.query(ExternalTestResult)
        .options(joinedload(ExternalTestResult.doctor).joinedload(Doctor.user))
        .filter(ExternalTestResult.patient_id == patient_id)
        .order_by(ExternalTestResult.applied_at.desc())
        .all()
    )
    catalog = _catalog_lookup()
    return [_serialize(r, catalog) for r in rows]


@router.get("/{result_id}", response_model=ExternalTestResponse)
def get_one(
    result_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    obj = (
        db.query(ExternalTestResult)
        .options(joinedload(ExternalTestResult.doctor).joinedload(Doctor.user))
        .filter(ExternalTestResult.id == result_id)
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="No encontrado")
    if not _can_view_patient(current_user, obj.patient_id, db):
        raise HTTPException(status_code=403, detail="Sin permiso")
    return _serialize(obj)
