"""Wave 2: 2FA TOTP + logout (JWT blocklist)."""
import pyotp


def _login(client, email, password, totp=None):
    body = {"email": email, "password": password}
    if totp:
        body["totp_code"] = totp
    return client.post("/api/auth/login", json=body)


def _bearer(client, email, password, totp=None):
    r = _login(client, email, password, totp)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


# ─── 2FA setup ─────────────────────────────────────────────

def test_totp_setup_returns_secret_qr_and_otpauth_url(client, patient, patient_headers):
    r = client.post("/api/auth/2fa/setup", headers=patient_headers)
    assert r.status_code == 200
    body = r.json()
    assert "secret" in body and len(body["secret"]) >= 16
    assert body["otpauth_url"].startswith("otpauth://totp/")
    assert body["qr_data_url"].startswith("data:image/png;base64,")


def test_totp_setup_doesnt_enable_until_verified(client, db_session, patient, patient_headers):
    client.post("/api/auth/2fa/setup", headers=patient_headers)
    db_session.refresh(patient)
    assert patient.totp_secret is not None
    assert patient.totp_enabled is False


def test_totp_verify_with_correct_code_activates(client, db_session, patient, patient_headers):
    setup = client.post("/api/auth/2fa/setup", headers=patient_headers).json()
    code = pyotp.TOTP(setup["secret"]).now()
    r = client.post("/api/auth/2fa/verify", json={"code": code}, headers=patient_headers)
    assert r.status_code == 200
    assert r.json()["totp_enabled"] is True
    db_session.refresh(patient)
    assert patient.totp_enabled is True


def test_totp_verify_with_wrong_code_rejected(client, patient, patient_headers):
    client.post("/api/auth/2fa/setup", headers=patient_headers)
    r = client.post("/api/auth/2fa/verify", json={"code": "000000"}, headers=patient_headers)
    assert r.status_code == 400


def test_totp_disable_requires_current_code(client, db_session, patient, patient_headers):
    setup = client.post("/api/auth/2fa/setup", headers=patient_headers).json()
    code = pyotp.TOTP(setup["secret"]).now()
    client.post("/api/auth/2fa/verify", json={"code": code}, headers=patient_headers)

    # disable con código inválido falla
    r = client.post("/api/auth/2fa/disable", json={"code": "000000"}, headers=patient_headers)
    assert r.status_code == 400

    # con el código correcto desactiva
    code2 = pyotp.TOTP(setup["secret"]).now()
    r = client.post("/api/auth/2fa/disable", json={"code": code2}, headers=patient_headers)
    assert r.status_code == 200
    assert r.json()["totp_enabled"] is False


# ─── Login con 2FA ─────────────────────────────────────────

def test_login_without_totp_returns_totp_required_when_enabled(client, db_session, patient, patient_headers):
    setup = client.post("/api/auth/2fa/setup", headers=patient_headers).json()
    code = pyotp.TOTP(setup["secret"]).now()
    client.post("/api/auth/2fa/verify", json={"code": code}, headers=patient_headers)

    r = client.post("/api/auth/login", json={"email": patient.email, "password": "secret123"})
    assert r.status_code == 401
    assert r.json()["detail"] == "totp_required"


def test_login_with_correct_totp_succeeds(client, db_session, patient, patient_headers):
    setup = client.post("/api/auth/2fa/setup", headers=patient_headers).json()
    code = pyotp.TOTP(setup["secret"]).now()
    client.post("/api/auth/2fa/verify", json={"code": code}, headers=patient_headers)

    fresh_code = pyotp.TOTP(setup["secret"]).now()
    r = _login(client, patient.email, "secret123", totp=fresh_code)
    assert r.status_code == 200


def test_login_with_invalid_totp_rejected(client, patient, patient_headers):
    setup = client.post("/api/auth/2fa/setup", headers=patient_headers).json()
    code = pyotp.TOTP(setup["secret"]).now()
    client.post("/api/auth/2fa/verify", json={"code": code}, headers=patient_headers)

    r = _login(client, patient.email, "secret123", totp="000000")
    assert r.status_code == 401
    assert r.json()["detail"] != "totp_required"


# ─── Logout / JWT blocklist ────────────────────────────────

def test_logout_revokes_current_token(client, patient):
    headers = _bearer(client, "paciente@test.cl", "secret123")
    # Token funciona
    assert client.get("/api/auth/me", headers=headers).status_code == 200

    r = client.post("/api/auth/logout", headers=headers)
    assert r.status_code == 204

    # Mismo token ya no debe servir
    assert client.get("/api/auth/me", headers=headers).status_code == 401


def test_logout_doesnt_affect_other_active_tokens(client, patient):
    h1 = _bearer(client, "paciente@test.cl", "secret123")
    h2 = _bearer(client, "paciente@test.cl", "secret123")
    assert h1["Authorization"] != h2["Authorization"]  # JTI distinto por token

    client.post("/api/auth/logout", headers=h1)
    assert client.get("/api/auth/me", headers=h1).status_code == 401
    assert client.get("/api/auth/me", headers=h2).status_code == 200
