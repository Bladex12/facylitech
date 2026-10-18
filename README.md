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

Para mostrar en la pantalla de login botones que rellenan estas cuentas, define
`VITE_MOSTRAR_CUENTAS_DEMO=true` en `frontend/.env` y reinicia `npm run dev`.
**Déjala vacía en producción.**

Tras 5 intentos fallidos en 15 minutos, el correo queda bloqueado un rato
(error 429). Reiniciar el backend limpia el contador.

### Datos de ejemplo

El seed carga los datos de simulación de la empresa
([`docs/datos-simulacion.md`](./docs/datos-simulacion.md)): 7 clientes, 10
comunidades, 68 equipos (ascensores, montacargas y montaplatos), 3 técnicos y
el cronograma de mantenciones de octubre. Las coordenadas, operador, contactos
y pautas son simulados. Es idempotente: se puede volver a correr.

## Variables de entorno

Definidas en `.env` (raíz) y documentadas en `.env.example`:

| Variable | Para qué | Por defecto |
|---|---|---|
| `DATABASE_URL` | Conexión a PostgreSQL | local (Docker) |
| `ENVIRONMENT` | `development` u otro | `development` |
| `CORS_ORIGINS` | Orígenes permitidos del front | `http://localhost:5173` |
| `JWT_SECRET` | Firma de tokens. Fuera de desarrollo es obligatoria y de ≥ 32 caracteres, o el backend no arranca | valor inseguro solo en desarrollo |
| `JWT_TTL_OPERADOR_HORAS` / `JWT_TTL_TECNICO_HORAS` | Duración de la sesión | 12 / 24 |
| `SEED_PASSWORD` | Contraseña de las cuentas demo | `facylitech2026` |
| `TIEMPO_RESPUESTA_EMERGENCIA_MIN` | Minutos para aceptar una emergencia antes de pasar al siguiente técnico | 5 |
| `STORAGE_BACKEND` | Fotos: `local` o `supabase` | `local` |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_BUCKET` | Solo con `supabase` (bucket público) | — |

Genera un secreto para producción con:
`python -c "import secrets; print(secrets.token_urlsafe(48))"`

En el frontend (`frontend/.env`): `VITE_API_URL` (URL de la API) y
`VITE_MOSTRAR_CUENTAS_DEMO` (solo demo).

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

## Problemas frecuentes

- **`alembic upgrade head` no conecta**: la base no está lista. Revisa
  `docker compose ps` y espera a que el healthcheck diga `healthy`.
- **El login dice credenciales inválidas**: ¿corriste `seed.py`? Si ya existían
  usuarios de antes de la autenticación, corre `alembic upgrade head` y
  `python seed.py` de nuevo para asignarles contraseña.
- **El front no carga datos**: revisa que `VITE_API_URL` apunte al puerto
  donde corre el backend, y que ese origen esté en `CORS_ORIGINS`.
- **Las fotos no se ven**: con `STORAGE_BACKEND=local` se sirven desde el
  backend en `/media`; no cambies de puerto sin ajustar `VITE_API_URL`.
- **Cámara y GPS en el celular**: el navegador solo los permite en HTTPS (o
  `localhost`). Para probar en un teléfono real usa un túnel HTTPS o un deploy.

## Estructura del repositorio

```
facylitech/
├── backend/        # FastAPI, Clean Architecture (domain/application/infrastructure/api)
├── frontend/       # React + Vite (rutas /operador y /tecnico)
├── docs/           # contratos de API, modelo ER, decisiones, avance, mockup/
├── docker-compose.yml
└── .env.example
```

## Documentación

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

## Limitaciones conocidas

- El contador de intentos fallidos de login está en memoria (se reinicia con el
  servidor).
- No hay refresh ni revocación de tokens: cambiar la contraseña no cierra las
  sesiones ya abiertas.
- `/media` (fotos de evidencia) es público, aunque las rutas no son adivinables.
- Sin recuperación de contraseña por correo: la restablece un operador.
- Cámara, GPS y captura de fotos no se probaron en un celular real.
