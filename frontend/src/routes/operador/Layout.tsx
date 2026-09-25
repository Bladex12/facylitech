import { NavLink, Outlet } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { endpoints } from '../../api/endpoints'

const HOY = new Date()
const MES_ACTUAL = `${HOY.getFullYear()}-${String(HOY.getMonth() + 1).padStart(2, '0')}`

const NAV_GENERAL = [
  { to: '/operador/dashboard', label: 'Dashboard' },
  { to: '/operador/mapa', label: 'Mapa' },
  { to: '/operador/calendario', label: 'Calendario' },
]
const NAV_TRABAJOS = [
  { to: '/operador/agenda', label: 'Agenda' },
  { to: '/operador/ascensores', label: 'Ascensores' },
  { to: '/operador/emergencias', label: 'Emergencias' },
]
const NAV_EQUIPO = [
  { to: '/operador/tecnicos', label: 'Técnicos' },
  { to: '/operador/mensajes', label: 'Mensajes' },
]

function Seccion({ titulo, items }: { titulo: string; items: { to: string; label: string }[] }) {
  return (
    <div className="mb-6">
      <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-blue-300">
        {titulo}
      </p>
      <nav className="space-y-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `block rounded px-3 py-2 text-sm ${
                isActive ? 'bg-white/10 text-white' : 'text-blue-100 hover:bg-white/5'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

export function OperadorLayout() {
  const { usuario, setUsuario } = useAuth()
  const { data: calendario } = useQuery({
    queryKey: ['dashboard', 'calendario', MES_ACTUAL],
    queryFn: () => endpoints.dashboard.calendario(MES_ACTUAL),
    refetchInterval: 60_000,
  })

  return (
    <div className="flex h-screen bg-gray-100">
      <aside className="flex w-56 flex-shrink-0 flex-col bg-[#1e2a78] p-4">
        <div className="mb-6 px-2 text-lg font-bold text-white">Facylitech</div>
        <Seccion titulo="General" items={NAV_GENERAL} />
        <Seccion titulo="Trabajos" items={NAV_TRABAJOS} />
        <Seccion titulo="Equipo" items={NAV_EQUIPO} />
      </aside>
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
          <div className="flex items-center gap-2 text-sm text-emerald-600">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Online
          </div>
          <div className="flex items-center gap-4">
            {(calendario?.emergencias_abiertas ?? 0) > 0 && (
              <NavLink
                to="/operador/emergencias"
                className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white"
              >
                {calendario?.emergencias_abiertas} emergencia
                {calendario?.emergencias_abiertas === 1 ? '' : 's'}
              </NavLink>
            )}
            <span className="text-sm text-gray-600">{usuario?.nombre}</span>
            <button
              onClick={() => setUsuario(null)}
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              Salir
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
