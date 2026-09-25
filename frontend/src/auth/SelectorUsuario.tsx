import { useQuery } from '@tanstack/react-query'
import { endpoints } from '../api/endpoints'
import { useAuth } from './AuthContext'

export function SelectorUsuario({ rolEsperado }: { rolEsperado: 'operador' | 'tecnico' }) {
  const { setUsuario } = useAuth()
  const { data, isLoading, error } = useQuery({
    queryKey: ['usuarios', rolEsperado],
    queryFn: () => endpoints.usuarios.listar(rolEsperado),
  })

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow">
        <h1 className="mb-1 text-lg font-semibold text-[#1e2a78]">Facylitech</h1>
        <p className="mb-4 text-sm text-gray-500">
          Selector de usuario de desarrollo — elige un {rolEsperado} del seed para continuar.
        </p>
        {isLoading && <p className="text-sm text-gray-500">Cargando usuarios…</p>}
        {error && (
          <p className="text-sm text-red-600">
            No se pudo conectar a la API. ¿Está el backend corriendo?
          </p>
        )}
        <ul className="space-y-2">
          {data?.items.map((usuario) => (
            <li key={usuario.id}>
              <button
                onClick={() => setUsuario(usuario)}
                className="w-full rounded border border-gray-200 px-3 py-2 text-left text-sm hover:border-[#1e2a78] hover:bg-gray-50"
              >
                <span className="font-medium">{usuario.nombre}</span>
                <span className="block text-xs text-gray-500">{usuario.email}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
