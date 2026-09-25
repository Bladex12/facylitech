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
