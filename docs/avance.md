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

## 2026-09-25 — Migración al prompt v2 + mockup real

El usuario trajo una versión actualizada del prompt (`prompt_claude_terminal_facylitech (1).md`)
con un modelo de datos mucho más grande (jerarquía Cliente→Administración→
Edificio→Ascensor, `emergencia`, `pieza_reemplazada`, matriz de frecuencia
`meses[]` en `pauta_item`, RNF-01/02/04/05/06) y la instrucción de reutilizar
un mockup ya validado con el cliente. Se recuperó el código fuente real del
mockup (export de Figma Make en el Desktop del usuario, reconstruido con
`git index-pack`) y se migró todo lo ya construido:

- **Backend**: modelo reescrito por completo (12 entidades), migración
  `0001` regenerada, nuevos routers (`clientes`, `administraciones`,
  `emergencias`, bitácora de ascensor), regla de dominio
  `items_del_mes()` (RNF-04), `seed.py` reescrito con los datos exactos del
  mockup (edificios, ascensores, técnicos, emergencias — no inventados).
  22 tests en verde, `ruff check .` limpio.
- **Frontend**: identidad visual reemplazada por los tokens exactos del
  mockup (navy `#0D1B2A`, naranjo `#EA580C`, tipografía Barlow), login/
  selector reconstruido como flujo de 2 pasos igual al mockup, `OrdenDetalle`
  ampliado con mañas de ascensor+edificio, línea "X de Y ítems este mes" y
  piezas reemplazadas, dashboard con tarjetas de estadísticas y banner de
  emergencia con datos reales. `lucide-react` y `recharts` agregados
  (mismas libs que usa el mockup). Build + Vitest en verde.
- **Verificado en navegador real** de punta a punta: login operador
  (Alex Moreau) → dashboard con calendario/banner/emergencias reales; login
  técnico (Marcus Delgado) → agenda → detalle con mañas y filtro de
  checklist por mes → marcar ítem → agregar pieza reemplazada.
- Decisiones documentadas en `docs/decisiones.md` (sección "v2"): mockup
  recuperado, 5 supuestos provisionales, semáforo por orden vs. por día,
  barra inferior móvil vs. sidebar compartido del mockup, rename
  LiftOps→Facylitech.

**Pendiente:** ninguno para el alcance de esta semana. El seed se re-corrió
después de las pruebas manuales para dejar datos de demo limpios.

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

## 2026-10-18 — Datos de la empresa + API sección 1 del contrato (backend-datos)

Migración `0002` (`ascensor.categoria`, `usuario.rut`, contactos de
comunidad en `edificio`, tabla `mensaje`; upgrade/downgrade verificados).
Endpoints: campos nuevos en `UsuarioOut`/`EdificioOut`/`AscensorOut`, filtro
`categoria` en `GET /ascensores`, `PATCH` de edificio/ascensor/orden,
`POST /ordenes-trabajo/{id}/cancelar` y mensajería REST
(`/mensajes/conversaciones`, `/mensajes/hilo`, `POST /mensajes`,
`POST /mensajes/leer`). `seed.py` reescrito con la data de simulación de la
empresa (10 comunidades, 68 equipos, 3 técnicos con RUT, cronograma 7–9 oct
mayormente completado con 3 OTs vencidas + ciclo 4–6 nov programado, 2
emergencias activas sin despachar). 44 tests pasando, ruff limpio.

**Pendiente:** confirmar con la empresa la lista de
`docs/datos-simulacion.md` §4 (discrepancias Excel/diagrama, coordenadas,
operador, especialidades, pautas reales, SLA, correos `.py`).

## 2026-10-18 — Storage de fotos (Evidencia) [backend]

`POST /papeletas/{id}/evidencias` (multipart `archivo` + `tipo` opcional;
JPEG/PNG/WebP validados por content-type **y** firma de bytes, ≤ 8 MB → 422;
409 si la papeleta está enviada) y `DELETE /papeletas/{id}/evidencias/{eid}`.
`PapeletaOut.evidencias`. Puerto `AlmacenamientoArchivos`
(`application/interfaces/storage.py`) con `AlmacenamientoLocal`
(`backend/media/`, servido en `/media`) y `AlmacenamientoSupabase` (REST con
httpx), elegido con `STORAGE_BACKEND`. Tests: subida/borrado real en tmp dir
y adaptador Supabase con `httpx.MockTransport`.

