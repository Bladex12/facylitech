"""Autenticación real: usuario.password_hash

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-18

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # NULL = el usuario no puede iniciar sesión hasta que un operador le fije clave.
    op.add_column("usuario", sa.Column("password_hash", sa.String(200), nullable=True))


def downgrade() -> None:
    op.drop_column("usuario", "password_hash")
