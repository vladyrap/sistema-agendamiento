#!/bin/sh
# Realiza un backup encriptado de Postgres y lo sube a Backblaze B2 (si está configurado).
# Variables esperadas en el entorno:
#   POSTGRES_HOST, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
#   BACKUP_PASSPHRASE (obligatoria)
#   B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET (opcionales — si vacíos, solo backup local)
#   BACKUP_RETENTION_DAYS (default 30, aplica a la copia remota)
set -eu

LOCAL_RETENTION_DAYS=${LOCAL_RETENTION_DAYS:-7}
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}

if [ -z "${BACKUP_PASSPHRASE:-}" ]; then
    echo "[backup] ERROR: BACKUP_PASSPHRASE no definida. Abortando."
    exit 1
fi

TS=$(date -u +%Y%m%dT%H%M%SZ)
DUMP_FILE="/backups/agendamiento-${TS}.sql.gz.enc"
mkdir -p /backups

echo "[backup] $(date -u +%Y-%m-%dT%H:%M:%SZ) iniciando dump → ${DUMP_FILE}"

PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
    --host="${POSTGRES_HOST}" \
    --username="${POSTGRES_USER}" \
    --no-owner --no-privileges \
    "${POSTGRES_DB}" \
  | gzip -9 \
  | openssl enc -aes-256-cbc -salt -pbkdf2 -iter 100000 -pass env:BACKUP_PASSPHRASE \
  > "${DUMP_FILE}"

SIZE=$(stat -c%s "${DUMP_FILE}" 2>/dev/null || stat -f%z "${DUMP_FILE}")
echo "[backup] dump local OK · ${SIZE} bytes"

# ── Upload a B2 ───────────────────────────────────────────────────────────
if [ -n "${B2_KEY_ID:-}" ] && [ -n "${B2_APPLICATION_KEY:-}" ] && [ -n "${B2_BUCKET:-}" ]; then
    echo "[backup] subiendo a B2 (${B2_BUCKET})"
    rclone --config /tmp/rclone.conf copy "${DUMP_FILE}" "b2:${B2_BUCKET}/agendamiento/" \
        --transfers=2 --no-traverse
    echo "[backup] subida OK"

    echo "[backup] limpiando remotos > ${RETENTION_DAYS}d en B2"
    rclone --config /tmp/rclone.conf delete "b2:${B2_BUCKET}/agendamiento/" \
        --min-age "${RETENTION_DAYS}d" || true
else
    echo "[backup] B2 no configurado — backup queda solo en volumen local"
fi

# ── Limpieza local ────────────────────────────────────────────────────────
echo "[backup] limpiando locales > ${LOCAL_RETENTION_DAYS}d"
find /backups -name "agendamiento-*.sql.gz.enc" -type f -mtime "+${LOCAL_RETENTION_DAYS}" -delete

echo "[backup] DONE"
