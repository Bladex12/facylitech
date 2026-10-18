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
