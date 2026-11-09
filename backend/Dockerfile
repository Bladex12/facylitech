# Backend Facylitech (FastAPI) para despliegue con docker-compose.prod.yml.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    MEDIA_DIR=/data/media

WORKDIR /app

# Dependencias primero (capa cacheable). Las ruedas de asyncpg, shapely, etc.
# vienen precompiladas para linux/amd64 y arm64: no hace falta compilador.
COPY pyproject.toml ./
RUN mkdir app && touch app/__init__.py && pip install . && rm -rf app build

COPY app ./app
COPY alembic ./alembic
COPY alembic.ini seed.py crear_operador.py docker-entrypoint.sh ./
RUN pip install --no-deps . \
    && chmod +x docker-entrypoint.sh \
    && useradd --system --uid 1000 facylitech \
    && mkdir -p /data/media && chown -R facylitech /data

USER facylitech
EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/v1/health', timeout=4)"

# Aplica migraciones y levanta uvicorn (ver docker-entrypoint.sh).
ENTRYPOINT ["./docker-entrypoint.sh"]
