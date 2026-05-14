"""Agente conversacional Calmar (Gemini API).

Si GEMINI_API_KEY no está configurado, el endpoint devuelve un mensaje fallback.
El agente tiene 4 tools que ejecuta contra la BD: list_specialties, search_doctors,
get_availability, get_clinic_info.
"""
from __future__ import annotations
import json
import logging
import re
from datetime import date, datetime, timedelta, time
from typing import Any, Optional

from sqlalchemy.orm import Session, joinedload, selectinload

from app.core.config import settings
from app.models.specialty import Specialty
from app.models.doctor import Doctor
from app.models.availability import DoctorAvailability
from app.models.appointment import Appointment, AppointmentStatus
from app.models.doctor_block import DoctorBlock

logger = logging.getLogger(__name__)


CRISIS_KEYWORDS = [
    "suicid", "matarme", "quitarme la vida", "no quiero vivir", "no aguanto",
    "auto lesion", "autolesion", "hacerme daño", "hacerme dano",
]

CRISIS_RESPONSE = (
    "Lo que sientes importa, y no estás solo/a. Si estás en una crisis o pensando en "
    "hacerte daño, por favor contacta ya mismo:\n\n"
    "🆘 **Salud Responde**: 600 360 7777 (24h, gratis)\n"
    "🆘 **Línea de prevención del suicidio**: *4141 desde tu celular (24h, gratis)\n"
    "🆘 **Emergencias**: 131 (SAMU)\n\n"
    "También puedes ir a la urgencia más cercana. Mientras tanto, "
    "¿te ayudaría agendar una hora con uno de nuestros psicólogos lo antes posible?"
)


SYSTEM_PROMPT = """Eres Calmar, el asistente virtual de miespejo.cl — una plataforma chilena \
de agendamiento de consultas psicológicas online (presenciales y por videollamada).

# Tu rol
Ayudas a visitantes y pacientes a:
- Descubrir qué especialidades ofrecemos
- Encontrar profesionales por especialidad o disponibilidad
- Ver horarios disponibles de un profesional
- Resolver dudas sobre precios, modalidades (presencial/teleconsulta) y formas de pago
- Derivar a una persona real cuando la consulta lo amerite

# Estilo
- Tono cercano, cálido, en español de Chile (tú, no usted)
- Respuestas breves y útiles (idealmente 2-4 oraciones)
- Si recomiendas un profesional, ofrece su nombre y especialidad, e invita a reservar
- Si el usuario quiere reservar, dile que vaya a https://miespejo.cl, inicie sesión y \
busque al profesional — tú no haces la reserva directamente
- Usa las tools disponibles ANTES de afirmar nada sobre profesionales, especialidades \
o disponibilidad. Nunca inventes nombres ni horarios.

# Límites importantes
- NUNCA diagnostiques, prescribas medicamentos ni des consejo clínico
- NUNCA respondas preguntas clínicas específicas (ej: "¿esta pastilla es buena para X?")
- Si detectas crisis emocional, autolesión o ideación suicida → deriva inmediatamente a \
líneas de emergencia (Salud Responde 600 360 7777, *4141, SAMU 131)
- Si te preguntan algo fuera del contexto de la plataforma, redirige amablemente

# Política
- Precios: si el profesional tiene `consultation_price = 0`, indica que la consulta es \
sin costo; si no, di el monto en CLP
- Pagos: aceptamos pagos en línea por MercadoPago (tarjetas de crédito/débito, Webpay, \
transferencia)
- Modalidades: presencial y teleconsulta (videollamada)
- Cancelaciones: hasta 24h antes sin costo

# Sobre la marca
Calmar (miespejo.cl) es salud y bienestar emocional. Más de 200 profesionales verificados."""


def is_enabled() -> bool:
    return bool(getattr(settings, "GEMINI_API_KEY", None))


def _detect_crisis(text: str) -> bool:
    norm = text.lower()
    return any(kw in norm for kw in CRISIS_KEYWORDS)


# ─── Tools ─────────────────────────────────────────────────────────────────

def tool_list_specialties(db: Session) -> list[dict]:
    rows = db.query(Specialty).filter(Specialty.is_active == True).all()
    return [{"id": s.id, "name": s.name, "description": s.description or ""} for s in rows]


