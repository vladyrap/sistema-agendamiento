#!/bin/sh
# Configura rclone con credenciales de B2 (si están), arma el cron y arranca crond.
set -eu

mkdir -p /tmp /var/log
cat > /tmp/rclone.conf <<EOF
[b2]
type = b2
account = ${B2_KEY_ID:-}
key = ${B2_APPLICATION_KEY:-}
EOF

SCHEDULE="${BACKUP_SCHEDULE:-0 3 * * *}"

# Exportar variables de entorno al cron (cron no las hereda en busybox).
mkdir -p /etc/crontabs
{
    env | grep -E "^(POSTGRES_|BACKUP_|B2_|LOCAL_)" | while IFS= read -r line; do
        printf 'export %s\n' "$line"
    done
} > /etc/profile.d/backup-env.sh

cat > /etc/crontabs/root <<EOF
${SCHEDULE} . /etc/profile.d/backup-env.sh; /usr/local/bin/backup.sh >> /var/log/backup.log 2>&1
EOF

echo "[entrypoint] Backup container listo"
echo "[entrypoint]   Schedule: ${SCHEDULE}"
echo "[entrypoint]   B2 enabled: $([ -n "${B2_KEY_ID:-}" ] && echo yes || echo no)"
echo "[entrypoint]   Local retention: ${LOCAL_RETENTION_DAYS:-7}d"
echo "[entrypoint]   Remote retention: ${BACKUP_RETENTION_DAYS:-30}d"
echo "[entrypoint] Trigger manual: docker compose exec backup /usr/local/bin/backup.sh"

touch /var/log/backup.log
crond -f -l 8 &
CRON_PID=$!
tail -F /var/log/backup.log &
wait $CRON_PID
