from typing import Optional
from pydantic import BaseModel, EmailStr


class ClinicBase(BaseModel):
    name: str
    address: Optional[str] = None
    city: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    description: Optional[str] = None


class ClinicCreate(ClinicBase):
    pass


class ClinicUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class ClinicResponse(ClinicBase):
    id: int
    is_active: bool

    class Config:
        from_attributes = True