def tool_search_doctors(
    db: Session,
    specialty_name: Optional[str] = None,
    specialty_id: Optional[int] = None,
    limit: int = 8,
) -> list[dict]:
    query = (
        db.query(Doctor)
        .options(joinedload(Doctor.user), joinedload(Doctor.specialty), selectinload(Doctor.reviews))
        .filter(Doctor.is_active == True)
    )
    if specialty_id:
        query = query.filter(Doctor.specialty_id == specialty_id)
    elif specialty_name:
        specialty = (
            db.query(Specialty)
            .filter(Specialty.name.ilike(f"%{specialty_name}%"))
            .first()
        )
        if specialty:
            query = query.filter(Doctor.specialty_id == specialty.id)
        else:
            return []

    rows = query.limit(max(1, min(limit, 12))).all()
    return [
        {
            "id": d.id,
            "name": f"Ps. {d.user.first_name} {d.user.last_name}",
            "specialty": d.specialty.name if d.specialty else "",
            "consultation_price_clp": d.consultation_price or 0,
            "duration_minutes": d.consultation_duration or 30,
            "rating": d.rating_avg,
            "rating_count": d.rating_count,
            "profile_url": f"https://miespejo.cl/patient/doctors/{d.id}",
        }
        for d in rows
    ]


def tool_get_availability(db: Session, doctor_id: int, days_ahead: int = 7) -> dict:
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id, Doctor.is_active == True).first()
    if not doctor:
        return {"error": "Profesional no encontrado"}

    days_ahead = max(1, min(days_ahead, 14))
    today = date.today()
    result_days = []

    blocks = (
        db.query(DoctorBlock)
        .filter(
            DoctorBlock.doctor_id == doctor_id,
            DoctorBlock.end_date >= today,
            DoctorBlock.start_date <= today + timedelta(days=days_ahead),
        )
        .all()
    )

    def is_blocked(d: date) -> bool:
        return any(b.start_date <= d <= b.end_date for b in blocks)

    availabilities = {
        a.day_of_week: a
        for a in db.query(DoctorAvailability)
        .filter(DoctorAvailability.doctor_id == doctor_id, DoctorAvailability.is_active == True)
        .all()
    }

    for offset in range(days_ahead):
        d = today + timedelta(days=offset)
        if is_blocked(d):
            continue
        a = availabilities.get(d.weekday())
        if not a:
            continue

        booked = {
            appt.start_time
            for appt in db.query(Appointment)
            .filter(
                Appointment.doctor_id == doctor_id,
                Appointment.appointment_date == d,
                Appointment.status.in_([AppointmentStatus.scheduled, AppointmentStatus.confirmed]),
            )
            .all()
        }

        duration = timedelta(minutes=doctor.consultation_duration or 30)
        slots: list[str] = []
        current = datetime.combine(d, a.start_time)
        end = datetime.combine(d, a.end_time)
        while current + duration <= end:
            if current.time() not in booked:
                slots.append(current.strftime("%H:%M"))
            current += duration

        if slots:
            result_days.append({"date": d.isoformat(), "slots": slots[:8]})

    return {
        "doctor_id": doctor_id,
        "doctor_name": f"Ps. {doctor.user.first_name} {doctor.user.last_name}",
        "days": result_days,
        "booking_url": f"https://miespejo.cl/patient/book/{doctor_id}",
    }


def tool_get_clinic_info() -> dict:
    return {
        "name": "Calmar (miespejo.cl)",
        "modalities": ["Presencial", "Teleconsulta (videollamada)"],
        "payment_methods": ["Tarjeta de crédito", "Tarjeta de débito", "Webpay", "Transferencia"],
        "payment_provider": "MercadoPago",
        "cancellation_policy": "Hasta 24 horas antes sin costo",
        "currency": "CLP",
        "emergency_lines": [
            {"name": "Salud Responde", "number": "600 360 7777"},
            {"name": "Prevención del suicidio", "number": "*4141"},
            {"name": "SAMU", "number": "131"},
        ],
    }


# ─── Definición de tools para Gemini ───────────────────────────────────────

GEMINI_TOOLS_DECL: list[dict] = [
    {
        "function_declarations": [
            {
                "name": "list_specialties",
                "description": "Lista todas las especialidades psicológicas disponibles en la plataforma.",
                "parameters": {"type": "OBJECT", "properties": {}},
            },
            {
                "name": "search_doctors",
                "description": "Busca profesionales activos, opcionalmente filtrados por nombre de especialidad.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "specialty_name": {
                            "type": "STRING",
                            "description": "Nombre o palabra clave de la especialidad (ej: 'psicología', 'cardiología'). Opcional.",
                        },
                        "limit": {
                            "type": "INTEGER",
                            "description": "Máximo de resultados (1-12). Default 8.",
                        },
                    },
                },
            },
            {
                "name": "get_availability",
                "description": "Obtiene los horarios disponibles de un profesional para los próximos N días.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "doctor_id": {
                            "type": "INTEGER",
                            "description": "ID del profesional (obtenido de search_doctors).",
                        },
                        "days_ahead": {
                            "type": "INTEGER",
                            "description": "Días hacia adelante a consultar (1-14). Default 7.",
                        },
                    },
                    "required": ["doctor_id"],
                },
            },
            {
                "name": "get_clinic_info",
                "description": "Devuelve información general de la clínica: modalidades, formas de pago, política de cancelación, líneas de emergencia.",
                "parameters": {"type": "OBJECT", "properties": {}},
            },
        ]
    }
]


