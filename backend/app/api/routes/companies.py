"""Convenios B2B con empresas.

Flujo:
1. Admin de la plataforma crea Company (con pool de sesiones inicial)
2. Admin agrega empleados (User con role=patient) como CompanyMembership
3. Cuando un empleado reserva una cita, el sistema descuenta del pool automáticamente
4. La empresa puede tener un company_admin que vea métricas anonimizadas
"""
from datetime import date as date_type, datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, extract
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.company import Company, CompanyMembership
from app.models.appointment import Appointment, AppointmentStatus
from app.models.doctor import Doctor
from app.models.specialty import Specialty
from app.schemas.company import (
    CompanyCreate, CompanyUpdate, CompanyTopUp, CompanyAssignAdmin, CompanyResponse,
    MembershipCreate, MembershipResponse,
    MyCompanyBenefit, CompanyStats, CompanyUsageItem,
)
from app.api.deps import get_current_user, require_admin

router = APIRouter(prefix="/companies", tags=["Empresas / B2B"])


def _serialize_company(c: Company, members_count: int = 0) -> CompanyResponse:
    admin_name = None
    if c.company_admin_user:
        admin_name = f"{c.company_admin_user.first_name} {c.company_admin_user.last_name}"
    return CompanyResponse(
        id=c.id,
        name=c.name,
        rut=c.rut,
        billing_email=c.billing_email,
        contact_name=c.contact_name,
        contact_phone=c.contact_phone,
        address=c.address,
        email_domain=c.email_domain,
        sessions_pool=c.sessions_pool,
        sessions_used=c.sessions_used,
        monthly_cap_per_employee=c.monthly_cap_per_employee,
        is_active=c.is_active,
        notes=c.notes or "",
        members_count=members_count,
        company_admin_user_id=c.company_admin_user_id,
        company_admin_name=admin_name,
        created_at=c.created_at,
    )


def _company_for_user(current_user: User, db: Session) -> Company:
    """Para company_admin: devuelve su empresa."""
    if current_user.role != UserRole.company_admin:
        raise HTTPException(status_code=403, detail="Solo company_admin")
    c = db.query(Company).filter(Company.company_admin_user_id == current_user.id).first()
    if not c:
        raise HTTPException(status_code=404, detail="No tienes empresa asociada")
    return c


# ─── CRUD admin platform ─────────────────────────────────────────────────

