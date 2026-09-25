# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

Facylitech App: digitaliza el trabajo en terreno de cuadrillas de mantención
de ascensores (Santiago, Chile) para la empresa Facylitech. Proyecto
académico (Desafío Empresa II, UDD). Dos perfiles únicamente: **Operador**
(web/escritorio) y **Técnico** (PWA/celular). Sin perfil de cliente, sin
asignación 100% automática de emergencias (el operador siempre aprueba),
sin firma electrónica.

Todo el código, commits y UI van **en español**. Dominio en español:
`edificio`, `ascensor`, `orden_trabajo`, `papeleta`.

## Stack

- Backend: FastAPI (Python 3.12) async, SQLAlchemy 2.0 async + asyncpg,
  Alembic, GeoAlchemy2, Pydantic v2 + pydantic-settings.
- Base de datos: PostgreSQL 16 + PostGIS (`postgis/postgis:16-3.4` vía Docker).
- Frontend: React + TypeScript + Vite + Tailwind CSS + React Router + TanStack Query.
- Técnico móvil: PWA (`vite-plugin-pwa`), foreground-first (sin offline completo aún).
- Tests: pytest + pytest-asyncio + httpx (backend), Vitest (frontend).
- Repo: monorepo único (`backend/`, `frontend/`, `docs/`).

**Deliberadamente fuera de alcance por ahora** (no agregar sin que el usuario
lo pida): Supabase Storage, mapa Leaflet, lector QR, algoritmo Haversine /
asignación en cascada, tracking GPS, mensajería, WebSockets, CQRS, BD
intercambiable, microservicios, event sourcing, autenticación real (JWT).

## Comandos

### Backend (`backend/`, venv en `backend/.venv`)

```bash
alembic upgrade head              # aplicar migraciones
alembic downgrade base            # revertir todas
alembic revision -m "mensaje"     # nueva migración (manual, no autogenerate)
python seed.py                    # datos de ejemplo (idempotente)
uvicorn app.main:app --reload --port 8000
pytest                            # requiere BD facylitech_test (ver README)
pytest tests/test_semaforo.py -k test_programado_pasado_esta_vencido  # 1 test
ruff check .                      # lint
ruff check . --fix
```

### Frontend (`frontend/`)

```bash
npm run dev
npm run build       # tsc -b && vite build
npm run test        # vitest run
npm run test -- ordenamiento   # 1 archivo
npm run lint         # oxlint
```

### Infraestructura

```bash
docker compose up -d
docker inspect --format='{{.State.Health.Status}}' facylitech-db
docker exec facylitech-db createdb -U facylitech facylitech_test  # una vez, para tests
```

## Arquitectura backend — Clean Architecture simple

```
backend/app/
├── domain/            # reglas puras: enums, semáforo, transiciones, orden de listado
│                       # (sin FastAPI ni SQLAlchemy — funciones que reciben primitivos/enums)
├── application/
│   ├── interfaces/    # Protocols del Repository Pattern (repositories.py)
│   ├── use_cases/      # un módulo por entidad; funciones async que reciben el repo
│   └── errors.py       # NoEncontradoError (-> 404 en la capa API)
├── infrastructure/
│   ├── db/             # base.py (DeclarativeBase), session.py, models.py (ORM)
│   ├── repositories/   # implementaciones SQLAlchemy de los Protocols
│   ├── config.py       # Settings (pydantic-settings)
│   └── geo.py           # conversión Coordenadas{lat,lon} <-> geography (WKT/WKB)
└── api/v1/
    ├── schemas/         # DTOs Pydantic (nunca se devuelven modelos ORM)
    ├── routers/         # un router por recurso, prefijo /api/v1
    ├── deps.py           # Depends() -> instancias de repositorio por request
    ├── serializers.py    # construye OrdenTrabajoOut con el semáforo calculado
    └── router.py          # agrega todos los routers
```

Puntos clave de esta arquitectura:

- **Sin entidades de dominio duplicadas**: en vez de triplicar
  entidad-de-dominio + DTO + modelo-ORM, `application`/`infrastructure`
  comparten los modelos SQLAlchemy como estructura de datos. Las reglas de
  negocio viven en `domain/` como funciones puras (reciben enums/primitivos,
  no objetos ORM), así que no dependen de FastAPI ni SQLAlchemy aunque
  compartan la clase de datos. Ver `docs/decisiones.md`.
