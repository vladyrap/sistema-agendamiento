"""Wave 1: audit log de accesos + rate limiting."""
from app.models.access_audit_log import AccessAuditLog


def test_audit_log_records_patient_viewing_own_record(client, db_session, patient, patient_headers):
    r = client.get("/api/me/medical-record", headers=patient_headers)
    assert r.status_code == 200

    entries = db_session.query(AccessAuditLog).all()
    assert len(entries) == 1
    e = entries[0]
    assert e.user_id == patient.id
    assert e.user_email == patient.email
    assert e.user_role == "patient"
    assert e.resource_type == "MedicalRecord"
    assert e.action == "view"
    assert e.patient_id == patient.id


def test_audit_log_records_admin_viewing_patient_record(client, db_session, patient, admin, admin_headers):
    r = client.get(f"/api/patients/{patient.id}/medical-record", headers=admin_headers)
    assert r.status_code == 200

    entries = db_session.query(AccessAuditLog).filter(AccessAuditLog.user_role == "admin").all()
    assert len(entries) == 1
    assert entries[0].patient_id == patient.id
    assert entries[0].action == "view"


def test_audit_log_records_update(client, db_session, patient, patient_headers):
    r = client.put(
        "/api/me/medical-record",
        json={"blood_type": "O+", "allergies": "ninguna"},
        headers=patient_headers,
    )
    assert r.status_code == 200

    update_entries = db_session.query(AccessAuditLog).filter(AccessAuditLog.action == "update").all()
    assert len(update_entries) == 1
    assert update_entries[0].patient_id == patient.id


def test_audit_endpoint_lists_entries_for_admin(client, db_session, patient, patient_headers, admin, admin_headers):
    client.get("/api/me/medical-record", headers=patient_headers)
    client.get("/api/me/medical-record", headers=patient_headers)

    r = client.get("/api/admin/audit-log", headers=admin_headers)
    assert r.status_code == 200
    data = r.json()
    assert len(data) >= 2
    assert all("created_at" in e for e in data)
    assert all(e["resource_type"] == "MedicalRecord" for e in data if e["user_role"] == "patient")


def test_audit_endpoint_filters_by_patient(client, db_session, patient, patient_headers, admin, admin_headers):
    client.get("/api/me/medical-record", headers=patient_headers)
    r = client.get(f"/api/admin/audit-log?patient_id={patient.id}", headers=admin_headers)
    assert r.status_code == 200
    data = r.json()
    assert all(e["patient_id"] == patient.id for e in data)


def test_audit_endpoint_requires_admin(client, patient_headers):
    r = client.get("/api/admin/audit-log", headers=patient_headers)
    assert r.status_code == 403


def test_rate_limit_blocks_after_threshold(client, patient):
    """6 logins fallidos seguidos: el 6º recibe 429."""
    for i in range(5):
        r = client.post("/api/auth/login", json={"email": patient.email, "password": "wrong"})
        assert r.status_code == 401, f"intento {i+1}: {r.status_code} {r.text}"

    r = client.post("/api/auth/login", json={"email": patient.email, "password": "wrong"})
    assert r.status_code == 429
    assert "Retry-After" in r.headers


def test_rate_limit_does_not_block_correct_login_before_threshold(client, patient):
    r = client.post("/api/auth/login", json={"email": patient.email, "password": "secret123"})
    assert r.status_code == 200
