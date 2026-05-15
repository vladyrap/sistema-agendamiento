# Staging environment

Stack paralelo a producción en el mismo VPS. Sirve dos propósitos:

1. **Smoke tests pre-deploy**: probar cambios contra una copia anonimizada de la DB de prod antes de tocar usuarios reales.
2. **Demo / sandbox**: link compartible (`staging.miespejo.cl`) con credenciales conocidas.

## Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│  Caddy (prod) — puerto 80/443                           │
│  ├─ miespejo.cl            → frontend (prod)            │
│  └─ staging.miespejo.cl    → frontend-staging           │
└─────────────────────────────────────────────────────────┘
        │                            │
┌───────────────┐            ┌───────────────────┐
│  Stack PROD   │            │  Stack STAGING    │
│  - db         │            │  - db-staging     │
│  - redis      │            │  - redis-staging  │
│  - backend    │            │  - backend-staging│
│  - worker     │            │  - worker-staging │
│  - frontend   │            │  - frontend-staging
│  - backup     │            │  (sin backup)     │
│  - prometheus │            │  (sin obs)        │
│  - grafana    │            │                   │
└───────────────┘            └───────────────────┘
        \_____ red docker compartida `miespejo_prod` _____/
```

El Caddy de prod sirve ambos hostnames. El stack staging se une a la red `miespejo_prod` (declarada con `external: true` en `docker-compose.staging.yml`). Cada stack tiene su propio Postgres, Redis y SECRET_KEY.

## Setup inicial (en el VPS, una sola vez)

```bash
# 1. DNS — apuntá staging.miespejo.cl a la IP del VPS (A record).

# 2. Avisarle al Caddy de prod que sirva el subdominio:
echo "STAGING_DOMAIN=staging.miespejo.cl" >> .env.prod
bash deploy.sh            # recarga Caddy

# 3. Configurar .env.staging:
cp .env.staging.example .env.staging
nano .env.staging         # opcional — los secrets se auto-generan

# 4. Levantar el stack staging:
bash deploy_staging.sh
```

## Sembrar con datos anonimizados de prod

```bash
sudo bash clone_anonymize_to_staging.sh
```

Reemplaza emails (`user{id}@staging.miespejo.cl`), nombres, RUT, teléfonos, fichas clínicas, notas privadas. Las contraseñas quedan todas en `staging123`.

Si querés que los campos clínicos queden encriptados con la SECRET_KEY de staging desde el primer momento:

```bash
docker compose -f docker-compose.staging.yml -p miespejo-staging \
    exec backend-staging python encrypt_legacy_rows.py
```

## Operaciones comunes

```bash
COMPOSE="docker compose -f docker-compose.staging.yml --env-file .env.staging -p miespejo-staging"

# Logs
$COMPOSE logs -f backend-staging
$COMPOSE logs -f worker-staging

# Restart después de un git pull
$COMPOSE up -d --build

# Tirar todo (datos + volúmenes) y empezar de cero
$COMPOSE down -v
bash deploy_staging.sh
```

## Cosas que NO se comparten con prod

- **Postgres**: `db-staging` es un container separado con su propio volumen `postgres_data_staging`.
- **Redis**: `redis-staging` separado — JWT blocklist y rate limits son independientes.
- **Uploads**: volumen `attachments_data_staging` separado.
- **SECRET_KEY**: distinta. La encripción at-rest depende de esto, así que los dumps de prod **no se descifran** en staging — por eso `clone_anonymize_to_staging.sh` los reemplaza por `[anon]`.

## Cosas que SÍ se comparten (cuidado)

- **Caddy de prod**: si lo tirás abajo (`down`), staging también deja de responder.
- **Twilio / MercadoPago real**: por default, staging usa credenciales SANDBOX (variables `STAGING_TWILIO_*`, `STAGING_MP_*`). NO mezcles con las productivas — usar el SID/token de sandbox.
- **Gemini quota**: si `STAGING_GEMINI_API_KEY` queda vacío, hereda la key de prod y consume su quota.

## Checks de salud

```bash
# Backend staging directo (no pasa por Caddy)
docker compose -f docker-compose.staging.yml -p miespejo-staging \
    exec backend-staging curl -s http://localhost:8000/health

# Via Caddy
curl https://staging.miespejo.cl/api/health
```