**Pendiente:** crear el bucket público en Supabase y probar contra el
proyecto real; UI de fotos en la papeleta (frontend-tecnico).

## 2026-10-18 — Algoritmo geográfico (Haversine/PostGIS) [backend]

`domain/cercania.py` (Haversine, ETA a 25 km/h, orden de candidatos:
disponibles → especialidad → distancia). Distancia real en BD con
`ST_Distance(geography)` y orden KNN `<->` sobre el índice GiST
(`infrastructure/repositories/tecnicos.py`); test de integración que la
compara con Haversine (±1%). Endpoints `GET /tecnicos/cercanos`,
`GET /emergencias/{id}/candidatos`, `POST /usuarios/{id}/ubicacion`,
`GET /mapa`, `GET /ascensores/qr/{codigo_qr}`.

**Pendiente:** que la PWA envíe la ubicación en los eventos (aceptar,
iniciar) — Gantt 26-oct; el seed aún no trae `ultima_ubicacion` de técnicos.

## 2026-10-18 — Lógica de asignación en cascada [backend]

Migración `0003` (`asignacion_emergencia`). `domain/cascada.py`: máquina de
estados pura (`en_espera → pendiente → aceptada|rechazada|expirada`,
`cancelada`) con evaluación perezosa y expiraciones encadenadas en tiempo
teórico. `POST /emergencias/{id}/despachar` (el operador aprueba el orden),
`GET /asignaciones`, `POST /asignaciones/{id}/aceptar|rechazar`; aceptar
crea la OT de emergencia (crítica) y deja al técnico `en_terreno`; cerrar la
emergencia cancela lo abierto. `EmergenciaOut` con `ubicacion`,
`asignaciones`, `cascada_agotada`, `orden_trabajo_id`. 40+ tests (dominio +
API).

**Pendiente:** notificación activa al técnico (hoy la PWA debe hacer polling
de `GET /asignaciones`); devolver al técnico a `disponible` al completar la
OT de emergencia.

## 2026-10-18 — Vistas del operador: Ascensores, Calendario y Agenda (frontend-operador-2)

**Quedó:** `/operador/ascensores` (drill-down Cliente → Administración →
Edificio → Equipo con migas, búsqueda global, filtros por categoría/estado,
ficha de edificio con contactos, mañas, reinicio y certificación editables por
PATCH, equipos agrupados por sector y categoría, ficha de equipo con datos
técnicos/estado/mañas editables, bitácora con piezas, QR real imprimible y
próximas OTs), `/operador/calendario` (mes y semana con semáforo, filtros por
técnico/tipo/edificio, panel lateral para reasignar, reprogramar, cambiar
prioridad y cancelar con manejo de 409) y `/operador/agenda` (cronograma
técnico × día con bloques mañana/tarde/día completo por edificio y progreso).
Modal "Nueva OT" reutilizable con pauta sugerida. Lógica pura en
`domain/semana.ts`, `domain/agenda.ts`, `domain/equipos.ts` con tests Vitest.

**Falta:** replicar cronograma al mes siguiente (botón del mockup), arrastrar
OTs entre días/técnicos, y vista móvil del operador (es de escritorio).

## 2026-10-18 — App del técnico completa + mensajería (frontend-tecnico)

Vistas `/tecnico/trabajos` (pendientes/completadas, filtro por tipo,
búsqueda, agrupadas por día), `/tecnico/mapa` (paradas del día numeradas,
mi posición, Google Maps/Waze), `/tecnico/emergencias` (asignaciones con
cuenta regresiva, aceptar/rechazar con motivo, historial; badge y banner en
todas las pantallas, polling 10 s), `/tecnico/escanear` (cámara +
BarcodeDetector/jsqr, entrada manual, verificación desde la OT, ficha del
equipo con bitácora), fotos de evidencia y borrado de piezas en la papeleta,
reporte de ubicación al Iniciar/Completar, y mensajería compartida
(`/tecnico/mensajes` y `/operador/mensajes`) con badges de no leídos.
Estados de carga/vacío/error/sin conexión en todas las vistas. Verificado
con Playwright a 390×844 (y 1440×900 el chat del operador) contra el backend
con la mensajería real; asignaciones, `porQr`, evidencias y ubicación
mockeados con la forma del contrato. Lectura QR real probada con cámara
falsa (video y4m con un QR). Tests Vitest pasando.

