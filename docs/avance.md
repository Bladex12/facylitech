# Bitácora de avance

## 2026-09-25 — Tarea 1: Modelo ER + BD

Modelo completo (usuario, edificio, ascensor, pauta_mantencion, pauta_item,
orden_trabajo, papeleta, papeleta_checklist_item, evidencia) con migración
Alembic inicial (PostGIS + índices GiST). Diagrama en `docs/modelo-er.md`.
Verificado: `alembic upgrade head` corre limpio contra Postgres 16+PostGIS en
Docker.

**Pendiente:** ninguno para esta tarea. `evidencia` y `usuario.ultima_ubicacion`
quedan modeladas sin lógica (como pide la Gantt, se activan en octubre).

## 2026-09-25 — Tarea 2: Setup FastAPI + GitHub

Estructura Clean Architecture (`domain/application/infrastructure/api`),
`docker-compose.yml` con healthcheck, `GET /health` verificando BD + PostGIS,
CORS para Vite, ruff configurado, prefijo `/api/v1`. Verificado: backend
levanta y `/health` responde 200 con versión de PostGIS.

**Pendiente:** ninguno.

## 2026-09-25 — Tarea 3: React + Tailwind + ruteo Operador

Vite + React 19 + TS + Tailwind v4 + React Router + TanStack Query. Sidebar
operador (General/Trabajos/Equipo) con paleta del mockup, header con
indicador Online y badge de emergencias real. Cliente API tipado. Selector
de usuario/rol de desarrollo (`auth/`). Verificado en navegador: selector
carga usuarios reales del seed, layout y navegación funcionan.

**Pendiente:** secciones Mapa, Calendario, Agenda(operador), Ascensores,
Emergencias, Técnicos, Mensajes quedan como placeholder "Próximamente"
(correcto según alcance de esta semana).

## 2026-09-25 — Tarea 4: PWA + menú Técnico

`vite-plugin-pwa` con manifest "Facylitech Técnico", scope `/tecnico/`,
service worker cacheando app shell. Barra inferior (Agenda, Trabajos, Mapa,
Emergencias, Mensajes). Verificado: `npm run build` genera `sw.js` +
manifest; layout responsive probado a ~400px de ancho en navegador.

**Pendiente:** Mapa, Mensajes, Trabajos y Emergencias del técnico quedan como
placeholder (solo Agenda + detalle/papeleta estaban detallados en la Gantt
de esta semana — ver `docs/decisiones.md`). Offline completo de papeletas no
se pide aún.

## 🏁 2026-09-25 — Hito 1 verificado

`docker compose up` → `alembic upgrade head` → `seed.py` → `/health` OK con
PostGIS → frontend carga `/operador` (dashboard con datos reales) y
`/tecnico` (agenda con datos reales). Probado manualmente en navegador de
extremo a extremo.

## 2026-09-25 — Tarea 5: APIs REST CRUD + seed

CRUD completo (`edificios`, `ascensores`, `usuarios`, `pautas`,
`ordenes-trabajo`) con filtros, paginación, transiciones `iniciar`/`completar`
con reglas de dominio (409 en transición inválida), semáforo + resumen de
ascensor/edificio embebido en cada orden. `seed.py` idempotente: 6 edificios
de Santiago, 12 ascensores, 1 operador + 4 técnicos, 2 pautas, 20 órdenes
(incluye vencidas y 2 emergencias críticas). Verificado: seed corrido dos
veces sin duplicar; 18 tests de pytest en verde (dominio + integración vía
httpx contra Postgres real); `ruff check .` limpio.

**Pendiente:** ninguno para el alcance de esta semana.

## 2026-09-25 — Tarea 6: Papeleta digital + checklist (Técnico)

`/tecnico/agenda` (agrupada Hoy/Mañana/Pasado mañana/Próximos días, tarjetas
con progreso de checklist), `/tecnico/ordenes/:id` (detalle + mañas e
instrucciones destacadas + botón Iniciar), flujo completo de papeleta
(crear, marcar ítems, observaciones/falla/trabajo realizado/causada por
terceros, enviar). Botón adjuntar fotos deshabilitado ("Próximamente").
Verificado de extremo a extremo en navegador: iniciar → crear papeleta →
marcar ítem → enviar → completar orden, con el 409 esperado si se intenta
completar antes de enviar.

**Pendiente:** ninguno para el alcance de esta semana.

## 2026-09-25 — Tarea 7: Dashboard calendario + semáforos (Operador)

`/operador/dashboard`: banner rojo de emergencias abiertas, calendario
mensual (lun-dom, domingo en rojo) con navegación, leyenda de colores, puntos
por semáforo en cada día; click en día abre listado con contadores por
estado y filas ordenadas según la regla del cliente (vencidos → en_curso →
programados → completados; por prioridad y fecha). Endpoint agregado
`GET /dashboard/calendario?mes=YYYY-MM`, semáforo calculado en backend.
Verificado en navegador con datos reales del seed (incluye emergencias
vencidas).

**Pendiente:** ninguno para el alcance de esta semana.

---

## Resumen de avance de la Gantt (al 25-09-2026)

| Tarea | Avance |
|---|---|
| 1. Modelo ER + BD | 100% |
| 2. Setup FastAPI + GitHub | 100% |
| 3. React + Tailwind + ruteo Operador | 100% |
| 4. PWA + menú Técnico | 100% |
| 🏁 Hito 1 | Verificado |
| 5. APIs REST CRUD (mantenimientos) | 100% |
| 6. Papeleta digital + checklist | 100% |
| 7. Dashboard calendario + semáforos | 100% |

### Cómo probarlo

Ver `README.md` — sección "Puesta en marcha (Hito 1)". Resumen: `docker
compose up -d` → migraciones → `seed.py` → backend (`uvicorn`) → frontend
(`npm run dev`) → `/operador` y `/tecnico`.

### Riesgos / pendientes para la tarea del 28 de septiembre

- **Supabase Storage (fotos de evidencia)**: la tabla `evidencia` ya existe
  y el botón "Adjuntar fotos" ya está en la UI (deshabilitado); falta la
  integración real de subida/URL firmada y el endpoint que la exponga.
- **Mapa Leaflet (mock data)**: las rutas `/operador/mapa` y `/tecnico/mapa`
  son placeholders; `edificio.ubicacion` y `usuario.ultima_ubicacion` ya
  están en el modelo con índice GiST, listas para consumir desde el mapa.
- **Riesgo de datos**: el algoritmo geográfico (Haversine/PostGIS) de
  octubre necesitará decidir qué se considera "cercanía" real vs. la
  columna `geography` ya indexada — no debería requerir cambios de modelo,
  solo nuevas queries/endpoints.
- **Auth de desarrollo**: sigue siendo un selector sin contraseña; si el
  cliente pide login real antes de lo previsto, es un cambio contenido a
  `frontend/src/auth/` + un router de autenticación nuevo en el backend.
