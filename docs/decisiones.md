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
