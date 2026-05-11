"""Test fixtures: in-memory SQLite + fakeredis, shared by all test modules."""
import os

# Must precede `app.main` import — disables real-DB table creation at startup.
os.environ.setdefault("TESTING", "1")

from datetime import time
from typing import Generator

import fakeredis
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import StaticPool, create_engine
from sqlalchemy.orm import sessionmaker

from app.core import redis_client as redis_module
from app.core.database import Base, get_db
from app.core.security import get_password_hash
from app.main import app
from app.models.availability import DoctorAvailability
from app.models.clinic import Clinic
from app.models.doctor import Doctor
from app.models.specialty import Specialty
from app.models.user import User, UserRole


@pytest.fixture
def db_session() -> Generator:
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def fake_redis(monkeypatch) -> fakeredis.FakeRedis:
    """Patch redis_client._redis_client with a fakeredis instance for the duration of a test."""
    instance = fakeredis.FakeRedis(decode_responses=True)
    monkeypatch.setattr(redis_module, "_redis_client", instance)
    return instance


@pytest.fixture
def client(db_session, fake_redis) -> Generator[TestClient, None, None]:
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def patient(db_session) -> User:
    user = User(
        email="paciente@test.cl",
        password_hash=get_password_hash("secret123"),
        first_name="Pat",
        last_name="Test",
        role=UserRole.patient,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def admin(db_session) -> User:
    user = User(
        email="admin@test.cl",
        password_hash=get_password_hash("admin123"),
        first_name="Admin",
        last_name="Root",
        role=UserRole.admin,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def specialty(db_session) -> Specialty:
    s = Specialty(name="Medicina General", description="Atención primaria")
    db_session.add(s)
    db_session.commit()
    db_session.refresh(s)
    return s


@pytest.fixture
def clinic(db_session) -> Clinic:
    c = Clinic(name="Clínica Test", city="Santiago")
    db_session.add(c)
    db_session.commit()
    db_session.refresh(c)
    return c


@pytest.fixture
def doctor(db_session, specialty, clinic) -> Doctor:
    user = User(
        email="doc@test.cl",
        password_hash=get_password_hash("doc123"),
        first_name="Doc",
        last_name="Tor",
        role=UserRole.doctor,
    )
    db_session.add(user)
    db_session.flush()
    d = Doctor(
        user_id=user.id,
        specialty_id=specialty.id,
        clinic_id=clinic.id,
        license_number="MED-TEST-001",
        consultation_duration=30,
    )
    db_session.add(d)
    db_session.flush()
    # Mon-Fri 09:00-18:00
    for day in range(5):
        db_session.add(
            DoctorAvailability(
                doctor_id=d.id,
                day_of_week=day,
                start_time=time(9, 0),
                end_time=time(18, 0),
            )
        )
    db_session.commit()
    db_session.refresh(d)
    return d


def auth_headers(client: TestClient, email: str, password: str) -> dict:
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture
def patient_headers(client, patient) -> dict:
    return auth_headers(client, "paciente@test.cl", "secret123")


@pytest.fixture
def admin_headers(client, admin) -> dict:
    return auth_headers(client, "admin@test.cl", "admin123")
