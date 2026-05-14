"""Seed de pacientes y psicólogos dummy con datos chilenos realistas y fotos.

Uso:
    docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T backend python seed_dummy.py

Crea (o actualiza password de) :
  - 10 psicólogos con fotos (randomuser.me), bios, precios, disponibilidad
  - 20 pacientes con fotos, edades variadas, datos de contacto chilenos

Si el user ya existe, se actualiza su password al valor uniforme `Inicio01..`.
Imprime al final la lista completa de credenciales.
"""

# Password única para TODOS los users dummy. Cambia este valor para regenerar.
DUMMY_PASSWORD = "Inicio01.."

from datetime import date, time, timedelta
import random

from app.core.database import SessionLocal
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.doctor import Doctor
from app.models.availability import DoctorAvailability
from app.models.clinic import Clinic
from app.models.specialty import Specialty


# ─── Datos chilenos realistas ─────────────────────────────────────────────

PSYCHOLOGISTS = [
    # (first, last, gender, photo_n, specialty_keyword, license, price, duration, bio)
    ("Camila", "Soto Vargas", "F", 11, "Psicología", "PSI-10456", 35000, 50,
     "Psicóloga clínica con 12 años de experiencia. Enfoque cognitivo-conductual y terapia de aceptación y compromiso."),
    ("Diego", "Hernández Rojas", "M", 22, "Psicología", "PSI-12087", 32000, 50,
     "Especialista en adolescentes y adultos jóvenes. Trabajo con ansiedad, autoestima y proyecto de vida."),
    ("Javiera", "Pérez Muñoz", "F", 28, "Psicología", "PSI-09812", 40000, 60,
     "Terapeuta de pareja y familia, enfoque sistémico. 15 años acompañando procesos de crisis y transformación."),
    ("Matías", "González Silva", "M", 36, "Psicología", "PSI-13245", 30000, 45,
     "Psicólogo infantil y juvenil. Especialista en TDAH, dificultades de aprendizaje y manejo emocional."),
    ("Constanza", "Fuentes Díaz", "F", 47, "Psicología", "PSI-11876", 38000, 50,
     "Enfoque humanista-existencial. Acompaño procesos de duelo, ansiedad y búsqueda de sentido."),
    ("Tomás", "Vargas Contreras", "M", 51, "Psicología", "PSI-10234", 34000, 50,
     "Psicólogo clínico especializado en adicciones, trauma y EMDR. Experiencia hospitalaria 8 años."),
    ("Antonia", "Morales Rojas", "F", 63, "Psicología", "PSI-13987", 33000, 45,
     "Psicología adolescente y crisis emocional. Trabajo con ideación suicida, autolesión y crisis identitaria."),
    ("Vicente", "Torres López", "M", 67, "Psicología", "PSI-12567", 45000, 60,
     "Neuropsicólogo. Evaluaciones cognitivas, rehabilitación post-ACV y deterioro cognitivo en adultos mayores."),
    ("Francisca", "Silva Núñez", "F", 75, "Psicología", "PSI-14102", 36000, 50,
     "Especialista en trastornos alimentarios (TCA), imagen corporal y autoestima. Enfoque integrativo."),
    ("Sebastián", "Díaz Sepúlveda", "M", 86, "Psicología", "PSI-11543", 31000, 50,
     "Terapia individual con adultos. Ansiedad, depresión, estrés laboral. Atiendo online y presencial."),
]


def chilean_rut(n: int) -> str:
    """Genera un RUT ficticio con dígito verificador. Solo para seeds."""
    # Formato: NN.NNN.NNN-X
    body = f"{n:08d}"
    return f"{body[:2]}.{body[2:5]}.{body[5:]}-K"


