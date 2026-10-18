# Decisiones de diseño (ambigüedades resueltas con la opción más simple)

Formato: fecha, decisión, por qué.

## 2026-09-25

- **Semáforo para órdenes `cancelado`**: el enum `Semaforo` del prompt solo
  define `completado | vencido | en_curso | programado` (no hay color para
  cancelado). Se decidió mostrar `cancelado` como `completado` (cerrada, no
  requiere atención) en vez de agregar un quinto valor no pedido.
- **Código secuencial de OT**: se generan como `WO-{2850 + n}` donde `n` es el
  conteo de órdenes existentes al momento de crear. Es una aproximación
  simple (no protegida contra condiciones de carrera concurrentes); suficiente
  para el volumen de uso de esta app interna. Si se detectan colisiones reales
  se puede migrar a una secuencia de Postgres.
- **IDs de todas las entidades**: UUID generados en la aplicación (`uuid4`),
  no `gen_random_uuid()` de Postgres, para no depender de `pgcrypto`/`uuid-ossp`
  además de PostGIS.
- **Capas de dominio/aplicación sin entidades duplicadas**: en vez de crear
  clases de dominio "puras" separadas de los modelos SQLAlchemy (triplicando
  entidad + DTO + ORM), las reglas de dominio (`semaforo.py`, `transiciones.py`,
  `ordenamiento.py`) son funciones puras que reciben primitivos/enums, y
  `application`/`infrastructure` comparten los modelos ORM como estructura de
  datos. Se evita así la sobreingeniería explícitamente descartada en el
  prompt, manteniendo la separación real donde importa: la lógica de negocio
  no depende de FastAPI ni SQLAlchemy.
- **Orden de listados (regla del cliente)**: "por prioridad y fecha" se
  interpretó como prioridad crítica primero, y dentro de la misma prioridad,
  fecha más próxima primero (`app/domain/ordenamiento.py`).
- **Auth de desarrollo**: selector de usuario/rol del seed en el frontend
  (guarda el `id` elegido), sin JWT ni contraseñas — tal como pide el punto
  3 de la Tarea 3 del prompt. La capa `frontend/src/auth/` está aislada para
  poder reemplazarla después sin tocar el resto de la app.
- **Puerto de desarrollo del backend**: `8000` estaba ocupado por otro
  proyecto en esta máquina; el backend corre en `8001` en este entorno de
  desarrollo (`uvicorn app.main:app --port 8001`). El README documenta ambos
  (8000 por defecto, con nota de usar otro puerto si está ocupado).

## 2026-09-25 (v2) — Migración al prompt actualizado + mockup real

El usuario trajo `prompt_claude_terminal_facylitech (1).md` (v2), que
reemplaza al prompt inicial con un modelo de datos mucho más grande
(jerarquía Cliente→Administración→Edificio→Ascensor, `emergencia`,
`pieza_reemplazada`, `meses[]`) y exige reutilizar un mockup ya validado con
el cliente. Preguntado, según pide el propio prompt v2 (paso 1):

- **¿Tenemos el mockup?** → Sí, pero no como archivo plano en el repo: se
  recuperó desde `Elevator Maintenance Management App.make` (export de
  Figma Make) en el Desktop del usuario. Es un zip que contiene
  `make_repos/*.zip` con **packs de git reales** (`manifest.json` +
  `.pack`); se reconstruyó con `git index-pack` + `git update-ref` +
  `git checkout`. El código fuente (`src/app/App.tsx`, ~1620 líneas) usa
  React+TS+Tailwind v4 con clases inline (**no usa ningún componente
  shadcn/radix** pese a que el proyecto los trae por defecto) — solo
  `lucide-react` y `recharts`, que se agregaron como dependencias reales.
  El `.html` compilado también se movió a `docs/mockup/`, junto con un
  volcado del código fuente en `docs/mockup/source/` para trazabilidad.
