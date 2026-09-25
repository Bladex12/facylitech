"""Modelo inicial: cliente, administracion, edificio, ascensor, usuario,
pautas, emergencia, orden_trabajo, papeleta, pieza_reemplazada, evidencia

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
        "cliente",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("tipo", sa.String(20), nullable=False),
    )

    op.create_table(
        "administracion",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "cliente_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("cliente.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("contacto_nombre", sa.String(200), nullable=True),
        sa.Column("contacto_email", sa.String(255), nullable=True),
        sa.Column("contacto_telefono", sa.String(50), nullable=True),
        sa.Column("contacto_alternativo", sa.Text(), nullable=True),
    )
    op.create_index("ix_administracion_cliente_id", "administracion", ["cliente_id"])

    op.create_table(
        "edificio",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "administracion_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("administracion.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("direccion", sa.String(300), nullable=False),
        sa.Column("comuna", sa.String(100), nullable=False),
        sa.Column("tipo", sa.String(20), nullable=False),
        sa.Column(
            "ubicacion", geoalchemy2.Geography(geometry_type="POINT", srid=4326), nullable=False
        ),
        sa.Column("manas", sa.Text(), nullable=True),
        sa.Column("instrucciones_reinicio", sa.Text(), nullable=True),
        sa.Column("vencimiento_certificacion", sa.Date(), nullable=True),
    )
    op.create_index("ix_edificio_administracion_id", "edificio", ["administracion_id"])
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
        sa.Column("codigo_qr", sa.String(50), nullable=False),
        sa.Column("torre", sa.String(50), nullable=True),
        sa.Column("numero", sa.String(20), nullable=True),
        sa.Column("marca", sa.String(100), nullable=True),
        sa.Column("modelo", sa.String(100), nullable=True),
        sa.Column("anio_instalacion", sa.Integer(), nullable=True),
        sa.Column("pisos", sa.Integer(), nullable=True),
        sa.Column("tipo_equipo", sa.String(20), nullable=False),
        sa.Column("estado", sa.String(20), nullable=False, server_default="operacional"),
        sa.Column("tasa_fallo", sa.Float(), nullable=True),
        sa.Column("manas", sa.Text(), nullable=True),
        sa.Column("ultima_mantencion", sa.Date(), nullable=True),
        sa.UniqueConstraint("codigo", name="uq_ascensor_codigo"),
        sa.UniqueConstraint("codigo_qr", name="uq_ascensor_codigo_qr"),
    )
    op.create_index("ix_ascensor_edificio_id", "ascensor", ["edificio_id"])

    op.create_table(
        "usuario",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("rol", sa.String(20), nullable=False),
        sa.Column("telefono", sa.String(50), nullable=True),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("zona", sa.String(100), nullable=True),
        sa.Column("especialidades", postgresql.ARRAY(sa.String(30)), nullable=True),
        sa.Column("estado_disponibilidad", sa.String(20), nullable=True),
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
        "pauta_mantencion",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("tipo_equipo", sa.String(20), nullable=False),
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
        sa.Column("meses", postgresql.ARRAY(sa.Integer()), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.create_index("ix_pauta_item_pauta_id", "pauta_item", ["pauta_id"])

    op.create_table(
        "emergencia",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("codigo", sa.String(20), nullable=False, unique=True),
        sa.Column("tipo", sa.String(30), nullable=False),
        sa.Column(
            "edificio_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("edificio.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "ascensor_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("ascensor.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("reportada_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("descripcion", sa.Text(), nullable=True),
        sa.Column("solicitante", sa.String(200), nullable=True),
        sa.Column("estado", sa.String(20), nullable=False, server_default="activa"),
    )
    op.create_index("ix_emergencia_edificio_id", "emergencia", ["edificio_id"])

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
        sa.Column(
            "emergencia_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("emergencia.id", ondelete="SET NULL"),
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
        sa.Column("folio_fisico", sa.String(50), nullable=True),
        sa.Column("firma_tecnico_url", sa.String(500), nullable=True),
        sa.Column("firma_receptor_url", sa.String(500), nullable=True),
        sa.Column("receptor_nombre", sa.String(200), nullable=True),
    )

    op.create_table(
        "papeleta_item",
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
    op.create_index("ix_papeleta_item_papeleta_id", "papeleta_item", ["papeleta_id"])

    op.create_table(
        "pieza_reemplazada",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "papeleta_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("papeleta.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("marca", sa.String(100), nullable=True),
        sa.Column("es_original", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.create_index("ix_pieza_reemplazada_papeleta_id", "pieza_reemplazada", ["papeleta_id"])

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
    op.drop_table("pieza_reemplazada")
    op.drop_table("papeleta_item")
    op.drop_table("papeleta")
    op.drop_table("orden_trabajo")
    op.drop_table("emergencia")
    op.drop_table("pauta_item")
    op.drop_table("pauta_mantencion")
    op.execute("DROP INDEX IF EXISTS ix_usuario_ultima_ubicacion")
    op.drop_table("usuario")
    op.drop_table("ascensor")
    op.execute("DROP INDEX IF EXISTS ix_edificio_ubicacion")
    op.drop_table("edificio")
    op.drop_table("administracion")
    op.drop_table("cliente")
