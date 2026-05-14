"""Catálogo de cuestionarios psicológicos validados.

Definiciones de tests estándar (PHQ-9, GAD-7, WHO-5) con preguntas, opciones,
y lógica de scoring + severidad. Los textos están en español de Chile.

Todos son de uso libre (PHQ-9 y GAD-7 son de Pfizer pero libres para uso clínico).
WHO-5 es de la WHO, libre uso.
"""
from __future__ import annotations
from typing import Optional


# ─── PHQ-9 ────────────────────────────────────────────────────────────────
PHQ9 = {
    "code": "phq9",
    "name": "PHQ-9 — Síntomas depresivos",
    "short_name": "PHQ-9",
    "description": "Evaluación de síntomas depresivos en las últimas 2 semanas. 9 preguntas, ~3 minutos.",
    "duration_minutes": 3,
    "scoring_note": "Score 0-27. Mayor score = más síntomas.",
    "frequency_recommendation": "Cada 2-4 semanas durante tratamiento activo.",
    "instructions": (
        "En las últimas 2 semanas, ¿con qué frecuencia te has sentido afectado/a "
        "por los siguientes problemas? Responde lo más honestamente posible."
    ),
    "scale_options": [
        {"value": 0, "label": "Nunca"},
        {"value": 1, "label": "Varios días"},
        {"value": 2, "label": "Más de la mitad de los días"},
        {"value": 3, "label": "Casi todos los días"},
    ],
    "questions": [
        "Poco interés o placer en hacer cosas",
        "Sentirme decaído/a, deprimido/a o sin esperanza",
        "Dificultad para dormirme o mantenerme dormido/a, o dormir demasiado",
        "Sentirme cansado/a o con poca energía",
        "Poco apetito o comer en exceso",
        "Sentirme mal conmigo mismo/a — o sentir que soy un fracaso, o que me he decepcionado a mí o a mi familia",
        "Dificultad para concentrarme en cosas como leer o ver televisión",
        "Moverme o hablar tan lentamente que otras personas lo notaron. O al revés — estar tan inquieto/a que me he estado moviendo mucho más de lo normal",
        "Pensar que estaría mejor muerto/a, o lastimarme de alguna manera",
    ],
    "severity_thresholds": [
        # (min, max, code, label, color_tone, action)
        (0,  4,  "minimal", "Mínima",      "wellness", "Mantén tus rutinas saludables."),
        (5,  9,  "mild",    "Leve",        "wellness", "Considera trabajar con tu profesional el origen de estos síntomas."),
        (10, 14, "moderate","Moderada",    "amber",    "Es importante abordar esto en consulta. Hay tratamientos efectivos."),
        (15, 19, "moderately_severe", "Moderadamente severa", "rose", "Recomendamos consulta lo antes posible."),
        (20, 27, "severe",  "Severa",      "rose",     "Es urgente abordar esto. Habla con tu profesional o llama a Salud Responde 600 360 7777."),
    ],
    # Pregunta 9 (índice 8) detecta ideación suicida — si > 0 dispara alerta de crisis
    "critical_question_index": 8,
    "critical_threshold": 1,
    "critical_message": "El paciente reportó pensamientos de hacerse daño en el PHQ-9.",
}


# ─── GAD-7 ────────────────────────────────────────────────────────────────
GAD7 = {
    "code": "gad7",
    "name": "GAD-7 — Síntomas de ansiedad",
    "short_name": "GAD-7",
    "description": "Evaluación de síntomas de ansiedad generalizada en las últimas 2 semanas. 7 preguntas, ~2 minutos.",
    "duration_minutes": 2,
    "scoring_note": "Score 0-21. Mayor score = más ansiedad.",
    "frequency_recommendation": "Cada 2-4 semanas durante tratamiento activo.",
    "instructions": (
        "En las últimas 2 semanas, ¿con qué frecuencia te has sentido afectado/a "
        "por los siguientes problemas?"
    ),
    "scale_options": [
        {"value": 0, "label": "Nunca"},
        {"value": 1, "label": "Varios días"},
        {"value": 2, "label": "Más de la mitad de los días"},
        {"value": 3, "label": "Casi todos los días"},
    ],
    "questions": [
        "Sentirme nervioso/a, ansioso/a o al borde",
        "No poder dejar de preocuparme o controlar la preocupación",
        "Preocuparme demasiado por distintas cosas",
        "Dificultad para relajarme",
        "Estar tan inquieto/a que es difícil quedarme sentado/a tranquilo/a",
        "Molestarme o irritarme con facilidad",
        "Sentir miedo como si algo terrible fuera a suceder",
    ],
    "severity_thresholds": [
        (0,  4,  "minimal", "Mínima",   "wellness", "Buenos niveles. Mantén tus rutinas."),
        (5,  9,  "mild",    "Leve",     "wellness", "Algo de ansiedad. Identifiquen disparadores en consulta."),
        (10, 14, "moderate","Moderada", "amber",    "Es importante abordarlo. Hay técnicas y tratamientos efectivos."),
        (15, 21, "severe",  "Severa",   "rose",     "Recomendamos atención profesional pronta."),
    ],
    "critical_question_index": None,
    "critical_threshold": None,
    "critical_message": None,
}


