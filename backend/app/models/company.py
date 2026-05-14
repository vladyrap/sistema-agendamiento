from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, ForeignKey, UniqueConstraint, Index,
)
from sqlalchemy.orm import relationship
from app.core.database import Base


class Company(Base):
    """Empresa cliente que contrata un pool de sesiones para sus empleados.

    El pool funciona como un balance: la empresa lo carga (admin platform recarga),
    cada vez que un empleado reserva una cita el pool se decrementa.
    """
    __tablename__ = "companies"

    id              = Column(Integer, primary_key=True, index=True)
    name            = Column(String(200), nullable=False, index=True)
    rut             = Column(String(20), unique=True, index=True, nullable=True)
    billing_email   = Column(String(255), nullable=True)
    contact_name    = Column(String(200), nullable=True)
    contact_phone   = Column(String(50), nullable=True)
    address         = Column(Text, nullable=True)

    # Pool de sesiones
    sessions_pool   = Column(Integer, default=0, nullable=False)   # sesiones restantes
    sessions_used   = Column(Integer, default=0, nullable=False)   # total histórico
    monthly_cap_per_employee = Column(Integer, nullable=True)      # tope mensual por empleado (NULL = sin tope)

    # Dominio para auto-link de empleados (ej: 'empresa.com' → cualquier user@empresa.com se asocia)
    email_domain    = Column(String(120), nullable=True, index=True)

    # User vinculado como administrador de la empresa (role=company_admin)
    company_admin_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    is_active       = Column(Boolean, default=True, nullable=False)
    notes           = Column(Text, default="")
    created_at      = Column(DateTime, default=datetime.utcnow)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    company_admin_user = relationship("User", foreign_keys=[company_admin_user_id])
    memberships = relationship("CompanyMembership", back_populates="company", cascade="all, delete-orphan")


class CompanyMembership(Base):
    """Vínculo entre un empleado (User role=patient) y su empresa.

    Solo permite un membership activo por empleado a la vez.
    """
    __tablename__ = "company_memberships"
    __table_args__ = (
        UniqueConstraint("company_id", "patient_id", name="uq_membership_company_patient"),
        Index("ix_membership_patient_active", "patient_id", "is_active"),
    )

    id              = Column(Integer, primary_key=True, index=True)
    company_id      = Column(Integer, ForeignKey("companies.id"), nullable=False)
    patient_id      = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    is_active       = Column(Boolean, default=True, nullable=False)
    sessions_used   = Column(Integer, default=0, nullable=False)
    joined_at       = Column(DateTime, default=datetime.utcnow)
    deactivated_at  = Column(DateTime, nullable=True)

    company = relationship("Company", back_populates="memberships")
    patient = relationship("User", foreign_keys=[patient_id])
