import secrets
import logging
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session, joinedload, selectinload

logger = logging.getLogger(__name__)
from app.core.database import get_db
from app.core.redis_client import cache_delete_pattern
from app.core.metrics import (
    appointments_created,
    appointments_cancelled,
    appointments_confirmed,
    appointments_completed,
)
from app.models.appointment import Appointment, AppointmentStatus
from app.models.doctor import Doctor
from app.models.availability import DoctorAvailability
from app.models.doctor_block import DoctorBlock
from app.models.user import User, UserRole
from app.models.payment import Payment, PaymentStatus
from app.models.waitlist import Waitlist, WaitlistStatus
from app.schemas.appointment import (
    AppointmentCreate, AppointmentCancel, AppointmentResponse, AppointmentSummary,
    AppointmentReschedule, CancelDayRequest, CancelDayResponse,
)
from app.api.deps import get_current_user
from app.services.notifications import enqueue
from app.services import payments as payments_service

router = APIRouter(prefix="/appointments", tags=["Citas"])


def _load_appointment(db: Session, appointment_id: int) -> Appointment:
    appt = (
        db.query(Appointment)
        .options(
            joinedload(Appointment.patient),
            joinedload(Appointment.doctor).joinedload(Doctor.user),
            joinedload(Appointment.doctor).joinedload(Doctor.specialty),
            selectinload(Appointment.payments),
        )
        .filter(Appointment.id == appointment_id)
        .first()
    )
    if not appt:
        raise HTTPException(status_code=404, detail="Cita no encontrada")
    return appt


def _notify_waitlist(db: Session, doctor_id: int, freed_date) -> None:
    """Cuando se libera una fecha (por cancelación), avisa al primer paciente
    en lista de espera cuya ventana incluye esa fecha."""
    entry = (
        db.query(Waitlist)
        .options(
            joinedload(Waitlist.patient),
            joinedload(Waitlist.doctor).joinedload(Doctor.user),
            joinedload(Waitlist.doctor).joinedload(Doctor.specialty),
        )
        .filter(
            Waitlist.doctor_id == doctor_id,
            Waitlist.status == WaitlistStatus.pending,
            Waitlist.desired_from <= freed_date,
            Waitlist.desired_to >= freed_date,
        )
        .order_by(Waitlist.created_at)
        .first()
    )
    if not entry:
        return
    entry.status = WaitlistStatus.notified
    entry.notified_at = datetime.utcnow()
    db.commit()
    enqueue("waitlist_slot_available", {
        "recipient_role": "patient",
        "to_email": entry.patient.email if entry.patient else None,
        "to_phone": entry.patient.phone if entry.patient else None,
        "to_name": f"{entry.patient.first_name} {entry.patient.last_name}" if entry.patient else "",
        "counterpart_name": (
            f"Dr(a). {entry.doctor.user.first_name} {entry.doctor.user.last_name}"
            if entry.doctor and entry.doctor.user else ""
        ),
        "doctor_name": (
            f"Dr(a). {entry.doctor.user.first_name} {entry.doctor.user.last_name}"
            if entry.doctor and entry.doctor.user else ""
        ),
        "patient_name": f"{entry.patient.first_name} {entry.patient.last_name}" if entry.patient else "",
        "appointment_date": str(freed_date),
        "start_time": "",
    })


def _notification_payload(appt: Appointment, recipient: str = "patient") -> dict:
    """Construye el payload de notificación para un evento de cita.

    recipient: 'patient' o 'doctor'. Define a quién va dirigida la notificación.
    El template del worker decide el copy según `recipient_role`.
    """
    patient_name = f"{appt.patient.first_name} {appt.patient.last_name}" if appt.patient else ""
    doctor_name = (
        f"Dr(a). {appt.doctor.user.first_name} {appt.doctor.user.last_name}"
        if appt.doctor and appt.doctor.user else ""
    )

    if recipient == "doctor" and appt.doctor and appt.doctor.user:
        to_email = appt.doctor.user.email
        to_phone = appt.doctor.user.phone
        to_name = doctor_name
        counterpart = patient_name
    else:
        to_email = appt.patient.email if appt.patient else None
        to_phone = appt.patient.phone if appt.patient else None
        to_name = patient_name
        counterpart = doctor_name

    return {
        "appointment_id": appt.id,
        "recipient_role": "doctor" if recipient == "doctor" else "patient",
        "to_email": to_email,
        "to_phone": to_phone,
        "to_name": to_name,
        "counterpart_name": counterpart,
        "doctor_name": doctor_name,
        "patient_name": patient_name,
        "appointment_date": str(appt.appointment_date),
        "start_time": str(appt.start_time),
        "modality": appt.modality,
    }