- **Repository Pattern**: interfaces (`Protocol`) en
  `application/interfaces/repositories.py`, implementaciones concretas
  `SqlXRepository` en `infrastructure/repositories/`.
- **Inyección de dependencias**: `Depends()` de FastAPI en `api/v1/deps.py`
  (`EdificioRepoDep`, `OrdenRepoDep`, etc.), instancia un repositorio nuevo
  por request sobre la sesión de esa request.
- **"Vencido" no se guarda**: `orden_trabajo.estado` nunca es `vencido`; se
  calcula en `domain/semaforo.py::calcular_semaforo()` a partir del estado y
  `fecha_programada` vs. `ahora`. Toda respuesta de orden pasa por
  `api/v1/serializers.py::construir_orden_out()` para incluirlo.
- **Transiciones de estado** (`domain/transiciones.py`): `iniciar` exige
  `programado`; `completar` exige `en_curso` + papeleta `enviada`. Violaciones
  lanzan `TransicionInvalidaError` -> HTTP 409 (ver `routers/ordenes_trabajo.py`).
- **Orden de listados** (`domain/ordenamiento.py::clave_orden_listado`): regla
  del cliente — vencidos > en_curso > programados > completados; dentro de
  cada grupo, por prioridad (crítica primero) y fecha (más próxima primero).
  La usan tanto `routers/dashboard.py` (calendario del operador) como
  `frontend/src/domain/ordenamiento.ts` (agenda del técnico).
- **Geoespacial**: columnas `geography(Point, 4326)` vía GeoAlchemy2 +
  índices GiST. Conversión a/desde `{lat, lon}` en `infrastructure/geo.py`
  (usa `shapely` internamente) — no calcular geometría a mano.
- **Códigos de OT**: generados en `SqlOrdenTrabajoRepository.siguiente_codigo()`
  como `WO-{2850 + conteo}`; ver limitaciones en `docs/decisiones.md`.

## Frontend — estructura de rutas

```
frontend/src/
├── api/          # client.ts (fetch wrapper), endpoints.ts, types.ts (DTOs)
├── auth/          # AuthContext (usuario en localStorage) + SelectorUsuario (auth de dev)
├── domain/        # semaforo.ts (colores), ordenamiento.ts, fechas.ts — espejo del backend
├── components/    # componentes compartidos (Proximamente, etc.)
└── routes/
    ├── operador/  # Layout.tsx (sidebar azul marino), Dashboard.tsx (calendario+semáforos)
    └── tecnico/    # Layout.tsx (barra inferior), Agenda.tsx, OrdenDetalle.tsx, OrdenCard.tsx
```

- Dos árboles de rutas bajo un solo proyecto Vite: `/operador/*` y `/tecnico/*`.
- **Auth de desarrollo**: `useAuth()` (`src/auth/AuthContext.tsx`) guarda el
  usuario elegido en `localStorage`; no hay JWT. `RequireOperador`/
  `RequireTecnico` en `App.tsx` redirigen según rol. Diseñado para
  reemplazarse por auth real sin tocar el resto de la app.
- Secciones de navegación no construidas muestran `<Proximamente titulo="..." />`
  en vez de dejarlas fuera del menú.
- El semáforo del backend (`completado|vencido|en_curso|programado`) mapea a
  colores en `domain/semaforo.ts` (verde/rojo/amarillo/azul) — es la única
  fuente de verdad de esos colores en el frontend.
- TanStack Query para todo el data-fetching; no hay estado global propio más
  allá de `AuthContext`.

## Convenciones

- Commits pequeños, en español, formato convencional (`feat:`, `fix:`,
  `chore:`, `docs:`, `test:`). No hacer push ni crear repo remoto sin que el
  usuario lo pida explícitamente.
- Migraciones Alembic escritas a mano (no autogenerate) para controlar
  exactamente índices GiST y tipos `geography`.
- Ambigüedades de alcance: elegir la opción más simple y anotarla en
  `docs/decisiones.md`; solo preguntar si la decisión es difícil de revertir.
- Al terminar una tarea de la carta Gantt: tests pasando + commit + una línea
  nueva en `docs/avance.md` (fecha, tarea, qué quedó, qué falta).
- No agregar dependencias pesadas sin justificarlas. Nada de capas extra
  (ver "fuera de alcance" arriba).