PATIENTS = [
    # (first, last, gender, photo_n, age, phone_last4, hi)
    ("Ignacia",   "Rojas Pérez",       "F",  3, 28, "1234", "Isapre Banmédica"),
    ("Felipe",    "Muñoz Soto",        "M",  7, 34, "2345", "Fonasa B"),
    ("Camila",    "González López",    "F", 15, 19, "3456", "Fonasa A"),
    ("Sebastián", "Díaz Vargas",       "M", 19, 42, "4567", "Isapre Colmena"),
    ("Valentina", "Torres Hernández",  "F", 25, 31, "5678", "Fonasa C"),
    ("Joaquín",   "Silva Fuentes",     "M", 31, 25, "6789", "Fonasa D"),
    ("Antonella", "Contreras Morales", "F", 33, 38, "7890", "Isapre Cruz Blanca"),
    ("Cristóbal", "Pérez Vargas",      "M", 38, 47, "8901", "Fonasa B"),
    ("Florencia", "Sepúlveda Reyes",   "F", 42, 22, "9012", "Fonasa A"),
    ("Tomás",     "Fernández Silva",   "M", 44, 29, "0123", "Isapre Vida Tres"),
    ("Catalina",  "Núñez Castro",      "F", 49, 33, "1357", "Fonasa C"),
    ("Andrés",    "Bravo Mella",       "M", 55, 51, "2468", "Fonasa B"),
    ("Martina",   "Carrasco Olivares", "F", 57, 16, "3579", "Fonasa A"),
    ("Vicente",   "Lagos Vergara",     "M", 60, 36, "4680", "Isapre Banmédica"),
    ("Trinidad",  "Espinoza Cabrera",  "F", 61, 41, "5791", "Fonasa D"),
    ("Maximiliano","Aravena Pizarro",  "M", 65, 27, "6802", "Fonasa B"),
    ("Sofía",     "Jara Riquelme",     "F", 69, 24, "7913", "Fonasa A"),
    ("Benjamín",  "Salinas Quezada",   "M", 77, 39, "8024", "Isapre Colmena"),
    ("Isidora",   "Tapia Cárdenas",    "F", 82, 26, "9135", "Fonasa C"),
    ("Lucas",     "Henríquez Quiroz",  "M", 88, 30, "0246", "Fonasa B"),
]


def photo_url(gender: str, n: int) -> str:
    """URL pública de foto desde randomuser.me — deterministic por (gender, n)."""
    folder = "men" if gender == "M" else "women"
    return f"https://randomuser.me/api/portraits/{folder}/{n}.jpg"


def email_from_name(first: str, last: str, domain: str = "ejemplo.cl") -> str:
    import unicodedata
    def normalize(s):
        return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn').lower()
    first_clean = normalize(first).split()[0]
    last_clean = normalize(last.replace(' ', '.'))
    return f"{first_clean}.{last_clean}@{domain}"


# ─── Seed ──────────────────────────────────────────────────────────────────

