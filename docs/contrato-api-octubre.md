# Contrato de API — octubre 2026 (Hito 2 + Fase 3)

Fuente de verdad compartida entre backend y frontend para el trabajo en
paralelo. Los tipos TypeScript exactos están en `frontend/src/api/types.ts`
(sección "Contrato octubre 2026") y las llamadas en
`frontend/src/api/endpoints.ts`. El backend **debe** devolver exactamente esas
formas (nombres de campo en snake_case, fechas ISO 8601 con zona,
coordenadas `{lat, lon}`). Todo bajo el prefijo `/api/v1`.

## 1. Datos de la empresa (backend-datos)

Migración `0002`:

| Cambio | Detalle |
|---|---|
| `ascensor.categoria` | `String(20)` NOT NULL default `'ascensor'`. Enum `CategoriaEquipo`: `ascensor`, `montacarga`, `montaplatos`. |
| `usuario.rut` | `String(12)` nullable. |
| `edificio.contacto_nombre/telefono/email` | nullable (contacto de la comunidad, además del de la administración). |
| `TipoCliente` | + `administracion`, `corporativo`, `publico` (columna es `String`, solo cambia el enum Python). |
| `TipoEdificio` | + `publico`. |
| tabla `mensaje` | `id, remitente_id→usuario, destinatario_id→usuario, orden_trabajo_id→orden_trabajo (null, SET NULL), texto, created_at, leido_at`. Índice por (destinatario_id, leido_at). |

Endpoints nuevos/ampliados:

- `UsuarioOut` agrega `rut`, `ultima_ubicacion: {lat,lon}|null`, `ultima_ubicacion_at`.
- `EdificioOut` agrega los 3 campos de contacto. `AscensorOut` agrega `categoria`.
- `GET /ascensores?edificio_id=&categoria=` (filtro nuevo opcional).
- `PATCH /edificios/{id}` — parcial: `manas`, `instrucciones_reinicio`, `vencimiento_certificacion`, contactos, `nombre`, `direccion`.
- `PATCH /ascensores/{id}` — parcial: `estado`, `manas`, `marca`, `modelo`, `pisos`, `anio_instalacion`, `torre`, `numero`.
- `PATCH /ordenes-trabajo/{id}` — `OrdenTrabajoActualizar` (reasignar técnico, reprogramar, prioridad, descripción). 409 si la orden está `completado` o `cancelado`.
- `POST /ordenes-trabajo/{id}/cancelar` — 409 si ya está `completado`/`cancelado`. (Regla en `domain/transiciones.py`.)
- Mensajería simple (REST + polling, sin WebSockets):
  - `GET /mensajes/conversaciones?usuario_id=` → `Conversacion[]` (una por contraparte con la que hay mensajes; el operador además ve a todos los técnicos activos aunque no haya mensajes, y el técnico ve a todos los operadores). Orden: último mensaje más reciente primero.
  - `GET /mensajes/hilo?usuario_id=&contraparte_id=` → `Mensaje[]` ascendente por fecha.
  - `POST /mensajes` `{remitente_id, destinatario_id, texto, orden_trabajo_id?}` → `Mensaje` (201). 422 si texto vacío.
  - `POST /mensajes/leer` `{usuario_id, contraparte_id}` → 204; marca `leido_at` de lo recibido.
  - `Mensaje.remitente/destinatario` = `{id, nombre}`.

## 2. Geo, cascada y evidencias (backend-geo)

Migración `0003` (`down_revision = "0002"`):

- tabla `asignacion_emergencia`: `id, emergencia_id→emergencia (CASCADE), tecnico_id→usuario, orden int, estado String(20), distancia_m float null, notificada_at, respondida_at, motivo_rechazo text null, operador_id→usuario null, created_at`.
- `emergencia.orden_trabajo_id` NO se agrega como columna: se deriva de `orden_trabajo.emergencia_id` (ya existe).

Reglas (funciones puras en `domain/`):

- `domain/cercania.py`: `haversine_m(a, b)`; `ordenar_candidatos(...)` — primero disponibles, luego con especialidad que calza con el tipo de emergencia, luego por distancia ascendente; técnicos sin ubicación conocida al final. `eta_min = round(distancia_m / (25 km/h))`.
- La distancia real se calcula en BD con PostGIS (`ST_Distance(geography, geography)`), Haversine queda como respaldo y para tests (deben coincidir ±1%).
- `domain/cascada.py`: estados `en_espera → pendiente → aceptada | rechazada | expirada`, y `cancelada` para el resto cuando alguien acepta. `avanzar_cascada(asignaciones, ahora, tiempo_respuesta)` es pura: expira la `pendiente` vencida y pasa la siguiente `en_espera` a `pendiente`. Se aplica de forma perezosa en cada lectura/escritura (no hay jobs en segundo plano). `tiempo_respuesta` = `settings.tiempo_respuesta_emergencia_min` (default 5).
- El operador SIEMPRE aprueba la cascada (alcance: sin asignación 100% automática).

