from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, Field


# ─── Catálogo de tests soportados ──────────────────────────────────────────
# Solo nombres + categoría — NO contienen items. El profesional aplica el test
# con su propia copia licenciada y registra solo el resultado.

TEST_CATALOG = [
    # Inteligencia / Cognición
    {"code": "wais4",       "name": "WAIS-IV (Inteligencia adultos)",            "category": "Cognición"},
    {"code": "wais3",       "name": "WAIS-III (Inteligencia adultos)",           "category": "Cognición"},
    {"code": "wisc5",       "name": "WISC-V (Inteligencia niños)",               "category": "Cognición"},
    {"code": "wisc4",       "name": "WISC-IV (Inteligencia niños)",              "category": "Cognición"},
    {"code": "wppsi",       "name": "WPPSI (Inteligencia pre-escolares)",        "category": "Cognición"},
    {"code": "ravens",      "name": "Raven (Matrices progresivas)",              "category": "Cognición"},
    {"code": "moca",        "name": "MoCA (Deterioro cognitivo)",                "category": "Cognición"},
    {"code": "mmse",        "name": "MMSE (Mini-Mental)",                        "category": "Cognición"},
    {"code": "ad8",         "name": "AD8 (Screening demencia)",                  "category": "Cognición"},
    {"code": "bender2",     "name": "Bender-Gestalt II",                         "category": "Cognición"},
    # Personalidad — Objetivos
    {"code": "mmpi2",       "name": "MMPI-2 (Personalidad / psicopatología)",    "category": "Personalidad"},
    {"code": "mmpi_a",      "name": "MMPI-A (Adolescentes)",                     "category": "Personalidad"},
    {"code": "mcmi4",       "name": "MCMI-IV (Trastornos de personalidad)",      "category": "Personalidad"},
    {"code": "neo_pi",      "name": "NEO-PI-R (Big Five)",                       "category": "Personalidad"},
    {"code": "neo_ffi",     "name": "NEO-FFI (Big Five resumido)",               "category": "Personalidad"},
    # Personalidad — Proyectivos
    {"code": "rorschach",   "name": "Rorschach (Sistema Exner)",                 "category": "Proyectivos"},
    {"code": "zulliger",    "name": "Zulliger",                                  "category": "Proyectivos"},
    {"code": "tro",         "name": "TRO (Test de Relaciones Objetales)",        "category": "Proyectivos"},
    {"code": "tat",         "name": "TAT (Apercepción temática)",                "category": "Proyectivos"},
    {"code": "cat",         "name": "CAT (Apercepción infantil)",                "category": "Proyectivos"},
    {"code": "htp",         "name": "HTP (Casa-Árbol-Persona)",                  "category": "Proyectivos"},
    {"code": "persona_lluvia", "name": "Persona Bajo la Lluvia",                "category": "Proyectivos"},
    {"code": "familia",     "name": "Test del Dibujo de la Familia",             "category": "Proyectivos"},
    # Depresión / Ansiedad / Estrés
    {"code": "bdi2",        "name": "BDI-II (Depresión Beck)",                   "category": "Depresión/Ansiedad"},
    {"code": "bai",         "name": "BAI (Ansiedad Beck)",                       "category": "Depresión/Ansiedad"},
    {"code": "hamilton_d",  "name": "Hamilton (Depresión)",                      "category": "Depresión/Ansiedad"},
    {"code": "hamilton_a",  "name": "Hamilton (Ansiedad)",                       "category": "Depresión/Ansiedad"},
    {"code": "dass21",      "name": "DASS-21 (Depresión/Ansiedad/Estrés)",       "category": "Depresión/Ansiedad"},
    {"code": "pss10",       "name": "PSS-10 (Estrés percibido)",                 "category": "Depresión/Ansiedad"},
    # TCA
    {"code": "eat26",       "name": "EAT-26 (Actitudes alimentarias)",           "category": "Trastornos alimentarios"},
    {"code": "edi3",        "name": "EDI-3 (Inventario TCA)",                    "category": "Trastornos alimentarios"},
    {"code": "scoff",       "name": "SCOFF (Screening TCA)",                     "category": "Trastornos alimentarios"},
    # TOC / Compulsiones
    {"code": "yale_brown",  "name": "Y-BOCS (Yale-Brown TOC)",                   "category": "TOC"},
    {"code": "oci_r",       "name": "OCI-R (Inventario TOC revisado)",           "category": "TOC"},
    # Trauma
    {"code": "caps5",       "name": "CAPS-5 (Entrevista TEPT)",                  "category": "Trauma"},
    # Autismo
    {"code": "ados2",       "name": "ADOS-2 (Espectro autista)",                 "category": "Autismo"},
    {"code": "adi_r",       "name": "ADI-R (Entrevista autismo)",                "category": "Autismo"},
    {"code": "aq",          "name": "AQ (Cociente del Espectro Autista)",        "category": "Autismo"},
    # Infanto-juvenil
    {"code": "asq3",        "name": "ASQ-3 (Desarrollo infantil)",               "category": "Infanto-juvenil"},
    {"code": "vineland",    "name": "Vineland (Conducta adaptativa)",            "category": "Infanto-juvenil"},
    {"code": "conners",     "name": "Conners (TDAH)",                            "category": "Infanto-juvenil"},
    {"code": "sdq",         "name": "SDQ (Capacidades y dificultades)",          "category": "Infanto-juvenil"},
    {"code": "cbcl",        "name": "CBCL (Child Behavior Checklist)",           "category": "Infanto-juvenil"},
    # Adicciones (versiones largas no en catálogo digital)
    {"code": "dudit",       "name": "DUDIT (Drogas)",                            "category": "Adicciones"},
    # Otros
    {"code": "other",       "name": "Otro test (especificar)",                   "category": "Otros"},
]


# ─── Schemas ───────────────────────────────────────────────────────────────

class ExternalTestCatalogItem(BaseModel):
    code: str
    name: str
    category: str


class ExternalTestCreate(BaseModel):
    test_code: str = Field(min_length=1, max_length=50)
    test_name: Optional[str] = Field(default=None, max_length=200)  # solo si test_code='other'
    applied_at: date
    score: Optional[str] = Field(default=None, max_length=100)
    severity_label: Optional[str] = Field(default=None, max_length=100)
    interpretation: Optional[str] = ""
    follow_up_date: Optional[date] = None
    attachment_id: Optional[int] = None
    notes: Optional[str] = ""


class ExternalTestUpdate(BaseModel):
    test_code: Optional[str] = None
    test_name: Optional[str] = None
    applied_at: Optional[date] = None
    score: Optional[str] = None
    severity_label: Optional[str] = None
    interpretation: Optional[str] = None
    follow_up_date: Optional[date] = None
    attachment_id: Optional[int] = None
    notes: Optional[str] = None


class ExternalTestResponse(BaseModel):
    id: int
    patient_id: int
    doctor_id: int
    doctor_name: Optional[str] = None
    test_code: str
    test_name: str
    category: Optional[str] = None
    applied_at: date
    score: Optional[str] = None
    severity_label: Optional[str] = None
    interpretation: str = ""
    follow_up_date: Optional[date] = None
    attachment_id: Optional[int] = None
    notes: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
