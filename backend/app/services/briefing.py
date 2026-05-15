"""Briefing pre-sesión generado por IA.

Recopila la data clínica relevante de un paciente (mood, cuestionarios, tareas,
última nota clínica, tests externos) y la pasa a Gemini para que produzca un
resumen ejecutivo que el psicólogo/a lee en los 30 segundos previos a la sesión.

Privacy: el prompt NO incluye nombre, email, RUT ni teléfono del paciente.
Solo edad y datos clínicos. Si más adelante hay que cumplir con regulaciones
estrictas, este es el lugar donde controlar la fuga de PII.
"""
from __future__ import annotations
import json
import logging
from datetime import datetime, date as date_type, timedelta
from typing import Optional, Any

from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.core.redis_client import get_redis
from app.models.user import User
from app.models.appointment import Appointment, AppointmentStatus
from app.models.mood_entry import MoodEntry
from app.models.questionnaire import QuestionnaireAssignment
from app.models.homework import HomeworkAssignment, HomeworkStatus
from app.models.session_log import SessionLog
from app.models.external_test import ExternalTestResult

logger = logging.getLogger(__name__)

LOOKBACK_DAYS = 60
RECENT_MOOD_DAYS = 21
CACHE_TTL_SECONDS = 4 * 60 * 60  # 4 horas


# ── Recolección de data ────────────────────────────────────────────────────

def _patient_age(patient: User) -> Optional[int]:
    if not patient.birth_date:
        return None
    today = date_type.today()
    years = today.year - patient.birth_date.year
    if (today.month, today.day) < (patient.birth_date.month, patient.birth_date.day):
        years -= 1
    return years


