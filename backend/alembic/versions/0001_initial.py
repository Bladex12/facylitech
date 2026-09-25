"""Modelo inicial: usuario, edificio, ascensor, pautas, ordenes_trabajo, papeleta

Revision ID: 0001
Revises:
Create Date: 2026-09-14

"""
from collections.abc import Sequence

import geoalchemy2
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    op.create_table(
        "usuario",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("rol", sa.String(20), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "ultima_ubicacion",
            geoalchemy2.Geography(geometry_type="POINT", srid=4326),
            nullable=True,
        ),
        sa.Column("ultima_ubicacion_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.execute(
        "CREATE INDEX ix_usuario_ultima_ubicacion ON usuario USING GIST (ultima_ubicacion)"
    )

    op.create_table(
        "edificio",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("direccion", sa.String(300), nullable=False),
        sa.Column("comuna", sa.String(100), nullable=False),
        sa.Column("tipo", sa.String(20), nullable=False),
        sa.Column(
            "ubicacion", geoalchemy2.Geography(geometry_type="POINT", srid=4326), nullable=False
        ),
        sa.Column("contacto_nombre", sa.String(200), nullable=True),
        sa.Column("contacto_email", sa.String(255), nullable=True),
        sa.Column("contacto_telefono", sa.String(50), nullable=True),
        sa.Column("manas", sa.Text(), nullable=True),
        sa.Column("instrucciones_reinicio", sa.Text(), nullable=True),
    )
    op.execute("CREATE INDEX ix_edificio_ubicacion ON edificio USING GIST (ubicacion)")

    op.create_table(
        "ascensor",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "edificio_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("edificio.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("codigo", sa.String(30), nullable=False),
        sa.Column("torre", sa.String(50), nullable=True),
        sa.Column("numero", sa.String(20), nullable=True),
        sa.Column("marca_modelo", sa.String(150), nullable=True),
        sa.Column("estado_operativo", sa.String(20), nullable=False, server_default="operativo"),
        sa.Column("estado_repuestos", sa.String(200), nullable=True),
        sa.UniqueConstraint("codigo", name="uq_ascensor_codigo"),
    )
    op.create_index("ix_ascensor_edificio_id", "ascensor", ["edificio_id"])

    op.create_table(
        "pauta_mantencion",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("descripcion", sa.Text(), nullable=True),
    )

    op.create_table(
        "pauta_item",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "pauta_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("pauta_mantencion.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("orden", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("descripcion", sa.Text(), nullable=False),
    )
    op.create_index("ix_pauta_item_pauta_id", "pauta_item", ["pauta_id"])

    op.create_table(
        "orden_trabajo",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("codigo", sa.String(20), nullable=False, unique=True),
        sa.Column("tipo", sa.String(20), nullable=False),
        sa.Column("prioridad", sa.String(20), nullable=False),
        sa.Column("estado", sa.String(20), nullable=False, server_default="programado"),
        sa.Column(
            "ascensor_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("ascensor.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "tecnico_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("usuario.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "pauta_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("pauta_mantencion.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("fecha_programada", sa.DateTime(timezone=True), nullable=False),
        sa.Column("inicio_real", sa.DateTime(timezone=True), nullable=True),
        sa.Column("fin_real", sa.DateTime(timezone=True), nullable=True),
        sa.Column("descripcion", sa.Text(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_orden_trabajo_ascensor_id", "orden_trabajo", ["ascensor_id"])
    op.create_index("ix_orden_trabajo_tecnico_id", "orden_trabajo", ["tecnico_id"])
    op.create_index("ix_orden_trabajo_fecha_programada", "orden_trabajo", ["fecha_programada"])
    op.create_index("ix_orden_trabajo_estado", "orden_trabajo", ["estado"])

    op.create_table(
        "papeleta",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "orden_trabajo_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("orden_trabajo.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("observaciones", sa.Text(), nullable=True),
        sa.Column("falla_detectada", sa.Text(), nullable=True),
        sa.Column("trabajo_realizado", sa.Text(), nullable=True),
        sa.Column(
            "causada_por_terceros", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
        sa.Column("hora_inicio", sa.DateTime(timezone=True), nullable=True),
        sa.Column("hora_fin", sa.DateTime(timezone=True), nullable=True),
        sa.Column("estado", sa.String(20), nullable=False, server_default="borrador"),
    )

    op.create_table(
        "papeleta_checklist_item",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "papeleta_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("papeleta.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "pauta_item_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("pauta_item.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("descripcion", sa.Text(), nullable=False),
        sa.Column("completado", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("completado_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("comentario", sa.Text(), nullable=True),
    )
    op.create_index(
        "ix_papeleta_checklist_item_papeleta_id", "papeleta_checklist_item", ["papeleta_id"]
    )

    op.create_table(
        "evidencia",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "papeleta_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("papeleta.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("url", sa.String(500), nullable=False),
        sa.Column("tipo", sa.String(50), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_evidencia_papeleta_id", "evidencia", ["papeleta_id"])


def downgrade() -> None:
    op.drop_table("evidencia")
    op.drop_table("papeleta_checklist_item")
    op.drop_table("papeleta")
    op.drop_table("orden_trabajo")
    op.drop_table("pauta_item")
    op.drop_table("pauta_mantencion")
    op.drop_table("ascensor")
    op.execute("DROP INDEX IF EXISTS ix_edificio_ubicacion")
    op.drop_table("edificio")
    op.execute("DROP INDEX IF EXISTS ix_usuario_ultima_ubicacion")
    op.drop_table("usuario")