# ─── WHO-5 ────────────────────────────────────────────────────────────────
WHO5 = {
    "code": "who5",
    "name": "WHO-5 — Bienestar general",
    "short_name": "WHO-5",
    "description": "Evaluación de bienestar emocional en las últimas 2 semanas. 5 preguntas, ~1 minuto.",
    "duration_minutes": 1,
    "scoring_note": "Score 0-25 (multiplicado x4 = 0-100). Mayor score = mejor bienestar. < 50/100 sugiere evaluar depresión.",
    "frequency_recommendation": "Mensual o cuando quieras un check rápido de bienestar.",
    "instructions": (
        "En las últimas 2 semanas, indica qué tan cercana a tu experiencia "
        "es cada una de las siguientes frases."
    ),
    "scale_options": [
        {"value": 0, "label": "En ningún momento"},
        {"value": 1, "label": "Algunos momentos"},
        {"value": 2, "label": "Menos de la mitad del tiempo"},
        {"value": 3, "label": "Más de la mitad del tiempo"},
        {"value": 4, "label": "La mayor parte del tiempo"},
        {"value": 5, "label": "Todo el tiempo"},
    ],
    "questions": [
        "Me he sentido alegre y de buen ánimo",
        "Me he sentido tranquilo/a y relajado/a",
        "Me he sentido activo/a y con energía",
        "Me he despertado sintiéndome fresco/a y descansado/a",
        "Mi vida diaria ha estado llena de cosas que me interesan",
    ],
    # Para WHO-5 la "severidad" es invertida: score alto = bueno
    "severity_thresholds": [
        (0,  6,  "very_low", "Muy bajo bienestar",  "rose",     "Sugerimos evaluar depresión. Habla con tu profesional."),
        (7,  12, "low",      "Bajo bienestar",      "amber",    "Hay espacio para mejorar. Trabajen estrategias en consulta."),
        (13, 18, "moderate", "Bienestar moderado",  "wellness", "Vas por buen camino."),
        (19, 25, "high",     "Buen bienestar",      "wellness", "Excelente nivel de bienestar."),
    ],
    "critical_question_index": None,
    "critical_threshold": None,
    "critical_message": None,
}


# ─── AUDIT-C ──────────────────────────────────────────────────────────────
# OMS — Versión corta del AUDIT, 3 items. Screening rápido de consumo de riesgo.
AUDITC = {
    "code": "auditc",
    "name": "AUDIT-C — Consumo de alcohol (screening)",
    "short_name": "AUDIT-C",
    "description": "Screening rápido de consumo riesgoso de alcohol. 3 preguntas, ~1 minuto.",
    "duration_minutes": 1,
    "scoring_note": "Score 0-12. Cut-off: ≥4 (hombres) o ≥3 (mujeres) sugiere consumo de riesgo.",
    "frequency_recommendation": "Anual en consulta de salud general, o cuando se sospeche consumo problemático.",
    "instructions": (
        "Estas preguntas son sobre tu consumo de alcohol. Una 'bebida' equivale a "
        "una copa de vino, un vaso de cerveza, o un trago corto (40 ml)."
    ),
    "scale_options": [
        {"value": 0, "label": "Nunca / 1 ó 2 / Nunca"},
        {"value": 1, "label": "Mensual o menos / 3 ó 4 / Menos de una vez al mes"},
        {"value": 2, "label": "2-4 veces al mes / 5 ó 6 / Mensualmente"},
        {"value": 3, "label": "2-3 veces a la semana / 7 a 9 / Semanalmente"},
        {"value": 4, "label": "4 ó más veces a la semana / 10 ó más / A diario o casi"},
    ],
    "questions": [
        "¿Con qué frecuencia consumes alguna bebida alcohólica?",
        "¿Cuántas bebidas alcohólicas consumes en un día típico de consumo?",
        "¿Con qué frecuencia tomas 6 o más bebidas alcohólicas en una sola ocasión?",
    ],
    "severity_thresholds": [
        (0,  2,  "low_risk",        "Bajo riesgo",                "wellness", "Tu consumo aparece dentro de niveles seguros. Mantén la consciencia."),
        (3,  4,  "moderate_risk",   "Consumo de riesgo",          "amber",    "Conviene conversar tu patrón de consumo con tu profesional."),
        (5,  7,  "harmful",         "Consumo perjudicial",        "rose",     "Tu consumo puede estar afectando tu salud. Hablar con un profesional es prioritario."),
        (8,  12, "probable_dep",    "Probable dependencia",       "rose",     "Recomendamos evaluación profesional especializada en consumo problemático."),
    ],
    "critical_question_index": None,
    "critical_threshold": None,
    "critical_message": None,
}


