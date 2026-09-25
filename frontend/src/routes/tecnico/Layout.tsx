import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'

const NAV = [
  { to: '/tecnico/agenda', label: 'Agenda', icon: '📋' },
  { to: '/tecnico/trabajos', label: 'Trabajos', icon: '🔧' },
  { to: '/tecnico/mapa', label: 'Mapa', icon: '🗺️' },
  { to: '/tecnico/emergencias', label: 'Emergencias', icon: '🚨' },
  { to: '/tecnico/mensajes', label: 'Mensajes', icon: '💬' },
]

export function TecnicoLayout() {
  const { usuario, setUsuario } = useAuth()

  return (
    <div className="mx-auto flex h-screen max-w-md flex-col bg-gray-100">
      <header className="flex items-center justify-between bg-[#1e2a78] px-4 py-3 text-white">
        <div>
          <p className="text-sm font-semibold">Facylitech Técnico</p>
          <p className="text-xs text-blue-200">{usuario?.nombre}</p>
        </div>
        <button onClick={() => setUsuario(null)} className="text-xs text-blue-200 underline">
          Salir
        </button>
      </header>
      <main className="flex-1 overflow-auto pb-16">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 mx-auto flex w-full max-w-md border-t border-gray-200 bg-white">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] ${
                isActive ? 'text-[#1e2a78]' : 'text-gray-400'
              }`
            }
          >
            <span className="text-base leading-none">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
