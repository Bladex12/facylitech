import { api, toQueryString } from './client'
import type {
  Administracion,
  Ascensor,
  BitacoraEntrada,
  CalendarioMes,
  Cliente,
  Edificio,
  Emergencia,
  OrdenTrabajo,
  Pagina,
  Papeleta,
  Pauta,
  Usuario,
} from './types'

export const endpoints = {
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
  },
  ascensores: {
    listar: (edificioId?: string) =>
      api.get<Pagina<Ascensor>>(`/ascensores${toQueryString({ edificio_id: edificioId })}`),
    bitacora: (id: string) => api.get<BitacoraEntrada[]>(`/ascensores/${id}/bitacora`),
  },
  usuarios: {
    listar: (rol?: string) => api.get<Pagina<Usuario>>(`/usuarios${toQueryString({ rol })}`),
  },
  pautas: {
    listar: () => api.get<Pagina<Pauta>>('/pautas'),
  },
  emergencias: {
    listar: (estado?: string) =>
      api.get<Pagina<Emergencia>>(`/emergencias${toQueryString({ estado })}`),
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
  },
  dashboard: {
    calendario: (mes: string) => api.get<CalendarioMes>(`/dashboard/calendario?mes=${mes}`),
  },
}
