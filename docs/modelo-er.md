# Modelo ER — Facylitech

Generado a partir de `backend/app/infrastructure/db/models.py` (migración `0001_initial`).

```mermaid
erDiagram
    USUARIO {
        uuid id PK
        string nombre
        string email UK
        string rol
        boolean activo
        geography ultima_ubicacion "nullable, Point 4326"
        timestamptz ultima_ubicacion_at "nullable"
    }

    EDIFICIO {
        uuid id PK
        string nombre
        string direccion
        string comuna
        string tipo
        geography ubicacion "Point 4326"
        string contacto_nombre "nullable"
        string contacto_email "nullable"
        string contacto_telefono "nullable"
        text manas "particularidades del edificio"
        text instrucciones_reinicio
    }

    ASCENSOR {
        uuid id PK
        uuid edificio_id FK
        string codigo UK
        string torre "nullable"
        string numero "nullable"
        string marca_modelo "nullable"
        string estado_operativo
        string estado_repuestos "nullable"
    }

    PAUTA_MANTENCION {
        uuid id PK
        string nombre
        text descripcion "nullable"
    }

    PAUTA_ITEM {
        uuid id PK
        uuid pauta_id FK
        int orden
        text descripcion
    }

    ORDEN_TRABAJO {
        uuid id PK
        string codigo UK "WO-2850"
        string tipo
        string prioridad
        string estado
        uuid ascensor_id FK
        uuid tecnico_id FK "nullable"
        uuid pauta_id FK "nullable"
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
    }

    PAPELETA_CHECKLIST_ITEM {
        uuid id PK
        uuid papeleta_id FK
        uuid pauta_item_id FK "nullable"
        text descripcion "copiada de la pauta"
        boolean completado
        timestamptz completado_at "nullable"
        text comentario "nullable"
    }

    EVIDENCIA {
        uuid id PK
        uuid papeleta_id FK
        string url
        string tipo "nullable"
        timestamptz created_at
    }

    EDIFICIO ||--o{ ASCENSOR : "tiene"
    ASCENSOR ||--o{ ORDEN_TRABAJO : "recibe"
    USUARIO ||--o{ ORDEN_TRABAJO : "tecnico asignado"
    PAUTA_MANTENCION ||--o{ PAUTA_ITEM : "define"
    PAUTA_MANTENCION ||--o{ ORDEN_TRABAJO : "plantilla usada"
    ORDEN_TRABAJO ||--o| PAPELETA : "genera"
    PAUTA_ITEM ||--o{ PAPELETA_CHECKLIST_ITEM : "origina"
    PAPELETA ||--o{ PAPELETA_CHECKLIST_ITEM : "contiene"
    PAPELETA ||--o{ EVIDENCIA : "adjunta (sin lógica de subida aún)"
```

## Notas de diseño

- **"Vencido" no es un estado ni columna almacenada**: se calcula en tiempo de
  lectura a partir de `orden_trabajo.estado` y `fecha_programada` (regla de
  dominio en `app/domain/semaforo.py`). El semáforo (`completado` | `vencido` |
  `en_curso` | `programado`) no tiene un color propio para `cancelado`; una
  orden cancelada se muestra como `completado` (ver `docs/decisiones.md`).
- `usuario.ultima_ubicacion` y `evidencia` quedan modelados pero sin lógica de
  negocio todavía — se activan en las tareas de octubre (tracking GPS, storage
  de fotos en Supabase).
- Todas las PK son UUID generadas en la aplicación (no se usa `uuid-ossp` ni
  `pgcrypto` en la BD).
- Índices GiST sobre `edificio.ubicacion` y `usuario.ultima_ubicacion` para
  las futuras consultas geoespaciales (asignación por cercanía, octubre).
