#!/bin/sh
# Verifica que el último backup encriptado se puede restaurar y trae datos válidos.
#
# Lo hace en una DB temporal del mismo Postgres (CREATE DATABASE backup_verify_<ts>)
# para NO tocar la base productiva. Si todo va bien, dropea la DB y notifica OK;
# si algo falla, deja la DB intacta para diagnóstico manual y notifica FAIL.
#
# Variables esperadas:
#   POSTGRES_HOST, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
#   BACKUP_PASSPHRASE
#   BACKUP_VERIFY_MAX_AGE_HOURS (default 26h: tolera retraso del cron diario)
#   BACKUP_VERIFY_MIN_USERS (default 1)
#   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM (opcionales)
#   BACKUP_VERIFY_NOTIFY_TO (whatsapp:+569XXXXXXXX, opcional)
set -u

MAX_AGE_HOURS=${BACKUP_VERIFY_MAX_AGE_HOURS:-26}
MIN_USERS=${BACKUP_VERIFY_MIN_USERS:-1}

log() { echo "[verify] $(date -u +%Y-%m-%dT%H:%M:%SZ) $*"; }

# ── Notificación WhatsApp via Twilio (silenciosa si no configurada) ───────
notify() {
    status="$1"   # OK | FAIL
    body="$2"
    if [ -z "${TWILIO_ACCOUNT_SID:-}" ] || [ -z "${TWILIO_AUTH_TOKEN:-}" ] \
       || [ -z "${TWILIO_WHATSAPP_FROM:-}" ] || [ -z "${BACKUP_VERIFY_NOTIFY_TO:-}" ]; then
        log "Twilio no configurado, omitiendo notificación (${status})"
        return 0
    fi
    msg="🔐 Backup verify ${status}
${body}"
    curl --max-time 15 -sS -X POST \
        "https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json" \
        -u "${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}" \
        --data-urlencode "From=${TWILIO_WHATSAPP_FROM}" \
        --data-urlencode "To=${BACKUP_VERIFY_NOTIFY_TO}" \
        --data-urlencode "Body=${msg}" \
        > /dev/null || log "WARN: notificación Twilio falló (status ${status} se reportó solo a log)"
}

fail() {
    log "FAIL: $*"
    notify "FAIL" "$*"
    # NO dropeamos la DB de verify en caso de fallo: queda para diagnóstico.
    exit 1
}

# ── Ubicar último backup local ────────────────────────────────────────────
LATEST=$(ls -1t /backups/agendamiento-*.sql.gz.enc 2>/dev/null | head -n 1 || true)
if [ -z "$LATEST" ]; then
    fail "No hay archivos /backups/agendamiento-*.sql.gz.enc"
fi

log "Último backup: $LATEST"

# Edad del archivo en horas (max_age_hours)
NOW=$(date -u +%s)
MTIME=$(stat -c%Y "$LATEST" 2>/dev/null || stat -f%m "$LATEST")
AGE_HOURS=$(( (NOW - MTIME) / 3600 ))
log "Edad: ${AGE_HOURS}h (max ${MAX_AGE_HOURS}h)"
if [ "$AGE_HOURS" -gt "$MAX_AGE_HOURS" ]; then
    fail "Backup más viejo (${AGE_HOURS}h) que el umbral (${MAX_AGE_HOURS}h) — backup.sh está fallando o no corre"
fi

# Tamaño no-vacío
SIZE=$(stat -c%s "$LATEST" 2>/dev/null || stat -f%z "$LATEST")
log "Tamaño: ${SIZE} bytes"
if [ "$SIZE" -lt 1024 ]; then
    fail "Archivo demasiado chico (${SIZE}b) — backup corrupto"
fi

# ── Decrypt + smoke check del SQL ─────────────────────────────────────────
TMP_SQL="/tmp/verify-$$.sql"
trap 'rm -f "$TMP_SQL"' EXIT

