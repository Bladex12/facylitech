import { api, toQueryString } from './client'
import type {
  Administracion,
  Ascensor,
  AsignacionEmergencia,
  AsignacionTecnico,
  CandidatoTecnico,
  Conversacion,
  Coordenadas,
  EmergenciaCrear,
  Evidencia,
  MapaData,
  Mensaje,
  OrdenTrabajoActualizar,
  OrdenTrabajoCrear,
  BitacoraEntrada,
  CalendarioMes,
  Cliente,
  LoginRespuesta,
  Edificio,
  Emergencia,
  OrdenTrabajo,
  Pagina,
  Papeleta,
  Pauta,
  Usuario,
} from './types'

export const endpoints = {
  auth: {
    login: (email: string, password: string) =>
      api.post<LoginRespuesta>('/auth/login', { email, password }),
    me: () => api.get<Usuario>('/auth/me'),
    /** 400 si la actual no coincide, la nueva es corta o igual a la actual. */
    cambiarPassword: (passwordActual: string, passwordNueva: string) =>
      api.post<void>('/auth/cambiar-password', {
        password_actual: passwordActual,
        password_nueva: passwordNueva,
      }),
  },
  clientes: {
    listar: () => api.get<Pagina<Cliente>>('/clientes'),
    administraciones: (clienteId: string) =>
      api.get<Administracion[]>(`/clientes/${clienteId}/administraciones`),
  },
  administraciones: {
    listar: () => api.get<Pagina<Administracion>>('/administraciones'),
    edificios: (administracionId: string) =>
      api.get<Edificio[]>(`/administraciones/${administracionId}/edificios`),
  },
  edificios: {
    listar: () => api.get<Pagina<Edificio>>('/edificios'),
    obtener: (id: string) => api.get<Edificio>(`/edificios/${id}`),
    actualizar: (id: string, datos: Partial<Edificio>) =>
      api.patch<Edificio>(`/edificios/${id}`, datos),
  },
  ascensores: {
    listar: (edificioId?: string) =>
      api.get<Pagina<Ascensor>>(`/ascensores${toQueryString({ edificio_id: edificioId })}`),
    obtener: (id: string) => api.get<Ascensor>(`/ascensores/${id}`),
    porQr: (codigoQr: string) =>
      api.get<Ascensor>(`/ascensores/qr/${encodeURIComponent(codigoQr)}`),
    actualizar: (id: string, datos: Partial<Ascensor>) =>
      api.patch<Ascensor>(`/ascensores/${id}`, datos),
    bitacora: (id: string) => api.get<BitacoraEntrada[]>(`/ascensores/${id}/bitacora`),
  },
  usuarios: {
    listar: (rol?: string) => api.get<Pagina<Usuario>>(`/usuarios${toQueryString({ rol })}`),
    obtener: (id: string) => api.get<Usuario>(`/usuarios/${id}`),
    /** Solo operador: restablece la contraseña de otro usuario (204). */
    restablecerPassword: (id: string, passwordNueva: string) =>
      api.put<void>(`/usuarios/${id}/password`, { password_nueva: passwordNueva }),
    /** Base del tracking GPS por eventos (Gantt 26-oct): el front la llama al iniciar/terminar. */
    reportarUbicacion: (id: string, coords: Coordenadas) =>
      api.post<Usuario>(`/usuarios/${id}/ubicacion`, coords),
  },
  tecnicos: {
    cercanos: (coords: Coordenadas, limit = 5) =>
      api.get<CandidatoTecnico[]>(
        `/tecnicos/cercanos${toQueryString({ lat: coords.lat, lon: coords.lon, limit })}`,
      ),
  },
  mapa: {
    obtener: () => api.get<MapaData>('/mapa'),
  },
  asignaciones: {
    /** Asignaciones del técnico (por defecto solo `pendiente`). */
    listar: (tecnicoId: string, estado?: string) =>
      api.get<AsignacionTecnico[]>(
        `/asignaciones${toQueryString({ tecnico_id: tecnicoId, estado })}`,
      ),
    aceptar: (id: string) => api.post<AsignacionEmergencia>(`/asignaciones/${id}/aceptar`),
    rechazar: (id: string, motivo?: string) =>
      api.post<AsignacionEmergencia>(`/asignaciones/${id}/rechazar`, { motivo: motivo ?? null }),
  },
  mensajes: {
    conversaciones: (usuarioId: string) =>
      api.get<Conversacion[]>(`/mensajes/conversaciones?usuario_id=${usuarioId}`),
    hilo: (usuarioId: string, contraparteId: string) =>
      api.get<Mensaje[]>(
        `/mensajes/hilo${toQueryString({ usuario_id: usuarioId, contraparte_id: contraparteId })}`,
      ),
    enviar: (datos: {
      remitente_id: string
      destinatario_id: string
      texto: string
      orden_trabajo_id?: string | null
    }) => api.post<Mensaje>('/mensajes', datos),
    marcarLeidos: (usuarioId: string, contraparteId: string) =>
      api.post<void>('/mensajes/leer', { usuario_id: usuarioId, contraparte_id: contraparteId }),
  },
  pautas: {
    listar: () => api.get<Pagina<Pauta>>('/pautas'),
  },
  emergencias: {
    listar: (estado?: string) =>
      api.get<Pagina<Emergencia>>(`/emergencias${toQueryString({ estado })}`),
    obtener: (id: string) => api.get<Emergencia>(`/emergencias/${id}`),
    crear: (datos: EmergenciaCrear) => api.post<Emergencia>('/emergencias', datos),
    cambiarEstado: (id: string, estado: string) =>
      api.patch<Emergencia>(`/emergencias/${id}/estado`, { estado }),
    /** Técnicos ordenados por cercanía (PostGIS) + disponibilidad + especialidad. */
    candidatos: (id: string, limit = 5) =>
      api.get<CandidatoTecnico[]>(`/emergencias/${id}/candidatos?limit=${limit}`),
    /** El operador aprueba la cascada (orden explícito). Nunca es 100% automática. */
    despachar: (id: string, tecnicoIds: string[], operadorId: string) =>
      api.post<Emergencia>(`/emergencias/${id}/despachar`, {
        tecnico_ids: tecnicoIds,
        operador_id: operadorId,
      }),
  },
  ordenes: {
    listar: (filtros: {
      tecnico_id?: string
      estado?: string
      tipo?: string
      edificio_id?: string
      desde?: string
      hasta?: string
      limit?: number
    }) => api.get<Pagina<OrdenTrabajo>>(`/ordenes-trabajo${toQueryString(filtros)}`),
    obtener: (id: string) => api.get<OrdenTrabajo>(`/ordenes-trabajo/${id}`),
    crear: (datos: OrdenTrabajoCrear) => api.post<OrdenTrabajo>('/ordenes-trabajo', datos),
    actualizar: (id: string, datos: OrdenTrabajoActualizar) =>
      api.patch<OrdenTrabajo>(`/ordenes-trabajo/${id}`, datos),
    cancelar: (id: string) => api.post<OrdenTrabajo>(`/ordenes-trabajo/${id}/cancelar`),
    iniciar: (id: string) => api.post<OrdenTrabajo>(`/ordenes-trabajo/${id}/iniciar`),
    completar: (id: string) => api.post<OrdenTrabajo>(`/ordenes-trabajo/${id}/completar`),
    crearPapeleta: (id: string) => api.post<Papeleta>(`/ordenes-trabajo/${id}/papeleta`),
  },
  papeletas: {
    obtener: (id: string) => api.get<Papeleta>(`/papeletas/${id}`),
    actualizar: (id: string, datos: Partial<Papeleta>) =>
      api.patch<Papeleta>(`/papeletas/${id}`, datos),
    marcarItem: (
      papeletaId: string,
      itemId: string,
      datos: { completado: boolean; comentario?: string | null },
    ) => api.patch(`/papeletas/${papeletaId}/items/${itemId}`, datos),
    enviar: (id: string) => api.post<Papeleta>(`/papeletas/${id}/enviar`),
    agregarPieza: (
      id: string,
      datos: { nombre: string; marca?: string | null; es_original: boolean },
    ) => api.post<Papeleta>(`/papeletas/${id}/piezas`, datos),
    eliminarPieza: (id: string, piezaId: string) =>
      api.delete<Papeleta>(`/papeletas/${id}/piezas/${piezaId}`),
    /** multipart/form-data: campo `archivo` (imagen) + `tipo` opcional. */
    subirEvidencia: (id: string, archivo: Blob, tipo?: string) => {
      const form = new FormData()
      form.append('archivo', archivo, archivo instanceof File ? archivo.name : 'foto.jpg')
      if (tipo) form.append('tipo', tipo)
      return api.upload<Evidencia>(`/papeletas/${id}/evidencias`, form)
    },
    eliminarEvidencia: (id: string, evidenciaId: string) =>
      api.delete<Papeleta>(`/papeletas/${id}/evidencias/${evidenciaId}`),
  },
  dashboard: {
    calendario: (mes: string) => api.get<CalendarioMes>(`/dashboard/calendario?mes=${mes}`),
  },
}
