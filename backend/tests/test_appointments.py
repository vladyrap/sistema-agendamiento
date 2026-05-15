"""End-to-end coverage of the booking flow: slots, conflicts, permissions, cancellation."""
import json
from datetime import date, timedelta

from app.services.notifications import QUEUE_KEY


def _next_weekday(target_weekday: int = 0) -> date:
    """Return the next date (strictly in the future) that falls on target_weekday (0=Mon)."""
    today = date.today()
    days_ahead = (target_weekday - today.weekday()) % 7
    if days_ahead == 0:
        days_ahead = 7
    return today + timedelta(days=days_ahead)


def test_available_slots_respects_availability(client, doctor):
    monday = _next_weekday(0)
    r = client.get(f"/api/doctors/{doctor.id}/available-slots", params={"date": monday.isoformat()})
    assert r.status_code == 200
    body = r.json()
    # 9:00 → 18:00 in 30min steps = 18 slots
    assert len(body["slots"]) == 18
    assert body["slots"][0]["start_time"] == "09:00"
    assert all(s["available"] for s in body["slots"])


def test_no_slots_on_off_days(client, doctor):
    sunday = _next_weekday(6)  # doctor only works Mon-Fri
    r = client.get(f"/api/doctors/{doctor.id}/available-slots", params={"date": sunday.isoformat()})
    assert r.status_code == 200
    assert r.json()["slots"] == []


def test_book_appointment_succeeds_and_enqueues_notification(
    client, doctor, patient_headers, fake_redis
):
    monday = _next_weekday(0)
    r = client.post(
        "/api/appointments/",
        json={
            "doctor_id": doctor.id,
            "appointment_date": monday.isoformat(),
            "start_time": "09:00:00",
            "reason": "Control",
        },
        headers=patient_headers,
    )
    assert r.status_code == 201, r.text
    appt = r.json()
    assert appt["status"] == "scheduled"
    assert appt["start_time"] == "09:00:00"
    assert appt["end_time"] == "09:30:00"

    # Al crear cita se encolan notificaciones (paciente y/o doctor).
    queued = fake_redis.lrange(QUEUE_KEY, 0, -1)
    assert len(queued) >= 1
    events = [json.loads(q) for q in queued]
    created = [e for e in events if e["type"] == "appointment_created"]
    assert len(created) >= 1
    # Algún destinatario tiene que ser el paciente que reservó.
    assert any(e["payload"].get("to_email") == "paciente@test.cl" for e in created)


def test_double_booking_rejected(client, doctor, patient_headers):
    monday = _next_weekday(0)
    payload = {
        "doctor_id": doctor.id,
        "appointment_date": monday.isoformat(),
        "start_time": "10:00:00",
    }
    first = client.post("/api/appointments/", json=payload, headers=patient_headers)
    assert first.status_code == 201
    second = client.post("/api/appointments/", json=payload, headers=patient_headers)
    assert second.status_code == 409


def test_booking_outside_availability_rejected(client, doctor, patient_headers):
    monday = _next_weekday(0)
    r = client.post(
        "/api/appointments/",
        json={
            "doctor_id": doctor.id,
            "appointment_date": monday.isoformat(),
            "start_time": "20:00:00",  # after 18:00
        },
        headers=patient_headers,
    )
    assert r.status_code == 400


def test_booking_on_unavailable_day_rejected(client, doctor, patient_headers):
    sunday = _next_weekday(6)
    r = client.post(
        "/api/appointments/",
        json={
            "doctor_id": doctor.id,
            "appointment_date": sunday.isoformat(),
            "start_time": "10:00:00",
        },
        headers=patient_headers,
    )
    assert r.status_code == 400


def test_patient_can_cancel_own_appointment(client, doctor, patient_headers, fake_redis):
    monday = _next_weekday(0)
    create = client.post(
        "/api/appointments/",
        json={
            "doctor_id": doctor.id,
            "appointment_date": monday.isoformat(),
            "start_time": "11:00:00",
        },
        headers=patient_headers,
    )
    appt_id = create.json()["id"]
    fake_redis.delete(QUEUE_KEY)  # ignore the create notification

    r = client.put(
        f"/api/appointments/{appt_id}/cancel",
        json={"cancellation_reason": "ya no puedo"},
        headers=patient_headers,
    )
    assert r.status_code == 200
    assert r.json()["status"] == "cancelled"

    queued = fake_redis.lrange(QUEUE_KEY, 0, -1)
    assert len(queued) >= 1
    assert all(json.loads(q)["type"] == "appointment_cancelled" for q in queued)


def test_listing_only_returns_my_appointments(client, doctor, patient_headers, db_session):
    from app.core.security import get_password_hash
    from app.models.user import User, UserRole

    other = User(
        email="other@test.cl",
        password_hash=get_password_hash("xxx12345"),
        first_name="Other",
        last_name="One",
        role=UserRole.patient,
    )
    db_session.add(other)
    db_session.commit()

    monday = _next_weekday(0)
    client.post(
        "/api/appointments/",
        json={
            "doctor_id": doctor.id,
            "appointment_date": monday.isoformat(),
            "start_time": "12:00:00",
        },
        headers=patient_headers,
    )

    other_login = client.post(
        "/api/auth/login", json={"email": "other@test.cl", "password": "xxx12345"}
    )
    other_headers = {"Authorization": f"Bearer {other_login.json()['access_token']}"}

    r = client.get("/api/appointments/", headers=other_headers)
    assert r.status_code == 200
    assert r.json() == []


def test_appointment_requires_auth(client, doctor):
    r = client.post(
        "/api/appointments/",
        json={
            "doctor_id": doctor.id,
            "appointment_date": _next_weekday(0).isoformat(),
            "start_time": "09:00:00",
        },
    )
    assert r.status_code == 401
