# Facylitech App

Sistema de digitalización del trabajo en terreno de cuadrillas técnicas para
**Facylitech**, empresa de mantención de ascensores en Santiago de Chile.
Proyecto académico — Desafío Empresa II, Universidad del Desarrollo.
Equipo: Agustín Reyes, Maria Poddubnaya y Martín Olivares. Tutor: Leonardo Causa.

Dos perfiles: **Operador** (web, escritorio) y **Técnico** (PWA, celular).

## Stack

- Backend: FastAPI (Python 3.12) async, SQLAlchemy 2.0 + asyncpg, Alembic, GeoAlchemy2
- Base de datos: PostgreSQL 16 + PostGIS (Docker: `postgis/postgis:16-3.4`)
- Frontend: React + TypeScript + Vite + Tailwind CSS + React Router + TanStack Query
- Técnico móvil: PWA (`vite-plugin-pwa`)
- Tests: pytest + pytest-asyncio + httpx (backend), Vitest (frontend)

Ver `CLAUDE.md` para arquitectura y convenciones detalladas.

## Requisitos

- Docker Desktop
- Python 3.12
- Node.js 20+

## Puesta en marcha (Hito 1)

```bash
# 1. Variables de entorno
cp .env.example .env

# 2. Base de datos PostGIS
docker compose up -d
# esperar a que el healthcheck esté "healthy":
docker inspect --format='{{.State.Health.Status}}' facylitech-db

# 3. Backend
cd backend
py -3.12 -m venv .venv          # o `python3.12 -m venv .venv` en Linux/Mac
./.venv/Scripts/pip install -e ".[dev]"   # Windows; en Linux/Mac: .venv/bin/pip
./.venv/Scripts/python -m alembic upgrade head
./.venv/Scripts/python seed.py

# 4. Levantar API (puerto 8000; si está ocupado usar --port 8001 y
#    actualizar frontend/.env con VITE_API_URL acorde)
./.venv/Scripts/python -m uvicorn app.main:app --reload --port 8000

# 5. Verificar
curl http://localhost:8000/api/v1/health
```

```bash
# 6. Frontend (en otra terminal)
cd frontend
cp .env.example .env   # ajustar VITE_API_URL si el backend corre en otro puerto
npm install
npm run dev
```

Abrir `http://localhost:5173/operador` (selector de usuario operador del
seed) y `http://localhost:5173/tecnico` (selector de técnico).

> Nota de este entorno de desarrollo: el puerto 8000 estaba ocupado por otro
> proyecto en esta máquina, por lo que el backend se corrió en 8001. Ver
> `docs/decisiones.md`.

## Comandos

### Backend (`backend/`)

| Comando | Qué hace |
|---|---|
| `alembic upgrade head` | Aplica migraciones |
| `alembic downgrade base` | Revierte todas las migraciones |
| `alembic revision -m "mensaje"` | Nueva migración manual |
| `python seed.py` | Carga datos de ejemplo (idempotente) |
| `uvicorn app.main:app --reload --port 8000` | Levanta la API |
| `pytest` | Corre los tests (requiere BD `facylitech_test`, ver abajo) |
| `ruff check .` | Lint |

Los tests de integración usan una base de datos separada `facylitech_test`
en el mismo contenedor Postgres. Crearla una vez:

```bash
docker exec facylitech-db createdb -U facylitech facylitech_test
```

### Frontend (`frontend/`)

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo (Vite) |
| `npm run build` | Typecheck + build de producción |
| `npm run test` | Corre Vitest |
| `npm run lint` | Lint (oxlint) |

## Estructura del repositorio

```
facylitech/
├── backend/        # FastAPI, Clean Architecture (domain/application/infrastructure/api)
├── frontend/        # React + Vite (rutas /operador y /tecnico)
├── docs/            # modelo-er.md, decisiones.md, avance.md
├── docker-compose.yml
└── .env.example
```

## Documentación

- [`CLAUDE.md`](./CLAUDE.md) — arquitectura, comandos y convenciones para
  desarrollo asistido por IA (también útil como referencia general).
- [`docs/modelo-er.md`](./docs/modelo-er.md) — diagrama ER (Mermaid).
- [`docs/decisiones.md`](./docs/decisiones.md) — decisiones de diseño ante
  ambigüedades del alcance.
- [`docs/avance.md`](./docs/avance.md) — bitácora de avance por tarea.