def _dispatch_tool(db: Session, name: str, args: dict) -> Any:
    if name == "list_specialties":
        return tool_list_specialties(db)
    if name == "search_doctors":
        return tool_search_doctors(
            db,
            specialty_name=args.get("specialty_name"),
            limit=args.get("limit", 8),
        )
    if name == "get_availability":
        return tool_get_availability(
            db,
            doctor_id=int(args.get("doctor_id", 0)),
            days_ahead=int(args.get("days_ahead", 7)),
        )
    if name == "get_clinic_info":
        return tool_get_clinic_info()
    return {"error": f"Tool desconocida: {name}"}


# ─── Llamada al modelo ─────────────────────────────────────────────────────

def chat(db: Session, message: str, history: list[dict] | None = None) -> dict:
    """Procesa un mensaje del usuario y devuelve la respuesta del asistente.

    - history: lista de {role: 'user'|'assistant', text: str} con los turnos previos.
    - Devuelve {reply: str, crisis: bool}.
    """
    if _detect_crisis(message):
        logger.info("chat.crisis_detected")
        return {"reply": CRISIS_RESPONSE, "crisis": True}

    if not is_enabled():
        return {
            "reply": (
                "Por ahora el asistente está deshabilitado. Te invitamos a explorar la web "
                "directamente y reservar tu hora. Si necesitas ayuda, escríbenos a "
                "contacto@miespejo.cl."
            ),
            "crisis": False,
        }

    try:
        from google import genai
        from google.genai import types as gtypes
    except ImportError:
        logger.exception("chat.gemini_sdk_missing")
        return {
            "reply": "El asistente no está disponible en este momento. Por favor intenta más tarde.",
            "crisis": False,
        }

    client = genai.Client(api_key=settings.GEMINI_API_KEY)

    contents: list[gtypes.Content] = []
    for turn in (history or [])[-12:]:
        role = "user" if turn.get("role") == "user" else "model"
        text = (turn.get("text") or "").strip()
        if not text:
            continue
        contents.append(gtypes.Content(role=role, parts=[gtypes.Part(text=text)]))
    contents.append(gtypes.Content(role="user", parts=[gtypes.Part(text=message)]))

    tools = [gtypes.Tool(function_declarations=GEMINI_TOOLS_DECL[0]["function_declarations"])]
    config = gtypes.GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT,
        tools=tools,
        temperature=0.6,
        max_output_tokens=600,
    )

    model = "gemini-2.0-flash"
    max_iters = 4

    for _iter in range(max_iters):
        try:
            response = client.models.generate_content(
                model=model, contents=contents, config=config
            )
        except Exception:
            logger.exception("chat.gemini_call_failed")
            return {
                "reply": "Tuve un problema procesando tu mensaje. ¿Puedes intentarlo de nuevo?",
                "crisis": False,
            }

        function_calls: list[Any] = []
        text_parts: list[str] = []
        candidate = response.candidates[0] if response.candidates else None
        if candidate and candidate.content and candidate.content.parts:
            for part in candidate.content.parts:
                if getattr(part, "function_call", None):
                    function_calls.append(part.function_call)
                elif getattr(part, "text", None):
                    text_parts.append(part.text)

        if not function_calls:
            reply = "".join(text_parts).strip() or (
                "No estoy seguro de cómo ayudarte con eso. ¿Quieres que te muestre nuestras especialidades?"
            )
            return {"reply": reply, "crisis": False}

        contents.append(candidate.content)

        for fc in function_calls:
            name = fc.name
            args = dict(fc.args) if fc.args else {}
            try:
                result = _dispatch_tool(db, name, args)
            except Exception as e:
                logger.exception("chat.tool_error", extra={"tool": name})
                result = {"error": str(e)}

            contents.append(
                gtypes.Content(
                    role="user",
                    parts=[
                        gtypes.Part.from_function_response(
                            name=name, response={"result": result}
                        )
                    ],
                )
            )

    logger.warning("chat.max_iters_reached")
    return {
        "reply": "Estoy teniendo problemas para procesar tu solicitud. ¿Puedes reformularla?",
        "crisis": False,
    }
