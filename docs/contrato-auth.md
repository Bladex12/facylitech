# Contrato de autenticación real (octubre 2026)

Reemplaza el selector de usuario de desarrollo (sin contraseña) por login con
correo + contraseña, token firmado y autorización por rol en el backend.
Fuente de verdad compartida entre backend y frontend. Todo bajo `/api/v1`.

## Decisiones de diseño

- **Token JWT (HS256) en header `Authorization: Bearer <token>`**, librería
  `PyJWT`. Claims: `sub` (id de usuario), `rol`, `iat`, `exp`. Sin refresh
  token: un solo token con duración larga (el técnico trabaja en terreno sin
  señal y no puede reautenticarse a mitad de turno, RNF-02): **operador 12 h,
  técnico 24 h** (configurables: `JWT_TTL_OPERADOR_HORAS`,
  `JWT_TTL_TECNICO_HORAS`).
- **Contraseñas** con `scrypt` de la biblioteca estándar (`hashlib.scrypt`,
  sal aleatoria de 16 bytes, N=2^15, r=8, p=1), formato
  `scrypt$N$r$p$<sal_b64>$<hash_b64>`, comparación en tiempo constante. Sin
  dependencias nuevas para hashing. Mínimo 8 caracteres.
- **Secreto**: `JWT_SECRET` por variable de entorno. En `ENVIRONMENT=development`
  hay un valor por defecto inseguro y se emite un warning al arrancar; en
  cualquier otro entorno el backend **no arranca** si falta o si tiene menos
  de 32 caracteres.
- **Anti fuerza bruta**: 5 intentos fallidos por correo en 15 minutos →
  `429` con `Retry-After`. Contador en memoria (RNF-06: ~20 usuarios, un solo
  proceso; documentar la limitación).
- **Mensajes de error genéricos** en login: correo inexistente, contraseña
  errónea y usuario inactivo devuelven el mismo `401`.
- **Sin registro público** ni "olvidé mi contraseña" por correo (no hay
  servicio de correo). Un operador crea usuarios y restablece contraseñas.
- **Token en `localStorage`** (necesario para el PWA offline-first del técnico).
  Riesgo XSS aceptado y documentado; mitigación: no renderizar HTML crudo.
- **`/media/*` (fotos de evidencia) sigue público** porque `<img>` no puede
  enviar headers; las rutas contienen dos UUID v4 (no enumerables). Queda
  documentado como límite conocido.

## Endpoints nuevos

| Método y ruta | Quién | Cuerpo | Respuesta |
|---|---|---|---|
| `POST /auth/login` | público | `{email, password}` | `200 {access_token, token_type: "bearer", expira_at, usuario}` · `401` · `429` |
| `GET /auth/me` | autenticado | — | `200 Usuario` · `401` |
| `POST /auth/cambiar-password` | autenticado | `{password_actual, password_nueva}` | `204` · `400` (actual incorrecta, nueva < 8 o igual a la actual) |
| `PUT /usuarios/{id}/password` | operador | `{password_nueva}` | `204` · `404` · `422` |

- `usuario` es el mismo `Usuario` de `frontend/src/api/types.ts` (sin hash,
  nunca se expone `password_hash`).
- `expira_at`: ISO 8601 con zona.
- `POST /usuarios` (operador) acepta `password` opcional (≥ 8). Un usuario sin
  contraseña no puede iniciar sesión.
- Errores con el formato de siempre (`{"detalle": "..."}`).
  `401` = falta/invalid/expirado el token o credenciales malas (con header
  `WWW-Authenticate: Bearer`); `403` = autenticado pero sin permiso.
  **El frontend cierra sesión ante cualquier `401` de endpoints que no sean
  `/auth/login` ni `/auth/cambiar-password`**; por eso una contraseña actual
  equivocada en `cambiar-password` es `400`, no `401`.

## Migración