@router.get("/", response_model=List[CompanyResponse])
def list_companies(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    rows = db.query(Company).order_by(Company.name.asc()).all()
    counts = dict(
        db.query(CompanyMembership.company_id, func.count(CompanyMembership.id))
        .filter(CompanyMembership.is_active == True)
        .group_by(CompanyMembership.company_id).all()
    )
    return [_serialize_company(c, counts.get(c.id, 0)) for c in rows]


@router.post("/", response_model=CompanyResponse, status_code=201)
def create_company(
    data: CompanyCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    if data.rut and db.query(Company).filter(Company.rut == data.rut).first():
        raise HTTPException(status_code=400, detail="Ya existe una empresa con ese RUT")
    c = Company(**data.model_dump())
    db.add(c)
    db.commit()
    db.refresh(c)
    return _serialize_company(c, 0)


@router.get("/{company_id}", response_model=CompanyResponse)
def get_company(
    company_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    c = db.query(Company).options(joinedload(Company.company_admin_user)).filter(Company.id == company_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    members_count = db.query(CompanyMembership).filter(
        CompanyMembership.company_id == c.id, CompanyMembership.is_active == True
    ).count()
    return _serialize_company(c, members_count)


@router.patch("/{company_id}", response_model=CompanyResponse)
def update_company(
    company_id: int,
    data: CompanyUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    c = db.query(Company).filter(Company.id == company_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return _serialize_company(c)


@router.delete("/{company_id}", status_code=204)
def delete_company(
    company_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    c = db.query(Company).filter(Company.id == company_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    db.delete(c)
    db.commit()


@router.post("/{company_id}/topup", response_model=CompanyResponse)
def topup_company(
    company_id: int,
    data: CompanyTopUp,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    c = db.query(Company).filter(Company.id == company_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    c.sessions_pool = (c.sessions_pool or 0) + data.sessions
    db.commit()
    db.refresh(c)
    return _serialize_company(c)


@router.post("/{company_id}/assign-admin", response_model=CompanyResponse)
def assign_admin(
    company_id: int,
    data: CompanyAssignAdmin,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Designar a un usuario como company_admin. El usuario debe existir;
    si no es company_admin, su rol se cambia."""
    c = db.query(Company).filter(Company.id == company_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    user = db.query(User).filter(User.email == data.admin_email.lower()).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado. Pídele que se registre primero.")
    # Si ya es company_admin de otra empresa, fallar
    other = db.query(Company).filter(
        Company.company_admin_user_id == user.id, Company.id != company_id
    ).first()
    if other:
        raise HTTPException(status_code=400, detail=f"Ya es admin de la empresa '{other.name}'")
    user.role = UserRole.company_admin
    c.company_admin_user_id = user.id
    db.commit()
    db.refresh(c)
    return _serialize_company(c)


# ─── Memberships ─────────────────────────────────────────────────────────

@router.get("/{company_id}/members", response_model=List[MembershipResponse])
def list_members(
    company_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    rows = (
        db.query(CompanyMembership)
        .options(joinedload(CompanyMembership.patient), joinedload(CompanyMembership.company))
        .filter(CompanyMembership.company_id == company_id)
        .order_by(CompanyMembership.joined_at.desc())
        .all()
    )
    return [
        MembershipResponse(
            id=m.id,
            company_id=m.company_id,
            company_name=m.company.name if m.company else None,
            patient_id=m.patient_id,
            patient_name=f"{m.patient.first_name} {m.patient.last_name}" if m.patient else "?",
            patient_email=m.patient.email if m.patient else "",
            patient_phone=m.patient.phone if m.patient else None,
            is_active=m.is_active,
            sessions_used=m.sessions_used,
            joined_at=m.joined_at,
        ) for m in rows
    ]


@router.post("/{company_id}/members", response_model=MembershipResponse, status_code=201)
def add_member(
    company_id: int,
    data: MembershipCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    c = db.query(Company).filter(Company.id == company_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    user = db.query(User).filter(User.email == data.patient_email.lower()).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado. Pídele que se registre como paciente primero.")
    if user.role != UserRole.patient:
        raise HTTPException(status_code=400, detail="El usuario no es paciente")
    # ¿ya tiene membership activo en OTRA empresa?
    existing = db.query(CompanyMembership).filter(
        CompanyMembership.patient_id == user.id,
        CompanyMembership.is_active == True,
    ).first()
    if existing and existing.company_id != company_id:
        raise HTTPException(status_code=400, detail=f"Ya tiene membership activo en otra empresa.")
    if existing and existing.company_id == company_id:
        raise HTTPException(status_code=400, detail="Ya es miembro de esta empresa.")

    m = CompanyMembership(
        company_id=company_id,
        patient_id=user.id,
        is_active=True,
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    return MembershipResponse(
        id=m.id,
        company_id=m.company_id,
        company_name=c.name,
        patient_id=user.id,
        patient_name=f"{user.first_name} {user.last_name}",
        patient_email=user.email,
        patient_phone=user.phone,
        is_active=True,
        sessions_used=0,
        joined_at=m.joined_at,
    )


@router.delete("/memberships/{mid}", status_code=204)
def remove_member(
    mid: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    m = db.query(CompanyMembership).filter(CompanyMembership.id == mid).first()
    if not m:
        raise HTTPException(status_code=404, detail="No encontrado")
    m.is_active = False
    m.deactivated_at = datetime.utcnow()
    db.commit()


# ─── Vista del paciente: ¿tiene beneficio? ──────────────────────────────

@router.get("/me")
def my_company(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Devuelve la empresa del company_admin actual (singular)."""
    c = _company_for_user(current_user, db)
    return {
        "id": c.id,
        "name": c.name,
        "rut": c.rut,
        "billing_email": c.billing_email,
        "contact_name": c.contact_name,
        "contact_phone": c.contact_phone,
        "is_active": c.is_active,
    }


@router.get("/me/benefit", response_model=MyCompanyBenefit)
def my_benefit(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.patient:
        return MyCompanyBenefit(has_benefit=False)
    m = (
        db.query(CompanyMembership)
        .options(joinedload(CompanyMembership.company))
        .filter(CompanyMembership.patient_id == current_user.id, CompanyMembership.is_active == True)
        .first()
    )
    if not m or not m.company or not m.company.is_active:
        return MyCompanyBenefit(has_benefit=False)
    # Calcular sesiones usadas este mes
    today = date_type.today()
    used_this_month = (
        db.query(Appointment)
        .filter(
            Appointment.patient_id == current_user.id,
            Appointment.paid_by_company_id == m.company_id,
            extract('year', Appointment.appointment_date) == today.year,
            extract('month', Appointment.appointment_date) == today.month,
        )
        .count()
    )
    return MyCompanyBenefit(
        has_benefit=True,
        company_name=m.company.name,
        sessions_pool_total=m.company.sessions_pool,
        monthly_cap=m.company.monthly_cap_per_employee,
        sessions_used_this_month=used_this_month,
        sessions_used_total=m.sessions_used,
    )


# ─── Portal company_admin: métricas ─────────────────────────────────────

@router.get("/me/stats", response_model=CompanyStats)
def my_company_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    c = _company_for_user(current_user, db)
    today = date_type.today()
    first_this_month = today.replace(day=1)
    first_last_month = (first_this_month - timedelta(days=1)).replace(day=1)

    members_total = db.query(CompanyMembership).filter(CompanyMembership.company_id == c.id).count()
    members_active = db.query(CompanyMembership).filter(
        CompanyMembership.company_id == c.id, CompanyMembership.is_active == True
    ).count()
    used_this = db.query(Appointment).filter(
        Appointment.paid_by_company_id == c.id,
        Appointment.appointment_date >= first_this_month,
    ).count()
    used_last = db.query(Appointment).filter(
        Appointment.paid_by_company_id == c.id,
        Appointment.appointment_date >= first_last_month,
        Appointment.appointment_date < first_this_month,
    ).count()

    return CompanyStats(
        company_id=c.id,
        name=c.name,
        sessions_pool=c.sessions_pool,
        sessions_used=c.sessions_used,
        members_total=members_total,
        members_active=members_active,
        sessions_used_this_month=used_this,
        sessions_used_last_month=used_last,
    )


@router.get("/me/usage", response_model=List[CompanyUsageItem])
def my_company_usage(
    days: int = Query(default=60, ge=1, le=365),
    anonymized: bool = Query(default=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista de sesiones usadas. Por defecto anonimizado (sin nombres)."""
    c = _company_for_user(current_user, db)
    since = date_type.today() - timedelta(days=days)
    rows = (
        db.query(Appointment)
        .options(
            joinedload(Appointment.doctor).joinedload(Doctor.specialty),
            joinedload(Appointment.patient),
        )
        .filter(
            Appointment.paid_by_company_id == c.id,
            Appointment.appointment_date >= since,
        )
        .order_by(Appointment.appointment_date.desc())
        .all()
    )
    return [
        CompanyUsageItem(
            appointment_id=a.id,
            date=a.appointment_date.isoformat(),
            specialty=a.doctor.specialty.name if a.doctor and a.doctor.specialty else None,
            employee_name=(
                f"{a.patient.first_name} {a.patient.last_name}"
                if (a.patient and not anonymized) else None
            ),
            status=a.status.value if a.status else "scheduled",
        ) for a in rows
    ]


@router.get("/me/members", response_model=List[MembershipResponse])
def my_company_members(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Company admin ve sus empleados (con nombre, para gestión)."""
    c = _company_for_user(current_user, db)
    rows = (
        db.query(CompanyMembership)
        .options(joinedload(CompanyMembership.patient))
        .filter(CompanyMembership.company_id == c.id)
        .order_by(CompanyMembership.joined_at.desc())
        .all()
    )
    return [
        MembershipResponse(
            id=m.id,
            company_id=m.company_id,
            company_name=c.name,
            patient_id=m.patient_id,
            patient_name=f"{m.patient.first_name} {m.patient.last_name}" if m.patient else "?",
            patient_email=m.patient.email if m.patient else "",
            patient_phone=m.patient.phone if m.patient else None,
            is_active=m.is_active,
            sessions_used=m.sessions_used,
            joined_at=m.joined_at,
        ) for m in rows
    ]


# ─── Helper para appointments.py ─────────────────────────────────────────

def try_cover_with_company(db: Session, patient_id: int, appointment_id: int) -> Optional[Company]:
    """Intenta cubrir una cita con el pool de la empresa del paciente.

    Returns:
        Company si la cubrió, None si no aplica.

    NO commitea — el caller debe hacer commit.
    """
    m = (
        db.query(CompanyMembership)
        .options(joinedload(CompanyMembership.company))
        .filter(CompanyMembership.patient_id == patient_id, CompanyMembership.is_active == True)
        .first()
    )
    if not m or not m.company or not m.company.is_active:
        return None
    company = m.company
    if (company.sessions_pool or 0) <= 0:
        return None

    # Tope mensual por empleado
    if company.monthly_cap_per_employee:
        today = date_type.today()
        used_this_month = (
            db.query(Appointment)
            .filter(
                Appointment.patient_id == patient_id,
                Appointment.paid_by_company_id == company.id,
                extract('year', Appointment.appointment_date) == today.year,
                extract('month', Appointment.appointment_date) == today.month,
            )
            .count()
        )
        if used_this_month >= company.monthly_cap_per_employee:
            return None

    # Marcar cita como cubierta por empresa
    appt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appt:
        return None
    appt.paid_by_company_id = company.id
    company.sessions_pool -= 1
    company.sessions_used = (company.sessions_used or 0) + 1
    m.sessions_used = (m.sessions_used or 0) + 1
    return company
