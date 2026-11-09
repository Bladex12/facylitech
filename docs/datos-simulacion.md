# Datos de simulación de la empresa → modelo de la app

Fuente: **"UDD N.° 6-1005 — Data Simulación App Gestión Operativa"**
(A. Valdivia, 05-oct-2026), entregado por Facylitech. Reemplaza a los datos
ficticios del mockup (Northgate Tower, Marcus Delgado, etc.) en
`backend/seed.py`. Todo lo que no viene en el documento está marcado con
`# SIMULADO` (o `# APROXIMADO`) en el seed.

## 1. Qué entregó la empresa

- **Jerarquía de clientes**: Fondo de inversión → Administración →
  Comunidad/Edificio → sector → equipos.
- **10 comunidades** con cantidad de equipos por categoría (ascensor /
  montacarga / montaplatos), pisos, dirección, contacto(s), fono(s) y correo(s).
- **3 técnicos** con nombre y RUT: Melvin Zúñiga (16.368.248-4), Jorge
  Candia (16.498.146-7), Juan Cubillos (15.298.537-5).
- **Cronograma de mantención** de 3 días (mié 07, jue 08, vie 09 de octubre
  de 2026), columnas por técnico, con los supuestos: dos edificios en un día
  = medio día cada uno; un edificio = día completo; sin considerar distancias
  ni pisos. "Será ideal reutilizar la misma data en un ciclo siguiente".
- Mención a **alertas de incumplimiento de SLA** (sin valores concretos).

| Cliente (modelo) | Tipo | Administración (modelo) | Comunidad | Equipos | Pisos | Comuna |
|---|---|---|---|---|---|---|
| Valora Prime Capital | fondo_inversion | Gestión Hogar y Comunidad | Torre Prisma | 3 asc | 14 | Santiago |
| | | | Terraza Raíces | 2 asc | 8 | Maipú |
| | | Vértice Urbano Administraciones | Torre Bioma | 2 asc + 1 mc | 8 / 3 | Providencia |
| Nexos propiedades y Gestión | administracion | (homónima) | Edificio Ámbar | 4 asc | 18 | Las Condes |
| | | | Nova Horizon | 4 asc | 8-6-6-8 | Ñuñoa |
| | | | Pinnacle Residences (Bloques A/B/C) | 6 asc | 14 | Macul |
| Torreón Administraciones | administracion | (homónima) | Alva Corporate Center (Torre Sur/Norte) | 12 asc | 24 | La Florida |
| Clínica Aether | corporativo | Clínica Aether (gestión directa) | Clínica Aether (Pabellones A/B/C) | 18 asc + 2 mc + 2 mp | 12 / 5 / 3 | Peñalolén |
| Ecohabitat Hotel | corporativo | Ecohabitat Hotel (gestión directa) | Ecohabitat Hotel (Pabellón B) | 4 asc + 2 mc | 12 / 3 | Santiago |
| Municipalidad | publico | Municipalidad (gestión directa) | Municipalidad | 4 asc + 2 mc | 3 / 2 | Vitacura |

Totales en la BD: 6 `cliente`, 7 `administracion` (los "7 clientes" del
documento = administraciones + dueños directos), 10 `edificio`, **68 equipos**
(59 ascensores, 7 montacargas, 2 montaplatos).

## 2. Cómo se mapeó al modelo

- **Fondo de inversión → `cliente` tipo `fondo_inversion`**; sus dos
  administraciones son filas `administracion` con el contacto de la
  administración (Pedro Armas, Jorge Fuentes).
- **Administraciones "múltiples edificios" / "directo o único"** (Nexos,
  Torreón) → `cliente` tipo `administracion` + una `administracion` homónima.
- **Corporativos (Clínica Aether, Ecohabitat Hotel) y sector público
  (Municipalidad)** → `cliente` tipo `corporativo`/`publico` + una
  `administracion` homónima con sufijo **"(gestión directa)"**, para no
  romper la FK `edificio.administracion_id NOT NULL`.