def _enqueue_for_both(event_type: str, appt: Appointment, **extra) -> None:
    """Encola la notificación tanto para el paciente como para el médico."""
    for role in ("patient", "doctor"):
        payload = _notification_payload(appt, recipient=role)
        if extra:
            payload.update(extra)
        enqueue(event_type, payload)


def _latest_payment_status(appt: Appointment) -> Optional[str]:
    if not appt.payments:
        return None
    last = sorted(appt.payments, key=lambda p: p.id)[-1]
    return last.status.value if last.status else None


@router.post("/", response_model=AppointmentResponse, status_code=201)
def create_appointment(
    data: AppointmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doctor = db.query(Doctor).filter(Doctor.id == data.doctor_id, Doctor.is_active == True).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Médico no encontrado")

    day_of_week = data.appointment_date.weekday()
    availability = (
        db.query(DoctorAvailability)
        .filter(
            DoctorAvailability.doctor_id == data.doctor_id,
            DoctorAvailability.day_of_week == day_of_week,
            DoctorAvailability.is_active == True,
        )
        .first()
    )
    if not availability:
        raise HTTPException(status_code=400, detail="El médico no atiende ese día")

    if not (availability.start_time <= data.start_time < availability.end_time):
        raise HTTPException(status_code=400, detail="Hora fuera del horario de atención")

    end_dt = datetime.combine(data.appointment_date, data.start_time) + timedelta(minutes=doctor.consultation_duration)
    end_time = end_dt.time()

    conflict = db.query(Appointment).filter(
        Appointment.doctor_id == data.doctor_id,
        Appointment.appointment_date == data.appointment_date,
        Appointment.start_time == data.start_time,
        Appointment.status.in_([AppointmentStatus.scheduled, AppointmentStatus.confirmed]),
    ).first()
    if conflict:
        raise HTTPException(status_code=409, detail="Ese horario ya está reservado")

    # Si es staff (admin/recepcionista) y especificó patient_id, agendamos a nombre suyo.
    target_patient_id = current_user.id
    if data.patient_id and current_user.role in (UserRole.admin, UserRole.receptionist):
        if not db.query(User).filter(User.id == data.patient_id, User.role == UserRole.patient).first():
            raise HTTPException(status_code=404, detail="Paciente no encontrado")
        target_patient_id = data.patient_id

    modality = data.modality if data.modality in ("in_person", "online") else "in_person"
    meeting_room_token = secrets.token_urlsafe(16) if modality == "online" else None

    # Bloqueo de fecha (vacaciones del médico)
    blocked = db.query(DoctorBlock).filter(
        DoctorBlock.doctor_id == data.doctor_id,
        DoctorBlock.start_date <= data.appointment_date,
        DoctorBlock.end_date >= data.appointment_date,
    ).first()
    if blocked:
        raise HTTPException(status_code=400, detail="El médico no atiende ese día (ausencia programada)")

    appt = Appointment(
        patient_id=target_patient_id,
        doctor_id=data.doctor_id,
        appointment_date=data.appointment_date,
        start_time=data.start_time,
        end_time=end_time,
        reason=data.reason,
        modality=modality,
        meeting_room_token=meeting_room_token,
    )
    db.add(appt)
    db.flush()

    # ── Cobertura por empresa (convenio B2B) ──
    # Si el paciente tiene membership activo + la empresa tiene pool, descontamos.
    try:
        from app.api.routes.companies import try_cover_with_company
        covered_by = try_cover_with_company(db, target_patient_id, appt.id)
        if covered_by:
            logger.info(
                "appointment.covered_by_company",
                extra={"company_id": covered_by.id, "appointment_id": appt.id},
            )
    except Exception:
        logger.exception("appointment.company_cover_failed")

    db.commit()
    cache_delete_pattern(f"slots:doctor:{data.doctor_id}:{data.appointment_date}")

    # ── Citas recurrentes (mismas hora/día de la semana, +1..N semanas) ──
    extras_created = []
    if data.repeat_weeks and data.repeat_weeks > 0:
        max_repeat = min(data.repeat_weeks, 51)
        for i in range(1, max_repeat + 1):
            next_date = data.appointment_date + timedelta(days=7 * i)
            # disponibilidad ese día
            next_avail = db.query(DoctorAvailability).filter(
                DoctorAvailability.doctor_id == doctor.id,
                DoctorAvailability.day_of_week == next_date.weekday(),
                DoctorAvailability.is_active == True,
            ).first()
            if not next_avail:
                continue
            if not (next_avail.start_time <= data.start_time < next_avail.end_time):
                continue
            # ausencia
            if db.query(DoctorBlock).filter(
                DoctorBlock.doctor_id == doctor.id,
                DoctorBlock.start_date <= next_date,
                DoctorBlock.end_date >= next_date,
            ).first():
                continue
            # conflicto
            if db.query(Appointment).filter(
                Appointment.doctor_id == doctor.id,
                Appointment.appointment_date == next_date,
                Appointment.start_time == data.start_time,
                Appointment.status.in_([AppointmentStatus.scheduled, AppointmentStatus.confirmed]),
            ).first():
                continue
            extra_end = (datetime.combine(next_date, data.start_time)
                         + timedelta(minutes=doctor.consultation_duration)).time()
            extra = Appointment(
                patient_id=target_patient_id,
                doctor_id=doctor.id,
                appointment_date=next_date,
                start_time=data.start_time,
                end_time=extra_end,
                reason=data.reason,
                modality=modality,
                meeting_room_token=secrets.token_urlsafe(16) if modality == "online" else None,
            )
            db.add(extra)
            extras_created.append((extra, next_date))
        if extras_created:
            db.commit()
            for e, d in extras_created:
                cache_delete_pattern(f"slots:doctor:{doctor.id}:{d}")
                loaded_e = _load_appointment(db, e.id)
                _enqueue_for_both("appointment_created", loaded_e)

    loaded = _load_appointment(db, appt.id)
    appointments_created.labels(specialty=loaded.doctor.specialty.name).inc()

    # ── Pago ──────────────────────────────────────────────────────────────
    checkout_url: Optional[str] = None
    payment_status: Optional[str] = None
    price = doctor.consultation_price or 0

    if price > 0 and payments_service.is_enabled():
        title = f"Consulta con Dr(a). {doctor.user.first_name} {doctor.user.last_name}"
        result = payments_service.create_preference(
            appointment_id=appt.id,
            amount=price,
            title=title,
            payer_email=current_user.email,
        )
        if result is not None:
            preference_id, checkout_url = result
            payment = Payment(
                appointment_id=appt.id,
                amount=price,
                currency="CLP",
                status=PaymentStatus.pending,
                provider="mercadopago",
                provider_id=preference_id,
                checkout_url=checkout_url,
            )
            db.add(payment)
            db.commit()
            payment_status = PaymentStatus.pending.value

    # ── Notificación a paciente + doctor ──────────────────────────────────
    _enqueue_for_both("appointment_created", loaded)

    # Re-cargar para incluir el payment recién creado
    loaded = _load_appointment(db, appt.id)
    response = AppointmentResponse.model_validate(loaded, from_attributes=True)
    response.checkout_url = checkout_url
    response.payment_status = payment_status or _latest_payment_status(loaded)
    return response


@router.get("/", response_model=List[AppointmentSummary])
def list_my_appointments(
    status_filter: Optional[AppointmentStatus] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        db.query(Appointment)
        .options(
            joinedload(Appointment.patient),
            joinedload(Appointment.doctor).joinedload(Doctor.user),
            joinedload(Appointment.doctor).joinedload(Doctor.specialty),
            selectinload(Appointment.payments),
        )
    )
    if current_user.role == UserRole.patient:
        query = query.filter(Appointment.patient_id == current_user.id)
    elif current_user.role == UserRole.doctor:
        doctor = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
        if doctor:
            query = query.filter(Appointment.doctor_id == doctor.id)
    # admin y recepcionista ven todas las citas (sin filtro)
    if status_filter:
        query = query.filter(Appointment.status == status_filter)
    appts = query.order_by(Appointment.appointment_date, Appointment.start_time).all()

    out: list[AppointmentSummary] = []
    for a in appts:
        item = AppointmentSummary.model_validate(a, from_attributes=True)
        item.payment_status = _latest_payment_status(a)
        out.append(item)
    return out


@router.get("/{appointment_id}", response_model=AppointmentResponse)
def get_appointment(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    appt = _load_appointment(db, appointment_id)
    if current_user.role not in [UserRole.admin, UserRole.receptionist]:
        if appt.patient_id != current_user.id:
            doctor = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
            if not doctor or appt.doctor_id != doctor.id:
                raise HTTPException(status_code=403, detail="Sin permisos")
    response = AppointmentResponse.model_validate(appt, from_attributes=True)
    response.payment_status = _latest_payment_status(appt)
    if appt.payments:
        last = sorted(appt.payments, key=lambda p: p.id)[-1]
        if last.status == PaymentStatus.pending:
            response.checkout_url = last.checkout_url
    return response


@router.put("/{appointment_id}/cancel", response_model=AppointmentResponse)
def cancel_appointment(
    appointment_id: int,
    data: AppointmentCancel,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    appt = _load_appointment(db, appointment_id)
    if appt.status not in [AppointmentStatus.scheduled, AppointmentStatus.confirmed]:
        raise HTTPException(status_code=400, detail="La cita no puede cancelarse en su estado actual")
    if current_user.role not in [UserRole.admin, UserRole.receptionist]:
        if appt.patient_id != current_user.id:
            doctor = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
            if not doctor or appt.doctor_id != doctor.id:
                raise HTTPException(status_code=403, detail="Sin permisos")
    appt.status = AppointmentStatus.cancelled
    appt.cancellation_reason = data.cancellation_reason
    db.commit()
    cache_delete_pattern(f"slots:doctor:{appt.doctor_id}:{appt.appointment_date}")

    loaded = _load_appointment(db, appointment_id)
    appointments_cancelled.labels(actor=current_user.role.value).inc()
    _enqueue_for_both("appointment_cancelled", loaded, reason=data.cancellation_reason or "no especificado")

    _notify_waitlist(db, appt.doctor_id, appt.appointment_date)

    response = AppointmentResponse.model_validate(loaded, from_attributes=True)
    response.payment_status = _latest_payment_status(loaded)
    return response


@router.put("/{appointment_id}/reschedule", response_model=AppointmentResponse)
def reschedule_appointment(
    appointment_id: int,
    data: AppointmentReschedule,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cambia la fecha/hora de una cita existente. Permitido para paciente o admin
    mientras la cita esté agendada o confirmada."""
    appt = _load_appointment(db, appointment_id)

    if appt.status not in [AppointmentStatus.scheduled, AppointmentStatus.confirmed]:
        raise HTTPException(status_code=400, detail="Solo citas agendadas o confirmadas pueden reagendarse")

    if current_user.role not in (UserRole.admin, UserRole.receptionist) and appt.patient_id != current_user.id:
        raise HTTPException(status_code=403, detail="Sin permisos")

    # Validar disponibilidad nueva
    doctor = appt.doctor
    day_of_week = data.appointment_date.weekday()
    availability = (
        db.query(DoctorAvailability)
        .filter(
            DoctorAvailability.doctor_id == doctor.id,
            DoctorAvailability.day_of_week == day_of_week,
            DoctorAvailability.is_active == True,
        )
        .first()
    )
    if not availability:
        raise HTTPException(status_code=400, detail="El médico no atiende ese día")
    if not (availability.start_time <= data.start_time < availability.end_time):
        raise HTTPException(status_code=400, detail="Hora fuera del horario de atención")

    # Conflict (ignorando la propia cita)
    conflict = db.query(Appointment).filter(
        Appointment.id != appt.id,
        Appointment.doctor_id == doctor.id,
        Appointment.appointment_date == data.appointment_date,
        Appointment.start_time == data.start_time,
        Appointment.status.in_([AppointmentStatus.scheduled, AppointmentStatus.confirmed]),
    ).first()
    if conflict:
        raise HTTPException(status_code=409, detail="Ese horario ya está reservado")

    old_date = appt.appointment_date
    old_start = appt.start_time

    end_dt = datetime.combine(data.appointment_date, data.start_time) + timedelta(minutes=doctor.consultation_duration)
    appt.appointment_date = data.appointment_date
    appt.start_time = data.start_time
    appt.end_time = end_dt.time()
    # Reagendar resetea a "scheduled" (perderá la confirmación previa)
    appt.status = AppointmentStatus.scheduled
    db.commit()

    # Invalidar slots caché de ambos días afectados
    cache_delete_pattern(f"slots:doctor:{doctor.id}:{old_date}")
    cache_delete_pattern(f"slots:doctor:{doctor.id}:{data.appointment_date}")

    loaded = _load_appointment(db, appointment_id)
    _enqueue_for_both("appointment_rescheduled", loaded, old_date=str(old_date), old_start=str(old_start))

    response = AppointmentResponse.model_validate(loaded, from_attributes=True)
    response.payment_status = _latest_payment_status(loaded)
    return response


@router.put("/{appointment_id}/confirm", response_model=AppointmentResponse)
def confirm_appointment(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    appt = _load_appointment(db, appointment_id)
    doctor = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
    if current_user.role not in (UserRole.admin, UserRole.receptionist):
        if not doctor or appt.doctor_id != doctor.id:
            raise HTTPException(status_code=403, detail="Sin permisos")
    if appt.status != AppointmentStatus.scheduled:
        raise HTTPException(status_code=400, detail="Solo citas 'scheduled' pueden confirmarse")
    appt.status = AppointmentStatus.confirmed
    db.commit()

    loaded = _load_appointment(db, appointment_id)
    appointments_confirmed.inc()
    _enqueue_for_both("appointment_confirmed", loaded)
    response = AppointmentResponse.model_validate(loaded, from_attributes=True)
    response.payment_status = _latest_payment_status(loaded)
    return response


@router.put("/{appointment_id}/complete", response_model=AppointmentResponse)
def complete_appointment(
    appointment_id: int,
    notes: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    appt = _load_appointment(db, appointment_id)
    doctor = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
    if current_user.role != UserRole.admin:
        if not doctor or appt.doctor_id != doctor.id:
            raise HTTPException(status_code=403, detail="Sin permisos")
    appt.status = AppointmentStatus.completed
    if notes:
        appt.notes = notes
    db.commit()
    appointments_completed.inc()
    loaded = _load_appointment(db, appointment_id)
    response = AppointmentResponse.model_validate(loaded, from_attributes=True)
    response.payment_status = _latest_payment_status(loaded)
    return response


# ─── Cancelar día completo (médico/admin/recepcionista) ────────────────────
@router.post("/cancel-day", response_model=CancelDayResponse)
def cancel_day(
    data: CancelDayRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cancela todas las citas de un médico para una fecha. Por defecto, la fecha
    se aplica al médico actual. Admin/recepcionista pueden enviar `doctor_id` extra
    en futuras versiones; por ahora solo el médico cancela su propio día."""
    if current_user.role == UserRole.doctor:
        doctor = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
    elif current_user.role in (UserRole.admin, UserRole.receptionist):
        # Para staff necesitamos saber qué médico — usamos el primer doctor con citas ese día.
        # En MVP: solo médicos pueden cancelar su día desde aquí.
        raise HTTPException(status_code=400, detail="Solo el médico puede cancelar su día desde este endpoint")
    else:
        raise HTTPException(status_code=403, detail="Sin permisos")

    if not doctor:
        raise HTTPException(status_code=404, detail="Perfil de médico no encontrado")

    appts = db.query(Appointment).filter(
        Appointment.doctor_id == doctor.id,
        Appointment.appointment_date == data.date,
        Appointment.status.in_([AppointmentStatus.scheduled, AppointmentStatus.confirmed]),
    ).all()
    cancelled = 0
    for a in appts:
        a.status = AppointmentStatus.cancelled
        a.cancellation_reason = data.reason or "Día cancelado por el médico"
        cancelled += 1
    if cancelled:
        db.commit()
        cache_delete_pattern(f"slots:doctor:{doctor.id}:{data.date}")
        for a in appts:
            loaded = _load_appointment(db, a.id)
            _enqueue_for_both("appointment_cancelled", loaded, reason=a.cancellation_reason)
            appointments_cancelled.labels(actor=current_user.role.value).inc()
        # Notificar lista de espera
        _notify_waitlist(db, doctor.id, data.date)
    return CancelDayResponse(cancelled=cancelled)


# ─── Teleconsulta ───────────────────────────────────────────────────────────
@router.get("/{appointment_id}/meeting")
def get_meeting_link(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Devuelve la URL de la sala Jitsi si la cita es online y estamos en la ventana
    válida (15 min antes a 30 min después de la hora de inicio)."""
    appt = _load_appointment(db, appointment_id)

    # Permisos: paciente, médico de la cita, o staff
    is_patient = appt.patient_id == current_user.id
    doctor_self = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
    is_appt_doctor = doctor_self and doctor_self.id == appt.doctor_id
    is_staff = current_user.role in (UserRole.admin, UserRole.receptionist)
    if not (is_patient or is_appt_doctor or is_staff):
        raise HTTPException(status_code=403, detail="Sin permisos")

    if appt.modality != "online" or not appt.meeting_room_token:
        raise HTTPException(status_code=400, detail="Esta cita no es por videollamada")

    start_dt = datetime.combine(appt.appointment_date, appt.start_time)
    end_dt = datetime.combine(appt.appointment_date, appt.end_time)
    now = datetime.utcnow()
    open_at = start_dt - timedelta(minutes=15)
    close_at = end_dt + timedelta(minutes=30)

    minutes_until = int((start_dt - now).total_seconds() // 60)

    if now < open_at:
        return {
            "available": False,
            "minutes_until_open": int((open_at - now).total_seconds() // 60),
            "minutes_until_start": minutes_until,
        }
    if now > close_at:
        return {"available": False, "expired": True}

    room_name = f"calmar-{appt.meeting_room_token}"
    return {
        "available": True,
        "room_name": room_name,
        "room_url": f"https://meet.jit.si/{room_name}",
        "subject": f"Cita con Dr(a). {appt.doctor.user.first_name} {appt.doctor.user.last_name}",
        "minutes_until_start": minutes_until,
    }


# ─── iCal ────────────────────────────────────────────────────────────────
def _ics_escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace(",", "\\,").replace(";", "\\;").replace("\n", "\\n")


@router.get("/{appointment_id}/calendar.ics")
def appointment_ics(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Devuelve un archivo .ics para añadir la cita al calendario del usuario.

    Asume zona horaria America/Santiago para los DTSTART/DTEND. Convertimos a UTC.
    """
    from zoneinfo import ZoneInfo

    appt = _load_appointment(db, appointment_id)

    # Permisos
    is_patient = appt.patient_id == current_user.id
    doctor_self = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
    is_appt_doctor = doctor_self and doctor_self.id == appt.doctor_id
    is_staff = current_user.role in (UserRole.admin, UserRole.receptionist)
    if not (is_patient or is_appt_doctor or is_staff):
        raise HTTPException(status_code=403, detail="Sin permisos")

    tz_local = ZoneInfo("America/Santiago")
    tz_utc = ZoneInfo("UTC")

    start_local = datetime.combine(appt.appointment_date, appt.start_time).replace(tzinfo=tz_local)
    end_local = datetime.combine(appt.appointment_date, appt.end_time).replace(tzinfo=tz_local)
    start_utc = start_local.astimezone(tz_utc).strftime("%Y%m%dT%H%M%SZ")
    end_utc = end_local.astimezone(tz_utc).strftime("%Y%m%dT%H%M%SZ")
    stamp = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")

    doctor_name = f"Dr(a). {appt.doctor.user.first_name} {appt.doctor.user.last_name}"
    summary = f"Cita médica con {doctor_name}"
    description_parts = [f"Especialidad: {appt.doctor.specialty.name}"]
    if appt.reason:
        description_parts.append(f"Motivo: {appt.reason}")
    if appt.modality == "online":
        description_parts.append("Modalidad: videollamada (link disponible 15 min antes)")
    description = _ics_escape("\n".join(description_parts))

    location = "Online" if appt.modality == "online" else "Presencial"

    ics = (
        "BEGIN:VCALENDAR\r\n"
        "VERSION:2.0\r\n"
        "PRODID:-//Calmar//Agendamiento//ES\r\n"
        "CALSCALE:GREGORIAN\r\n"
        "METHOD:PUBLISH\r\n"
        "BEGIN:VEVENT\r\n"
        f"UID:appointment-{appt.id}@calmar\r\n"
        f"DTSTAMP:{stamp}\r\n"
        f"DTSTART:{start_utc}\r\n"
        f"DTEND:{end_utc}\r\n"
        f"SUMMARY:{_ics_escape(summary)}\r\n"
        f"DESCRIPTION:{description}\r\n"
        f"LOCATION:{_ics_escape(location)}\r\n"
        "STATUS:CONFIRMED\r\n"
        "BEGIN:VALARM\r\n"
        "ACTION:DISPLAY\r\n"
        f"DESCRIPTION:Recordatorio: {_ics_escape(summary)}\r\n"
        "TRIGGER:-PT24H\r\n"
        "END:VALARM\r\n"
        "END:VEVENT\r\n"
        "END:VCALENDAR\r\n"
    )

    return Response(
        content=ics,
        media_type="text/calendar",
        headers={
            "Content-Disposition": f'attachment; filename="cita-{appt.id}.ics"',
        },
    )