# ─── EPDS ─────────────────────────────────────────────────────────────────
# Edinburgh Postnatal Depression Scale (Cox, Holden, Sagovsky, 1987)
# Estándar del MINSAL Chile para control prenatal y postnatal.
EPDS = {
    "code": "epds",
    "name": "EPDS — Depresión perinatal (Edinburgh)",
    "short_name": "EPDS",
    "description": "Detección de síntomas depresivos en el embarazo o post-parto. 10 preguntas, ~3 minutos.",
    "duration_minutes": 3,
    "scoring_note": "Score 0-30. Cut-off: ≥10 sugiere posible depresión, ≥13 probable depresión. Pregunta 10 (ideación) > 0 dispara alerta.",
    "frequency_recommendation": "Una vez por trimestre durante el embarazo y al mes 2 y 6 post-parto. Sirve también para padres/parejas.",
    "instructions": (
        "Estás viviendo un embarazo o has sido madre/padre recientemente. "
        "En los últimos 7 días, ¿cómo te has sentido? Elige la respuesta que más se acerque a tu experiencia."
    ),
    "scale_options": [
        {"value": 0, "label": "Como siempre / Nunca / Sí, todo el tiempo"},
        {"value": 1, "label": "No tanto como antes / Casi nunca / Sí, casi todo el tiempo"},
        {"value": 2, "label": "Definitivamente menos / A veces / A veces"},
        {"value": 3, "label": "No, casi nada / Casi todos los días / No, en absoluto"},
    ],
    "questions": [
        "He podido reírme y ver el lado divertido de las cosas",
        "He mirado el futuro con ilusión",
        "Me he culpado innecesariamente cuando las cosas han salido mal",
        "He estado ansiosa/o o preocupada/o sin motivo",
        "He sentido miedo o pánico sin motivo justificado",
        "Las cosas se me han venido encima — siento que no puedo con todo",
        "Me he sentido tan infeliz que he tenido dificultad para dormir",
        "Me he sentido triste o desgraciada/o",
        "Me he sentido tan infeliz que he estado llorando",
        "He tenido pensamientos de hacerme daño",
    ],
    "severity_thresholds": [
        (0,  9,  "minimal",   "Sin riesgo aparente",        "wellness", "Tus respuestas no sugieren depresión perinatal. Mantén el autocuidado."),
        (10, 12, "possible",  "Posible depresión",          "amber",    "Algunas señales preocupantes. Conviene una evaluación con tu profesional."),
        (13, 30, "probable",  "Probable depresión perinatal","rose",    "Se recomienda evaluación profesional especializada en salud mental perinatal."),
    ],
    # Item 10 (índice 9) detecta ideación de hacerse daño
    "critical_question_index": 9,
    "critical_threshold": 1,
    "critical_message": "Respuesta crítica: el paciente reportó pensamientos de hacerse daño en el EPDS.",
}


