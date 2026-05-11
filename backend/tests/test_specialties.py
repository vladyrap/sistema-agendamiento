def test_list_specialties_is_public(client, specialty):
    r = client.get("/api/specialties/")
    assert r.status_code == 200
    names = [s["name"] for s in r.json()]
    assert specialty.name in names


def test_patient_cannot_create_specialty(client, patient_headers):
    r = client.post(
        "/api/specialties/",
        json={"name": "Cardiología"},
        headers=patient_headers,
    )
    assert r.status_code == 403


def test_admin_creates_specialty(client, admin_headers):
    r = client.post(
        "/api/specialties/",
        json={"name": "Pediatría", "description": "Niños"},
        headers=admin_headers,
    )
    assert r.status_code == 201
    assert r.json()["name"] == "Pediatría"


def test_admin_deactivate_specialty(client, admin_headers, specialty):
    r = client.delete(f"/api/specialties/{specialty.id}", headers=admin_headers)
    assert r.status_code == 204
    listed = client.get("/api/specialties/").json()
    assert all(s["id"] != specialty.id for s in listed)
