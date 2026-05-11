from typing import Optional
from pydantic import BaseModel


class SpecialtyBase(BaseModel):
    name: str
    description: Optional[str] = None


class SpecialtyCreate(SpecialtyBase):
    pass


class SpecialtyUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class SpecialtyResponse(SpecialtyBase):
    id: int
    is_active: bool

    class Config:
        from_attributes = True
