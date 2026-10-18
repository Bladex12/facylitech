export type RolUsuario = 'operador' | 'tecnico'
export type TipoCliente =
  | 'comunidad'
  | 'fondo_inversion'
  | 'administracion'
  | 'corporativo'
  | 'publico'
  | 'otro'
export type TipoEdificio =
  | 'residencial'
  | 'hospital'
  | 'oficina'
  | 'hotel'
  | 'industrial'
  | 'publico'
/** Clase de equipo (dato de la empresa): ascensor, montacarga o montaplatos. */
export type CategoriaEquipo = 'ascensor' | 'montacarga' | 'montaplatos'
export type TipoEquipo = 'electromecanico' | 'hidraulico' | 'electrohidraulico'
export type EstadoAscensor = 'operacional' | 'advertencia' | 'critico' | 'sin_senal'
export type Especialidad =
  | 'persona_atrapada'
  | 'mecanica'
  | 'corte_energia'
  | 'incendio'
  | 'inundacion'
export type EstadoDisponibilidadTecnico = 'disponible' | 'en_terreno'
export type TipoOrdenTrabajo =
  | 'mantencion'
  | 'reparacion'
  | 'inspeccion'
  | 'primera_visita'
  | 'emergencia'
export type PrioridadOrdenTrabajo = 'baja' | 'media' | 'alta' | 'critica'
export type EstadoOrdenTrabajo = 'programado' | 'en_curso' | 'completado' | 'cancelado'
export type EstadoPapeleta = 'borrador' | 'enviada'
export type EstadoEmergencia = 'activa' | 'en_atencion' | 'cerrada'
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

export interface Cliente {
  id: string
  nombre: string
  tipo: TipoCliente
}

export interface Administracion {
  id: string
  cliente_id: string
  nombre: string
  contacto_nombre: string | null
  contacto_email: string | null
  contacto_telefono: string | null
  contacto_alternativo: string | null
}

export interface Edificio {
  id: string
  administracion_id: string
  nombre: string
  direccion: string
  comuna: string
  tipo: TipoEdificio
  ubicacion: Coordenadas
  manas: string | null
  instrucciones_reinicio: string | null
  vencimiento_certificacion: string | null
  contacto_nombre: string | null
  contacto_telefono: string | null
  contacto_email: string | null
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
  codigo_qr: string
  torre: string | null
  numero: string | null
  marca: string | null
  modelo: string | null
  anio_instalacion: number | null
  pisos: number | null
  tipo_equipo: TipoEquipo
  categoria: CategoriaEquipo
  estado: EstadoAscensor
  tasa_fallo: number | null
  manas: string | null
  ultima_mantencion: string | null
  edificio?: EdificioResumen
}

export interface PiezaBitacora {
  nombre: string
  marca: string | null
  es_original: boolean
}

export interface BitacoraEntrada {
  orden_codigo: string
  tipo: TipoOrdenTrabajo
  fecha: string
  tecnico_nombre: string | null
  descripcion: string | null
  falla_detectada: string | null
  trabajo_realizado: string | null
  piezas: PiezaBitacora[]
}

export interface Usuario {
  id: string
  nombre: string
  email: string
  rol: RolUsuario
  telefono: string | null
  activo: boolean
  zona: string | null
  especialidades: Especialidad[] | null
  estado_disponibilidad: EstadoDisponibilidadTecnico | null
  rut: string | null
  ultima_ubicacion: Coordenadas | null
  ultima_ubicacion_at: string | null
}

/** Respuesta de `POST /auth/login` (docs/contrato-auth.md). */
export interface LoginRespuesta {
  access_token: string
  token_type: 'bearer'
  /** ISO 8601 con zona. */
  expira_at: string
  usuario: Usuario
}

export interface PautaItem {
  id: string
  orden: number
  descripcion: string
  meses: number[]
  activo: boolean
}

export interface Pauta {
  id: string
  nombre: string
  tipo_equipo: TipoEquipo
  descripcion: string | null
  items: PautaItem[]
}

