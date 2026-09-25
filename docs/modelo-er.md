# Modelo ER — Facylitech

Generado a partir de `backend/app/infrastructure/db/models.py` (migración `0001_initial`).
Jerarquía de 4 niveles validada con el cliente: **Cliente → Administración → Edificio → Ascensor**.

```mermaid
erDiagram
    CLIENTE {
        uuid id PK
        string nombre
        string tipo "comunidad|fondo_inversion|otro"
    }

    ADMINISTRACION {
        uuid id PK
        uuid cliente_id FK
        string nombre
        string contacto_nombre "nullable"
        string contacto_email "nullable"
        string contacto_telefono "nullable"
        text contacto_alternativo "nullable, ej. suplente del comité"
    }

    EDIFICIO {
        uuid id PK
        uuid administracion_id FK
        string nombre
        string direccion
        string comuna
        string tipo "residencial|hospital|oficina|hotel|industrial"
        geography ubicacion "Point 4326"
        text manas "particularidades del edificio"
        text instrucciones_reinicio
        date vencimiento_certificacion "nullable"
    }

    ASCENSOR {
        uuid id PK
        uuid edificio_id FK
        string codigo UK "ELV-01A"
        string codigo_qr UK "FCY-B01-01A"
        string torre "nullable"
        string numero "nullable"
        string marca "nullable"
        string modelo "nullable"
        int anio_instalacion "nullable"
        int pisos "nullable"
        string tipo_equipo "electromecanico|hidraulico|electrohidraulico"
        string estado "operacional|advertencia|critico|sin_senal"
        float tasa_fallo "nullable"
        text manas "particularidades propias del ascensor"
        date ultima_mantencion "nullable"
    }

    USUARIO {
        uuid id PK
        string nombre
        string email UK
        string rol "operador|tecnico"
        string telefono "nullable"
        boolean activo
        string zona "nullable, solo tecnicos"
        string[] especialidades "nullable, array de Especialidad"
        string estado_disponibilidad "nullable: disponible|en_terreno"
        geography ultima_ubicacion "nullable, Point 4326"
        timestamptz ultima_ubicacion_at "nullable"
    }

    PAUTA_MANTENCION {
        uuid id PK
        string nombre
        string tipo_equipo "a qué tipo de ascensor aplica"
        text descripcion "nullable"
    }

    PAUTA_ITEM {
        uuid id PK
        uuid pauta_id FK
        int orden
        text descripcion
        int[] meses "matriz de frecuencia, 1-12"
        boolean activo
    }

    EMERGENCIA {
        uuid id PK
        string codigo UK "EM-001"
        string tipo "mismos valores que especialidad"
        uuid edificio_id FK
        uuid ascensor_id FK "nullable"
        timestamptz reportada_at
        text descripcion "nullable"
        string solicitante "nullable"
        string estado "activa|en_atencion|cerrada"
    }

    ORDEN_TRABAJO {
        uuid id PK
        string codigo UK "WO-2850"
        string tipo "mantencion|reparacion|inspeccion|primera_visita|emergencia"
        string prioridad
        string estado
        uuid ascensor_id FK
        uuid tecnico_id FK "nullable"
        uuid pauta_id FK "nullable"
        uuid emergencia_id FK "nullable"
        timestamptz fecha_programada
        timestamptz inicio_real "nullable"
        timestamptz fin_real "nullable"
        text descripcion "nullable"
        timestamptz created_at
        timestamptz updated_at
    }

    PAPELETA {
        uuid id PK
        uuid orden_trabajo_id FK "1:1, UK"
        text observaciones "nullable"
        text falla_detectada "nullable"
        text trabajo_realizado "nullable"
        boolean causada_por_terceros
        timestamptz hora_inicio "nullable"
        timestamptz hora_fin "nullable"
        string estado "borrador|enviada"
        string folio_fisico "nullable"
        string firma_tecnico_url "nullable, sin lógica aún"
        string firma_receptor_url "nullable, sin lógica aún"
        string receptor_nombre "nullable"
    }

    PAPELETA_ITEM {
        uuid id PK
        uuid papeleta_id FK
        uuid pauta_item_id FK "nullable"
        text descripcion "copiada de la pauta"
        boolean completado
        timestamptz completado_at "nullable"
        text comentario "nullable"
    }

    PIEZA_REEMPLAZADA {
        uuid id PK
        uuid papeleta_id FK
        string nombre
        string marca "nullable"
        boolean es_original
    }

    EVIDENCIA {
        uuid id PK
        uuid papeleta_id FK
        string url
        string tipo "nullable"
        timestamptz created_at
    }

    CLIENTE ||--o{ ADMINISTRACION : "tiene"
    ADMINISTRACION ||--o{ EDIFICIO : "administra"
    EDIFICIO ||--o{ ASCENSOR : "tiene"
    EDIFICIO ||--o{ EMERGENCIA : "reporta"
    ASCENSOR ||--o{ ORDEN_TRABAJO : "recibe"
    USUARIO ||--o{ ORDEN_TRABAJO : "tecnico asignado"
    PAUTA_MANTENCION ||--o{ PAUTA_ITEM : "define"
    PAUTA_MANTENCION ||--o{ ORDEN_TRABAJO : "plantilla usada"
    EMERGENCIA ||--o{ ORDEN_TRABAJO : "origina"
    ORDEN_TRABAJO ||--o| PAPELETA : "genera"
    PAUTA_ITEM ||--o{ PAPELETA_ITEM : "origina"
    PAPELETA ||--o{ PAPELETA_ITEM : "contiene"
    PAPELETA ||--o{ PIEZA_REEMPLAZADA : "registra"
    PAPELETA ||--o{ EVIDENCIA : "adjunta (sin lógica de subida aún)"
```

## Notas de diseño

- **"Vencido" no es un estado ni columna almacenada**: se calcula en tiempo de
  lectura a partir de `orden_trabajo.estado` y `fecha_programada`
  (`app/domain/semaforo.py`). El semáforo no tiene color propio para
  `cancelado`; se muestra como `completado` (ver más abajo).
- **`meses` en `pauta_item` (RNF-04)**: el checklist se maneja con datos, no
  con código — `app/domain/pauta.py::items_del_mes()` filtra qué ítems
  corresponden al mes en curso al crear la papeleta.
- **La bitácora del ascensor no es una tabla**: es la consulta
  `GET /ascensores/{id}/bitacora` sobre `orden_trabajo` completadas + su
  `papeleta` + `pieza_reemplazada`.
- **Campos preparados sin lógica aún**: `usuario.ultima_ubicacion`,
  `evidencia`, `papeleta.firma_*_url`, `papeleta.folio_fisico` — modelados
  para octubre (tracking GPS, Supabase Storage, firma no vinculante) sin
  implementar su comportamiento.
- Todas las PK son UUID generadas en la aplicación (no se usa `uuid-ossp` ni
  `pgcrypto` en la BD).
- Índices GiST sobre `edificio.ubicacion` y `usuario.ultima_ubicacion`.
