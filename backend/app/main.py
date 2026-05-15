import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator
from app.core.config import settings
from app.core.database import Base, engine
from app.core.logging_config import setup_logging
from app.api.routes import (
    auth, specialties, clinics, doctors, appointments, admin, payments, reviews, patients,
    medical_records, patient_notes, doctor_blocks, waitlist, attachments, session_logs, chat, mood,
    homework, tutors, questionnaires, companies, exports, gifts, notifications, external_tests,
    boletas, ley_karin,
)

setup_logging()

if not os.getenv("TESTING"):
    Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix=settings.API_PREFIX)
app.include_router(specialties.router, prefix=settings.API_PREFIX)
app.include_router(clinics.router, prefix=settings.API_PREFIX)
app.include_router(doctors.router, prefix=settings.API_PREFIX)
app.include_router(appointments.router, prefix=settings.API_PREFIX)
app.include_router(admin.router, prefix=settings.API_PREFIX)
app.include_router(payments.router, prefix=settings.API_PREFIX)
app.include_router(reviews.router, prefix=settings.API_PREFIX)
app.include_router(patients.router, prefix=settings.API_PREFIX)
app.include_router(medical_records.router, prefix=settings.API_PREFIX)
app.include_router(patient_notes.router, prefix=settings.API_PREFIX)
app.include_router(doctor_blocks.router, prefix=settings.API_PREFIX)
app.include_router(waitlist.router, prefix=settings.API_PREFIX)
app.include_router(attachments.router, prefix=settings.API_PREFIX)
app.include_router(session_logs.router, prefix=settings.API_PREFIX)
app.include_router(chat.router, prefix=settings.API_PREFIX)
app.include_router(mood.router, prefix=settings.API_PREFIX)
app.include_router(homework.router, prefix=settings.API_PREFIX)
app.include_router(tutors.router, prefix=settings.API_PREFIX)
app.include_router(questionnaires.router, prefix=settings.API_PREFIX)
app.include_router(companies.router, prefix=settings.API_PREFIX)
app.include_router(exports.router, prefix=settings.API_PREFIX)
app.include_router(gifts.router, prefix=settings.API_PREFIX)
app.include_router(notifications.router, prefix=settings.API_PREFIX)
app.include_router(external_tests.router, prefix=settings.API_PREFIX)
app.include_router(boletas.router, prefix=settings.API_PREFIX)
app.include_router(ley_karin.router, prefix=settings.API_PREFIX)

Instrumentator().instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)


@app.get("/health")
def health():
    return {"status": "ok", "version": settings.VERSION}
