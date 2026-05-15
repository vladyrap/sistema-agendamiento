from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel, EmailStr
from app.models.user import UserRole


class UserBase(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    phone: Optional[str] = None
    rut: Optional[str] = None


class UserCreate(UserBase):
    password: str
    role: UserRole = UserRole.patient


class UserUpdate(BaseModel):
    """Self-update por el paciente (datos personales) y admin (todos)."""
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    birth_date: Optional[date] = None
    address: Optional[str] = None
    health_insurance: Optional[str] = None


class AdminPatientUpdate(BaseModel):
    """Solo admin puede modificar estos campos."""
    patient_status: Optional[str] = None  # active / in_treatment / inactive / discharged
    assigned_doctor_id: Optional[int] = None


class UserResponse(UserBase):
    id: int
    role: UserRole
    is_active: bool
    created_at: datetime
    birth_date: Optional[date] = None
    address: Optional[str] = None
    health_insurance: Optional[str] = None
    patient_status: Optional[str] = None
    assigned_doctor_id: Optional[int] = None
    photo_url: Optional[str] = None
    totp_enabled: bool = False

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    totp_code: Optional[str] = None


class TotpSetupResponse(BaseModel):
    secret: str
    otpauth_url: str
    qr_data_url: str  # data:image/png;base64,...


class TotpCodeRequest(BaseModel):
    code: str
