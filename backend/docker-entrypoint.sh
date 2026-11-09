#!/bin/sh
# Arranque del contenedor del backend: migraciones y luego la API.
set -e

echo "Aplicando migraciones..."
alembic upgrade head

# Un solo proceso a propósito: el contador de intentos de login vive en memoria
# (docs/decisiones.md) y ~20 usuarios no necesitan más (RNF-06).
# --proxy-headers: la API está detrás de Caddy (HTTPS).
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'
