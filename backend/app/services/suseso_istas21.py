"""SUSESO/ISTAS-21 — Cuestionario de Evaluación de Riesgo Psicosocial Laboral (versión breve).

Instrumento oficial de la Superintendencia de Seguridad Social de Chile (SUSESO),
adaptado del CoPsoQ-ISTAS21 español. Su uso es obligatorio para evaluación de
riesgo psicosocial en empresas chilenas según la Norma Técnica MINSAL y la Ley 21.643
(Ley Karin).

Esta es la **versión breve de 20 ítems** organizada en 5 dimensiones, pensada para
screening rápido y aplicación masiva en empresas.

### Notas técnicas importantes

- Escala Likert 0-4: Nunca (0), Solo alguna vez (1), Algunas veces (2), Muchas veces (3), Siempre (4).
- Para algunos ítems la escala es de 5 niveles desde "Muy en desacuerdo" a "Muy de acuerdo";
  internamente los mapeamos a la misma escala 0-4 para uniformidad.
- Cada ítem tiene su flag `inverted`. En SUSESO/ISTAS-21 la inversión es **por ítem**,
  NO por dimensión completa, porque dimensiones como "Compensaciones" mezclan ítems
  donde "siempre" es bueno (reconocimiento) con ítems donde "siempre" es malo (miedo
  a perder el empleo).
- El "score de riesgo" de cada ítem se calcula como `value` si NO está invertido, o
  `4 - value` si está invertido. Así, score más alto siempre = más riesgo.
- Cortes por tercil oficial SUSESO para población chilena. La versión breve no tiene
  cortes exactos publicados por dimensión; usamos terciles relativos sobre el rango
  posible de cada dimensión.

### Referencia oficial

Manual del Método del Cuestionario SUSESO/ISTAS-21, versión 2009 (SUSESO).
URL: https://www.suseso.cl/606/articles-19640_archivo_01.pdf

Las redacciones de abajo son las publicadas por SUSESO. Si SUSESO publica una
versión revisada, actualizar este archivo y subir `version` en CATALOG_ITEM.
"""

LIKERT_5 = [
    {"value": 4, "label": "Siempre"},
    {"value": 3, "label": "Muchas veces"},
    {"value": 2, "label": "Algunas veces"},
    {"value": 1, "label": "Solo alguna vez"},
    {"value": 0, "label": "Nunca"},
]

# Cada ítem: {text, inverted}
# - inverted=False: "Siempre" → más riesgo
# - inverted=True:  "Siempre" → menos riesgo (lo invertimos en el cálculo)

DIMENSIONS = [
    {
        "code": "exigencias",
        "label": "Exigencias psicológicas",
        "description": "Carga cuantitativa, cognitiva y emocional del trabajo, y necesidad de esconder emociones.",
        "items": [
            {"text": "¿Puede hacer su trabajo con tranquilidad y tenerlo al día?", "inverted": True},
            {"text": "En su trabajo, ¿tiene usted que tomar decisiones difíciles?", "inverted": False},
            {"text": "En general, ¿considera usted que su trabajo le produce desgaste emocional?", "inverted": False},
            {"text": "En su trabajo, ¿tiene usted que guardar sus emociones y no expresarlas?", "inverted": False},
            {"text": "¿Su trabajo requiere atención constante?", "inverted": False},
        ],
    },
    {
        "code": "trabajo_activo",
        "label": "Trabajo activo y desarrollo de habilidades",
        "description": "Influencia sobre el trabajo, oportunidades de desarrollo, sentido del trabajo e integración.",
        "items": [
            {"text": "¿Tiene influencia sobre la cantidad de trabajo que se le asigna?", "inverted": True},
            {"text": "¿Puede dejar su trabajo un momento para conversar con un/a compañero/a?", "inverted": True},
            {"text": "¿Su trabajo permite que aprenda cosas nuevas?", "inverted": True},
            {"text": "Las tareas que hace, ¿le parecen importantes?", "inverted": True},
            {"text": "¿Siente que su empresa tiene una gran importancia para usted?", "inverted": True},
        ],
    },
    {
        "code": "apoyo_liderazgo",
        "label": "Apoyo social en la empresa y calidad de liderazgo",
        "description": "Claridad de rol, conflictos de rol, apoyo de superiores y de pares, calidad del liderazgo.",
        "items": [
            {"text": "¿Sabe exactamente qué tareas son de su responsabilidad?", "inverted": True},
            {"text": "¿Tiene que hacer tareas que usted cree que deberían hacerse de otra manera?", "inverted": False},
            {"text": "¿Recibe ayuda y apoyo de su inmediato o inmediata superior?", "inverted": True},
            {"text": "Entre compañeros y compañeras, ¿se ayudan en el trabajo?", "inverted": True},
            {"text": "¿Sus actuales jefes inmediatos planifican bien el trabajo?", "inverted": True},
        ],
    },
    {
        "code": "compensaciones",
        "label": "Compensaciones",
        "description": "Reconocimiento, estima, inseguridad laboral y temor por el futuro del empleo.",
        "items": [
            {"text": "¿Está preocupado/a por si le despiden o no le renuevan el contrato?", "inverted": False},
            {"text": "Mis superiores me dan el reconocimiento que merezco.", "inverted": True},
            {"text": "¿Está preocupado/a por lo difícil que sería encontrar otro trabajo en el caso de que se quedara sin empleo?", "inverted": False},
        ],
    },
    {
        "code": "doble_presencia",
        "label": "Doble presencia",
        "description": "Conflicto entre demandas del trabajo remunerado y del trabajo doméstico-familiar.",
        "items": [
            {"text": "Si falta algún día de casa, ¿las tareas domésticas que realiza se quedan sin hacer?", "inverted": False},
            {"text": "Cuando está en el trabajo, ¿piensa en las tareas domésticas y familiares?", "inverted": False},
        ],
    },
]