def gather_patient_data(db: Session, patient_id: int, doctor_id: int) -> dict:
    """Recolecta toda la data clínica reciente del paciente."""
    patient = db.query(User).filter(User.id == patient_id).first()
    if not patient:
        return {}

    today = date_type.today()
    since_long = today - timedelta(days=LOOKBACK_DAYS)
    since_mood = today - timedelta(days=RECENT_MOOD_DAYS)

    # Citas anteriores (completadas) con este doctor — para contar "sesión #N"
    prior_attended = (
        db.query(Appointment)
        .filter(
            Appointment.patient_id == patient_id,
            Appointment.doctor_id == doctor_id,
            Appointment.status == AppointmentStatus.completed,
        )
        .order_by(Appointment.appointment_date.desc())
        .all()
    )
    session_number = len(prior_attended) + 1  # esta sesión sería la #N

    # Última nota clínica del mismo doctor
    last_log = None
    last_log_date = None
    if prior_attended:
        recent_appt_ids = [a.id for a in prior_attended[:5]]
        logs = (
            db.query(SessionLog)
            .filter(SessionLog.appointment_id.in_(recent_appt_ids), SessionLog.is_draft == False)
            .all()
        )
        log_by_appt = {sl.appointment_id: sl for sl in logs}
        for a in prior_attended:
            if a.id in log_by_appt:
                last_log = log_by_appt[a.id]
                last_log_date = a.appointment_date
                break

    # Moods últimos 21 días
    moods = (
        db.query(MoodEntry)
        .filter(MoodEntry.patient_id == patient_id, MoodEntry.date >= since_mood)
        .order_by(MoodEntry.date.asc())
        .all()
    )

    # Cuestionarios completados últimos 60 días, agrupados por código
    questionnaires = (
        db.query(QuestionnaireAssignment)
        .filter(
            QuestionnaireAssignment.patient_id == patient_id,
            QuestionnaireAssignment.status == "completed",
            QuestionnaireAssignment.completed_at >= datetime.combine(since_long, datetime.min.time()),
        )
        .order_by(QuestionnaireAssignment.completed_at.asc())
        .all()
    )
    pending_qs = (
        db.query(QuestionnaireAssignment)
        .filter(
            QuestionnaireAssignment.patient_id == patient_id,
            QuestionnaireAssignment.status == "pending",
        )
        .all()
    )

    # Tareas: pendientes con vencimiento próximo + completadas recientes
    homework = (
        db.query(HomeworkAssignment)
        .filter(HomeworkAssignment.patient_id == patient_id)
        .order_by(HomeworkAssignment.created_at.desc())
        .limit(10)
        .all()
    )

    # Tests externos recientes (1 año hacia atrás)
    ext_tests = (
        db.query(ExternalTestResult)
        .filter(
            ExternalTestResult.patient_id == patient_id,
            ExternalTestResult.applied_at >= today - timedelta(days=365),
        )
        .order_by(ExternalTestResult.applied_at.desc())
        .limit(5)
        .all()
    )

    return {
        "patient": {
            "age": _patient_age(patient),
            "is_minor": _patient_age(patient) is not None and _patient_age(patient) < 18,
            "status": patient.patient_status or "active",
            "in_treatment_since": prior_attended[-1].appointment_date.isoformat() if prior_attended else None,
        },
        "session_number": session_number,
        "last_session": {
            "date": last_log_date.isoformat() if last_log_date else None,
            "evolution": last_log.evolution if last_log else None,
            "emotional_state": last_log.emotional_state if last_log else None,
            "topics_discussed": last_log.topics_discussed if last_log else None,
            "therapeutic_goals": last_log.therapeutic_goals if last_log else None,
            "next_steps": last_log.next_steps if last_log else None,
            "homework": last_log.homework if last_log else None,
            "risk_level": last_log.risk_level if last_log else None,
        } if last_log else None,
        "moods": [
            {"date": m.date.isoformat(), "score": m.score, "note": (m.note or "")[:200]}
            for m in moods
        ],
        "questionnaires_completed": [
            {
                "code": q.code,
                "date": q.completed_at.date().isoformat() if q.completed_at else None,
                "score": q.score,
                "max_score": q.max_score,
                "severity_label": q.severity_label,
                "crisis_flagged": q.crisis_flagged,
                "patient_comment": (q.patient_comment or "")[:300],
            }
            for q in questionnaires
        ],
        "questionnaires_pending": [
            {"code": q.code, "due_date": q.due_date.isoformat() if q.due_date else None}
            for q in pending_qs
        ],
        "homework": [
            {
                "title": h.title,
                "status": h.status.value if h.status else None,
                "due_date": h.due_date.isoformat() if h.due_date else None,
                "completed_at": h.completed_at.isoformat() if h.completed_at else None,
                "patient_feedback": (h.patient_feedback or "")[:200],
            }
            for h in homework
        ],
        "external_tests": [
            {
                "name": t.test_name,
                "applied_at": t.applied_at.isoformat() if t.applied_at else None,
                "score": t.score,
                "severity_label": t.severity_label,
                "interpretation": (t.interpretation or "")[:300],
            }
            for t in ext_tests
        ],
    }


# ── Heurísticas locales (sin IA) ───────────────────────────────────────────

