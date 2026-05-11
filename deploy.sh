#!/usr/bin/env bash
# Deploy script para Ubuntu 22.04/24.04. Idempotente: lo puedes correr varias veces.
# Uso (en el VPS, dentro del directorio del proyecto):
#   sudo bash deploy.sh

set -euo pipefail

cd "$(dirname "$0")"

echo "▶ 1/6  Verificando Docker..."
if ! command -v docker >/dev/null 2>&1; then
    echo "  Instalando Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable --now docker
else
    echo "  Docker $(docker --version) ya instalado."
fi

if ! docker compose version >/dev/null 2>&1; then
    echo "  ERROR: 'docker compose' (plugin v2) no está disponible. Instálalo manualmente."
    exit 1
fi

echo
echo "▶ 2/6  Preparando .env.prod..."
if [ ! -f .env.prod ]; then
    cp .env.prod.example .env.prod
    echo "  Creado .env.prod desde el ejemplo. Edítalo y vuelve a correr el script."
    echo "  Campos importantes: DOMAIN, DOMAIN_HOST, ACME_EMAIL, SMTP_*"
    exit 0
fi

# Cargar valores actuales (sin export, para inspeccionar y rellenar lo faltante)
# shellcheck disable=SC1091
set -a; . ./.env.prod; set +a

# Helper: garantiza que una variable secreta exista y tenga valor en .env.prod.
# Si la línea no existe → la agrega. Si existe pero vacía → la rellena.
# Si ya tiene valor → no la toca.
ensure_secret() {
    local key="$1" generator="$2"
    if ! grep -q "^${key}=" .env.prod; then
        echo "  Agregando ${key} (línea nueva)"
        printf '%s=%s\n' "${key}" "$(eval "${generator}")" >> .env.prod
        return
    fi
    local current
    current=$(grep "^${key}=" .env.prod | head -1 | cut -d= -f2-)
    if [ -z "${current}" ]; then
        echo "  Generando ${key}"
        sed -i "s|^${key}=.*|${key}=$(eval "${generator}")|" .env.prod
    fi
}

ensure_secret SECRET_KEY        'openssl rand -hex 32'
ensure_secret POSTGRES_PASSWORD 'openssl rand -hex 16'
ensure_secret GRAFANA_PASSWORD  'openssl rand -hex 12'
ensure_secret BACKUP_PASSPHRASE 'openssl rand -hex 32'

# Recargar tras eventuales cambios para que los pasos siguientes vean las nuevas variables.
set -a; . ./.env.prod; set +a

echo
echo "▶ 3/6  Build + up de los contenedores..."
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

echo
echo "▶ 4/6  Esperando a que el backend responda..."
for i in $(seq 1 60); do
    if docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T backend \
        python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health').read()" >/dev/null 2>&1; then
        echo "  Backend OK."
        break
    fi
    sleep 2
done

echo
echo "▶ 5/6  Seed de datos iniciales (si la BD está vacía)..."
docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T backend python seed.py || true

echo
echo "▶ 6/6  Estado final:"
docker compose -f docker-compose.prod.yml --env-file .env.prod ps

echo
echo "════════════════════════════════════════════════════════════════"
echo " ✔ Deploy completo"
echo "════════════════════════════════════════════════════════════════"
echo " Acceso público:  http(s)://${DOMAIN_HOST}/"
echo " Grafana (vía SSH tunnel):"
echo "   ssh -L 3000:grafana:3000 root@${DOMAIN_HOST}"
echo "   Usuario: ${GRAFANA_USER}    Password: \$(grep GRAFANA_PASSWORD .env.prod)"
echo
echo " Credenciales seed:"
echo "   admin@clinica.cl / admin123   ← cambia inmediatamente"
echo "   dr.garcia@clinica.cl / doctor123"
echo "   paciente@ejemplo.cl / paciente123"
echo "════════════════════════════════════════════════════════════════"
