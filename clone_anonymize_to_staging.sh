#!/usr/bin/env bash
# Clona la DB de prod a staging y anonimiza datos personales.
#
# Pasos:
#   1) pg_dump del schema + data de prod (db) — no toca la DB productiva.
#   2) Restaura el dump dentro de la db-staging.
#   3) Corre un SQL que reemplaza emails, RUT, phones, nombres y campos
#      clínicos por placeholders. Passwords se hashean a "staging123".
#
# Importante:
# - Los campos clínicos encriptados (PatientNote.content, MedicalRecord.*, etc.)
#   se reemplazan por plaintext "[anon]". El TypeDecorator EncryptedText tolera
#   plaintext legacy: lo devuelve as-is al leer, y al primer UPDATE en la app
#   queda encriptado con la SECRET_KEY de staging.
# - Si querés que los campos queden encriptados con la key de staging desde el
#   primer momento, corré también:
#       docker compose -f docker-compose.staging.yml -p miespejo-staging \
#           exec backend-staging python encrypt_legacy_rows.py
#
# Uso (en el VPS):
#   sudo bash clone_anonymize_to_staging.sh

set -euo pipefail

cd "$(dirname "$0")"

PROD_COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.prod"
STAGING_COMPOSE="docker compose -f docker-compose.staging.yml --env-file .env.staging -p miespejo-staging"

# shellcheck disable=SC1091
set -a; . ./.env.prod; set +a
PROD_USER="${POSTGRES_USER}"; PROD_PASS="${POSTGRES_PASSWORD}"; PROD_DB="${POSTGRES_DB}"

# shellcheck disable=SC1091
set -a; . ./.env.staging; set +a
STAGING_USER="${POSTGRES_USER}"; STAGING_PASS="${POSTGRES_PASSWORD}"; STAGING_DB="${POSTGRES_DB}"

DUMP_FILE="/tmp/prod-clone-$(date +%Y%m%d-%H%M%S).sql"
echo "▶ 1/4  Dump de prod (no destructivo, read-only)..."
${PROD_COMPOSE} exec -T -e PGPASSWORD="${PROD_PASS}" db \
    pg_dump --username="${PROD_USER}" --no-owner --no-privileges --clean --if-exists \
            "${PROD_DB}" > "${DUMP_FILE}"
echo "  Dump: ${DUMP_FILE} ($(wc -l < "${DUMP_FILE}") líneas)"

echo
echo "▶ 2/4  Wipe DB staging y restaurar dump..."
${STAGING_COMPOSE} exec -T -e PGPASSWORD="${STAGING_PASS}" db-staging \
    psql --username="${STAGING_USER}" --dbname="${STAGING_DB}" -c \
    "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

${STAGING_COMPOSE} exec -T -e PGPASSWORD="${STAGING_PASS}" db-staging \
    psql --username="${STAGING_USER}" --dbname="${STAGING_DB}" \
    --set ON_ERROR_STOP=1 < "${DUMP_FILE}"

echo
echo "▶ 3/4  Anonimizando datos personales..."
# Hash bcrypt pre-calculado para password "staging123".
STAGING_HASH='$2b$12$Wgs/0FySm6OPOd3lp/yp/.aDpf2c2gK06P3p7vbRkRChiBP1HrJby'

${STAGING_COMPOSE} exec -T -e PGPASSWORD="${STAGING_PASS}" db-staging \
    psql --username="${STAGING_USER}" --dbname="${STAGING_DB}" \
    --set ON_ERROR_STOP=1 --set anon_hash="${STAGING_HASH}" <<'SQL'
BEGIN;

-- Users: PII reemplazada. Mantenemos role e is_active porque la app los usa.
UPDATE users SET
    email = 'user' || id || '@staging.miespejo.cl',
    first_name = CASE role
        WHEN 'admin'         THEN 'Admin'
        WHEN 'doctor'        THEN 'Ps. Test'
        WHEN 'receptionist'  THEN 'Recepcion'
        WHEN 'company_admin' THEN 'Empresa'
        WHEN 'consultant'    THEN 'Consultor'
        WHEN 'tutor'         THEN 'Tutor'
        ELSE                       'Paciente'
    END,
    last_name = 'Staging-' || id,
    phone = '+56900000000',
    rut = NULL,
    address = NULL,
    health_insurance = NULL,
    photo_url = NULL,
    password_hash = :'anon_hash',
    totp_secret = NULL,
    totp_enabled = FALSE;

-- Fichas y notas clínicas: contenido reemplazado por placeholder. El
-- TypeDecorator EncryptedText tolera plaintext legacy. Si se quiere volver
-- a encriptar, correr encrypt_legacy_rows.py en el container backend-staging.
UPDATE medical_records SET
    allergies = '[anon]',
    chronic_conditions = '[anon]',
    medications = '[anon]',
    notes = '[anon]',
    emergency_contact_name = 'Contacto Test',
    emergency_contact_phone = '+56900000000';

UPDATE patient_notes SET content = '[anon]';

UPDATE session_logs SET
    diagnosis = '[anon]',
    evolution = '[anon]',
    observations = '[anon]',
    indications = '[anon]',
    treatment = '[anon]',
    medications = '[anon]',
    next_steps = '[anon]',
    emotional_state = '[anon]',
    topics_discussed = '[anon]',
    therapeutic_goals = '[anon]',
    progress_notes = '[anon]',
    homework = '[anon]';

-- Pagos y boletas: cambiar montos reales por sandbox (mantenemos status para
-- testear flujos).
UPDATE payments SET external_id = NULL, payer_email = 'payer@staging.miespejo.cl';

-- Adjuntos: limpiamos el storage_path para no apuntar a archivos reales.
-- El archivo físico no existe en el volumen de staging, así que los downloads
-- darán 410 — esto es OK para staging.
UPDATE medical_attachments SET storage_path = '/anon/' || id, file_name = 'anon-' || id;

-- Auditoría: empezamos limpio.
DELETE FROM access_audit_logs;

-- Notas de sitio público y empresas también pueden tener emails/teléfonos —
-- los normalizamos por las dudas.
UPDATE companies SET
    billing_email = 'billing-' || id || '@staging.miespejo.cl',
    contact_phone = '+56900000000';

COMMIT;
SQL

rm -f "${DUMP_FILE}"

echo
echo "▶ 4/4  Listo."
echo "════════════════════════════════════════════════════════════════"
echo " ✔ Staging clonado y anonimizado"
echo "════════════════════════════════════════════════════════════════"
echo " Credenciales staging para CUALQUIER usuario:"
echo "   email: <user>@staging.miespejo.cl  →  ej. user1@..., user2@..."
echo "   password: staging123"
echo
echo " Re-encriptar campos clínicos con la SECRET_KEY de staging:"
echo "   ${STAGING_COMPOSE} exec backend-staging python encrypt_legacy_rows.py"
echo "════════════════════════════════════════════════════════════════"