**Pendiente:** probar contra los endpoints reales de backend-geo
(asignaciones, `ascensores/qr`, evidencias, ubicación) al integrar; probar
en un celular real (cámara, GPS, `capture="environment"`).

---

## 2026-10-18 — Autenticación real en el frontend (frontend-auth)

Reemplazado el selector de usuario por login con correo + contraseña contra
`docs/contrato-auth.md`. **Qué quedó:** pantalla `/login` (mostrar/ocultar
contraseña, estados de carga/error, bloqueo temporal 429 con cuenta regresiva,
aviso de sesión expirada, responsive 390 px y escritorio; sin accesos rápidos desde 2026-11-09); sesión
`{token, usuario, expira_at}` en `localStorage['facylitech.sesion']` validada
con `GET /auth/me` al cargar (sin red se conserva; 401 o `expira_at` vencido la
descartan); `Authorization: Bearer` en todo request; 401 -> vuelve a `/login`
y 403/429 con mensaje claro; guards por rol con redirección a la ruta
pedida; al cerrar sesión y al iniciar otra se vacían TanStack Query y las
cachés `api-get`/`evidencias` del service worker; "Cambiar contraseña" en el
menú de usuario de ambos layouts y "Restablecer contraseña" (con confirmación
y generador) en el detalle de técnico del operador. Revisión de la matriz de
permisos: ninguna vista del técnico llama a endpoints prohibidos (verificado
en el navegador); no hubo que ajustar vistas. **Verificación:** 30
comprobaciones con Playwright (móvil 390x844 y escritorio 1440x900, auth
simulada con `page.route` y datos del backend sin auth de esta rama) + 51
tests nuevos de Vitest. **Falta:** probar contra el backend real con auth
(integración del orquestador); el backend debería exponer `Retry-After` por
CORS (`expose_headers`) para que el contador del 429 funcione entre orígenes
distintos (si no, el front muestra el mensaje del backend sin cuenta
regresiva).

## 🏁 2026-10-18 — Integración y verificación de punta a punta

Se integraron las 5 líneas de trabajo (backend datos de la empresa, backend
geo/cascada/evidencias, operador mapa/emergencias/técnicos, operador
ascensores/calendario/agenda, técnico + mensajería). Verificado en navegador
real contra el backend real (sin mocks): las 8 vistas del operador y las 6 del
técnico cargan sin errores; despacho en cascada (operador aprueba → técnico
acepta → se crea la OT de emergencia → al completarla se cierra la
emergencia y el técnico queda disponible); subida de foto de evidencia;
búsqueda por QR; reporte de ubicación; completar OT. Backend: 138 tests +
ruff limpio. Frontend: 72 tests, build y lint limpios.

### Resumen de avance de la Gantt (al 18-10-2026)

| Tarea | Gantt | Estado |
|---|---|---|
| Fase 1 completa + 🏁 Hito 1 | 31-ago a 13-sep | 100 % |
| APIs REST CRUD, papeleta, dashboard calendario/semáforos | 14 a 27-sep | 100 % |
| Storage de fotos (evidencia) | 28-sep a 4-oct | 100 % (local en dev; Supabase configurable, falta credenciales) |
| Mapa Leaflet + OSM con datos reales del seed | 28-sep a 4-oct | 100 % |
| Lector de código QR (cámara) | 5 a 11-oct | 100 % (falta probar en celular real) |
| 🏁 Hito 2: interfaz navegable completa | 11-oct | 100 % — incluso las vistas que la Gantt no exigía |
| Algoritmo geográfico (Haversine/PostGIS) | 12 a 25-oct | 100 % |
| Lógica de asignación en cascada | 12 a 25-oct | 100 % |
| Integración de API real con Operador | 19-oct a 1-nov | ~90 %: todas las vistas ya usan la API real; falta pulir con feedback |
| Tracking GPS por eventos de botones | 26-oct a 1-nov | Gancho hecho (ubicación al iniciar/completar); falta el botón explícito "Llegué" |
| 🏁 Hito 3: MVP funcional conectado | 1-nov | Adelantado |

