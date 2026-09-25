import { api, toQueryString } from './client'
import type {
  Ascensor,
  CalendarioMes,
  Edificio,
  OrdenTrabajo,
  Pagina,
  Papeleta,
  Pauta,
  Usuario,
} from './types'

export const endpoints = {
  edificios: {
    listar: () => api.get<Pagina<Edificio>>('/edificios'),
    obtener: (id: string) => api.get<Edificio>(`/edificios/${id}`),
  },
  ascensores: {
    listar: (edificioId?: string) =>
      api.get<Pagina<Ascensor>>(`/ascensores${toQueryString({ edificio_id: edificioId })}`),
  },
  usuarios: {
    listar: (rol?: string) => api.get<Pagina<Usuario>>(`/usuarios${toQueryString({ rol })}`),
  },
  pautas: {
    listar: () => api.get<Pagina<Pauta>>('/pautas'),
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
  },
  dashboard: {
    calendario: (mes: string) => api.get<CalendarioMes>(`/dashboard/calendario?mes=${mes}`),
  },
}