- **Contactos**: cuando la comunidad trae dos contactos, el primero (el de
  la administración) va en `administracion.contacto_*` y el segundo (el de la
  comunidad) en `edificio.contacto_*` (Torre Prisma → Jaime Soto, Terraza
  Raíces → Luis Peña, Municipalidad → Magali Ruiz). Con un solo contacto,
  queda solo en la administración y `edificio.contacto_*` = null. El segundo
  teléfono de Santiago Silva (Clínica Aether) va en
  `administracion.contacto_alternativo`.
- **Sector** (Torre Sur/Norte, Bloque A/B/C, Pabellón A/B/C) → `ascensor.torre`;
  `ascensor.numero` = correlativo dentro del sector.
- **Categoría** → `ascensor.categoria` (`ascensor` | `montacarga` | `montaplatos`).
- **Códigos de equipo**: `codigo = {EDIF}-{A01..|MC1..|MP1..}` y
  `codigo_qr = FCY-{codigo}` (p. ej. `FCY-AET-MC1`). Abreviaturas: PRI, TRA,
  BIO, AMB, NOV, PIN, ALV, AET, ECO, MUN.
- **Pisos de Nova Horizon** "8-6-6-8" → pisos por ascensor (A01=8, A02=6,
  A03=6, A04=8).
- **Cronograma** → una OT `mantencion` por equipo con su pauta. Mañana
  08:30–13:00, tarde 14:00–18:00, día completo = ambos tramos; los equipos se
  reparten parejo dentro del tramo. Edificios que aparecen 2 días (Clínica
  Aether, Alva, Nova Horizon) reparten sus equipos entre esos días (Alva:
  Torre Sur el jueves, Torre Norte el viernes).
