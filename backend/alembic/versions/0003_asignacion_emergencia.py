"""Despacho en cascada: tabla asignacion_emergencia

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-18

"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "asignacion_emergencia",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "emergencia_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("emergencia.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "tecnico_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("usuario.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("orden", sa.Integer(), nullable=False),
        sa.Column("estado", sa.String(20), nullable=False, server_default="en_espera"),
        sa.Column("distancia_m", sa.Float(), nullable=True),
        sa.Column("notificada_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("respondida_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("motivo_rechazo", sa.Text(), nullable=True),
        sa.Column(
            "operador_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("usuario.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index(
        "ix_asignacion_emergencia_emergencia_id", "asignacion_emergencia", ["emergencia_id", "orden"]
    )
    op.create_index(
        "ix_asignacion_emergencia_tecnico_estado", "asignacion_emergencia", ["tecnico_id", "estado"]
    )


def downgrade() -> None:
    op.drop_index("ix_asignacion_emergencia_tecnico_estado", table_name="asignacion_emergencia")
    op.drop_index("ix_asignacion_emergencia_emergencia_id", table_name="asignacion_emergencia")
    op.drop_table("asignacion_emergencia")