Endpoints:

- `GET /tecnicos/cercanos?lat=&lon=&limit=5` → `CandidatoTecnico[]` (solo rol técnico activo).
- `GET /emergencias/{id}/candidatos?limit=5` → `CandidatoTecnico[]` respecto al edificio de la emergencia, con `especialidad_match` según `emergencia.tipo`.
- `POST /emergencias/{id}/despachar` `{tecnico_ids: uuid[], operador_id}` → `EmergenciaOut`. Crea las asignaciones en ese orden: la primera `pendiente` (notificada_at=ahora), el resto `en_espera`. 409 si la emergencia está `cerrada` o ya tiene una asignación `aceptada`. Re-despachar (cascada agotada) cancela las `en_espera`/`pendiente` previas y crea una nueva cascada.
- `GET /asignaciones?tecnico_id=&estado=pendiente` → `AsignacionTecnico[]` (estado por defecto `pendiente`; `estado=todas` devuelve todas).
- `POST /asignaciones/{id}/aceptar` → `AsignacionEmergencia`. Marca `aceptada`, cancela las demás, emergencia → `en_atencion`, técnico → `en_terreno`, crea `OrdenTrabajo` tipo `emergencia`, prioridad `critica`, estado `programado`, `fecha_programada=ahora`, ligada a la emergencia y a su ascensor (si la emergencia no tiene ascensor, se usa el primero del edificio). 409 si no está `pendiente` (p.ej. expiró).
- `POST /asignaciones/{id}/rechazar` `{motivo?}` → `AsignacionEmergencia`; avanza la cascada.
- `EmergenciaOut` agrega `ubicacion`, `asignaciones` (ordenadas por `orden`), `cascada_agotada`, `orden_trabajo_id`.
- `PATCH /emergencias/{id}/estado` a `cerrada` cancela asignaciones abiertas.
- `POST /usuarios/{id}/ubicacion` `{lat, lon}` → `UsuarioOut` (base del tracking GPS por eventos de la Gantt 26-oct).
- `GET /mapa` → `MapaData` (edificios con conteos, técnicos con ubicación y orden en curso, emergencias no cerradas).
- `GET /ascensores/qr/{codigo_qr}` → `AscensorOut` con `edificio` embebido; 404 si no existe.
- Evidencias (fotos):
  - `POST /papeletas/{id}/evidencias` multipart: `archivo` (image/jpeg|png|webp, ≤ 8 MB) + `tipo` opcional → `Evidencia` (201). 409 si la papeleta ya está `enviada`.
  - `DELETE /papeletas/{id}/evidencias/{evidencia_id}` → `PapeletaOut`. 409 si `enviada`.
  - `PapeletaOut` agrega `evidencias: Evidencia[]`.
  - Almacenamiento detrás de un Protocol `AlmacenamientoArchivos` (`application/interfaces/storage.py`) con dos implementaciones: `AlmacenamientoLocal` (disco en `backend/media/`, servido en `/media/...`, default en desarrollo) y `AlmacenamientoSupabase` (REST de Supabase Storage vía `httpx`, activado con `STORAGE_BACKEND=supabase` + `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_BUCKET`). `Evidencia.url` es relativa (`/media/...`) en local y absoluta en Supabase; el front usa `urlArchivo()`.

## 3. Vistas (frontend)

| Rol | Ruta | Vista | Agente |
|---|---|---|---|
| Operador | `/operador/mapa` | Mapa Leaflet: edificios, técnicos, emergencias, técnicos cercanos | frontend-operador-1 |
| Operador | `/operador/emergencias` | Lista + crear + despacho en cascada | frontend-operador-1 |
| Operador | `/operador/tecnicos` | Equipo técnico: estado, ubicación, carga | frontend-operador-1 |
| Operador | `/operador/ascensores` | Drill-down Cliente→Administración→Edificio→Equipo + ficha + bitácora + QR | frontend-operador-2 |
| Operador | `/operador/calendario` | Calendario mensual/semanal con filtros, crear/editar OT | frontend-operador-2 |
| Operador | `/operador/agenda` | Agenda por técnico y día (formato cronograma de la empresa) | frontend-operador-2 |
| Ambos | `/operador/mensajes`, `/tecnico/mensajes` | Mensajería | frontend-tecnico |
| Técnico | `/tecnico/trabajos` | Historial / todos mis trabajos | frontend-tecnico |
| Técnico | `/tecnico/mapa` | Mis trabajos de hoy en el mapa + navegación | frontend-tecnico |
| Técnico | `/tecnico/emergencias` | Asignaciones pendientes (aceptar/rechazar) | frontend-tecnico |
| Técnico | `/tecnico/escanear` | Lector QR (cámara) | frontend-tecnico |
| Técnico | `/tecnico/ordenes/:id` | + fotos de evidencia en la papeleta | frontend-tecnico |
