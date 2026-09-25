from enum import StrEnum


class RolUsuario(StrEnum):
    OPERADOR = "operador"
    TECNICO = "tecnico"


class TipoEdificio(StrEnum):
    RESIDENCIAL = "residencial"
    HOSPITAL = "hospital"
    OFICINA = "oficina"
    HOTEL = "hotel"
    INDUSTRIAL = "industrial"


class EstadoOperativoAscensor(StrEnum):
    OPERATIVO = "operativo"
    DETENIDO = "detenido"
    EN_MANTENCION = "en_mantencion"


class TipoOrdenTrabajo(StrEnum):
    MANTENCION = "mantencion"
    REPARACION = "reparacion"
    EMERGENCIA = "emergencia"


class PrioridadOrdenTrabajo(StrEnum):
    BAJA = "baja"
    MEDIA = "media"
    ALTA = "alta"
    CRITICA = "critica"


class EstadoOrdenTrabajo(StrEnum):
    PROGRAMADO = "programado"
    EN_CURSO = "en_curso"
    COMPLETADO = "completado"
    CANCELADO = "cancelado"


class EstadoPapeleta(StrEnum):
    BORRADOR = "borrador"
    ENVIADA = "enviada"


class Semaforo(StrEnum):
    COMPLETADO = "completado"
    VENCIDO = "vencido"
    EN_CURSO = "en_curso"
    PROGRAMADO = "programado"
