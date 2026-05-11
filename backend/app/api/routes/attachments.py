"""Adjuntos de la ficha clínica del paciente: imagenología, exámenes, recetas."""
import os
import uuid
import logging
from typing import List, Optional
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.medical_attachment import MedicalAttachment, AttachmentCategory
from app.schemas.medical_attachment import AttachmentResponse
from app.api.deps import get_current_user

router = APIRouter(tags=["Adjuntos"])
logger = logging.getLogger(__name__)


ALLOWED_CONTENT_TYPES = {
    "image/jpeg", "image/png", "image/webp", "image/gif",
    "application/pdf",
    "application/dicom",
    "application/octet-stream",  # DICOM viejo se reporta como octet-stream
}

ALLOWED_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".webp", ".gif",
    ".pdf",
    ".dcm",
}


def _can_view_patient_attachments(current_user: User, target_patient_id: int) -> bool:
    if current_user.id == target_patient_id:
        return True
    return current_user.role in (UserRole.doctor, UserRole.receptionist, UserRole.admin)


def _can_upload_for_patient(current_user: User, target_patient_id: int) -> bool:
    return _can_view_patient_attachments(current_user, target_patient_id)


def _store_file(upload: UploadFile, patient_id: int) -> tuple[str, int]:
    """Guarda el archivo en disco con nombre UUID, devuelve (storage_path_relativa, size)."""
    base = Path(settings.UPLOAD_DIR) / str(patient_id)
    base.mkdir(parents=True, exist_ok=True)

    ext = Path(upload.filename or "").suffix.lower() or ".bin"
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Extensión {ext} no permitida")

    new_name = f"{uuid.uuid4().hex}{ext}"
    abs_path = base / new_name

    size = 0
    with open(abs_path, "wb") as f:
        while True:
            chunk = upload.file.read(64 * 1024)
            if not chunk:
                break
            size += len(chunk)
            if size > settings.UPLOAD_MAX_BYTES:
                f.close()
                abs_path.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail="Archivo excede el tamaño máximo (20 MB)")
            f.write(chunk)

    rel_path = f"{patient_id}/{new_name}"
    return rel_path, size


@router.post("/me/attachments", response_model=AttachmentResponse, status_code=201)
def upload_my_attachment(
    file: UploadFile = File(...),
    category: str = Form("other"),
    note: Optional[str] = Form(None),
    appointment_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _create_attachment(db, file, category, note, appointment_id, current_user.id, current_user)


@router.post("/patients/{patient_id}/attachments", response_model=AttachmentResponse, status_code=201)
def upload_attachment_for_patient(
    patient_id: int,
    file: UploadFile = File(...),
    category: str = Form("other"),
    note: Optional[str] = Form(None),
    appointment_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not _can_upload_for_patient(current_user, patient_id):
        raise HTTPException(status_code=403, detail="Sin permisos")
    target = db.query(User).filter(User.id == patient_id, User.role == UserRole.patient).first()
    if not target:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    return _create_attachment(db, file, category, note, appointment_id, patient_id, current_user)


def _create_attachment(db, file, category, note, appointment_id, patient_id, uploader: User):
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail=f"Tipo de archivo no permitido: {file.content_type}")
    try:
        cat = AttachmentCategory(category)
    except ValueError:
        cat = AttachmentCategory.other

    rel_path, size = _store_file(file, patient_id)

    att = MedicalAttachment(
        patient_id=patient_id,
        appointment_id=appointment_id,
        file_name=file.filename or "archivo",
        storage_path=rel_path,
        content_type=file.content_type,
        size_bytes=size,
        category=cat,
        note=note,
        uploaded_by_id=uploader.id,
    )
    db.add(att)
    db.commit()
    db.refresh(att)
    logger.info("attachment.uploaded", extra={"attachment_id": att.id, "patient_id": patient_id, "size": size})
    return att


@router.get("/me/attachments", response_model=List[AttachmentResponse])
def list_my_attachments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(MedicalAttachment)
        .filter(MedicalAttachment.patient_id == current_user.id)
        .order_by(MedicalAttachment.uploaded_at.desc())
        .all()
    )


@router.get("/patients/{patient_id}/attachments", response_model=List[AttachmentResponse])
def list_patient_attachments(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not _can_view_patient_attachments(current_user, patient_id):
        raise HTTPException(status_code=403, detail="Sin permisos")
    return (
        db.query(MedicalAttachment)
        .filter(MedicalAttachment.patient_id == patient_id)
        .order_by(MedicalAttachment.uploaded_at.desc())
        .all()
    )


@router.get("/attachments/{attachment_id}/download")
def download_attachment(
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    att = db.query(MedicalAttachment).filter(MedicalAttachment.id == attachment_id).first()
    if not att:
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    if not _can_view_patient_attachments(current_user, att.patient_id):
        raise HTTPException(status_code=403, detail="Sin permisos")

    abs_path = Path(settings.UPLOAD_DIR) / att.storage_path
    if not abs_path.exists():
        raise HTTPException(status_code=410, detail="Archivo no disponible en disco")

    def iterfile():
        with open(abs_path, "rb") as f:
            while True:
                chunk = f.read(64 * 1024)
                if not chunk:
                    break
                yield chunk

    headers = {
        "Content-Disposition": f'inline; filename="{att.file_name}"',
        "Content-Length": str(att.size_bytes),
    }
    return StreamingResponse(iterfile(), media_type=att.content_type, headers=headers)


@router.delete("/attachments/{attachment_id}", status_code=204)
def delete_attachment(
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    att = db.query(MedicalAttachment).filter(MedicalAttachment.id == attachment_id).first()
    if not att:
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    # Solo quien lo subió, el dueño paciente, o admin pueden borrarlo
    is_owner = att.patient_id == current_user.id
    is_uploader = att.uploaded_by_id == current_user.id
    if not (is_owner or is_uploader or current_user.role == UserRole.admin):
        raise HTTPException(status_code=403, detail="Sin permisos")

    abs_path = Path(settings.UPLOAD_DIR) / att.storage_path
    abs_path.unlink(missing_ok=True)
    db.delete(att)
    db.commit()