**Pendiente / riesgos:** credenciales reales de Supabase Storage; probar en un
celular real (cámara, GPS, `capture`); confirmar con la empresa la lista de
datos faltantes de `docs/datos-simulacion.md` §4 (coordenadas reales,
especialidades, pautas por tipo de equipo, SLA); despliegue (sujeto a
factibilidad de servidor); sin auth real todavía (selector de desarrollo).

> Nota: en `Carta Gantt Facylitech II.xlsx` la tarea "Integración de API real
> con Operador" tiene las fechas con año 2016 (19-10-16 a 1-11-16); es un
> error de tipeo de la planilla (debería ser 2026).

## 2026-10-18 — Autenticación real y autorización por rol [backend-auth]

Login con correo + contraseña (`POST /auth/login`, `GET /auth/me`,
`POST /auth/cambiar-password`, `PUT /usuarios/{id}/password`), JWT HS256 con
PyJWT (12 h operador / 24 h técnico), contraseñas con scrypt de la stdlib
(migración `0004`: `usuario.password_hash`), 5 intentos fallidos en 15 min ->
429 con `Retry-After` (contador en memoria) y arranque que exige `JWT_SECRET`
(>= 32 caracteres) fuera de desarrollo. Toda la API quedó protegida según la
matriz de `docs/contrato-auth.md` (rol por router, propiedad de OT, papeleta y
asignación por endpoint, `usuario_id`/`tecnico_id`/`remitente_id`/`operador_id`
validados contra el token); el token se contrasta con la BD en cada request.
`seed.py` asigna `SEED_PASSWORD` (default `facylitech2026`) a los 4 usuarios.
Verificado: alembic upgrade/downgrade/upgrade limpios, seed idempotente,
`pytest` en verde (matriz de autorización sobre todos los endpoints + casos de
propiedad), `ruff` limpio y prueba manual con curl (login de operador y
técnico, 401 sin token, 403 de técnico en endpoint de operador, 403 al leer la
OT de otro técnico).

**Pendiente / límites:** contador de intentos en memoria (no sobrevive
reinicios ni varios workers); sin refresh ni revocación de tokens (cambiar la
contraseña no invalida los emitidos); `/media` sigue público; ver
`docs/decisiones.md`. El frontend (login, sesión, caché del service worker)
lo implementa el otro agente contra este mismo contrato.

---

## 2026-10-18 — Autenticación real (integración y verificación)

Login con correo + contraseña, JWT (operador 12 h, técnico 24 h), hash scrypt,
bloqueo tras 5 intentos fallidos, autorización por rol y por propiedad en todo
el backend, cambio de contraseña propio y restablecimiento por el operador.
Verificado en navegador real contra el backend real: sin sesión redirige a
`/login` y vuelve a la ruta pedida; contraseña mala; token manipulado; refrescar
conserva la sesión; cerrar sesión limpia `localStorage` y cachés del PWA; un
técnico en `/operador` es redirigido; técnico recibe 403 en emergencias, mapa,
usuarios y en OT/mensajes ajenos; 429 al 6.º intento; despacho en cascada con
tokens reales. Backend: 329 tests, ruff limpio. Frontend: 127 tests.

**Pendiente / límites conocidos:** contador de intentos en memoria (un solo
proceso); sin refresh ni revocación de tokens (cambiar la contraseña no cierra
sesiones abiertas); `/media` público (rutas con UUID); `/login` queda fuera del
scope PWA `/tecnico/` (puede verse una barra superior solo en el login de la app
instalada). Falta `JWT_SECRET` real para cualquier despliegue.

---

## 2026-11-09 — Tracking GPS por eventos de botones (cierre)