if ! openssl enc -d -aes-256-cbc -salt -pbkdf2 -iter 100000 \
        -pass env:BACKUP_PASSPHRASE -in "$LATEST" 2>/dev/null \
     | gunzip > "$TMP_SQL"; then
    fail "No se pudo descifrar/descomprimir — passphrase incorrecta o archivo corrupto"
fi

SQL_SIZE=$(stat -c%s "$TMP_SQL" 2>/dev/null || stat -f%z "$TMP_SQL")
log "SQL desencriptado: ${SQL_SIZE} bytes"
if [ "$SQL_SIZE" -lt 1024 ]; then
    fail "SQL desencriptado vacío (${SQL_SIZE}b)"
fi
# Debe haber al menos una CREATE TABLE
if ! grep -q "CREATE TABLE" "$TMP_SQL"; then
    fail "SQL no contiene 'CREATE TABLE' — dump inválido"
fi

# ── Restaurar a DB temporal y validar contenido ───────────────────────────
TS=$(date -u +%Y%m%d%H%M%S)
VERIFY_DB="backup_verify_${TS}"
export PGPASSWORD="${POSTGRES_PASSWORD}"
PSQL="psql --host=${POSTGRES_HOST} --username=${POSTGRES_USER} -v ON_ERROR_STOP=1 --quiet --no-psqlrc"

log "Creando DB temporal ${VERIFY_DB}"
if ! $PSQL --dbname=postgres -c "CREATE DATABASE \"${VERIFY_DB}\";"; then
    fail "No se pudo crear DB temporal ${VERIFY_DB}"
fi

# Cleanup de DB temporal SOLO si el restore es OK. Si falla la dejamos para inspección manual.
cleanup_verify_db() {
    $PSQL --dbname=postgres -c "DROP DATABASE IF EXISTS \"${VERIFY_DB}\";" > /dev/null 2>&1 || true
}

log "Restaurando dump en ${VERIFY_DB}…"
if ! $PSQL --dbname="${VERIFY_DB}" -f "$TMP_SQL" > /tmp/verify-restore-$$.log 2>&1; then
    log "Restore falló — primeras líneas de error:"
    head -20 /tmp/verify-restore-$$.log | sed 's/^/  /'
    fail "Restore falló sobre ${VERIFY_DB} (DB conservada para diagnóstico)"
fi
rm -f /tmp/verify-restore-$$.log

# ── Smoke queries ─────────────────────────────────────────────────────────
count_query() {
    table="$1"
    $PSQL --dbname="${VERIFY_DB}" -tA -c "SELECT COUNT(*) FROM ${table};" 2>/dev/null || echo "-1"
}

USERS=$(count_query users)
APPTS=$(count_query appointments)
SPECS=$(count_query specialties)
LAST_APPT=$($PSQL --dbname="${VERIFY_DB}" -tA -c \
    "SELECT MAX(appointment_date)::text FROM appointments;" 2>/dev/null || echo "")

log "users=${USERS}  appointments=${APPTS}  specialties=${SPECS}  last_appt=${LAST_APPT:-<vacio>}"

if [ "$USERS" -lt "$MIN_USERS" ]; then
    cleanup_verify_db
    fail "Tabla users tiene ${USERS} filas (min esperado ${MIN_USERS})"
fi
if [ "$SPECS" -lt 1 ]; then
    cleanup_verify_db
    fail "Tabla specialties vacía — restore parece incompleto"
fi
if [ "$APPTS" -lt 0 ]; then
    cleanup_verify_db
    fail "Tabla appointments no existe en el restore"
fi

# ── OK ────────────────────────────────────────────────────────────────────
cleanup_verify_db
SIZE_MB=$(( SIZE / 1024 / 1024 ))
notify "OK" "Archivo: $(basename "$LATEST")
Edad: ${AGE_HOURS}h · ${SIZE_MB}MB
users=${USERS} appointments=${APPTS} specs=${SPECS}
last_appt=${LAST_APPT:-<sin citas>}"
log "DONE — backup verificado OK"
