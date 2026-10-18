/**
 * Queries compartidas de las vistas del operador (ascensores, calendario y
 * agenda). Los catálogos son chicos (RNF-06: 7 clientes, 10 edificios, ~80
 * equipos), así que se cargan completos una vez y se filtran en el cliente.
 */
import { useMemo } from 'react'
import { useQuery, type QueryClient } from '@tanstack/react-query'
import { traerTodo } from '../../../api/paginacion'
import type {
  Administracion,
  Ascensor,
  Cliente,
  Edificio,
  OrdenTrabajo,
  Pauta,
  TipoOrdenTrabajo,
  Usuario,
} from '../../../api/types'

const CINCO_MIN = 5 * 60_000
/** Un reintento: con mala conexión el error se muestra rápido y con botón Reintentar. */
const RETRY = 1

export const claves = {
  clientes: ['catalogo', 'clientes'] as const,
  administraciones: ['catalogo', 'administraciones'] as const,
  edificios: ['catalogo', 'edificios'] as const,
  equipos: ['catalogo', 'equipos'] as const,
  tecnicos: ['catalogo', 'tecnicos'] as const,
  pautas: ['catalogo', 'pautas'] as const,
  ordenes: ['ordenes'] as const,
}

export function useClientes() {
  return useQuery({
    queryKey: claves.clientes,
    queryFn: () => traerTodo<Cliente>('/clientes'),
    staleTime: CINCO_MIN,
    retry: RETRY,
  })
}

export function useAdministraciones() {
  return useQuery({
    queryKey: claves.administraciones,
    queryFn: () => traerTodo<Administracion>('/administraciones'),
    staleTime: CINCO_MIN,
    retry: RETRY,
  })
}

export function useEdificios() {
  return useQuery({
    queryKey: claves.edificios,
    queryFn: () => traerTodo<Edificio>('/edificios'),
    staleTime: CINCO_MIN,
    retry: RETRY,
  })
}

/** Todos los equipos. El filtro `categoria` del contrato se aplica en el
 * cliente: con ~80 equipos no vale la pena una query por categoría. */
export function useEquipos() {
  return useQuery({
    queryKey: claves.equipos,
    queryFn: () => traerTodo<Ascensor>('/ascensores'),
    staleTime: CINCO_MIN,
    retry: RETRY,
  })
}

export function useTecnicos() {
  return useQuery({
    queryKey: claves.tecnicos,
    queryFn: () => traerTodo<Usuario>('/usuarios', { rol: 'tecnico' }),
    staleTime: CINCO_MIN,
    retry: RETRY,
    select: (ts) =>
      ts.filter((t) => t.activo).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
  })
}

export function usePautas() {
  return useQuery({
    queryKey: claves.pautas,
    queryFn: () => traerTodo<Pauta>('/pautas'),
    staleTime: CINCO_MIN,
    retry: RETRY,
  })
}

export interface FiltrosOrdenes {
  desde: string
  hasta: string
  tecnico_id?: string
  tipo?: TipoOrdenTrabajo
  edificio_id?: string
}

export function useOrdenes(filtros: FiltrosOrdenes, habilitado = true) {
  return useQuery({
    queryKey: [...claves.ordenes, filtros],
    queryFn: () =>
      traerTodo<OrdenTrabajo>('/ordenes-trabajo', filtros as unknown as Record<string, string>),
    enabled: habilitado,
    retry: RETRY,
    placeholderData: (previo) => previo,
  })
}

/** Tras crear/editar/cancelar una OT: listados, dashboard y bitácoras. */
export function invalidarOrdenes(qc: QueryClient) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: claves.ordenes }),
    qc.invalidateQueries({ queryKey: ['dashboard'] }),
    qc.invalidateQueries({ queryKey: ['bitacora'] }),
  ])
}

/** Índices por id para resolver la jerarquía Cliente → Administración → Edificio. */
export function useJerarquia() {
  const clientes = useClientes()
  const administraciones = useAdministraciones()
  const edificios = useEdificios()
  const equipos = useEquipos()

  const indices = useMemo(() => {
    const clientePorId = new Map((clientes.data ?? []).map((c) => [c.id, c]))
    const adminPorId = new Map((administraciones.data ?? []).map((a) => [a.id, a]))
    const edificioPorId = new Map((edificios.data ?? []).map((e) => [e.id, e]))
    const equiposPorEdificio = new Map<string, Ascensor[]>()
    for (const e of equipos.data ?? []) {
      const lista = equiposPorEdificio.get(e.edificio_id)
      if (lista) lista.push(e)
      else equiposPorEdificio.set(e.edificio_id, [e])
    }
    return { clientePorId, adminPorId, edificioPorId, equiposPorEdificio }
  }, [clientes.data, administraciones.data, edificios.data, equipos.data])

  const consultas = [clientes, administraciones, edificios, equipos]
  return {
    clientes: clientes.data ?? [],
    administraciones: administraciones.data ?? [],
    edificios: edificios.data ?? [],
    equipos: equipos.data ?? [],
    ...indices,
    isLoading: consultas.some((q) => q.isLoading),
    error: consultas.find((q) => q.error)?.error ?? null,
    reintentar: () => consultas.forEach((q) => q.error && q.refetch()),
  }
}