Botón **"Llegué al edificio"** en el detalle de la OT (confirma el envío o avisa
si no hubo GPS/red) y reporte de ubicación al **aceptar una emergencia**, además
de Iniciar/Completar. 3 tests Vitest. **Falta:** probar en un celular real.

## 2026-11-09 — Replicar cronograma al mes siguiente

Botón "Replicar a {mes}" del mockup en el calendario del operador con vista
previa (por día, equipos omitidos y sin técnico) y confirmación.
`POST /ordenes-trabajo/replicar` + regla pura `domain/replicacion.py` (+4
semanas). Idempotente. 7 tests de dominio + 4 de API + matriz de autorización.

## 2026-11-09 — QA y corrección de bugs

Recorrido con Playwright de las 8 vistas del operador y las 6 del técnico
contra el backend real (sin errores de API ni de consola), flujo completo de la
papeleta a 390 × 844, despacho en cascada aceptado desde el celular. Bugs
corregidos:
- Papeleta enviada se podía editar y reenviar → ahora 409 (test nuevo).
- Se podía enviar la papeleta con 0 ítems marcados sin aviso → confirmación.
- Dashboard: celdas vacías del calendario se veían seleccionadas; "hoy" en UTC.
- Seed con ciclos fijos: pasado el 6-nov mostraba 68 OTs vencidas → ciclos
  generados hasta el próximo según la fecha.
- Test que vencía con el calendario (fecha fija 2026-11-05).
**Falta:** prueba en celular real (cámara, GPS, `capture`, instalación PWA).

## 2026-11-09 — Despliegue

`docker-compose.prod.yml` (PostGIS + backend + Caddy con HTTPS automático),
Dockerfiles, `.env.prod.example`, `crear_operador.py` y `docs/despliegue.md`.
Verificado por piezas (sin acceso a Docker Hub en el entorno de desarrollo):
instalación limpia del backend, entrypoint en modo producción, Caddyfile real
por HTTPS con recorrido en navegador (login, foto, service worker).
**Falta:** `docker compose -f docker-compose.prod.yml up --build` una vez en una
máquina con Docker, y definir servidor/dominio con Facylitech.

## 2026-11-09 — Manual técnico

`docs/manual-tecnico.docx` (15 páginas): arquitectura, modelo de datos, reglas
de negocio, API con matriz de permisos, seguridad, desarrollo, despliegue,
pruebas y límites conocidos. README actualizado.

### Resumen de avance de la Gantt (al 09-11-2026)

| Tarea | Gantt | Estado |
|---|---|---|
| Fases 1 y 2 + 🏁 Hitos 1 y 2 | 31-ago a 11-oct | 100 % |
| Algoritmo geográfico, cascada | 12 a 25-oct | 100 % |
| Integración de API real con Operador | 19-oct a 1-nov | 100 % (+ replicar cronograma) |
| Tracking GPS por eventos de botones | 26-oct a 1-nov | 100 % |
| 🏁 Hito 3: MVP funcional conectado | 1-nov | Cumplido |
| Pruebas de usabilidad y corrección de bugs | 2 a 15-nov | Hecho en entorno de pruebas; falta celular real y feedback del cliente |
| Despliegue (sujeto a factibilidad) | 9 a 15-nov | Empaquetado y verificado; falta servidor de Facylitech |
| Redacción de manual técnico y código | 16 a 20-nov | 100 % (adelantado) |
| 🏁 Hito 4: Entrega final | 20-nov | Listo para entregar |

Backend: 345 tests, ruff limpio. Frontend: 133 tests, build, tsc y lint limpios.

### Checklist de entrega (Hito 4)

- [x] Código en el repositorio con README de puesta en marcha
- [x] Manual técnico (`docs/manual-tecnico.docx`)
- [x] Guía de despliegue (`docs/despliegue.md`) y archivos de Docker
- [x] Datos de simulación de la empresa cargables con `seed.py`
- [ ] Construir las imágenes una vez con Docker (`docker-compose.prod.yml`)
- [ ] Probar la app del técnico en un celular real por HTTPS
- [ ] Confirmar con Facylitech los datos de `docs/datos-simulacion.md` §4
- [ ] Corregir en la planilla Gantt el año de "Integración de API real" (dice 2016)