- **Ciclos siguientes** ("será ideal reutilizar la misma data en un ciclo
  siguiente"): a partir del cronograma de octubre, el seed genera cada ciclo
  con la regla del botón "Replicar" (+4 semanas, o 5 si con 4 sigue en el mismo
  mes; `domain/replicacion.py`) **hasta el primer ciclo que empieza después de
  la fecha en que se corre**: oct 7–9 → nov 4–6 → dic 2–4 → … Así la demo sigue
  vigente sin importar cuándo se ejecute el seed (antes los ciclos de octubre y
  noviembre estaban fijos y, pasado el 6-nov, las 68 OTs de noviembre aparecían
  vencidas).
- **Estado de los ciclos**: lo ya ocurrido queda `completado` con papeleta
  `enviada` (checklist del mes marcado, trabajo realizado; las piezas
  reemplazadas solo en el ciclo de octubre); lo futuro queda `programado`. Del
  **último ciclo ya iniciado**, 3 OTs quedan `programado` en el pasado →
  semáforo **vencido** (alerta de incumplimiento): AET-A17, AET-A18 (jueves) y
  BIO-MC1 (viernes).

## 3. Qué se simuló o aproximó

| Dato | Qué se hizo |
|---|---|
| Coordenadas | **Aproximadas** a mano (no geocodificadas): punto plausible en la calle/comuna. Varias direcciones parecen ficticias (p. ej. "Calle San Martín 721, Ñuñoa"). |
| Teléfono, email, zona, especialidades de técnicos | Simulados (`+56 9 5511 42xx`, `nombre.apellido@facylitech.cl`). |
| Ubicación y disponibilidad actual de técnicos | Simuladas "hoy": Jorge en terreno en Edificio Ámbar; Melvin disponible en Providencia; Juan disponible en Ñuñoa. |
| Operador | La empresa no entregó uno: cuenta genérica "Operador Central" (operador@facylitech.cl). |
| Marca / modelo / año | Simulados en parte de los equipos (Otis, Schindler, TK Elevator, Mitsubishi, Orona); null en Terraza Raíces, Nova Horizon, montaplatos de Clínica Aether y Municipalidad. |
| Tipo de equipo | Electromecánico por defecto; hidráulico en la Municipalidad (3 y 2 pisos). |
| Mañas, instrucciones de reinicio, vencimiento de certificación | Simulados en algunos edificios/equipos; null en el resto. |
| Pautas | 3 pautas simuladas (electromecánica, hidráulica y una nueva para montacargas/montaplatos), con `meses[]` por ítem. |
| Historial de papeletas (trabajo, piezas, receptor) | Simulado. |
| OTs no-mantención | Reparación en curso hoy (Ámbar A03), inspección mañana (Aether A01), reparación sin técnico (Ecohabitat A02), primera visita esta semana (Municipalidad MC1). |
| Emergencias | EM-001 cerrada (02-oct, Ecohabitat, con OT completada en la bitácora); EM-002 falla mecánica en Clínica Aether y EM-003 persona atrapada en Torre Prisma, **activas y sin despachar**. |
| Mensajes | 4 mensajes de ejemplo operador ↔ técnicos. |

## 4. Datos faltantes o inconsistentes — pedir a la empresa

1. **Clínica Aether — cantidad de ascensores**: el Excel dice 18 ascensores,
   el diagrama suma 16 (Pabellón A 6, B 4, C 6). Se usó 18 repartido
   A=7 / B=4 / C=7. ¿Cuál es el correcto y en qué pabellón están?
2. **Municipalidad — cantidad de ascensores**: Excel 4 ascensores + 2
   montacargas; diagrama 2 + 2. Se usó el Excel (4 + 2).
3. **Coordenadas / direcciones reales** de cada comunidad (algunas
   direcciones no parecen existir o no calzan con la comuna).
4. **Operador(es)**: nombre, correo y teléfono de quién(es) usarán el perfil
   operador.
5. **Técnicos**: teléfono, correo, zona/base habitual y **especialidades**
   (persona atrapada, mecánica, corte de energía, incendio, inundación) —
   necesarias para el despacho en cascada.
6. **Ficha de equipos**: marca, modelo, año de instalación, tipo
   (electromecánico / hidráulico), número/nomenclatura interna de cada
   equipo, vencimiento de certificación.
7. **Pautas reales por tipo de equipo** (ascensor, montacarga, montaplatos;
   electromecánico vs. hidráulico) con su frecuencia por mes.
8. **SLA concretos**: tiempo máximo de respuesta a emergencias (hoy se asume
   5 min por técnico en la cascada), plazo para considerar una mantención
   incumplida (hoy: vencida apenas pasa la hora programada) y cómo se escalan.
9. **Horarios**: confirmar tramos (mañana 08:30–13:00, tarde 14:00–18:00),
   restricciones por edificio (p. ej. hotel, clínica) y si se trabaja fines
   de semana.
10. **Correos `.py`** (pedro@ghc.py, cindy@nexus.py, juan@muni.py, …): el
    dominio `.py` (Paraguay) parece de prueba. ¿Son reales? `cindy@nexus.py`
    además no calza con "Nexos".
11. **Juan Ortega** aparece como contacto de Torreón Administraciones
    (juan@alva.py) y de la Municipalidad (juan@muni.py) con teléfonos
    distintos: ¿es la misma persona?
12. **Contactos de comunidad faltantes**: Torre Bioma, Edificio Ámbar, Nova
    Horizon, Pinnacle Residences, Alva, Clínica Aether y Ecohabitat solo
    traen un contacto (el de la administración/dueño).
13. **Torre Bioma**: tipo de edificio (residencial u oficinas) y a qué
    pisos sirve el montacarga (3).
14. **Mañas e instrucciones de reinicio** reales por edificio/equipo.
15. **Ciclo siguiente**: confirmar que se repite el mismo cronograma cada
    4 semanas (se asumió mié 04 – vie 06 de noviembre, mié 02 – vie 04 de
    diciembre, etc.).
