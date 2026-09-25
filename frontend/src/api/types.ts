export type RolUsuario = 'operador' | 'tecnico'
export type TipoEdificio = 'residencial' | 'hospital' | 'oficina' | 'hotel' | 'industrial'
export type EstadoOperativoAscensor = 'operativo' | 'detenido' | 'en_mantencion'
export type TipoOrdenTrabajo = 'mantencion' | 'reparacion' | 'emergencia'
export type PrioridadOrdenTrabajo = 'baja' | 'media' | 'alta' | 'critica'
export type EstadoOrdenTrabajo = 'programado' | 'en_curso' | 'completado' | 'cancelado'
export type EstadoPapeleta = 'borrador' | 'enviada'
export type Semaforo = 'completado' | 'vencido' | 'en_curso' | 'programado'

export interface Coordenadas {
  lat: number
  lon: number
}

export interface Pagina<T> {
  items: T[]
  total: number
  limit: number
  offset: number
}

export interface Edificio {
  id: string
  nombre: string
  direccion: string
  comuna: string
  tipo: TipoEdificio
  ubicacion: Coordenadas
  contacto_nombre: string | null
  contacto_email: string | null
  contacto_telefono: string | null
  manas: string | null
  instrucciones_reinicio: string | null
}

export interface EdificioResumen {
  id: string
  nombre: string
  direccion: string
  comuna: string
}

export interface Ascensor {
  id: string
  edificio_id: string
  codigo: string
  torre: string | null
  numero: string | null
  marca_modelo: string | null
  estado_operativo: EstadoOperativoAscensor
  estado_repuestos: string | null
  edificio?: EdificioResumen
}

export interface Usuario {
  id: string
  nombre: string
  email: string
  rol: RolUsuario
  activo: boolean
}

export interface PautaItem {
  id: string
  orden: number
  descripcion: string
}

export interface Pauta {
  id: string
  nombre: string
  descripcion: string | null
  items: PautaItem[]
}

export interface AscensorResumen {
  id: string
  codigo: string
  torre: string | null
  numero: string | null
  edificio: EdificioResumen
}

export interface TecnicoResumen {
  id: string
  nombre: string
}

export interface OrdenTrabajo {
  id: string
  codigo: string
  tipo: TipoOrdenTrabajo
  prioridad: PrioridadOrdenTrabajo
  estado: EstadoOrdenTrabajo
  semaforo: Semaforo
  ascensor: AscensorResumen
  tecnico: TecnicoResumen | null
  fecha_programada: string
  inicio_real: string | null
  fin_real: string | null
  descripcion: string | null
  papeleta_id: string | null
  papeleta_estado: EstadoPapeleta | null
}

export interface ChecklistItem {
  id: string
  pauta_item_id: string | null
  descripcion: string
  completado: boolean
  completado_at: string | null
  comentario: string | null
}

export interface Papeleta {
  id: string
  orden_trabajo_id: string
  observaciones: string | null
  falla_detectada: string | null
  trabajo_realizado: string | null
  causada_por_terceros: boolean
  hora_inicio: string | null
  hora_fin: string | null
  estado: EstadoPapeleta
  checklist: ChecklistItem[]
}

export interface OrdenCalendarioItem {
  id: string
  codigo: string
  hora: string
  ascensor_codigo: string
  edificio_nombre: string
  tipo: TipoOrdenTrabajo
  prioridad: PrioridadOrdenTrabajo
  estado: EstadoOrdenTrabajo
  semaforo: Semaforo
}

export interface DiaCalendario {
  fecha: string
  ordenes: OrdenCalendarioItem[]
}

export interface CalendarioMes {
  anio: number
  mes: number
  dias: DiaCalendario[]
  emergencias_abiertas: number
}
