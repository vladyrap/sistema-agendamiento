"""Seed inicial: crea especialidades, clínica, admin, un médico y un paciente de ejemplo."""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from datetime import time
from app.core.database import SessionLocal, engine
from app.core.database import Base
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.specialty import Specialty
from app.models.clinic import Clinic
from app.models.doctor import Doctor
from app.models.availability import DoctorAvailability
import app.models  # noqa

Base.metadata.create_all(bind=engine)
db = SessionLocal()

try:
    specialties_data = [
        ("Medicina General", "Atención primaria y diagnóstico general"),
        ("Cardiología", "Enfermedades del corazón y sistema cardiovascular"),
        ("Pediatría", "Atención médica de niños y adolescentes"),
        ("Dermatología", "Enfermedades de la piel"),
        ("Traumatología", "Lesiones óseas y musculares"),
        ("Ginecología", "Salud reproductiva femenina"),
        ("Neurología", "Enfermedades del sistema nervioso"),
        ("Oftalmología", "Enfermedades de los ojos"),
    ]
    specialties = {}
    for name, desc in specialties_data:
        if not db.query(Specialty).filter(Specialty.name == name).first():
            s = Specialty(name=name, description=desc)
            db.add(s)
            db.flush()
            specialties[name] = s
        else:
            specialties[name] = db.query(Specialty).filter(Specialty.name == name).first()

    clinic = db.query(Clinic).filter(Clinic.name == "Clínica Central").first()
    if not clinic:
        clinic = Clinic(
            name="Clínica Central",
            address="Av. Providencia 1234",
            city="Santiago",
            phone="+56 2 2345 6789",
            email="contacto@clinicacentral.cl",
        )
        db.add(clinic)
        db.flush()

    if not db.query(User).filter(User.email == "admin@clinica.cl").first():
        admin = User(
            email="admin@clinica.cl",
            password_hash=get_password_hash("Inicio01.."),
            first_name="Admin",
            last_name="Sistema",
            role=UserRole.admin,
        )
        db.add(admin)

    if not db.query(User).filter(User.email == "recepcion@clinica.cl").first():
        receptionist = User(
            email="recepcion@clinica.cl",
            password_hash=get_password_hash("Inicio01.."),
            first_name="Camila",
            last_name="Soto",
            phone="+56 9 5555 1234",
            role=UserRole.receptionist,
        )
        db.add(receptionist)

    if not db.query(User).filter(User.email == "paciente@ejemplo.cl").first():
        patient = User(
            email="paciente@ejemplo.cl",
            password_hash=get_password_hash("Inicio01.."),
            first_name="Juan",
            last_name="Pérez",
            phone="+56 9 8765 4321",
            rut="12345678-9",
            role=UserRole.patient,
        )
        db.add(patient)

    if not db.query(User).filter(User.email == "tutor@ejemplo.cl").first():
        tutor_user = User(
            email="tutor@ejemplo.cl",
            password_hash=get_password_hash("Inicio01.."),
            first_name="Marta",
            last_name="Pérez",
            phone="+56 9 5555 9876",
            rut="11223344-5",
            role=UserRole.tutor,
        )
        db.add(tutor_user)
        db.flush()

        # Vincular como tutora del paciente seed
        from app.models.tutor import TutorRelationship
        patient_user = db.query(User).filter(User.email == "paciente@ejemplo.cl").first()
        if patient_user and not db.query(TutorRelationship).filter(
            TutorRelationship.patient_id == patient_user.id,
            TutorRelationship.tutor_user_id == tutor_user.id,
        ).first():
            rel = TutorRelationship(
                patient_id=patient_user.id,
                tutor_user_id=tutor_user.id,
                name=f"{tutor_user.first_name} {tutor_user.last_name}",
                relationship_label="Madre",
                email=tutor_user.email,
                phone=tutor_user.phone,
                rut=tutor_user.rut,
                is_legal_guardian=True,
                notify_on_crisis=True,
                notify_on_appointments=True,
                can_view_full_profile=True,
                notes="Tutor seed para pruebas.",
            )
            db.add(rel)

    if not db.query(User).filter(User.email == "dr.garcia@clinica.cl").first():
        doctor_user = User(
            email="dr.garcia@clinica.cl",
            password_hash=get_password_hash("Inicio01.."),
            first_name="María",
            last_name="García",
            phone="+56 9 1234 5678",
            rut="98765432-1",
            role=UserRole.doctor,
        )
        db.add(doctor_user)
        db.flush()

        doctor = Doctor(
            user_id=doctor_user.id,
            specialty_id=specialties["Medicina General"].id,
            clinic_id=clinic.id,
            license_number="MED-001234",
            consultation_duration=30,
            consultation_price=25000,
            bio="Médico general con 10 años de experiencia en atención primaria.",
        )
        db.add(doctor)
        db.flush()

        for day in range(5):  # Lunes a Viernes
            avail = DoctorAvailability(
                doctor_id=doctor.id,
                day_of_week=day,
                start_time=time(9, 0),
                end_time=time(18, 0),
            )
            db.add(avail)

    db.commit()
    print("Seed completado exitosamente.")
    print("Credenciales de prueba (TODAS la misma password):")
    print("  Password única: Inicio01..")
    print()
    print("  Admin:        admin@clinica.cl")
    print("  Médico:       dr.garcia@clinica.cl")
    print("  Recepción:    recepcion@clinica.cl")
    print("  Paciente:     paciente@ejemplo.cl")
    print("  Tutor:        tutor@ejemplo.cl")
finally:
    db.close()