def all_items() -> list[dict]:
    """Lista plana de ítems para el formulario público (sin la flag de inversión,
    que es interna al motor de scoring)."""
    out = []
    for dim in DIMENSIONS:
        for i, it in enumerate(dim["items"]):
            out.append({
                "code": f"{dim['code']}_{i+1}",
                "dimension": dim["code"],
                "text": it["text"],
            })
    return out


def public_dimensions() -> list[dict]:
    """Versión saneada de DIMENSIONS para devolver al frontend público: sin la
    flag `inverted` por ítem, solo {code, label, description, item_count}."""
    return [
        {
            "code": d["code"],
            "label": d["label"],
            "description": d["description"],
            "item_count": len(d["items"]),
        }
        for d in DIMENSIONS
    ]


def _risk_score_for_item(value: int, inverted: bool) -> int:
    """Devuelve el score de riesgo de un ítem (siempre 0-4, más alto = más riesgo)."""
    if value is None:
        return 0
    return (4 - value) if inverted else value


def calculate_dimension_scores(answers: dict[str, int]) -> dict[str, dict]:
    """Dado un dict {item_code: 0-4}, calcula scores de RIESGO por dimensión.

    Retorna {dim_code: {raw_score, max_score, answered_items, level, label, tone}}.
    Score más alto = más riesgo, en TODAS las dimensiones (ya considera la inversión por ítem).
    """
    out = {}
    for dim in DIMENSIONS:
        risk_total = 0
        count = 0
        n_items = len(dim["items"])
        max_dim = n_items * 4  # cada ítem aporta hasta 4 puntos de riesgo
        for i, it in enumerate(dim["items"]):
            key = f"{dim['code']}_{i+1}"
            v = answers.get(key)
            if v is None:
                continue
            risk_total += _risk_score_for_item(int(v), it["inverted"])
            count += 1

        if count == 0:
            out[dim["code"]] = {
                "raw_score": None,
                "max_score": max_dim,
                "answered_items": 0,
                "level": "unanswered",
                "label": "Sin datos",
                "tone": "ink",
            }
            continue

        # Si saltaron ítems, escalamos al máximo de la dimensión proporcionalmente
        scaled_risk = round(risk_total * (n_items / count)) if count < n_items else risk_total

        # Tercil: bajo (<= 1/3), medio (<= 2/3), alto (> 2/3)
        third = max_dim / 3
        if scaled_risk <= third:
            level, label, tone = "low", "Riesgo bajo", "wellness"
        elif scaled_risk <= 2 * third:
            level, label, tone = "medium", "Riesgo medio", "amber"
        else:
            level, label, tone = "high", "Riesgo alto", "rose"

        out[dim["code"]] = {
            "raw_score": scaled_risk,
            "max_score": max_dim,
            "answered_items": count,
            "level": level,
            "label": label,
            "tone": tone,
        }
    return out


def aggregate_responses(responses: list[dict]) -> dict:
    """Agrega múltiples respuestas anónimas → reporte para la empresa.

    `responses` es lista de dicts con `dimension_scores` ya calculado.
    """
    by_dim: dict[str, dict] = {}
    for dim in DIMENSIONS:
        dist = {"low": 0, "medium": 0, "high": 0, "unanswered": 0}
        scores = []
        max_dim = len(dim["items"]) * 4
        for r in responses:
            ds = (r.get("dimension_scores") or {}).get(dim["code"])
            if not ds:
                continue
            lvl = ds.get("level", "unanswered")
            dist[lvl if lvl in dist else "unanswered"] += 1
            if ds.get("raw_score") is not None:
                scores.append(ds["raw_score"])
        avg = round(sum(scores) / len(scores), 1) if scores else None
        # % normalizado sobre el máximo posible
        avg_pct = round(avg * 100 / max_dim, 1) if avg is not None else None
        total = sum(dist.values()) or 1
        pct_high = round(dist["high"] * 100 / total)
        by_dim[dim["code"]] = {
            "label": dim["label"],
            "description": dim["description"],
            "avg_risk_score": avg,
            "avg_risk_pct": avg_pct,
            "max_score": max_dim,
            "n": len(scores),
            "distribution": dist,
            "pct_high": pct_high,
        }
    return {
        "total_responses": len(responses),
        "dimensions": by_dim,
        "worst_dimension": max(
            (d for d in by_dim.values() if d.get("n", 0) > 0),
            key=lambda d: d.get("pct_high", 0),
            default=None,
        ),
    }


CATALOG_ITEM = {
    "code": "suseso_istas21_short",
    "name": "SUSESO/ISTAS-21 (versión breve)",
    "description": "Evaluación de riesgo psicosocial laboral. 20 ítems, 5 dimensiones. Instrumento oficial SUSESO (Chile).",
    "version": "1.0",
    "items_count": sum(len(d["items"]) for d in DIMENSIONS),
    "dimensions_count": len(DIMENSIONS),
    "estimated_minutes": 5,
    "reference_url": "https://www.suseso.cl/606/articles-19640_archivo_01.pdf",
}
