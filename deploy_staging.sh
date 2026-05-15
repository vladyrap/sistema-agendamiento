#!/usr/bin/env bash
# Deploy del stack STAGING — paralelo a prod en el mismo VPS.
#
# Pre-requisitos:
#   1) Stack de prod corriendo (la red miespejo_prod debe existir).
#   2) DNS de staging.miespejo.cl apuntando a la IP del VPS.
#   3) Variable STAGING_DOMAIN seteada en .env.prod (para que el Caddy de prod
#      la sirva). Tras setearla, redeploy de prod (bash deploy.sh) para que
#      Caddy recargue.
#   4) Archivo .env.staging con la config del stack staging (db separada,
#      SECRET_KEY distinta, Twilio/MP en sandbox).
#
# Uso (en el VPS, dentro del directorio del proyecto):
#   sudo bash deploy_staging.sh

set -euo pipefail

cd "$(dirname "$0")"

PROJECT_NAME="miespejo-staging"
COMPOSE="docker compose -f docker-compose.staging.yml --env-file .env.staging -p ${PROJECT_NAME}"

echo "▶ 1/5  Verificando que la red miespejo_prod exista..."
if ! docker network inspect miespejo_prod >/dev/null 2>&1; then
    echo "  ERROR: la red 'miespejo_prod' no existe. Levantá primero el stack de prod"
    echo "         con 'bash deploy.sh'."
    exit 1
fi

echo
echo "▶ 2/5  Preparando .env.staging..."
if [ ! -f .env.staging ]; then
    cp .env.staging.example .env.staging
    echo "  Creado .env.staging desde el ejemplo. Editalo y volvé a correr."
    echo "  Importante: usar SECRETS distintos a prod (SECRET_KEY, POSTGRES_PASSWORD)."
    exit 0
fi

# shellcheck disable=SC1091
set -a; . ./.env.staging; set +a

# Helper idéntico al de deploy.sh — auto-rellena secretos vacíos.
ensure_secret() {
    local key="$1" generator="$2"
    if ! grep -q "^${key}=" .env.staging; then
        printf '%s=%s\n' "${key}" "$(eval "${generator}")" >> .env.staging
        return
    fi
    local current
    current=$(grep "^${key}=" .env.staging | head -1 | cut -d= -f2-)
    if [ -z "${current}" ]; then
        sed -i "s|^${key}=.*|${key}=$(eval "${generator}")|" .env.staging
    fi
}

ensure_secret SECRET_KEY        'openssl rand -hex 32'
ensure_secret POSTGRES_PASSWORD 'openssl rand -hex 16'

set -a; . ./.env.staging; set +a

echo
echo "▶ 3/5  Build + up del stack staging..."
${COMPOSE} up -d --build

echo
echo "▶ 4/5  Esperando backend-staging..."
for i in $(seq 1 60); do
    if ${COMPOSE} exec -T backend-staging python -c \
        "import urllib.request; urllib.request.urlopen('http://localhost:8000/health').read()" \
        >/dev/null 2>&1; then
        echo "  Backend staging OK."
        break
    fi
    sleep 2
done

echo
echo "▶ 5/5  Estado:"
${COMPOSE} ps

echo
echo "════════════════════════════════════════════════════════════════"
echo " ✔ Staging desplegado"
echo "════════════════════════════════════════════════════════════════"
echo " URL pública:  https://${STAGING_DOMAIN_HOST}/"
echo
echo " Próximos pasos opcionales:"
echo "   - Sembrar staging con datos anonimizados de prod:"
echo "       sudo bash clone_anonymize_to_staging.sh"
echo "   - O sembrar con dummies:"
echo "       ${COMPOSE} exec -T backend-staging python seed.py"
echo "════════════════════════════════════════════════════════════════"
