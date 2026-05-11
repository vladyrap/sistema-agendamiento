#!/bin/sh
# Restaura un backup encriptado al Postgres del entorno actual.
# Uso:
#   restore.sh <ruta_al_archivo.sql.gz.enc>
#
# Si necesitas restaurar desde B2:
#   rclone --config /tmp/rclone.conf copy "b2:${B2_BUCKET}/agendamiento/agendamiento-XXX.sql.gz.enc" /backups
#   restore.sh /backups/agendamiento-XXX.sql.gz.enc
#
# DESTRUCTIVO: hace TRUNCATE/DROP de las tablas existentes en el destino.
set -eu

if [ -z "${1:-}" ]; then
    echo "Uso: restore.sh <archivo.sql.gz.enc>"
    exit 1
fi

FILE="$1"
if [ ! -f "${FILE}" ]; then
    echo "Archivo no encontrado: ${FILE}"
    exit 1
fi

if [ -z "${BACKUP_PASSPHRASE:-}" ]; then
    echo "ERROR: BACKUP_PASSPHRASE no definida"
    exit 1
fi

echo "[restore] Restaurando desde ${FILE}"
echo "[restore] Destino: ${POSTGRES_USER}@${POSTGRES_HOST}/${POSTGRES_DB}"

openssl enc -d -aes-256-cbc -salt -pbkdf2 -iter 100000 -pass env:BACKUP_PASSPHRASE -in "${FILE}" \
  | gunzip \
  | PGPASSWORD="${POSTGRES_PASSWORD}" psql \
        --host="${POSTGRES_HOST}" \
        --username="${POSTGRES_USER}" \
        --dbname="${POSTGRES_DB}" \
        --set ON_ERROR_STOP=1

echo "[restore] OK"
