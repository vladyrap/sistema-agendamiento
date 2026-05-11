from typing import Optional
from pydantic import BaseModel, EmailStr
from .specialty import SpecialtyResponse
from .user import UserResponse


class DoctorBase(BaseModel):
    specialty_id: int
    clinic_id: Optional[int] = None
    license_number: str
    consultation_duration: int = 30
    consultation_price: int = 0  # CLP, 0 = sin pago
    bio: Optional[str] = None


class DoctorCreate(DoctorBase):
    user_id: int


class DoctorUpdate(BaseModel):
    specialty_id: Optional[int] = None
    clinic_id: Optional[int] = None
    consultation_duration: Optional[int] = None
    consultation_price: Optional[int] = None
    bio: Optional[str] = None
    is_active: Optional[bool] = None


class DoctorResponse(DoctorBase):
    id: int
    user_id: int
    is_active: bool
    user: UserResponse
    specialty: SpecialtyResponse
    rating_avg: Optional[float] = None
    rating_count: int = 0

    class Config:
        from_attributes = True


class AdminDoctorCreate(BaseModel):
    """Crea usuario y perfil de médico en una sola operación (sólo admin)."""
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    phone: Optional[str] = None
    rut: Optional[str] = None
    specialty_id: int
    clinic_id: Optional[int] = None
    license_number: str
    consultation_duration: int = 30
    consultation_price: int = 0
    bio: Optional[str] = None


class DoctorListResponse(BaseModel):
    id: int
    specialty_id: int
    consultation_duration: int
    consultation_price: int = 0
    bio: Optional[str]
    is_active: bool
    user: UserResponse
    specialty: SpecialtyResponse
    rating_avg: Optional[float] = None
    rating_count: int = 0

    class Config:
        from_attributes = True
