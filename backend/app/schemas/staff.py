"""Schemas para staff: creación de pacientes en mostrador y de recepcionistas por admin."""
from typing import Optional
from pydantic import BaseModel, EmailStr
from .user import UserResponse


class StaffPatientCreate(BaseModel):
    """Recepción crea un paciente al vuelo. La password se autogenera y se devuelve una vez."""
    email: EmailStr
    first_name: str
    last_name: str
    phone: Optional[str] = None
    rut: Optional[str] = None


class StaffPatientCreateResponse(BaseModel):
    user: UserResponse
    generated_password: str


class ReceptionistCreate(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    phone: Optional[str] = None
    rut: Optional[str] = None
