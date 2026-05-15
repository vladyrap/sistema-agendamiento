"""Endpoints para campañas Ley Karin: assessment de riesgo psicosocial laboral.

Flujo:
1. company_admin o consultant crea una campaña → recibe share_token
2. Empresa difunde el link público a sus trabajadores
3. Trabajadores responden anónimamente (sin auth) — endpoint público
4. company_admin / consultant ven reporte agregado por dimensión
"""
import hashlib
from datetime import datetime
from typing import Optional, List, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc

from app.core.database import get_db
from app.core.redis_client import rate_limit_check
from app.models.user import User, UserRole
from app.models.company import Company, CompanyMembership
from app.models.ley_karin import (
    LeyKarinAssessment, LeyKarinResponse, LeyKarinAssessmentStatus,
)
from app.services import suseso_istas21 as instrument
from app.api.deps import get_current_user

router = APIRouter(prefix="/ley-karin", tags=["Ley Karin"])


# ── Schemas ────────────────────────────────────────────────────────────────

class AssessmentCreate(BaseModel):
    company_id: int
    title: Optional[str] = None
    target_employees: Optional[int] = Field(default=None, ge=1)
    notes: Optional[str] = ""


class AssessmentUpdate(BaseModel):
    title: Optional[str] = None
    target_employees: Optional[int] = Field(default=None, ge=1)
    notes: Optional[str] = None
    consultant_user_id: Optional[int] = None


class AssessmentResponse(BaseModel):
    id: int
    company_id: int
    company_name: Optional[str] = None
    title: str
    instrument_code: str
    status: LeyKarinAssessmentStatus
    share_token: str
    target_employees: Optional[int] = None
    response_count: int
    notes: Optional[str] = ""
    created_at: datetime
    closed_at: Optional[datetime] = None
    consultant_user_id: Optional[int] = None
    created_by_user_id: int

    class Config:
        from_attributes = True


class PublicResponseSubmit(BaseModel):
    answers: dict[str, int]
    meta_age_range: Optional[str] = None
    meta_tenure: Optional[str] = None
    meta_department: Optional[str] = None
    meta_gender: Optional[str] = None


# ── Helpers ────────────────────────────────────────────────────────────────

def _can_manage_company(user: User, company_id: int, db: Session) -> bool:
    if user.role == UserRole.admin:
        return True
    if user.role == UserRole.consultant:
        return True  # consultor puede manejar cualquier empresa (a futuro: solo las asignadas)
    if user.role == UserRole.company_admin:
        c = db.query(Company).filter(Company.id == company_id, Company.company_admin_user_id == user.id).first()
        return c is not None
    return False


def _serialize(a: LeyKarinAssessment) -> AssessmentResponse:
    company_name = a.company.name if a.company else None
    return AssessmentResponse(
        id=a.id,
        company_id=a.company_id,
        company_name=company_name,
        title=a.title,
        instrument_code=a.instrument_code,
        status=a.status,
        share_token=a.share_token,
        target_employees=a.target_employees,
        response_count=a.response_count,
        notes=a.notes or "",
        created_at=a.created_at,
        closed_at=a.closed_at,
        consultant_user_id=a.consultant_user_id,
        created_by_user_id=a.created_by_user_id,
    )


def _hash_ip(req: Request) -> str:
    ip = req.client.host if req.client else ""
    return hashlib.sha256(ip.encode("utf-8")).hexdigest()[:48]


def _client_fingerprint(req: Request) -> str:
    """IP + User-Agent hasheado: identifica una origen de submit sin guardar PII bruta."""
    ip = req.client.host if req.client else ""
    ua = req.headers.get("user-agent", "")[:200]
    return hashlib.sha256(f"{ip}|{ua}".encode("utf-8")).hexdigest()[:32]


# ── Endpoints autenticados (consultant / company_admin / admin) ───────────

@router.get("/instrument")
def get_instrument_definition():
    """Devuelve la definición del cuestionario para que el frontend lo arme.

    Pública (sin auth) porque también la usa el formulario público. No revela PII.
    """
    return {
        "instrument": instrument.CATALOG_ITEM,
        "likert": instrument.LIKERT_5,
        "dimensions": instrument.public_dimensions(),
        "items": instrument.all_items(),
    }


