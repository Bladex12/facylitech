from enum import StrEnum


class RolUsuario(StrEnum):
    OPERADOR = "operador"
    TECNICO = "tecnico"


class TipoCliente(StrEnum):
    COMUNIDAD = "comunidad"
    FONDO_INVERSION = "fondo_inversion"
    OTRO = "otro"


class TipoEdificio(StrEnum):
    RESIDENCIAL = "residencial"
    HOSPITAL = "hospital"
    OFICINA = "oficina"
    HOTEL = "hotel"
    INDUSTRIAL = "industrial"


class TipoEquipo(StrEnum):
    ELECTROMECANICO = "electromecanico"
    HIDRAULICO = "hidraulico"
    ELECTROHIDRAULICO = "electrohidraulico"


class EstadoAscensor(StrEnum):
    OPERACIONAL = "operacional"
    ADVERTENCIA = "advertencia"
    CRITICO = "critico"
    SIN_SENAL = "sin_senal"


class Especialidad(StrEnum):
    PERSONA_ATRAPADA = "persona_atrapada"
    MECANICA = "mecanica"
    CORTE_ENERGIA = "corte_energia"
    INCENDIO = "incendio"
    INUNDACION = "inundacion"


class EstadoDisponibilidadTecnico(StrEnum):
    DISPONIBLE = "disponible"
    EN_TERRENO = "en_terreno"


class TipoOrdenTrabajo(StrEnum):
    MANTENCION = "mantencion"
    REPARACION = "reparacion"
    INSPECCION = "inspeccion"
    PRIMERA_VISITA = "primera_visita"
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


class EstadoEmergencia(StrEnum):
    ACTIVA = "activa"
    EN_ATENCION = "en_atencion"
    CERRADA = "cerrada"


class Semaforo(StrEnum):
    COMPLETADO = "completado"
    VENCIDO = "vencido"
    EN_CURSO = "en_curso"
    PROGRAMADO = "programado"