`0004` agrega `usuario.password_hash String(200) NULL`. `seed.py` asigna a
todos los usuarios la contraseña de `SEED_PASSWORD` (default
`facylitech2026`, solo para demo; se imprime al terminar). Correos del seed:
`operador@facylitech.cl`, `melvin.zuniga@facylitech.cl`,
`jorge.candia@facylitech.cl`, `juan.cubillos@facylitech.cl`.

## Matriz de autorización (backend)

Dependencias FastAPI en `api/v1/auth.py`: `UsuarioActualDep`,
`OperadorDep` (403 si no es operador). Los routers quedan protegidos a nivel
de router (no endpoint por endpoint) salvo las excepciones públicas.

| Recurso | Operador | Técnico |
|---|---|---|
| `/health`, `/auth/login`, `/media/*` | público | público |
| clientes, administraciones | todo | sin acceso (403) |
| edificios, ascensores, pautas — GET | sí | sí (necesita QR, mapa, ficha) |
| edificios, ascensores, pautas — POST/PATCH | sí | 403 |
| `/ascensores/qr/{codigo}` | sí | sí |
| usuarios — lista y crear, `PUT /usuarios/{id}/password` | sí | 403 |
| `GET /usuarios/{id}` | cualquiera | solo el propio |
| `POST /usuarios/{id}/ubicacion` | solo el propio | solo el propio |
| `/ordenes-trabajo` GET lista | todo | solo las propias (si manda otro `tecnico_id` → 403; si no manda, se fuerza el propio) |
| `/ordenes-trabajo/{id}` GET, `/iniciar`, `/completar`, `/papeleta` | todas | solo si la OT es suya (403 si no) |
| `POST /ordenes-trabajo`, `PATCH`, `/cancelar` | sí | 403 |
| `/papeletas/**` (GET, PATCH, ítems, enviar, piezas, evidencias) | todas | solo si la OT de la papeleta es suya |
| `/emergencias/**` (listar, crear, estado, candidatos, despachar) | sí | 403 (el técnico ve las suyas vía `/asignaciones`, que embebe la emergencia) |
| `GET /asignaciones` | cualquiera | `tecnico_id` debe ser el propio (se fuerza) |
| `POST /asignaciones/{id}/aceptar` y `/rechazar` | 403 | solo si la asignación es suya |
| `/tecnicos/cercanos`, `/mapa`, `/dashboard/calendario` | sí | 403 |
| `/mensajes/*` | `usuario_id`/`remitente_id` debe ser el propio (403 si no) | idem |
| `POST /emergencias/{id}/despachar` | `operador_id` del cuerpo debe ser el propio | — |

Los parámetros `usuario_id`, `tecnico_id`, `remitente_id`, `operador_id` se
mantienen en la API para no romper el contrato existente, pero el servidor
los **valida contra el token** (nunca confía en ellos).

## Frontend

- Ruta pública `/login`: formulario correo + contraseña (mostrar/ocultar
  contraseña, estados de carga y error, mensaje de bloqueo temporal en 429),
  misma identidad visual del mockup (navy/celeste, Barlow). Tras entrar
  redirige a `/operador` o `/tecnico` según `usuario.rol`, o a la ruta que se
  intentaba abrir. Se elimina el selector de cuentas y, desde 2026-11-09, también los
  accesos rápidos de demostración: el login es solo correo + contraseña.
- Sesión en `localStorage` bajo `facylitech.sesion` =
  `{token, usuario, expira_at}`; se borra la clave vieja `facylitech.usuario`.
  `api/client.ts` agrega `Authorization: Bearer` a todo request; ante `401`
  (salvo login/cambiar-password) limpia la sesión y manda a `/login`.
  Al cargar la app valida con `GET /auth/me`; si no hay red, **conserva** la
  sesión (solo se descarta con un `401` explícito o `expira_at` vencido).
- **Al cerrar sesión (y al iniciar una nueva) se vacían las cachés del
  service worker `api-get` y `evidencias`** y la caché de TanStack Query: de
  lo contrario otro usuario en el mismo celular vería datos del anterior.
- "Cambiar contraseña" en el menú de usuario de ambos layouts. En el detalle
  de técnico del operador: "Restablecer contraseña".