db = SessionLocal()
try:
    print("─" * 60)
    print("Seed dummy de Calmar")
    print("─" * 60)

    # Buscar clínica y especialidad
    clinic = db.query(Clinic).first()
    if not clinic:
        clinic = Clinic(name="Centro Calmar Providencia", address="Av. Providencia 1234, Santiago", phone="+56 2 2345 6789")
        db.add(clinic)
        db.flush()

    psi_spec = db.query(Specialty).filter(Specialty.name.ilike("%psicolog%")).first()
    if not psi_spec:
        psi_spec = Specialty(name="Psicología", description="Atención psicológica clínica para adolescentes, adultos y familias.")
        db.add(psi_spec)
        db.flush()

    created_psychologists = []
    created_patients = []
    password_hash_dummy = get_password_hash(DUMMY_PASSWORD)

    # ─── 10 Psicólogos ────────────────────────────────────────────────────
    print("\nCreando/actualizando psicólogos…")
    for i, (first, last, gender, photo_n, _spec_kw, license_n, price, duration, bio) in enumerate(PSYCHOLOGISTS):
        email = email_from_name(first, last, "calmar.cl")
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            # Reset de password + foto a los valores del seed
            existing.password_hash = password_hash_dummy
            if not existing.photo_url:
                existing.photo_url = photo_url(gender, photo_n)
            created_psychologists.append({
                "name": f"{first} {last}",
                "email": email,
                "password": DUMMY_PASSWORD,
                "license": existing.rut or "-",
                "price": "-",
                "status": "actualizado",
            })
            print(f"  ↻ {first} {last} ya existía — password reseteada")
            continue

        rut = chilean_rut(15000000 + i * 137)

        user = User(
            email=email,
            password_hash=password_hash_dummy,
            first_name=first,
            last_name=last,
            phone=f"+56 9 {7000 + i*111:04d} {1000 + i*73:04d}",
            rut=rut,
            role=UserRole.doctor,
            photo_url=photo_url(gender, photo_n),
        )
        db.add(user)
        db.flush()

        doctor = Doctor(
            user_id=user.id,
            specialty_id=psi_spec.id,
            clinic_id=clinic.id,
            license_number=license_n,
            consultation_duration=duration,
            consultation_price=price,
            bio=bio,
        )
        db.add(doctor)
        db.flush()

        # Disponibilidad lun-vie (varían los horarios)
        start_hour = 9 if i % 2 == 0 else 10
        end_hour = 18 if i % 2 == 0 else 19
        for day in range(5):
            db.add(DoctorAvailability(
                doctor_id=doctor.id,
                day_of_week=day,
                start_time=time(start_hour, 0),
                end_time=time(end_hour, 0),
            ))

        created_psychologists.append({
            "name": f"{first} {last}",
            "email": email,
            "password": DUMMY_PASSWORD,
            "license": license_n,
            "price": price,
            "status": "creado",
        })
        print(f"  ✓ {first} {last} ({email})")

    # ─── 20 Pacientes ─────────────────────────────────────────────────────
    print("\nCreando/actualizando pacientes…")
    for i, (first, last, gender, photo_n, age, phone_last4, hi) in enumerate(PATIENTS):
        email = email_from_name(first, last, "paciente.cl")
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            existing.password_hash = password_hash_dummy
            if not existing.photo_url:
                existing.photo_url = photo_url(gender, photo_n)
            created_patients.append({
                "name": f"{first} {last}",
                "email": email,
                "password": DUMMY_PASSWORD,
                "age": age,
                "hi": existing.health_insurance or hi,
                "status": "actualizado",
            })
            print(f"  ↻ {first} {last} ya existía — password reseteada")
            continue

        rut = chilean_rut(20000000 + i * 91)
        birth_year = date.today().year - age

        user = User(
            email=email,
            password_hash=password_hash_dummy,
            first_name=first,
            last_name=last,
            phone=f"+56 9 {5000 + i*43:04d} {phone_last4}",
            rut=rut,
            role=UserRole.patient,
            birth_date=date(birth_year, ((i * 7) % 12) + 1, ((i * 11) % 27) + 1),
            address=f"Calle Las {['Encinas', 'Acacias', 'Camelias', 'Magnolias', 'Hortensias'][i % 5]} {1000 + i * 47}, "
                    f"{['Providencia', 'Ñuñoa', 'Las Condes', 'La Florida', 'Maipú', 'San Miguel'][i % 6]}",
            health_insurance=hi,
            photo_url=photo_url(gender, photo_n),
        )
        db.add(user)
        db.flush()

        created_patients.append({
            "name": f"{first} {last}",
            "email": email,
            "password": DUMMY_PASSWORD,
            "age": age,
            "hi": hi,
            "status": "creado",
        })
        print(f"  ✓ {first} {last} ({email})")

    db.commit()

    # ─── Resumen final con credenciales ────────────────────────────────────
    print()
    print("═" * 70)
    print(f"  ✓ {len(created_psychologists)} psicólogos")
    print(f"  ✓ {len(created_patients)} pacientes")
    print(f"  🔑 TODOS los users tienen la misma password: {DUMMY_PASSWORD}")
    print("═" * 70)
    print()

    if created_psychologists:
        print("PSICÓLOGOS:")
        print("─" * 70)
        print(f"{'#':<3} {'Email':<42} {'Estado':<12}")
        print("─" * 70)
        for i, p in enumerate(created_psychologists, 1):
            print(f"{i:<3} {p['email']:<42} {p.get('status','-'):<12}")
        print()

    if created_patients:
        print("PACIENTES:")
        print("─" * 70)
        print(f"{'#':<3} {'Email':<44} {'Edad':>5}  {'Estado':<12}")
        print("─" * 70)
        for i, p in enumerate(created_patients, 1):
            print(f"{i:<3} {p['email']:<44} {p['age']:>5}  {p.get('status','-'):<12}")
        print()

    print(f"🔑 Password de TODOS los usuarios dummy:  {DUMMY_PASSWORD}")
    print()
    print("Recordá: estos son usuarios de prueba con password débil.")
    print("Antes de producción real, desactivá estas cuentas o cambiales la password.")
    print()
finally:
    db.close()
