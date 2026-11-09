"""Crea (o reactiva) una cuenta de operador desde la línea de comandos.

Sirve para poner en marcha una instalación con datos reales, sin el seed de
demostración: la API solo deja crear usuarios a un operador ya autenticado, así
que el primero se crea aquí. Después, ese operador crea a los técnicos desde la
app (Técnicos) o con la API.

Uso (pide la contraseña sin mostrarla):
    python crear_operador.py --nombre "Operador Central" --email operador@facylitech.cl

En el servidor con Docker:
    docker compose -f docker-compose.prod.yml --env-file .env.prod exec backend \\
        python crear_operador.py --nombre "..." --email ...

Si el correo ya existe, actualiza su contraseña, lo deja activo y con rol
operador (útil también para recuperar el acceso si se olvidó la contraseña).
"""

import argparse
import asyncio
import getpass
import sys

from sqlalchemy import select

from app.domain.enums import RolUsuario
from app.domain.seguridad import hash_password, validar_password_nueva
from app.infrastructure.db.models import Usuario
from app.infrastructure.db.session import SessionLocal


def _pedir_password() -> str:
    while True:
        password = getpass.getpass("Contraseña: ")
        error = validar_password_nueva(password)
        if error:
            print(error)
            continue
        if getpass.getpass("Repetir contraseña: ") != password:
            print("Las contraseñas no coinciden.")
            continue
        return password


async def crear_operador(nombre: str, email: str, password: str) -> tuple[Usuario, bool]:
    """Devuelve (usuario, creado). Si el correo existe, lo actualiza en vez de duplicarlo."""
    email = email.strip().lower()
    async with SessionLocal() as session:
        usuario = (await session.execute(select(Usuario).where(Usuario.email == email))).scalar_one_or_none()
        creado = usuario is None
        if creado:
            usuario = Usuario(nombre=nombre, email=email, rol=RolUsuario.OPERADOR)
            session.add(usuario)
        usuario.rol = RolUsuario.OPERADOR
        usuario.activo = True
        usuario.password_hash = hash_password(password)
        await session.commit()
        return usuario, creado


def main() -> int:
    parser = argparse.ArgumentParser(description="Crea o reactiva una cuenta de operador.")
    parser.add_argument("--nombre", required=True)
    parser.add_argument("--email", required=True)
    args = parser.parse_args()
    password = _pedir_password()
    usuario, creado = asyncio.run(crear_operador(args.nombre, args.email, password))
    print(f"Operador {'creado' if creado else 'actualizado'}: {usuario.nombre} <{usuario.email}>")
    return 0


if __name__ == "__main__":
    sys.exit(main())
