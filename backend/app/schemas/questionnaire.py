from datetime import date, datetime
from typing import Optional, Any
from pydantic import BaseModel, Field


class QuestionnaireMetadata(BaseModel):
    code: str
    name: str
    short_name: str
    description: str
    duration_minutes: int
    scoring_note: str
    frequency_recommendation: str
    num_questions: int
    max_score: int


class QuestionnaireFull(QuestionnaireMetadata):
    instructions: str
    scale_options: list[dict]
    questions: list[str]


class AssignmentCreate(BaseModel):
    patient_id: int
    code: str = Field(min_length=2, max_length=50)
    due_date: Optional[date] = None
    doctor_note: Optional[str] = ""


class AssignmentSubmit(BaseModel):
    answers: dict[str, int]   # {"0": 2, "1": 0, ...}
    patient_comment: Optional[str] = Field(default="", max_length=2000)


class AssignmentResponse(BaseModel):
    id: int
    code: str
    short_name: Optional[str] = None  # nombre humano del cuestionario
    questionnaire_name: Optional[str] = None
    doctor_id: int
    doctor_name: Optional[str] = None
    patient_id: int
    patient_name: Optional[str] = None
    status: str
    due_date: Optional[date] = None
    doctor_note: str
    answers: Optional[dict] = None
    score: Optional[int] = None
    max_score: Optional[int] = None
    severity_code: Optional[str] = None
    severity_label: Optional[str] = None
    severity_tone: Optional[str] = None
    action_hint: Optional[str] = None
    crisis_flagged: bool = False
    patient_comment: str = ""
    created_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class HistoryPoint(BaseModel):
    """Para gráficos de evolución."""
    completed_at: datetime
    score: int
    max_score: int
    severity_code: str
    severity_tone: str
