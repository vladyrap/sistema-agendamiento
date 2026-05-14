from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field


# ─── Company ──────────────────────────────────────────────────────────────

class CompanyCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    rut: Optional[str] = Field(default=None, max_length=20)
    billing_email: Optional[EmailStr] = None
    contact_name: Optional[str] = Field(default=None, max_length=200)
    contact_phone: Optional[str] = Field(default=None, max_length=50)
    address: Optional[str] = None
    email_domain: Optional[str] = Field(default=None, max_length=120)
    monthly_cap_per_employee: Optional[int] = Field(default=None, ge=1, le=100)
    sessions_pool: int = Field(default=0, ge=0)
    notes: Optional[str] = ""


class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    rut: Optional[str] = None
    billing_email: Optional[EmailStr] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    address: Optional[str] = None
    email_domain: Optional[str] = None
    monthly_cap_per_employee: Optional[int] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class CompanyTopUp(BaseModel):
    """Recargar el pool de sesiones."""
    sessions: int = Field(ge=1, le=10000)
    note: Optional[str] = ""


class CompanyAssignAdmin(BaseModel):
    admin_email: EmailStr  # email del usuario que será company_admin (debe existir)


class CompanyResponse(BaseModel):
    id: int
    name: str
    rut: Optional[str] = None
    billing_email: Optional[str] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    address: Optional[str] = None
    email_domain: Optional[str] = None
    sessions_pool: int
    sessions_used: int
    monthly_cap_per_employee: Optional[int] = None
    is_active: bool
    notes: str = ""
    members_count: int = 0
    company_admin_user_id: Optional[int] = None
    company_admin_name: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ─── Memberships ──────────────────────────────────────────────────────────

class MembershipCreate(BaseModel):
    patient_email: EmailStr


class MembershipResponse(BaseModel):
    id: int
    company_id: int
    company_name: Optional[str] = None
    patient_id: int
    patient_name: str
    patient_email: str
    patient_phone: Optional[str] = None
    is_active: bool
    sessions_used: int
    joined_at: Optional[datetime] = None


# ─── For patient view ─────────────────────────────────────────────────────

class MyCompanyBenefit(BaseModel):
    """Lo que ve el paciente: tiene una empresa activa que le cubre sesiones."""
    has_benefit: bool
    company_name: Optional[str] = None
    sessions_pool_total: Optional[int] = None  # cuánto le queda a la empresa
    monthly_cap: Optional[int] = None
    sessions_used_this_month: int = 0
    sessions_used_total: int = 0


# ─── For company admin portal ─────────────────────────────────────────────

class CompanyStats(BaseModel):
    company_id: int
    name: str
    sessions_pool: int
    sessions_used: int
    members_total: int
    members_active: int
    sessions_used_this_month: int
    sessions_used_last_month: int


class CompanyUsageItem(BaseModel):
    """Una sesión usada (anonimizada o no, según context)."""
    appointment_id: int
    date: str
    specialty: Optional[str] = None
    employee_name: Optional[str] = None  # solo si el admin pidió ver no-anonimizado
    status: str