# ─── PCL-5 ────────────────────────────────────────────────────────────────
# PTSD Checklist for DSM-5 (Weathers et al.) — Department of Veterans Affairs.
PCL5 = {
    "code": "pcl5",
    "name": "PCL-5 — Síntomas de estrés postraumático",
    "short_name": "PCL-5",
    "description": "Evaluación de síntomas de TEPT (DSM-5). 20 preguntas, ~5 minutos.",
    "duration_minutes": 5,
    "scoring_note": "Score 0-80. Cut-off general: ≥33 sugiere probable TEPT.",
    "frequency_recommendation": "Cada 4-6 semanas durante tratamiento de trauma.",
    "instructions": (
        "Piensa en un evento traumático que viviste o presenciaste (un accidente, "
        "una agresión, una pérdida, una situación violenta, etc.). En el último mes, "
        "¿cuánto te ha molestado cada uno de los siguientes problemas relacionados con ese evento?"
    ),
    "scale_options": [
        {"value": 0, "label": "Nada"},
        {"value": 1, "label": "Un poco"},
        {"value": 2, "label": "Moderadamente"},
        {"value": 3, "label": "Bastante"},
        {"value": 4, "label": "Extremadamente"},
    ],
    "questions": [
        "Recuerdos repetidos, perturbadores e involuntarios del evento",
        "Sueños repetidos y perturbadores relacionados con el evento",
        "Sentir o actuar de repente como si el evento estuviera volviendo a ocurrir (flashbacks)",
        "Sentirse muy molesto/a cuando algo te recuerda el evento",
        "Tener reacciones físicas fuertes cuando algo te recuerda el evento (sudor, taquicardia, etc.)",
        "Evitar recuerdos, pensamientos o sentimientos relacionados con el evento",
        "Evitar lugares, personas o actividades que te recuerden el evento",
        "Dificultad para recordar partes importantes del evento",
        "Creencias negativas fuertes sobre ti mismo, otras personas o el mundo",
        "Culparte a ti mismo o a otros por el evento o por lo que pasó después",
        "Sentir mucho miedo, horror, rabia, culpa o vergüenza",
        "Pérdida de interés en actividades que antes disfrutabas",
        "Sentirte distante o desconectado/a de los demás",
        "Dificultad para experimentar sentimientos positivos",
        "Comportamiento irritable, enojo o agresividad",
        "Comportamiento imprudente o autodestructivo",
        "Estar 'súper alerta', vigilante o en guardia",
        "Sobresaltarse fácilmente",
        "Dificultad para concentrarse",
        "Problemas para conciliar o mantener el sueño",
    ],
    "severity_thresholds": [
        (0,  17,  "minimal",  "Mínimo",            "wellness", "Sin síntomas significativos de TEPT."),
        (18, 32,  "mild",     "Leve",              "wellness", "Algunos síntomas; conviene seguimiento."),
        (33, 49,  "moderate", "Moderado (probable TEPT)", "amber", "Sugerimos evaluación clínica especializada."),
        (50, 80,  "severe",   "Severo",            "rose",     "Síntomas severos. Tratamiento especializado en trauma es prioritario."),
    ],
    "critical_question_index": None,
    "critical_threshold": None,
    "critical_message": None,
}


CATALOG = {
    "phq9":   PHQ9,
    "gad7":   GAD7,
    "who5":   WHO5,
    "auditc": AUDITC,
    "epds":   EPDS,
    "pcl5":   PCL5,
}


def get_questionnaire(code: str) -> Optional[dict]:
    return CATALOG.get(code)


def list_codes() -> list[str]:
    return list(CATALOG.keys())


def list_metadata() -> list[dict]:
    """Lista resumida (sin las preguntas) — para selectores y dashboards."""
    return [
        {
            "code": q["code"],
            "name": q["name"],
            "short_name": q["short_name"],
            "description": q["description"],
            "duration_minutes": q["duration_minutes"],
            "scoring_note": q["scoring_note"],
            "frequency_recommendation": q["frequency_recommendation"],
            "num_questions": len(q["questions"]),
            "max_score": (len(q["questions"]) * max(o["value"] for o in q["scale_options"])),
        }
        for q in CATALOG.values()
    ]


def score_answers(code: str, answers: dict) -> dict:
    """Dado un código y un dict de respuestas {index: value}, devuelve score + severidad.

    answers: dict con keys "0", "1", ... (string) o int. Valores ints según scale_options.
    """
    q = get_questionnaire(code)
    if not q:
        raise ValueError(f"Cuestionario desconocido: {code}")

    # Normalizar keys a int
    normalized = {int(k): int(v) for k, v in answers.items()}
    # Validar
    valid_values = {o["value"] for o in q["scale_options"]}
    for i in range(len(q["questions"])):
        if i not in normalized:
            raise ValueError(f"Falta respuesta para pregunta {i + 1}")
        if normalized[i] not in valid_values:
            raise ValueError(f"Valor inválido en pregunta {i + 1}: {normalized[i]}")

    score = sum(normalized[i] for i in range(len(q["questions"])))

    # Encontrar severidad
    severity = next(
        (s for s in q["severity_thresholds"] if s[0] <= score <= s[1]),
        q["severity_thresholds"][-1],
    )
    _min, _max, code_sev, label, tone, action = severity

    # Detectar crisis (solo para PHQ-9 hoy)
    crisis = False
    crisis_message = None
    if q.get("critical_question_index") is not None:
        idx = q["critical_question_index"]
        if normalized.get(idx, 0) >= (q.get("critical_threshold") or 1):
            crisis = True
            crisis_message = q.get("critical_message")

    return {
        "score": score,
        "max_score": (len(q["questions"]) * max(o["value"] for o in q["scale_options"])),
        "severity_code": code_sev,
        "severity_label": label,
        "severity_tone": tone,
        "action_hint": action,
        "crisis": crisis,
        "crisis_message": crisis_message,
    }
