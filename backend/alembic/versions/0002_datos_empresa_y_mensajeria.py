"""Datos de la empresa (categoría de equipo, RUT, contactos de comunidad) y
tabla de mensajería.

- ascensor.categoria (ascensor | montacarga | montaplatos)
- usuario.rut
- edificio.contacto_nombre / contacto_telefono / contacto_email
- tabla mensaje (operador <-> técnico, REST + polling)

`TipoCliente` y `TipoEdificio` ganan valores nuevos, pero sus columnas son
`String(20)`: no requieren cambio de esquema.

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-18

"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "ascensor",
        sa.Column("categoria", sa.String(20), nullable=False, server_default="ascensor"),
    )
    op.add_column("usuario", sa.Column("rut", sa.String(12), nullable=True))
    op.add_column("edificio", sa.Column("contacto_nombre", sa.String(200), nullable=True))
    op.add_column("edificio", sa.Column("contacto_telefono", sa.String(50), nullable=True))
    op.add_column("edificio", sa.Column("contacto_email", sa.String(255), nullable=True))

    op.create_table(
        "mensaje",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "remitente_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("usuario.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "destinatario_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("usuario.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "orden_trabajo_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("orden_trabajo.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("texto", sa.Text(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("leido_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_mensaje_destinatario_leido", "mensaje", ["destinatario_id", "leido_at"])


def downgrade() -> None:
    op.drop_index("ix_mensaje_destinatario_leido", table_name="mensaje")
    op.drop_table("mensaje")
    op.drop_column("edificio", "contacto_email")
    op.drop_column("edificio", "contacto_telefono")
    op.drop_column("edificio", "contacto_nombre")
    op.drop_column("usuario", "rut")
    op.drop_column("ascensor", "categoria")
