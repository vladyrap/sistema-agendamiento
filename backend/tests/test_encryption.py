"""Wave 3: encripción at-rest de campos clínicos sensibles."""
from sqlalchemy import text

from app.core.encryption import _looks_like_fernet, decrypt_str, encrypt_str
from app.models.medical_record import MedicalRecord
from app.models.patient_note import PatientNote
from app.models.doctor import Doctor


def test_encrypt_then_decrypt_roundtrip():
    original = "Paciente con TDAH grave. Sesión 5: avance notable."
    token = encrypt_str(original)
    assert _looks_like_fernet(token)
    assert token != original
    assert decrypt_str(token) == original


def test_decrypt_passes_through_legacy_plaintext():
    legacy = "Esto NO empieza con gAAAA — datos viejos"
    assert decrypt_str(legacy) == legacy


def test_decrypt_handles_corrupted_token_gracefully():
    # Empieza con prefijo Fernet pero el resto es basura
    fake = "gAAAA_" + "x" * 100
    # Devuelve el ciphertext as-is con un warning en log (no crashea)
    assert decrypt_str(fake) == fake


def test_medical_record_persists_encrypted(client, db_session, patient, patient_headers):
    """Lo que se ve por el ORM debe ser plaintext; el SQL crudo debe mostrar token."""
    r = client.put(
        "/api/me/medical-record",
        json={"allergies": "Penicilina", "chronic_conditions": "Hipertensión"},
        headers=patient_headers,
    )
    assert r.status_code == 200
    assert r.json()["allergies"] == "Penicilina"
    assert r.json()["chronic_conditions"] == "Hipertensión"

    # SQL crudo: los campos están encriptados
    raw = db_session.execute(text(
        "SELECT allergies, chronic_conditions FROM medical_records WHERE patient_id = :pid"
    ), {"pid": patient.id}).fetchone()
    assert raw[0] is not None and raw[0].startswith("gAAAA")
    assert raw[1] is not None and raw[1].startswith("gAAAA")


def test_medical_record_reads_back_plaintext_via_orm(client, db_session, patient, patient_headers):
    client.put(
        "/api/me/medical-record",
        json={"medications": "Sertralina 50mg/día"},
        headers=patient_headers,
    )
    # Releer via ORM — debe venir desencriptado
    rec = db_session.query(MedicalRecord).filter(MedicalRecord.patient_id == patient.id).first()
    assert rec.medications == "Sertralina 50mg/día"


def test_patient_note_encrypted_at_rest(client, db_session, doctor, patient):
    """El doctor escribe una nota; verificamos que el SQL crudo está encriptado."""
    from app.core.security import get_password_hash
    # Login del doctor (creado en la fixture pero sin headers; armo headers a mano).
    r = client.post("/api/auth/login", json={"email": "doc@test.cl", "password": "doc123"})
    assert r.status_code == 200, r.text
    doc_headers = {"Authorization": f"Bearer {r.json()['access_token']}"}

    r = client.put(
        f"/api/patient-notes/{patient.id}",
        json={"content": "Paciente refiere ansiedad social — recomendar exposición gradual."},
        headers=doc_headers,
    )
    assert r.status_code == 200, r.text
    assert "ansiedad social" in r.json()["content"]

    # SQL crudo
    raw = db_session.execute(text(
        "SELECT content FROM patient_notes WHERE patient_id = :pid"
    ), {"pid": patient.id}).fetchone()
    assert raw[0].startswith("gAAAA")


def test_legacy_row_still_readable_after_schema_change(client, db_session, patient, patient_headers):
    """Simula una fila pre-encriptación: insertamos plaintext directo y verificamos
    que el ORM lo lee sin romperse (devuelve as-is)."""
    db_session.execute(text(
        "INSERT INTO medical_records (patient_id, allergies, notes) VALUES (:pid, :a, :n)"
    ), {"pid": patient.id, "a": "Latex", "n": "Datos pre-migración"})
    db_session.commit()

    r = client.get("/api/me/medical-record", headers=patient_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["allergies"] == "Latex"
    assert body["notes"] == "Datos pre-migración"


def test_null_values_remain_null(client, db_session, patient, patient_headers):
    r = client.get("/api/me/medical-record", headers=patient_headers)
    body = r.json()
    # Sin guardar nada, los campos opcionales deben venir None/null
    assert body.get("allergies") in (None, "")
