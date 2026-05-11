def test_register_creates_patient(client):
    r = client.post(
        "/api/auth/register",
        json={
            "email": "new@test.cl",
            "password": "secret123",
            "first_name": "New",
            "last_name": "User",
        },
    )
    assert r.status_code == 201
    body = r.json()
    assert body["email"] == "new@test.cl"
    assert body["role"] == "patient"
    assert "password_hash" not in body


def test_register_duplicate_email_rejected(client, patient):
    r = client.post(
        "/api/auth/register",
        json={
            "email": patient.email,
            "password": "x" * 8,
            "first_name": "Other",
            "last_name": "Name",
        },
    )
    assert r.status_code == 400


def test_login_success(client, patient):
    r = client.post(
        "/api/auth/login",
        json={"email": patient.email, "password": "secret123"},
    )
    assert r.status_code == 200
    assert r.json()["token_type"] == "bearer"
    assert r.json()["user"]["email"] == patient.email


def test_login_wrong_password(client, patient):
    r = client.post(
        "/api/auth/login",
        json={"email": patient.email, "password": "wrong"},
    )
    assert r.status_code == 401


def test_me_requires_token(client):
    r = client.get("/api/auth/me")
    assert r.status_code == 401


def test_me_returns_current_user(client, patient, patient_headers):
    r = client.get("/api/auth/me", headers=patient_headers)
    assert r.status_code == 200
    assert r.json()["id"] == patient.id


def test_inactive_user_cannot_login(client, db_session, patient):
    patient.is_active = False
    db_session.commit()
    r = client.post(
        "/api/auth/login",
        json={"email": patient.email, "password": "secret123"},
    )
    assert r.status_code == 403
