import uuid
from datetime import datetime

from geoalchemy2 import Geography
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.domain.enums import (
    EstadoOperativoAscensor,
    EstadoOrdenTrabajo,
    EstadoPapeleta,
    PrioridadOrdenTrabajo,
    RolUsuario,
    TipoEdificio,
    TipoOrdenTrabajo,
)
from app.infrastructure.db.base import Base


def _uuid_pk() -> Mapped[uuid.UUID]:
    return mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


class Usuario(Base):
    __tablename__ = "usuario"

    id: Mapped[uuid.UUID] = _uuid_pk()
    nombre: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    rol: Mapped[RolUsuario] = mapped_column(String(20), nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    ultima_ubicacion = mapped_column(Geography(geometry_type="POINT", srid=4326), nullable=True)
    ultima_ubicacion_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    ordenes_asignadas: Mapped[list["OrdenTrabajo"]] = relationship(back_populates="tecnico")


class Edificio(Base):
    __tablename__ = "edificio"

    id: Mapped[uuid.UUID] = _uuid_pk()
    nombre: Mapped[str] = mapped_column(String(200), nullable=False)
    direccion: Mapped[str] = mapped_column(String(300), nullable=False)
    comuna: Mapped[str] = mapped_column(String(100), nullable=False)
    tipo: Mapped[TipoEdificio] = mapped_column(String(20), nullable=False)
    ubicacion = mapped_column(Geography(geometry_type="POINT", srid=4326), nullable=False)
    contacto_nombre: Mapped[str | None] = mapped_column(String(200))
    contacto_email: Mapped[str | None] = mapped_column(String(255))
    contacto_telefono: Mapped[str | None] = mapped_column(String(50))
    manas: Mapped[str | None] = mapped_column(Text)
    instrucciones_reinicio: Mapped[str | None] = mapped_column(Text)

    ascensores: Mapped[list["Ascensor"]] = relationship(
        back_populates="edificio", cascade="all, delete-orphan"
    )


class Ascensor(Base):
    __tablename__ = "ascensor"
    __table_args__ = (UniqueConstraint("codigo", name="uq_ascensor_codigo"),)

    id: Mapped[uuid.UUID] = _uuid_pk()
    edificio_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("edificio.id", ondelete="CASCADE"), nullable=False
    )
    codigo: Mapped[str] = mapped_column(String(30), nullable=False)
    torre: Mapped[str | None] = mapped_column(String(50))
    numero: Mapped[str | None] = mapped_column(String(20))
    marca_modelo: Mapped[str | None] = mapped_column(String(150))
    estado_operativo: Mapped[EstadoOperativoAscensor] = mapped_column(
        String(20), nullable=False, default=EstadoOperativoAscensor.OPERATIVO
    )
    estado_repuestos: Mapped[str | None] = mapped_column(String(200))

    edificio: Mapped["Edificio"] = relationship(back_populates="ascensores")
    ordenes: Mapped[list["OrdenTrabajo"]] = relationship(back_populates="ascensor")


class PautaMantencion(Base):
    __tablename__ = "pauta_mantencion"

    id: Mapped[uuid.UUID] = _uuid_pk()
    nombre: Mapped[str] = mapped_column(String(200), nullable=False)
    descripcion: Mapped[str | None] = mapped_column(Text)

    items: Mapped[list["PautaItem"]] = relationship(
        back_populates="pauta", cascade="all, delete-orphan", order_by="PautaItem.orden"
    )


class PautaItem(Base):
    __tablename__ = "pauta_item"

    id: Mapped[uuid.UUID] = _uuid_pk()
    pauta_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pauta_mantencion.id", ondelete="CASCADE"), nullable=False
    )
    orden: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    descripcion: Mapped[str] = mapped_column(Text, nullable=False)

    pauta: Mapped["PautaMantencion"] = relationship(back_populates="items")


class OrdenTrabajo(Base):
    __tablename__ = "orden_trabajo"

    id: Mapped[uuid.UUID] = _uuid_pk()
    codigo: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)
    tipo: Mapped[TipoOrdenTrabajo] = mapped_column(String(20), nullable=False)
    prioridad: Mapped[PrioridadOrdenTrabajo] = mapped_column(String(20), nullable=False)
    estado: Mapped[EstadoOrdenTrabajo] = mapped_column(
        String(20), nullable=False, default=EstadoOrdenTrabajo.PROGRAMADO
    )
    ascensor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ascensor.id", ondelete="RESTRICT"), nullable=False
    )
    tecnico_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("usuario.id", ondelete="SET NULL")
    )
    pauta_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pauta_mantencion.id", ondelete="SET NULL")
    )
    fecha_programada: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    inicio_real: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    fin_real: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    descripcion: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    ascensor: Mapped["Ascensor"] = relationship(back_populates="ordenes")
    tecnico: Mapped["Usuario | None"] = relationship(back_populates="ordenes_asignadas")
    pauta: Mapped["PautaMantencion | None"] = relationship()
    papeleta: Mapped["Papeleta | None"] = relationship(
        back_populates="orden_trabajo", cascade="all, delete-orphan", uselist=False
    )


class Papeleta(Base):
    __tablename__ = "papeleta"

    id: Mapped[uuid.UUID] = _uuid_pk()
    orden_trabajo_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("orden_trabajo.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    observaciones: Mapped[str | None] = mapped_column(Text)
    falla_detectada: Mapped[str | None] = mapped_column(Text)
    trabajo_realizado: Mapped[str | None] = mapped_column(Text)
    causada_por_terceros: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    hora_inicio: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    hora_fin: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    estado: Mapped[EstadoPapeleta] = mapped_column(
        String(20), nullable=False, default=EstadoPapeleta.BORRADOR
    )

    orden_trabajo: Mapped["OrdenTrabajo"] = relationship(back_populates="papeleta")
    checklist: Mapped[list["PapeletaChecklistItem"]] = relationship(
        back_populates="papeleta", cascade="all, delete-orphan"
    )
    evidencias: Mapped[list["Evidencia"]] = relationship(
        back_populates="papeleta", cascade="all, delete-orphan"
    )


class PapeletaChecklistItem(Base):
    __tablename__ = "papeleta_checklist_item"

    id: Mapped[uuid.UUID] = _uuid_pk()
    papeleta_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("papeleta.id", ondelete="CASCADE"), nullable=False
    )
    pauta_item_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pauta_item.id", ondelete="SET NULL")
    )
    descripcion: Mapped[str] = mapped_column(Text, nullable=False)
    completado: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    completado_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    comentario: Mapped[str | None] = mapped_column(Text)

    papeleta: Mapped["Papeleta"] = relationship(back_populates="checklist")


class Evidencia(Base):
    __tablename__ = "evidencia"

    id: Mapped[uuid.UUID] = _uuid_pk()
    papeleta_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("papeleta.id", ondelete="CASCADE"), nullable=False
    )
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    tipo: Mapped[str | None] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    papeleta: Mapped["Papeleta"] = relationship(back_populates="evidencias")
