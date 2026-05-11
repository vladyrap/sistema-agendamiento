# 🏥 Sistema de Agendamiento Clínico

Plataforma integral para la gestión, reserva y administración de citas médicas. Maneja múltiples especialistas, especialidades y horarios, con notificaciones asíncronas, métricas, logs centralizados y una arquitectura dockerizada.

---

## 🏗️ Arquitectura

Tres frontends sobre una API central:

1. **🧑‍💻 Paciente** — busca especialistas, ve horarios disponibles, agenda/cancela citas, recibe notificaciones.
2. **🩺 Médico** — gestiona disponibilidad por día, ve agenda, confirma y completa citas.
3. **⚙️ Admin** — usuarios, especialidades, métricas globales.

---

## 🛠️ Stack

| Componente | Tecnología |
| :--- | :--- |
| API | FastAPI (Python 3.11) + SQLAlchemy + Alembic + JWT |
| DB | PostgreSQL 16 |
| Cache / cola | Redis 7 (cache de slots + cola de notificaciones) |
| Worker | Proceso separado consumiendo de Redis (envío SMTP) |
| Frontend | React 18 + Vite + React Router + Axios |
| Métricas | Prometheus + Grafana (dashboard provisionado) |
| Logs | ELK (Elasticsearch + Logstash + Kibana) — JSON estructurado vía TCP |
| Tests | pytest + fakeredis + SQLite en memoria |

---

## 🚀 Despliegue

### Prerrequisitos
- Docker 24+ y Docker Compose v2
- Recomendado: 4 GB RAM disponibles para el stack completo (ELK pesa)

### Variables de entorno
Copia `.env.example` a `.env` en la raíz. Las claves opcionales (`SMTP_*`, `LOGSTASH_*`) pueden quedar vacías para desarrollo: las notificaciones se loguean en consola y los logs se quedan en stdout.

### Levantar todo
```bash
docker compose up -d
docker compose exec backend python seed.py
```

Datos de prueba:
- Admin: `admin@clinica.cl` / `admin123`
- Médico: `dr.garcia@clinica.cl` / `doctor123`
- Paciente: `paciente@ejemplo.cl` / `paciente123`

### Servicios y puertos

| URL | Servicio |
| :--- | :--- |
| http://localhost:6500 | Frontend (Vite dev server) |
| http://localhost:6501/api/docs | API + Swagger |
| http://localhost:6501/metrics | Endpoint Prometheus |
| http://localhost:9090 | Prometheus UI |
| http://localhost:3001 | Grafana (admin / admin) |
| http://localhost:5601 | Kibana |
| http://localhost:9200 | Elasticsearch |
| localhost:6502 | Postgres |
| localhost:6503 | Redis |
| localhost:5044 | Logstash TCP input (json_lines) |

---

## 🔔 Notificaciones

El servicio `backend` empuja eventos (`appointment_created`, `appointment_cancelled`, `appointment_confirmed`) a la cola `notifications:queue` en Redis. El servicio `worker` (mismo image, comando `python -m app.worker`) los consume y envía emails SMTP.

Si `SMTP_HOST` está vacío, el worker registra el contenido del email en logs sin enviarlo — útil para desarrollo.

Los contadores `notifications_enqueued_total` y `notifications_processed_total` están expuestos en Prometheus.

---

## 📊 Observabilidad

### Métricas (Grafana)
Dashboard auto-provisionado en `Agendamiento → Agendamiento Clínico — Overview`. Incluye:
- Rate y latencia p95 por endpoint
- Citas creadas / canceladas / completadas
- Notificaciones procesadas por tipo y outcome
- Latencia del cálculo de slots (`slot_lookup_seconds`)

Métricas custom definidas en [backend/app/core/metrics.py](backend/app/core/metrics.py).

### Logs (Kibana)
El backend emite logs JSON a stdout y los reenvía por TCP a Logstash en `logstash:5000`. Logstash los indexa en Elasticsearch como `agendamiento-YYYY.MM.DD`. En Kibana, crea un data view con patrón `agendamiento-*` para explorarlos.

---

## 🧪 Tests

Suite pytest cubriendo auth, autorización por rol, agendamiento, conflictos de horario, slots, cancelación y enqueue de notificaciones.

```bash
docker compose run --rm backend sh -c "pip install -r requirements-dev.txt && pytest -v"
```

Los tests usan SQLite en memoria + `fakeredis`, así que **no requieren** Postgres ni Redis levantados.

---

## 📁 Layout

```
backend/
  app/
    api/routes/          # FastAPI routers
    core/                # config, db, security, metrics, logging
    models/              # SQLAlchemy models
    schemas/             # Pydantic schemas
    services/            # notifications enqueue
    main.py              # FastAPI app
    worker.py            # notification worker (long-running)
  tests/                 # pytest suite
  seed.py
frontend/
  src/{pages,components,context,services}/
infra/
  prometheus/            # prometheus.yml
  grafana/               # provisioning + dashboards
  logstash/              # pipeline + config
docker-compose.yml
```