@router.get("/assessments", response_model=List[AssessmentResponse])
def list_assessments(
    company_id: Optional[int] = Query(default=None),
    status: Optional[LeyKarinAssessmentStatus] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista campañas que el usuario puede ver según su rol."""
    q = db.query(LeyKarinAssessment).options(joinedload(LeyKarinAssessment.company))

    if current_user.role == UserRole.company_admin:
        my_companies = [c.id for c in db.query(Company).filter(Company.company_admin_user_id == current_user.id).all()]
        if not my_companies:
            return []
        q = q.filter(LeyKarinAssessment.company_id.in_(my_companies))
    elif current_user.role not in (UserRole.admin, UserRole.consultant):
        raise HTTPException(status_code=403, detail="Sin permisos para ver campañas")

    if company_id:
        q = q.filter(LeyKarinAssessment.company_id == company_id)
    if status:
        q = q.filter(LeyKarinAssessment.status == status)

    items = q.order_by(desc(LeyKarinAssessment.created_at)).all()
    return [_serialize(a) for a in items]


@router.post("/assessments", response_model=AssessmentResponse, status_code=201)
def create_assessment(
    data: AssessmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not _can_manage_company(current_user, data.company_id, db):
        raise HTTPException(status_code=403, detail="No puedes crear campañas para esta empresa")

    company = db.query(Company).filter(Company.id == data.company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")

    title = data.title or f"Evaluación de riesgo psicosocial — {company.name} — {datetime.utcnow().year}"
    a = LeyKarinAssessment(
        company_id=data.company_id,
        consultant_user_id=current_user.id if current_user.role == UserRole.consultant else None,
        created_by_user_id=current_user.id,
        title=title,
        target_employees=data.target_employees,
        notes=data.notes or "",
        status=LeyKarinAssessmentStatus.draft,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return _serialize(a)


@router.get("/assessments/{assessment_id}", response_model=AssessmentResponse)
def get_assessment(
    assessment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    a = (
        db.query(LeyKarinAssessment)
        .options(joinedload(LeyKarinAssessment.company))
        .filter(LeyKarinAssessment.id == assessment_id)
        .first()
    )
    if not a:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    if not _can_manage_company(current_user, a.company_id, db):
        raise HTTPException(status_code=403, detail="Sin permisos")
    return _serialize(a)


@router.patch("/assessments/{assessment_id}", response_model=AssessmentResponse)
def update_assessment(
    assessment_id: int,
    data: AssessmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    a = db.query(LeyKarinAssessment).filter(LeyKarinAssessment.id == assessment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    if not _can_manage_company(current_user, a.company_id, db):
        raise HTTPException(status_code=403, detail="Sin permisos")
    if data.title is not None: a.title = data.title
    if data.target_employees is not None: a.target_employees = data.target_employees
    if data.notes is not None: a.notes = data.notes
    if data.consultant_user_id is not None: a.consultant_user_id = data.consultant_user_id
    db.commit()
    return _serialize(a)


@router.post("/assessments/{assessment_id}/activate", response_model=AssessmentResponse)
def activate_assessment(
    assessment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Pasar campaña de draft → active: link público recibe respuestas."""
    a = db.query(LeyKarinAssessment).filter(LeyKarinAssessment.id == assessment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    if not _can_manage_company(current_user, a.company_id, db):
        raise HTTPException(status_code=403, detail="Sin permisos")
    a.status = LeyKarinAssessmentStatus.active
    db.commit()
    return _serialize(a)


@router.post("/assessments/{assessment_id}/close", response_model=AssessmentResponse)
def close_assessment(
    assessment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    a = db.query(LeyKarinAssessment).filter(LeyKarinAssessment.id == assessment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    if not _can_manage_company(current_user, a.company_id, db):
        raise HTTPException(status_code=403, detail="Sin permisos")
    a.status = LeyKarinAssessmentStatus.closed
    a.closed_at = datetime.utcnow()
    a.closed_by_user_id = current_user.id
    db.commit()
    return _serialize(a)


@router.get("/assessments/{assessment_id}/report")
def get_assessment_report(
    assessment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Reporte agregado por dimensión. Solo si N≥3 para preservar anonimato."""
    a = (
        db.query(LeyKarinAssessment)
        .options(joinedload(LeyKarinAssessment.company))
        .filter(LeyKarinAssessment.id == assessment_id)
        .first()
    )
    if not a:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    if not _can_manage_company(current_user, a.company_id, db):
        raise HTTPException(status_code=403, detail="Sin permisos")

    responses = (
        db.query(LeyKarinResponse)
        .filter(LeyKarinResponse.assessment_id == assessment_id)
        .all()
    )

    # Para no revelar respuestas individuales si la muestra es muy pequeña
    MIN_N_FOR_REPORT = 3
    if len(responses) < MIN_N_FOR_REPORT:
        return {
            "assessment_id": assessment_id,
            "title": a.title,
            "company_name": a.company.name if a.company else None,
            "status": a.status.value,
            "total_responses": len(responses),
            "target_employees": a.target_employees,
            "completion_pct": (round(len(responses) * 100 / a.target_employees) if a.target_employees else None),
            "report_available": False,
            "min_n_required": MIN_N_FOR_REPORT,
            "message": f"Esperando más respuestas. Necesitamos al menos {MIN_N_FOR_REPORT} para preservar el anonimato.",
        }

    aggregate = instrument.aggregate_responses([
        {"dimension_scores": r.dimension_scores} for r in responses
    ])

    # Distribución demográfica básica (sin identificar)
    demo: dict[str, dict[str, int]] = {
        "age_range": {}, "tenure": {}, "gender": {}, "department": {},
    }
    for r in responses:
        for key, attr in (("age_range", "meta_age_range"), ("tenure", "meta_tenure"),
                          ("gender", "meta_gender"), ("department", "meta_department")):
            v = getattr(r, attr)
            if v:
                demo[key][v] = demo[key].get(v, 0) + 1

    return {
        "assessment_id": assessment_id,
        "title": a.title,
        "company_name": a.company.name if a.company else None,
        "status": a.status.value,
        "total_responses": len(responses),
        "target_employees": a.target_employees,
        "completion_pct": (round(len(responses) * 100 / a.target_employees) if a.target_employees else None),
        "report_available": True,
        "aggregate": aggregate,
        "demographics": demo,
    }


@router.delete("/assessments/{assessment_id}", status_code=204)
def delete_assessment(
    assessment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Solo permite borrar campañas en draft."""
    a = db.query(LeyKarinAssessment).filter(LeyKarinAssessment.id == assessment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    if not _can_manage_company(current_user, a.company_id, db):
        raise HTTPException(status_code=403, detail="Sin permisos")
    if a.status != LeyKarinAssessmentStatus.draft:
        raise HTTPException(status_code=400, detail="Solo se pueden borrar campañas en draft. Cerrá la campaña en su lugar.")
    db.delete(a)
    db.commit()


# ── Endpoints públicos (sin auth) — para el trabajador anónimo ────────────

@router.get("/public/{share_token}")
def get_public_form(share_token: str, request: Request, db: Session = Depends(get_db)):
    """Devuelve la definición del formulario para un share_token activo."""
    # Rate-limit liviano: 30 lecturas por minuto por fingerprint (anti-scraping)
    fp = _client_fingerprint(request)
    allowed, _ = rate_limit_check(f"lk:form:{fp}", max_hits=30, window_seconds=60)
    if not allowed:
        raise HTTPException(status_code=429, detail="Demasiadas solicitudes. Espera un momento.")

    a = (
        db.query(LeyKarinAssessment)
        .options(joinedload(LeyKarinAssessment.company))
        .filter(LeyKarinAssessment.share_token == share_token)
        .first()
    )
    if not a:
        raise HTTPException(status_code=404, detail="Enlace no válido")
    if a.status != LeyKarinAssessmentStatus.active:
        raise HTTPException(status_code=410, detail="Esta evaluación no está activa en este momento")
    return {
        "company_name": a.company.name if a.company else "tu empresa",
        "title": a.title,
        "instrument": instrument.CATALOG_ITEM,
        "likert": instrument.LIKERT_5,
        "dimensions": instrument.public_dimensions(),
        "items": instrument.all_items(),
    }


@router.post("/public/{share_token}/submit")
def submit_public_response(
    share_token: str,
    data: PublicResponseSubmit,
    request: Request,
    db: Session = Depends(get_db),
):
    """Recibe respuesta anónima del trabajador.

    Rate limits:
      - 5 submits / hora por (fingerprint, assessment): cubre el caso office NAT
        (varios empleados desde misma IP en redes corporativas) sin permitir spam.
      - 100 submits / hora por assessment total: kill-switch global anti-flooding.
    """
    a = db.query(LeyKarinAssessment).filter(LeyKarinAssessment.share_token == share_token).first()
    if not a:
        raise HTTPException(status_code=404, detail="Enlace no válido")
    if a.status != LeyKarinAssessmentStatus.active:
        raise HTTPException(status_code=410, detail="Esta evaluación está cerrada")

    fp = _client_fingerprint(request)
    allowed_fp, count_fp = rate_limit_check(
        f"lk:submit:{a.id}:{fp}", max_hits=5, window_seconds=3600,
    )
    if not allowed_fp:
        raise HTTPException(
            status_code=429,
            detail="Detectamos varios envíos desde tu conexión. Si trabajas en una oficina, espera unos minutos antes de intentar nuevamente.",
        )
    allowed_global, _ = rate_limit_check(
        f"lk:submit:global:{a.id}", max_hits=100, window_seconds=3600,
    )
    if not allowed_global:
        raise HTTPException(
            status_code=429,
            detail="Demasiados envíos en este momento. Intenta de nuevo en unos minutos.",
        )

    # Validación liviana: que las respuestas estén en rango 0-4
    items_codes = {it["code"] for it in instrument.all_items()}
    cleaned: dict[str, int] = {}
    for k, v in (data.answers or {}).items():
        if k in items_codes and isinstance(v, int) and 0 <= v <= 4:
            cleaned[k] = v
    if len(cleaned) < 10:
        raise HTTPException(status_code=400, detail="Faltan respuestas. Responde al menos la mitad del cuestionario.")

    scores = instrument.calculate_dimension_scores(cleaned)
    resp = LeyKarinResponse(
        assessment_id=a.id,
        answers=cleaned,
        dimension_scores=scores,
        meta_age_range=data.meta_age_range,
        meta_tenure=data.meta_tenure,
        meta_department=(data.meta_department or "")[:120] or None,
        meta_gender=data.meta_gender,
        ip_hash=_hash_ip(request),
    )
    db.add(resp)
    a.response_count = (a.response_count or 0) + 1
    db.commit()

    return {"ok": True, "message": "Tu respuesta fue registrada anónimamente. Gracias."}