def _mood_summary(moods: list[dict]) -> dict:
    if not moods:
        return {"n": 0}
    scores = [m["score"] for m in moods]
    avg = sum(scores) / len(scores)
    half = max(1, len(scores) // 2)
    first_avg = sum(scores[:half]) / half
    last_avg = sum(scores[-half:]) / half
    low_days = sum(1 for s in scores if s <= 3)
    return {
        "n": len(scores),
        "avg": round(avg, 1),
        "trend": round(last_avg - first_avg, 1),
        "low_days": low_days,
        "latest": scores[-1] if scores else None,
        "min": min(scores),
        "max": max(scores),
    }


def _questionnaire_deltas(items: list[dict]) -> list[dict]:
    """Para cada código, los dos últimos scores y la variación."""
    by_code: dict[str, list[dict]] = {}
    for it in items:
        by_code.setdefault(it["code"], []).append(it)
    out = []
    for code, entries in by_code.items():
        entries = sorted(entries, key=lambda x: x["date"] or "")
        latest = entries[-1]
        prev = entries[-2] if len(entries) >= 2 else None
        out.append({
            "code": code,
            "latest_score": latest["score"],
            "latest_max": latest["max_score"],
            "latest_severity": latest["severity_label"],
            "latest_date": latest["date"],
            "prev_score": prev["score"] if prev else None,
            "delta": (latest["score"] - prev["score"]) if (prev and latest["score"] is not None and prev["score"] is not None) else None,
            "crisis_flagged": any(e.get("crisis_flagged") for e in entries[-3:]),
        })
    out.sort(key=lambda x: (0 if x["crisis_flagged"] else 1, x["latest_date"] or ""), reverse=True)
    return out


def derive_signals(data: dict) -> dict:
    """Señales clave que el psicólogo necesita ver SÍ o SÍ, aunque no haya IA."""
    mood = _mood_summary(data.get("moods", []))
    qs = _questionnaire_deltas(data.get("questionnaires_completed", []))

    alerts = []
    # Riesgo suicida flag
    if any(q.get("crisis_flagged") for q in qs):
        alerts.append({"level": "high", "msg": "Cuestionario reciente con flag de riesgo suicida (PHQ-9 ítem 9 > 0 o similar)."})
    # Ánimo bajo persistente
    if mood.get("low_days", 0) >= 5:
        alerts.append({"level": "high", "msg": f"Ánimo ≤ 3 en {mood['low_days']} días de los últimos {mood['n']}."})
    elif mood.get("low_days", 0) >= 2:
        alerts.append({"level": "medium", "msg": f"Ánimo ≤ 3 en {mood['low_days']} día(s) recientes."})
    # Tendencia negativa
    if mood.get("trend") is not None and mood["trend"] <= -2:
        alerts.append({"level": "medium", "msg": f"Tendencia del ánimo bajando ({mood['trend']:+.1f} pts)."})
    # Deltas de cuestionarios
    for q in qs:
        if q.get("delta") is not None and q["delta"] >= 4:
            alerts.append({"level": "medium", "msg": f"{q['code'].upper()} subió {q['delta']} pts ({q['prev_score']} → {q['latest_score']})."})
        elif q.get("delta") is not None and q["delta"] <= -4:
            alerts.append({"level": "low", "msg": f"{q['code'].upper()} bajó {abs(q['delta'])} pts ({q['prev_score']} → {q['latest_score']}) — mejora."})
    # Riesgo registrado en última nota
    last = data.get("last_session") or {}
    if last.get("risk_level") == "high":
        alerts.append({"level": "high", "msg": "Última sesión registró nivel de riesgo ALTO."})
    elif last.get("risk_level") == "medium":
        alerts.append({"level": "medium", "msg": "Última sesión registró nivel de riesgo medio."})
    # Tareas
    pending_homework = [h for h in data.get("homework", []) if h.get("status") == "pending"]
    completed_homework = [h for h in data.get("homework", []) if h.get("status") == "completed"]
    return {
        "mood": mood,
        "questionnaires": qs,
        "alerts": alerts,
        "homework_pending": len(pending_homework),
        "homework_completed_recent": sum(1 for h in completed_homework[:5]),
    }


# ── Prompt + llamada a Gemini ──────────────────────────────────────────────

BRIEFING_SYSTEM = """Eres un asistente clínico para psicólogos/as en Chile.
Generas un briefing breve y útil que el profesional lee en 30 segundos antes de empezar una sesión.

# Estilo
- Español de Chile, tono profesional pero directo.
- 5 secciones cortas, en orden fijo:
  1. **Estado actual** (2-3 líneas con lo más importante de hoy)
  2. **Cambios desde la última sesión** (qué se movió en cuestionarios, ánimo, tareas)
  3. **Señales de alerta** (riesgo, deterioro, banderas — vacío si no hay)
  4. **Adherencia** (cuestionarios pendientes, tareas pendientes/completadas)
  5. **Posibles temas para esta sesión** (3 bullets accionables)
- Total: máximo 180 palabras.
- Cita números concretos cuando los tengas (ej: "PHQ-9 subió de 8 a 14").
- Si no hay data en alguna sección, escribe brevemente "Sin datos en este período."

# Reglas clínicas
- NUNCA diagnostiques ni prescribas. Solo describe lo que la data muestra.
- Si hay flag de riesgo suicida (crisis_flagged=true o PHQ-9 ítem 9 > 0) o riesgo alto registrado:
  abre con un bloque "🚨 RIESGO" antes de las 5 secciones, mencionando el protocolo chileno
  (Salud Responde 600 360 7777, *4141 desde celular, SAMU 131).
- No uses el nombre del paciente. Usa "el/la paciente" o "esta persona".

# Output
Devuelve el briefing en Markdown. Solo el briefing, sin preámbulos ni cierres tipo "Espero que te sirva".
"""


def _build_briefing_prompt(data: dict, signals: dict) -> str:
    """Arma el mensaje que va al modelo. Sin PII identificatoria."""
    age = data.get("patient", {}).get("age")
    is_minor = data.get("patient", {}).get("is_minor")
    session_number = data.get("session_number")
    last = data.get("last_session")

    lines = []
    lines.append(f"# Briefing para sesión #{session_number}")
    if age is not None:
        lines.append(f"Paciente: {age} años{' (menor de edad)' if is_minor else ''}.")
    if data.get("patient", {}).get("in_treatment_since"):
        lines.append(f"En tratamiento contigo desde {data['patient']['in_treatment_since']}.")

    lines.append("\n## Última nota clínica")
    if last:
        lines.append(f"Fecha: {last.get('date')}")
        if last.get("risk_level"):
            lines.append(f"Nivel de riesgo registrado: **{last['risk_level']}**.")
        for field, label in [
            ("evolution", "Evolución"),
            ("emotional_state", "Estado emocional"),
            ("topics_discussed", "Temas tratados"),
            ("therapeutic_goals", "Objetivos terapéuticos"),
            ("next_steps", "Próximos pasos"),
            ("homework", "Tarea asignada"),
        ]:
            if last.get(field):
                lines.append(f"- {label}: {last[field][:400]}")
    else:
        lines.append("Sin notas previas con este profesional.")

    lines.append("\n## Ánimo (diario, últimos 21d)")
    mood = signals.get("mood", {})
    if mood.get("n"):
        lines.append(
            f"{mood['n']} entradas. Promedio {mood['avg']}/10, último {mood['latest']}, "
            f"rango {mood['min']}-{mood['max']}. Tendencia {mood.get('trend'):+.1f} pts. "
            f"Días con ánimo ≤ 3: {mood.get('low_days', 0)}."
        )
    else:
        lines.append("Sin entradas de diario emocional en el período.")

    lines.append("\n## Cuestionarios (últimos 60d, completados)")
    qs = signals.get("questionnaires", [])
    if qs:
        for q in qs:
            line = f"- {q['code'].upper()}: {q['latest_score']}/{q['latest_max']} ({q.get('latest_severity') or 'sin severidad'}) el {q['latest_date']}"
            if q.get("delta") is not None:
                line += f" — anterior {q['prev_score']}, delta {q['delta']:+d}"
            if q.get("crisis_flagged"):
                line += " 🚨 FLAG DE RIESGO"
            lines.append(line)
    else:
        lines.append("Sin cuestionarios completados.")

    if data.get("questionnaires_pending"):
        lines.append(f"\nPendientes de responder: {len(data['questionnaires_pending'])} ({', '.join(q['code'] for q in data['questionnaires_pending'])}).")

    lines.append("\n## Tareas (homework)")
    if data.get("homework"):
        pending = [h for h in data["homework"] if h.get("status") == "pending"]
        done = [h for h in data["homework"] if h.get("status") == "completed"]
        lines.append(f"{len(pending)} pendiente(s), {len(done)} completada(s) recientes.")
        for h in pending[:3]:
            lines.append(f"- PENDIENTE: {h['title']}" + (f" (vence {h['due_date']})" if h.get('due_date') else ""))
        for h in done[:3]:
            extra = ""
            if h.get("patient_feedback"):
                extra = f" — feedback: \"{h['patient_feedback']}\""
            lines.append(f"- COMPLETADA: {h['title']}{extra}")
    else:
        lines.append("Sin tareas asignadas.")

    if data.get("external_tests"):
        lines.append("\n## Tests externos recientes")
        for t in data["external_tests"][:3]:
            lines.append(f"- {t['name']} ({t['applied_at']}): score {t.get('score') or '—'}, {t.get('severity_label') or '—'}")

    if signals.get("alerts"):
        lines.append("\n## Señales detectadas (heurística)")
        for a in signals["alerts"]:
            lines.append(f"- [{a['level'].upper()}] {a['msg']}")

    lines.append("\nGenera el briefing siguiendo las reglas del system prompt.")
    return "\n".join(lines)


def _call_gemini(prompt: str) -> Optional[str]:
    if not getattr(settings, "GEMINI_API_KEY", None):
        return None
    try:
        from google import genai
        from google.genai import types as gtypes
    except ImportError:
        logger.exception("briefing.gemini_sdk_missing")
        return None

    try:
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        config = gtypes.GenerateContentConfig(
            system_instruction=BRIEFING_SYSTEM,
            temperature=0.3,
            max_output_tokens=600,
        )
        contents = [gtypes.Content(role="user", parts=[gtypes.Part(text=prompt)])]
        response = client.models.generate_content(
            model="gemini-2.0-flash", contents=contents, config=config
        )
        candidate = response.candidates[0] if response.candidates else None
        if not candidate:
            return None
        parts = candidate.content.parts if candidate.content else []
        texts = [p.text for p in parts if getattr(p, "text", None)]
        return "\n".join(t for t in texts if t).strip() or None
    except Exception:
        logger.exception("briefing.gemini_call_failed")
        return None


# ── Cache ──────────────────────────────────────────────────────────────────

def _cache_key(appointment_id: int) -> str:
    return f"briefing:appt:{appointment_id}"


def get_cached(appointment_id: int) -> Optional[dict]:
    try:
        raw = get_redis().get(_cache_key(appointment_id))
        if raw:
            return json.loads(raw)
    except Exception:
        logger.exception("briefing.cache_read_failed")
    return None


def set_cached(appointment_id: int, payload: dict) -> None:
    try:
        get_redis().setex(_cache_key(appointment_id), CACHE_TTL_SECONDS, json.dumps(payload, default=str))
    except Exception:
        logger.exception("briefing.cache_write_failed")


def invalidate_cache(appointment_id: int) -> None:
    try:
        get_redis().delete(_cache_key(appointment_id))
    except Exception:
        pass


# ── Entry point ────────────────────────────────────────────────────────────

def generate_briefing(
    db: Session,
    appointment_id: int,
    patient_id: int,
    doctor_id: int,
    force_refresh: bool = False,
) -> dict:
    """Devuelve un dict con `ai_text` (markdown), `signals` (estructurado),
    `data_summary` (lo que se le pasó a la IA), y metadata.

    Si Gemini no está disponible, `ai_text` es None pero `signals` igual sirve
    para que el frontend muestre las alertas heurísticas.
    """
    if not force_refresh:
        cached = get_cached(appointment_id)
        if cached:
            return cached

    data = gather_patient_data(db, patient_id, doctor_id)
    signals = derive_signals(data)
    prompt = _build_briefing_prompt(data, signals)
    ai_text = _call_gemini(prompt)

    payload = {
        "appointment_id": appointment_id,
        "generated_at": datetime.utcnow().isoformat(),
        "ai_available": ai_text is not None,
        "ai_text": ai_text,
        "signals": signals,
        "session_number": data.get("session_number"),
        "has_prior_session": bool(data.get("last_session")),
    }
    set_cached(appointment_id, payload)
    return payload