export interface AscensorResumen {
  id: string
  codigo: string
  torre: string | null
  numero: string | null
  manas: string | null
  edificio: {
    id: string
    nombre: string
    direccion: string
    comuna: string
    manas: string | null
    instrucciones_reinicio: string | null
  }
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
  emergencia_id: string | null
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

export interface Pieza {
  id: string
  nombre: string
  marca: string | null
  es_original: boolean
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
  folio_fisico: string | null
  receptor_nombre: string | null
  items: ChecklistItem[]
  piezas: Pieza[]
  evidencias: Evidencia[]
  total_items_pauta: number | null
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

export interface EmergenciaBanner {
  id: string
  codigo: string
  tipo: Especialidad
  edificio_nombre: string
  descripcion: string | null
  reportada_at: string
}

export interface CalendarioMes {
  anio: number
  mes: number
  dias: DiaCalendario[]
  emergencias_abiertas: EmergenciaBanner[]
}

export interface Emergencia {
  id: string
  codigo: string
  tipo: Especialidad
  edificio: { id: string; nombre: string; direccion: string }
  ascensor: { id: string; codigo: string } | null
  reportada_at: string
  descripcion: string | null
  solicitante: string | null
  estado: EstadoEmergencia
  /** Coordenadas del edificio (para el mapa y el cálculo de cercanía). */
  ubicacion: Coordenadas
  /** Cascada de despacho aprobada por el operador, en orden. Vacía si aún no se despacha. */
  asignaciones: AsignacionEmergencia[]
  /** true si todos los técnicos de la cascada rechazaron/expiraron: el operador debe re-despachar. */
  cascada_agotada: boolean
  /** OT de emergencia creada al aceptar un técnico (null hasta entonces). */
  orden_trabajo_id: string | null
}

// ---------------------------------------------------------------------------
// Contrato octubre 2026 (Hito 2 + Fase 3). Ver docs/contrato-api-octubre.md
// ---------------------------------------------------------------------------

export interface Evidencia {
  id: string
  url: string
  tipo: string | null
  created_at: string
}

/** pendiente = notificado, esperando respuesta; en_espera = más abajo en la cascada. */
export type EstadoAsignacion =
  | 'en_espera'
  | 'pendiente'
  | 'aceptada'
  | 'rechazada'
  | 'expirada'
  | 'cancelada'

export interface AsignacionEmergencia {
  id: string
  emergencia_id: string
  tecnico: TecnicoResumen
  orden: number
  estado: EstadoAsignacion
  distancia_m: number | null
  notificada_at: string | null
  respondida_at: string | null
  /** Momento en que expira si sigue pendiente (notificada_at + tiempo de respuesta). */
  expira_at: string | null
  motivo_rechazo: string | null
}

/** Asignación vista por el técnico, con la emergencia embebida. */
export interface AsignacionTecnico extends AsignacionEmergencia {
  emergencia: Emergencia
}

export interface CandidatoTecnico {
  tecnico: Usuario
  distancia_m: number | null
  /** Estimado simple: distancia / 25 km/h (tráfico urbano Santiago). */
  eta_min: number | null
  especialidad_match: boolean
  disponible: boolean
  ordenes_en_curso: number
}

export interface MapaEdificio {
  id: string
  nombre: string
  direccion: string
  comuna: string
  tipo: TipoEdificio
  ubicacion: Coordenadas
  total_equipos: number
  equipos_con_falla: number
  ordenes_hoy: number
  emergencia_activa: boolean
}

export interface MapaTecnico {
  id: string
  nombre: string
  estado_disponibilidad: EstadoDisponibilidadTecnico | null
  ubicacion: Coordenadas | null
  ubicacion_at: string | null
  orden_actual: { id: string; codigo: string; edificio_nombre: string } | null
}

export interface MapaEmergencia {
  id: string
  codigo: string
  tipo: Especialidad
  edificio_id: string
  edificio_nombre: string
  ubicacion: Coordenadas
  reportada_at: string
  estado: EstadoEmergencia
}

export interface MapaData {
  edificios: MapaEdificio[]
  tecnicos: MapaTecnico[]
  emergencias: MapaEmergencia[]
}

export interface Mensaje {
  id: string
  remitente: TecnicoResumen
  destinatario: TecnicoResumen
  orden_trabajo_id: string | null
  texto: string
  created_at: string
  leido_at: string | null
}

export interface Conversacion {
  contraparte: { id: string; nombre: string; rol: RolUsuario }
  ultimo_mensaje: Mensaje | null
  no_leidos: number
}

export interface OrdenTrabajoCrear {
  tipo: TipoOrdenTrabajo
  prioridad: PrioridadOrdenTrabajo
  ascensor_id: string
  tecnico_id?: string | null
  pauta_id?: string | null
  fecha_programada: string
  descripcion?: string | null
}

export interface OrdenTrabajoActualizar {
  tecnico_id?: string | null
  fecha_programada?: string
  prioridad?: PrioridadOrdenTrabajo
  descripcion?: string | null
}

export interface EmergenciaCrear {
  tipo: Especialidad
  edificio_id: string
  ascensor_id?: string | null
  descripcion?: string | null
  solicitante?: string | null
}