- **¿Decisiones de la sección 3 resueltas?** → No; se usaron los 5 supuestos
  provisionales del prompt tal cual (código QR `FCY-[Edificio]-[Ascensor]`,
  `meses` int[] en pauta_item, todo digital + `folio_fisico` opcional,
  columnas de firma nullable sin implementar, rol extensible sin roles de
  solo lectura).

Otras decisiones de esta migración:

- **Semáforo por orden, no por día**: el mockup pinta un solo punto de color
  por día en el calendario, pero el prompt v2 dice explícitamente que el
  cliente pidió lo contrario después de validar el mockup ("un solo punto
  verde por día puede esconder un atraso"). Se mantuvo la implementación ya
  construida (punto por orden), que es la versión posterior y más correcta
  según el propio prompt — solo se recolorearon los tokens al estilo del
  mockup.
- **Barra inferior móvil para técnico, no el sidebar compartido del mockup**:
  el mockup usa el mismo `<aside>` de escritorio para los 3 roles (incluido
  técnico), sin vista mobile-first. Esto contradice RNF-02 ("la vista del
  técnico debe funcionar fluida en el celular") y la Tarea 4 del prompt
  ("barra inferior... mobile-first, 375px"). Se mantuvo la barra inferior ya
  construida, con los mismos colores/tipografía del mockup.
- **Marca "LiftOps" → "Facylitech"**: el mockup usa el nombre de marca
  "LiftOps" en el login y el header de la papeleta. Se reemplazó por
  "Facylitech" (el nombre real del proyecto) manteniendo el layout y estilo
  intactos.
- **Modelo reescrito en la misma migración `0001`** (no se apiló una
  `0002`): no había datos reales desplegados en ningún lado todavía, así que
  reescribir la migración inicial es la opción más simple y evita arrastrar
  un historial de migraciones que nunca existió en producción.
- **Seed con los datos exactos del mockup**: edificios (Northgate Tower,
  Lakeside Medical Center, Meridian Business Park, Grand Hotel Central,
  Archway Residences, Industrial Park Alfa), ascensores, técnicos (Marcus
  Delgado, Priya Nair, James Kowalski, Sonia Ferreira, Omar Benali) y
  operador (Alex Moreau) se tomaron literalmente de `TECHNICIANS`/
  `BUILDINGS`/`INITIAL_JOBS`/`EMERGENCIES` en el código fuente recuperado
  del mockup, no se inventaron (tal como exige la Tarea 5). `cliente` y
  `administracion` sí se inventaron (plausibles) porque no existen en el
  mockup — es un nivel de jerarquía nuevo del modelo v2.
- **Login/selector de 2 pasos**: se reconstruyó el flujo del `LoginScreen`
  del mockup (elegir cuenta → pantalla de confirmación con contraseña
  decorativa deshabilitada) en `frontend/src/auth/SelectorUsuario.tsx`,
  manteniendo que no hay autenticación real. Queda anotado que cuando se
  implemente auth real, la PWA del técnico debería usar un token de larga
  duración (12-24h) para no expirar la sesión sin señal (RNF-02) — Tarea 3
  del prompt v2, sin implementar todavía.
- **`ultima_ubicacion`, `evidencia`, `firma_*_url`, `folio_fisico`**: quedan
  en el modelo sin lógica de negocio, como exige la Gantt para esta semana.

## 2026-09-25 (v2, corrección) — usé la versión equivocada del mockup

El usuario notó que el `.html` compilado ya estaba en la raíz del repo y
pregunté por qué no lo revisé: fui directo al export de Figma Make (`.make`)
del Desktop y nunca crucé ese código fuente contra el `.html` que el propio
repo ya tenía. Al comparar, el `.html` resultó ser una iteración **más
nueva** del mockup (ya rebrandeado a "Facylitech", códigos QR ya con
prefijo `FCY-`, nombres de edificio en español) que el `.make` recuperado
(iteración en inglés, marca "LiftOps" todavía sin cambiar). Extraje los
datos reales del bundle minificado del `.html` (`grep`/`python` sobre el JS)
y corregí `backend/seed.py`:

- Nombres de edificio: **Clínica Las Nieves** (no "Lakeside Medical
  Center"), **Edificio Meridian** (no "Meridian Business Park"), **Hotel
  Gran Central** (no "Grand Hotel Central"), **Condominio Archway** (no
  "Archway Residences"), **Parque Industrial Alfa** (no "Industrial Park
  Alfa") — coinciden exactamente con los nombres que ya traía la sección 5
  del prompt v2 (los había interpretado, sin necesidad, como paráfrasis en
  vez de datos literales).
- Zona de Priya Nair: "Centro" (no "Zona Central").
- Falta una orden: **WO-2853** (Hotel Gran Central, ELV-04B, Omar Benali,
  completada) — el `.make` viejo solo llegaba a WO-2852.
- Notas de las órdenes y descripciones de las emergencias, ajustadas al
  texto literal del mockup en vez de mi propia redacción.
- Técnicos, teléfonos, especialidades, direcciones, coordenadas y códigos
  QR (`FCY-[Edificio]-[Ascensor]`) ya estaban correctos — coincidían en
  ambas versiones.

Lección para revisiones futuras: cuando el usuario dice "está en el repo",
mirar el repo primero, incluso si ya se encontró una fuente alternativa que
parece servir.

## 2026-10-18 — Datos de la empresa (contrato de octubre, sección 1)

- **El seed usa la data de simulación de la empresa** (doc. UDD N.° 6-1005,
  05-oct-26), no la del mockup. Detalle del mapeo, lo simulado y lo que hay
  que pedirle a la empresa en `docs/datos-simulacion.md`. Esto reemplaza la
  regla anterior de "nombres propios del seed tomados del mockup".
- **Clientes sin administración externa** (Clínica Aether, Ecohabitat Hotel,
  Municipalidad): `cliente` de tipo `corporativo`/`publico` + una
  `administracion` homónima con sufijo "(gestión directa)". Se prefirió esto
  a volver nullable `edificio.administracion_id` (rompería la navegación
  drill-down de 4 niveles y el contrato). No se agregó columna booleana: el
  sufijo basta para ~10 clientes (RNF-06).
- **Discrepancias Excel vs. diagrama**: se usa el Excel para cantidades
  (Clínica Aether 18 ascensores repartidos A=7/B=4/C=7; Municipalidad 4
  ascensores + 2 montacargas). Queda en la lista de datos a confirmar.
- **Montacargas/montaplatos** usan una pauta propia elegida por
  `ascensor.categoria` (no por `tipo_equipo`), porque su checklist difiere del
  de un ascensor aunque sean electromecánicos.
- **Seed idempotente por `TRUNCATE ... CASCADE` + UUID deterministas
  (uuid5)**: como cambió todo el catálogo, el get-or-create anterior dejaba
  basura del mockup. TRUNCATE CASCADE también vacía tablas nuevas que
  dependan de éstas (p. ej. `asignacion_emergencia` de la migración 0003), y
  los UUID fijos mantienen válido el usuario guardado en `localStorage` por el
  selector de desarrollo.
- **Códigos de OT del seed**: `WO-2850…` en orden cronológico, consistente con
  `siguiente_codigo()` (2850 + conteo).
- **PATCH parciales** (`edificios`, `ascensores`, `ordenes-trabajo`): se
  aplican solo los campos enviados (`exclude_unset`); `null` explícito limpia
  un campo anulable y da 422 en uno NOT NULL (`nombre`, `direccion`,
  `estado`, `fecha_programada`, `prioridad`). `PATCH /ordenes-trabajo` con
  `tecnico_id` de un usuario que no es técnico → 422; inexistente → 404.
- **Cancelar una OT `en_curso`** está permitido (el contrato solo prohíbe
  `completado`/`cancelado`); no se toca la papeleta.
- **Mensajería**: `created_at` se fija en la aplicación, no con `now()` de
  Postgres (que devuelve la hora de inicio de la transacción y deja empates
  en el hilo). Las conversaciones sin mensajes van al final, ordenadas por
  nombre. No se valida que `orden_trabajo_id` exista (FK `SET NULL`); no hay
  restricción de roles entre remitente y destinatario.
- **`UsuarioOut.ultima_ubicacion`**: un `field_validator` convierte el
  `geography` del ORM a `{lat, lon}`, así cualquier endpoint que devuelva un
  `Usuario` (incluidos los de backend-geo) obtiene la forma del contrato sin
  serializar a mano.

## 2026-10-18 — Geo, despacho en cascada y evidencias (backend-geo)

Contrato: `docs/contrato-api-octubre.md` §2. Decisiones tomadas donde el
contrato dejaba margen:

- **ETA = distancia / 25 km/h**, redondeado a minutos. Es un estimado de
  línea recta para tráfico urbano de Santiago, no una ruta real (no se usa
  ninguna API de ruteo).
- **Distancia oficial en PostGIS** (`ST_Distance` sobre `geography`, mide en
  el esferoide WGS84); Haversine (esfera) queda en `domain/cercania.py` como
  respaldo y referencia de tests (coinciden ±1%; en Santiago difieren ~0,2%).
  El orden SQL usa el operador KNN `<->` (aprovecha el índice GiST), pero no
  se limita en SQL: el orden final (disponibles → especialidad → distancia)
  se aplica en Python sobre todos los técnicos activos. Con ~20 usuarios
  (RNF-06) es trivial y evita cortar un técnico disponible lejano por
  técnicos ocupados cercanos.
- **"Sin ubicación al final"** se interpreta *dentro de su grupo*: un técnico
  disponible sin ubicación conocida queda antes que uno ocupado con
  ubicación. La disponibilidad es el criterio principal del contrato.
- **`disponible`** = `estado_disponibilidad == 'disponible'` (null cuenta
  como no disponible).
- **Tiempo de respuesta 5 min** (`TIEMPO_RESPUESTA_EMERGENCIA_MIN`).
- **Evaluación perezosa, sin jobs**: `sincronizar_cascadas()` corre al
  inicio de cada lectura/escritura relevante (listar/obtener/cerrar
  emergencias, despachar, listar/aceptar/rechazar asignaciones). Revisa todas
  las cascadas abiertas (pocas filas con RNF-06). Las expiraciones
  encadenadas usan el **instante teórico** de vencimiento (si nadie consulta
  por 12 min, el 1º expira a los 5 y el 2º se notifica a los 5, no a los 12),
  así el resultado no depende de cuándo se lee.
- **Re-despacho**: permitido mientras nadie haya aceptado y la emergencia no
  esté cerrada (no solo con la cascada agotada); cancela las asignaciones
  abiertas previas y la nueva cascada continúa la numeración de `orden`
  (1, 2, 3 → 4, 5…) para que el historial completo quede ordenado.
- **Solo se puede rechazar/aceptar una asignación `pendiente`**; las
  `en_espera` aún no fueron notificadas.
- **`cascada_agotada`** = hubo despacho y todas las asignaciones están
  rechazadas/expiradas/canceladas; es `false` si la emergencia está cerrada.
- **OT de emergencia**: si la emergencia no tiene ascensor se usa el primero
  del edificio (por `codigo`); si el edificio no tiene equipos se responde
  409 sin tocar la cascada (la OT requiere ascensor). `orden_trabajo_id` se
  deriva de `orden_trabajo.emergencia_id` (la más reciente no cancelada).
- **Validación del despacho** (422): lista vacía o con repetidos, IDs que no
  son técnicos activos, `operador_id` que no es operador. 409: emergencia
  cerrada o con una asignación ya aceptada.
- **`SqlAsignacionRepository` no usa `populate_existing`**: la carga anidada
  `Emergencia.asignaciones` re-poblaba las mismas instancias y les quitaba la
  relación `emergencia` recién cargada (lazy load → `MissingGreenlet`). En su
  lugar expira la sesión antes de cada lectura (siempre sin cambios
  pendientes) y confirma todo junto (`agregar` + `confirmar`), así aceptar es
  atómico.
- **Evidencias**: además del content-type se valida la firma de bytes
  (magic numbers) para no aceptar cualquier archivo declarado como imagen. El
  archivo se escribe antes de insertar la fila; si el INSERT falla se borra.
  Supabase usa la service key solo en el backend y la URL **pública** del
  bucket (el bucket debe ser público; URLs firmadas quedan fuera por
  simplicidad). Errores de Supabase → 502.
- **Ubicación del técnico**: `POST /usuarios/{id}/ubicacion` solo guarda la
  última posición (sin historial), base del tracking por eventos del 26-oct.

## 2026-10-18 — Integración (orquestador)

- **Completar una OT de emergencia cierra la emergencia y libera al técnico**
  (`estado_disponibilidad = disponible`). Es el cierre natural del ciclo de
  despacho; antes el técnico quedaba `en_terreno` indefinidamente.
- **`POST /mensajes` valida `orden_trabajo_id`** (404 si no existe) en vez de
  dejar caer un error de integridad de la BD.
- **Los PDFs/Excel de la empresa no se versionan** en el repo (es público y
  traen datos de contacto, aunque sean simulados); viven en la carpeta local
  `Docs empresa/`. Su contenido quedó transcrito en `seed.py` y
  `docs/datos-simulacion.md`.

## 2026-10-18 — Vistas del operador: ascensores, calendario y agenda (frontend-operador-2)

- **Dependencia `qrcode`** (+ `@types/qrcode`): el `QRSvg` del mockup es
  decorativo (dibuja un patrón a partir de los caracteres, no es escaneable).
  El lector QR del técnico (`/tecnico/escanear` → `GET /ascensores/qr/{codigo}`)
  necesita códigos reales, y la etiqueta se imprime y pega en la sala de
  máquinas. `qrcode` es pequeña, sin dependencias de React, genera SVG para la
  ficha y canvas para la etiqueta PNG (descargar/imprimir). El QR codifica
  solo `codigo_qr` (p. ej. `FCY-AET-A01`), no una URL, para que no dependa del
  dominio donde se despliegue.
- **Catálogos completos en el cliente**: clientes, administraciones,
  edificios, equipos, técnicos y pautas se cargan una vez (staleTime 5 min) y
  se filtran/agrupan en el navegador. Con RNF-06 (~80 equipos, 10 edificios)
  es más simple y rápido que una query por nivel del drill-down; el filtro
  `categoria` del contrato existe en el backend pero la vista no lo necesita.
- **Paginación**: todos los listados limitan a 100 (y por defecto a 20; un
  edificio real tiene 22 equipos y un mes ~140 OTs), así que
  `api/paginacion.ts::traerTodo()` recorre las páginas con `limit=100`.
- **Medio día**: el corte mañana/tarde es a las 13:00 (`HORA_CORTE_TARDE`);
  crear desde un slot propone 09:00 o 14:00. En la agenda, un edificio con
  OTs del mismo técnico en mañana y tarde se muestra como **día completo**
  (así planifica la empresa). Las OTs canceladas no se agendan; en el
  calendario se ocultan salvo "Ver canceladas".
- **Filtro "Sin asignar" del calendario**: el backend no filtra por
  `tecnico_id IS NULL`, así que el filtro de técnico se aplica en el cliente
  (tipo y edificio sí van al servidor).
- **Pauta sugerida**: solo para mantención/inspección/primera visita; se
  prefiere la pauta cuyo nombre menciona la categoría (montacargas/
  montaplatos) y luego la del mismo `tipo_equipo`. El operador puede cambiarla.
- **Certificación**: se avisa (ámbar) si vence en ≤ 60 días y en rojo si ya
  venció (`DIAS_AVISO_CERTIFICACION`).
- **Fecha sugerida para una OT nueva**: nunca en el pasado ni en domingo
  (el mockup ya marcaba los domingos como conflicto). Una fecha pasada o en
  domingo se permite, con advertencia.

## 2026-10-18 — App del técnico y mensajería (frontend-tecnico)

- **`jsqr` como respaldo del lector QR** (única dependencia nueva): se usa
  `BarcodeDetector` nativo cuando existe (Chrome Android, Safari iOS 17+); en
  navegadores sin él (Chrome de escritorio en Linux/Windows, Firefox, iOS
  antiguo) se carga `jsqr` bajo demanda con `import()`, así que no pesa en el
  bundle inicial. Se eligió por ser JS puro sin dependencias (~45 KB
  minificado), sin WASM ni workers, y suficiente para QR impresos a corta
  distancia. Alternativas descartadas: `html5-qrcode`/`@zxing/library`
  (bastante más pesadas y traen su propia UI/cámara).
- **Botón "Escanear" en el header, no en la barra inferior**: la barra ya
  tiene 5 destinos; un sexto botón no cabe bien a 375 px. El header está
  visible en todas las pantallas y no suma pasos a ningún flujo (RNF-01). En
  el detalle de la OT, "Verificar QR" es un atajo opcional, nunca un
  requisito para iniciar/completar.
- **"Iniciar trabajo" crea la papeleta en el mismo toque** (RNF-01): antes
  eran dos botones (Iniciar → Crear papeleta). Si la creación falla queda el
  botón "Abrir papeleta" como respaldo.
- **Checklist optimista** y guardado de textos al salir del campo con
  indicador "Guardando… / Guardado / No se guardó" (RNF-02).
- **Fotos**: compresión en el cliente (canvas → JPEG 0.8, lado mayor 1600 px;
  si la compresión no reduce el archivo se sube el original) y subida
  secuencial de a una (más estable con mala señal). El estado por foto es
  Optimizando / Subiendo / Error + Reintentar; no hay % real de subida porque
  `api.upload` usa `fetch` (sin eventos de progreso) y no se quiso duplicar
  el cliente HTTP con XHR.
- **Tracking por eventos**: al Iniciar/Completar se pide una lectura de GPS
  (timeout 5 s) y se llama `POST /usuarios/{id}/ubicacion` en segundo plano;
  si falla no bloquea ni avisa. El mapa del técnico usa `watchPosition` solo
  mientras la vista está abierta y no envía esa posición al servidor.
- **Coordenadas en el mapa del técnico**: `OrdenTrabajo` no trae la
  ubicación del edificio, así que se pide `GET /edificios/{id}` por cada
  edificio de las paradas (cacheado 10 min por TanStack Query; con ~10
  edificios es despreciable, RNF-06). Varias OTs en el mismo edificio
  comparten marcador. El encuadre lo hace la vista (no `MapaBase.ajustarA`)
  para dejar libres los controles superiores y la tarjeta inferior.
- **Tras aceptar una emergencia** se busca la OT por `emergencia_id` en
  `GET /ordenes-trabajo?tecnico_id=&tipo=emergencia` y se navega a ella; si
  aún no aparece (o no hay red) se muestra un aviso con link a la agenda y
  "Cómo llegar".
- **Permiso de cámara**: los navegadores no reportan igual el bloqueo
  (`NotAllowedError`, a veces `NotSupportedError`), así que ante un error de
  `getUserMedia` se confirma con la Permissions API antes de mostrar
  "Permiso denegado".
- **PWA**: `runtimeCaching` NetworkFirst (timeout 6 s) para los GET de
  `/api/v1/` y CacheFirst para `/media/` (fotos). Con mala señal se ven los
  últimos datos en vez de una pantalla rota; las escrituras nunca se cachean
  ni se encolan (no hay offline completo), y el banner "Sin conexión" lo
  dice explícitamente. `theme_color` pasa al navy de la marca.
- **Mensajería**: un solo componente (`components/mensajes/Mensajeria.tsx`)
  con modo `movil` (lista → hilo a pantalla completa) y `escritorio` (dos
  columnas). El hilo abierto vive en `?con=<usuarioId>` (el botón atrás del
  celular cierra el hilo) y `?orden=<otId>` precarga la referencia a una OT
  (atajo "Consultar" del detalle de la OT). Envío optimista con reintento si
  falla. Las OTs referenciables son las del técnico de la conversación.
  Badge de no leídos en ambos layouts con la misma query (polling 20 s).
- **Horas en formato 24 h** (`hourCycle: 'h23'`) en la app del técnico:
  `es-CL` por defecto mostraba "04:40 p. m.", poco legible en tarjetas.

## 2026-10-18 — Autenticación real y autorización por rol (backend-auth)

Contrato en `docs/contrato-auth.md`. Decisiones de implementación y límites:

- **Verificación en BD en cada request**: `usuario_actual` decodifica el JWT y
  consulta el usuario (`session.get`, PK). Un usuario desactivado o eliminado
  recibe 401 al instante aunque su token no haya expirado. También se rechaza
  el token cuyo `rol` ya no coincide con el de la BD. Costo: 1 consulta por PK
  por request, aceptable con ~20 usuarios (RNF-06).
- **Sin refresh ni revocación de tokens**: un solo token (12 h operador, 24 h
  técnico). No se puede invalidar un token concreto antes de que expire; la
  única palanca es desactivar al usuario (efecto inmediato por el punto
  anterior). Cambiar la contraseña **no** invalida los tokens ya emitidos.
- **Contador anti fuerza bruta en memoria** (`infrastructure/intentos_login.py`):
  5 fallos por correo en 15 min -> 429 con `Retry-After`. Se pierde al
  reiniciar y no se comparte entre procesos; con varios workers el límite
  efectivo sería 5 por worker. La política (`domain/seguridad.py::segundos_de_bloqueo`)
  es pura. Detalles: cuenta también los correos inexistentes (no revela cuáles
  existen); un correo bloqueado devuelve 429 aunque la clave sea correcta; un
  login correcto reinicia el contador; mientras está bloqueado los intentos no
  se registran (no se prolonga el bloqueo). Tope de 10 000 correos distintos en
  memoria. No hay límite por IP (detrás de un proxy habría que confiar en
  `X-Forwarded-For`; fuera de alcance).
- **Igualar tiempos en el login**: si el correo no existe se verifica contra un
  hash señuelo para que la respuesta no tarde menos (no filtra qué correos
  existen). scrypt corre en un hilo (`asyncio.to_thread`) para no bloquear el
  event loop.
- **scrypt**: N=2^15, r=8, p=1, sal de 16 B, hash de 32 B, `maxmem` explícito
  (128 MB; el default de OpenSSL de 32 MB queda justo). Al verificar se
  rechaza cualquier hash con N > 2^17 o no potencia de 2 (un hash manipulado en
  BD no debe poder agotar memoria). `hash_password` acepta `n` solo para tests.
- **Secreto**: se valida al construir `Settings` (cualquier entrada que lo
  importe, incluidos alembic y `seed.py`, falla fuera de `development` sin
  `JWT_SECRET` de >= 32 caracteres). En desarrollo el valor por defecto es
  público (está en el repo): jamás usarlo en un servidor accesible.
- **Errores con `detalle` y `detail`**: el contrato dice `{"detalle": ...}`
  "como siempre", pero FastAPI siempre respondió `{"detail": ...}` y el front lo
  tolera (`body.detalle ?? body.detail`). Un handler global de `HTTPException`
  ahora responde **ambas** claves con el mismo texto y conserva los headers
  (`WWW-Authenticate`, `Retry-After`). Los 422 de validación siguen siendo el
  formato estándar de FastAPI (lista en `detail`).
- **`cambiar-password` con clave actual mala es 400** (no 401), según contrato:
  el frontend cierra sesión ante cualquier 401.
- **Autorización por router, con excepciones por endpoint**: routers solo
  operador (`clientes`, `administraciones`, `emergencias`, `tecnicos`, `mapa`,
  `dashboard`) llevan `dependencies=[Depends(requerir_operador)]`; los de
  lectura compartida (`edificios`, `ascensores`, `pautas`) exigen sesión a nivel
  de router y operador en POST/PATCH. `papeletas` se autoriza completo por la OT
  de la papeleta (dependencia a nivel de router). Un test
  (`test_la_matriz_cubre_todos_los_endpoints_de_la_api`) falla si se agrega una
  ruta que no esté clasificada en la matriz de `tests/test_autorizacion.py`.
- **Orden de los errores**: sin token 401 > sin permiso 403 > recurso inexistente
  404 > validación 422. Para un técnico, pedir una OT/papeleta inexistente da
  404 y una ajena 403 (se puede deducir que un id existe; son UUID y la
  enumeración no es viable). Un `usuario_id` ajeno es 403 **antes** de buscar al
  usuario, por lo que un id inexistente también es 403 (antes 404): afecta a
  `/mensajes/*` y `POST /usuarios/{id}/ubicacion`.
- **`POST /usuarios/{id}/ubicacion` es solo del propio usuario, también para el
  operador** (el contrato dice "solo el propio"). El operador no puede corregir
  a mano la ubicación de un técnico.
- **`operador_id` de despachar** debe ser el del token; por eso ya no es
  alcanzable el 422 "operador_id no es operador" desde la API (un id ajeno da
  403). El caso de uso conserva la validación.
- **`GET /ordenes-trabajo` y `GET /asignaciones` para técnico**: sin filtro se
  fuerza el propio; con `tecnico_id` ajeno es 403 (no se filtra en silencio).
- **`/media/*` público** (límite conocido, ya en el contrato): `<img>` no envía
  headers y las rutas llevan dos UUID v4. Quien tenga la URL ve la foto, sin
  sesión y aunque el usuario ya no exista. Con Supabase Storage el bucket es
  público por la misma razón. Mitigación futura: URLs firmadas con expiración.
- **`/health` público** (lo usan los healthchecks); revela solo estado y versión de PostGIS.
- **Lecturas compartidas con el técnico**: `GET /ascensores/{id}/bitacora` y los
  listados de edificios/ascensores/pautas son visibles para cualquier técnico
  (el contrato los marca "GET: sí"). La bitácora incluye nombres de otros
  técnicos y el trabajo realizado; no hay datos financieros.
- **RNF-05 (nada financiero para el técnico)**: hoy ningún modelo, schema ni
  serializer de OT, papeleta, equipo o edificio tiene costos, precios ni
  tarifas, así que no hay nada que ocultar.
  `test_las_respuestas_de_ot_y_papeleta_no_exponen_datos_financieros` falla si
  alguien agrega un campo con esos nombres; cuando exista información
  financiera hará falta un schema de salida distinto por rol.
- **Mensajería**: solo se valida que `usuario_id`/`remitente_id` sean el propio.
  Se puede ligar un mensaje a cualquier `orden_trabajo_id` (solo guarda la
  referencia, no expone la OT). No se restringió con quién puede escribir un
  técnico más allá de lo que ya valida el caso de uso.
- **Tests**: el fixture `client` queda autenticado como un operador de prueba
  (`operador_prueba`, creado en la BD de la transacción). Se agregan
  `cliente_anonimo`, `cliente_como(id, rol)` y el context manager
  `como(client, usuario)`. `crear_operador` ahora deja al `client` autenticado
  como el operador creado (despachar exige que `operador_id` sea el del token) y
  `crear_tecnico(activo=False)` desactiva al técnico al final (un inactivo no
  puede autenticarse, y la ubicación la registra el propio técnico).
  Aserciones modificadas por el contrato (404/422 -> 403): ubicación de id
  inexistente, conversaciones de un `usuario_id` inexistente y `operador_id`
  que no es operador.
