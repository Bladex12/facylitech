# Facylitech App

Sistema de digitalización del trabajo en terreno de cuadrillas técnicas para
**Facylitech**, empresa de mantención de ascensores en Santiago de Chile.
Proyecto académico — Desafío Empresa II, Universidad del Desarrollo.
Equipo: Agustín Reyes, Maria Poddubnaya y Martín Olivares. Tutor: Leonardo Causa.

Dos perfiles: **Operador** (web, escritorio) y **Técnico** (PWA, celular).

## Qué incluye

**Operador**: dashboard, calendario y agenda de órdenes de trabajo (crear,
editar, reasignar, cancelar), ascensores (Cliente → Administración → Edificio →
Equipo, ficha, bitácora y QR), mapa en vivo, emergencias con despacho en
cascada (el operador siempre aprueba), equipo técnico, mensajería y
restablecimiento de contraseñas.

**Técnico**: agenda del día y trabajos, papeleta con checklist según el mes,
fotos de evidencia, lector QR, mapa con navegación, aceptar/rechazar
emergencias, mensajería y cambio de contraseña.

**Transversal**: login real (JWT) con autorización por rol en el backend.

## Stack

- Backend: FastAPI (Python 3.12) async, SQLAlchemy 2.0 + asyncpg, Alembic, GeoAlchemy2
- Base de datos: PostgreSQL 16 + PostGIS (Docker: `postgis/postgis:16-3.4`)
- Frontend: React + TypeScript + Vite + Tailwind CSS + React Router + TanStack Query
- Mapa: Leaflet + OpenStreetMap · QR: `qrcode` + `jsqr`
- Técnico móvil: PWA (`vite-plugin-pwa`)
- Tests: pytest + pytest-asyncio + httpx (backend), Vitest (frontend)

## Requisitos

- Docker Desktop
- Python 3.12
- Node.js 20+

## Cómo levantar el proyecto

Todos los comandos se ejecutan desde la raíz del repositorio, salvo que se
indique otra carpeta.

### 1. Variables de entorno

```bash
cp .env.example .env
```

Los valores por defecto sirven para desarrollo local. No necesitas editar nada
para una primera prueba.

### 2. Base de datos (PostGIS)

```bash
docker compose up -d
# esperar a que el healthcheck esté "healthy":
docker inspect --format='{{.State.Health.Status}}' facylitech-db
```

### 3. Backend

```bash
cd backend
py -3.12 -m venv .venv                     # Windows; en Linux/Mac: python3.12 -m venv .venv
./.venv/Scripts/pip install -e ".[dev]"    # Windows; en Linux/Mac: .venv/bin/pip
./.venv/Scripts/python -m alembic upgrade head
./.venv/Scripts/python seed.py
./.venv/Scripts/python -m uvicorn app.main:app --reload --port 8000
```

En Linux/Mac reemplaza `./.venv/Scripts/python` por `.venv/bin/python`.
Verifica que responde: `curl http://localhost:8000/api/v1/health`.
La documentación interactiva de la API está en `http://localhost:8000/docs`.

Si el puerto 8000 está ocupado, usa otro (por ejemplo `--port 8001`) y ajusta
`VITE_API_URL` en `frontend/.env`.

### 4. Frontend (en otra terminal)

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Abre `http://localhost:5173`.

Para ver la vista del técnico como en un celular, abre las herramientas de
desarrollo del navegador y activa el modo dispositivo móvil.

## Credenciales de prueba

El seed crea estas cuentas. Todas usan la contraseña **`facylitech2026`**
(configurable con `SEED_PASSWORD` antes de correr `seed.py`):

| Perfil | Nombre | Correo | Entra a |
|---|---|---|---|
| Operador | Operador | `operador@facylitech.cl` | `/operador` |
| Técnico | Melvin Zúñiga | `melvin.zuniga@facylitech.cl` | `/tecnico` |
| Técnico | Jorge Candia | `jorge.candia@facylitech.cl` | `/tecnico` |
| Técnico | Juan Cubillos | `juan.cubillos@facylitech.cl` | `/tecnico` |

El login no tiene accesos rápidos: se escribe el correo y la contraseña.
**Déjala vacía en producción.**

Tras 5 intentos fallidos en 15 minutos, el correo queda bloqueado un rato
(error 429). Reiniciar el backend limpia el contador.

### Datos de ejemplo

El seed carga los datos de simulación de la empresa
([`docs/datos-simulacion.md`](./docs/datos-simulacion.md)): 7 clientes, 10
comunidades, 68 equipos (ascensores, montacargas y montaplatos), 3 técnicos y
los ciclos mensuales de mantención: parte del cronograma de la empresa (7 al 9 de
octubre) y genera cada ciclo siguiente hasta el próximo, así que los datos siguen
vigentes sin importar cuándo se corra. Las coordenadas, operador, contactos y
pautas son simulados. Es idempotente: se puede volver a correr.

## Despliegue en un servidor

Ver [`docs/despliegue.md`](./docs/despliegue.md): Docker Compose con PostGIS,
backend y Caddy (HTTPS automático, necesario para GPS y cámara en el celular).

```bash
cp .env.prod.example .env.prod   # completar DOMINIO, JWT_SECRET, POSTGRES_PASSWORD
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

## Comandos

### Backend (`backend/`)

| Comando | Qué hace |
|---|---|
| `alembic upgrade head` | Aplica migraciones |
| `alembic downgrade base` | Revierte todas las migraciones |
| `alembic revision -m "mensaje"` | Nueva migración manual |
| `python seed.py` | Carga datos de ejemplo (idempotente; **borra** los datos existentes) |
| `python crear_operador.py --nombre ... --email ...` | Crea o reactiva un operador (instalación real) |
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
├── frontend/       # React + Vite (rutas /operador y /tecnico)
├── docs/           # contratos de API, modelo ER, decisiones, avance, mockup/
├── docker-compose.yml        # solo la BD, para desarrollo
├── docker-compose.prod.yml   # despliegue completo (db + backend + Caddy)
├── .env.example
└── .env.prod.example
```

## Documentación

- [`docs/manual-tecnico.docx`](./docs/manual-tecnico.docx) — manual técnico
  (arquitectura, modelo de datos, API, reglas de negocio, despliegue).
- [`docs/despliegue.md`](./docs/despliegue.md) — despliegue en un servidor.
- [`docs/modelo-er.md`](./docs/modelo-er.md) — diagrama ER (Mermaid).
- [`docs/decisiones.md`](./docs/decisiones.md) — decisiones de diseño ante
  ambigüedades del alcance.
- [`docs/avance.md`](./docs/avance.md) — bitácora de avance por tarea.
- [`docs/contrato-api-octubre.md`](./docs/contrato-api-octubre.md) — contrato
  de la API de octubre (mapa, cascada, evidencias, mensajería).
- [`docs/contrato-auth.md`](./docs/contrato-auth.md) — autenticación y matriz
  de permisos por rol.
- [`docs/datos-simulacion.md`](./docs/datos-simulacion.md) — datos de la
  empresa y qué se simuló.
- [`docs/mockup/`](./docs/mockup/) — mockup validado con el cliente (HTML
  compilado + código fuente de referencia).
