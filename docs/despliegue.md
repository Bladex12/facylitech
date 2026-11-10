# Despliegue de Facylitech

Guía para dejar la app funcionando en un servidor (Gantt: "Despliegue — sujeto a
factibilidad de servidor"). Facylitech todavía no define dónde se alojará, así
que el despliegue quedó **empaquetado y reproducible**: cualquier servidor Linux
con Docker lo levanta con un solo comando.

## Qué se levanta

| Servicio | Imagen | Qué hace | Puertos |
|---|---|---|---|
| `db` | `postgis/postgis:16-3.4` | PostgreSQL 16 + PostGIS | solo red interna |
| `backend` | `backend/Dockerfile` | FastAPI; aplica las migraciones al arrancar | solo red interna |
| `web` | `frontend/Dockerfile` | Caddy: sirve el frontend, reenvía `/api` y `/media` al backend y entrega **HTTPS** | 80 y 443 |

Web y API comparten dominio (sin CORS). **HTTPS es obligatorio en la práctica**:
los navegadores del celular solo dan acceso al GPS, a la cámara (lector QR,
fotos) y a la instalación como app (PWA) en sitios seguros. Caddy obtiene y
renueva el certificado de Let's Encrypt automáticamente.

Volúmenes persistentes: `db-data` (base de datos), `media` (fotos de evidencia
con `STORAGE_BACKEND=local`) y `caddy-data` (certificados).

## Requisitos del servidor

- Linux (Ubuntu 22.04/24.04 o similar) con Docker Engine y el plugin `docker compose`.
- 1 vCPU y 1–2 GB de RAM alcanzan para ~20 usuarios (RNF-06).
- Puertos 80 y 443 abiertos hacia internet.
- Un dominio o subdominio (p. ej. `app.facylitech.cl`) con un registro DNS tipo A
  apuntando a la IP del servidor.

## Puesta en marcha

```bash
git clone <repositorio> facylitech && cd facylitech
cp .env.prod.example .env.prod
# Editar .env.prod: DOMINIO, JWT_SECRET y POSTGRES_PASSWORD (obligatorios).
# Para generar secretos:
python3 -c "import secrets; print(secrets.token_urlsafe(48))"

docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.prod ps   # los 3 servicios "healthy"/"running"
```

Abrir `https://<DOMINIO>`. La documentación de la API queda en `https://<DOMINIO>/docs`.

El backend **no arranca** si `JWT_SECRET` falta o tiene menos de 32 caracteres
(protección deliberada fuera de desarrollo).

### Opción A — Demostración con los datos de simulación de la empresa

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod exec backend python seed.py
```

Carga las 10 comunidades, 68 equipos, 3 técnicos y los ciclos de mantención
(ver `docs/datos-simulacion.md`). Todas las cuentas quedan con `SEED_PASSWORD`.

> `seed.py` **borra** todas las tablas de negocio antes de cargar. Nunca correrlo
> sobre una instalación con datos reales.

### Opción B — Instalación real (sin datos de demostración)

Crear la primera cuenta de operador (pide la contraseña sin mostrarla):

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod exec backend \
    python crear_operador.py --nombre "Nombre Apellido" --email persona@facylitech.cl
```

Con esa cuenta, el operador crea a los técnicos y les asigna contraseña desde
**Técnicos** en la app. La carga de clientes, edificios y equipos se hace desde
**Ascensores** (o con la API); la primera inspección técnica de Facylitech
registra número y torre de cada equipo (alcance).

El mismo comando sirve para recuperar el acceso de un operador: si el correo ya
existe, le cambia la contraseña y lo reactiva.

## Probar en una red local (sin dominio)

Con `DOMINIO=localhost` o `DOMINIO=<IP del servidor>`, Caddy usa un certificado
propio: el navegador muestra una advertencia que hay que aceptar una vez. Sirve
para probar en el computador y en celulares de la misma red Wi-Fi, pero para
instalar la PWA y usar GPS/cámara sin fricción conviene un dominio real.

## Fotos de evidencia en Supabase (opcional)

Por defecto las fotos se guardan en el volumen `media` del servidor. Para usar
Supabase Storage: crear un bucket **público** (p. ej. `evidencias`) y completar
en `.env.prod`:

```
STORAGE_BACKEND=supabase
SUPABASE_URL=https://<proyecto>.supabase.co
SUPABASE_SERVICE_KEY=<service_role key>
SUPABASE_BUCKET=evidencias
```

## Operación

```bash
# Logs
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f backend

# Actualizar a una nueva versión (las migraciones se aplican solas al arrancar)
git pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

# Respaldo de la base de datos
docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T db \
    pg_dump -U facylitech -Fc facylitech > respaldo-$(date +%F).dump

# Restaurar un respaldo
docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T db \
    pg_restore -U facylitech -d facylitech --clean --if-exists < respaldo-AAAA-MM-DD.dump

# Respaldo de las fotos (STORAGE_BACKEND=local)
docker run --rm -v facylitech_media:/m -v "$PWD":/r alpine tar czf /r/media-$(date +%F).tgz -C /m .
```

## Límites conocidos (ver docs/decisiones.md)

- **Un solo proceso del backend**: el contador de intentos de login vive en
  memoria. No escalar `backend` a varias réplicas sin moverlo a la base de datos.
- **Sin revocación de tokens**: cambiar una contraseña no cierra las sesiones ya
  abiertas (duran 12 h el operador y 24 h el técnico).
- **`/media` es público** (rutas con UUID imposibles de adivinar).
- Las notificaciones al técnico son por *polling* cada 10 s (no hay push).

## Cómo se verificó

Las imágenes Docker no se pudieron construir en el entorno de desarrollo usado
(sin acceso a Docker Hub), así que se verificaron sus piezas por separado con
las mismas versiones: instalación limpia del backend con `pip install .`,
`docker-entrypoint.sh` en modo `production` (rechaza un `JWT_SECRET` vacío,
aplica las 4 migraciones sobre una base vacía y levanta la API), el `Caddyfile`
real con Caddy 2 sirviendo el build de producción por HTTPS (SPA, `/api`,
`/media`, `/docs`, cabeceras de caché del service worker) y un recorrido con
navegador: login, iniciar OT, subir una foto de evidencia y verla, registro de
la PWA con scope `/tecnico/`, y `crear_operador.py` sobre la base vacía.
**Pendiente:** correr `docker compose -f docker-compose.prod.yml up --build`
una vez en una máquina con Docker (p. ej. Docker Desktop) antes de la entrega.
