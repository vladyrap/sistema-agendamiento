import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Date, DateTime, ForeignKey, Enum, Index
from sqlalchemy.orm import relationship
from app.core.database import Base


class BoletaStatus(str, enum.Enum):
    pending  = "pending"   # cita pagada, falta que el psicólogo/a emita la boleta en SII
    issued   = "issued"    # ya emitida (guardamos folio + fecha)
    cancelled = "cancelled"  # cancelada manualmente o por reembolso


class BoletaHonorarios(Base):
    """Registro de boleta de honorarios pendiente / emitida por un psicólogo/a.

    El SII no expone API pública para emitir boletas de honorarios, así que
    este registro existe para asistir al profesional: agrupa los datos
    necesarios (RUT paciente, monto, glosa, fecha) y trackea si la boleta
    ya fue emitida manualmente en sii.cl.

    En Nivel 1 se crea automáticamente al confirmarse el pago de una cita.
    """
    __tablename__ = "boletas_honorarios"
    __table_args__ = (
        Index("ix_boleta_doctor_status", "doctor_id", "status"),
        Index("ix_boleta_appointment", "appointment_id"),
    )

    id            = Column(Integer, primary_key=True, index=True)
    doctor_id     = Column(Integer, ForeignKey("doctors.id"), nullable=False)
    patient_id    = Column(Integer, ForeignKey("users.id"), nullable=False)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=True)

    # Snapshot de datos al momento de generar la boleta
    amount_clp    = Column(Integer, nullable=False)
    glosa         = Column(String(200), nullable=False, default="Atención psicológica")
    service_date  = Column(Date, nullable=False)  # fecha del servicio prestado

    # Estado y datos del SII
    status        = Column(Enum(BoletaStatus), default=BoletaStatus.pending, nullable=False)
    folio         = Column(String(50), nullable=True)  # número de boleta SII
    emitted_at    = Column(DateTime, nullable=True)

    # PDF de la boleta (opcional, lo sube el psicólogo/a después de emitirla)
    attachment_id = Column(Integer, ForeignKey("medical_attachments.id"), nullable=True)

    notes         = Column(Text, default="")
    created_at    = Column(DateTime, default=datetime.utcnow)
    updated_at    = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    doctor      = relationship("Doctor", foreign_keys=[doctor_id])
    patient     = relationship("User", foreign_keys=[patient_id])
    appointment = relationship("Appointment", foreign_keys=[appointment_id])
    attachment  = relationship("MedicalAttachment", foreign_keys=[attachment_id])
