import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import { SelectorUsuario } from './auth/SelectorUsuario'
import { Proximamente } from './components/Proximamente'
import { OperadorLayout } from './routes/operador/Layout'
import { Dashboard } from './routes/operador/Dashboard'
import { TecnicoLayout } from './routes/tecnico/Layout'
import { Agenda } from './routes/tecnico/Agenda'
import { OrdenDetalle } from './routes/tecnico/OrdenDetalle'

function RequireOperador({ children }: { children: ReactNode }) {
  const { usuario } = useAuth()
  if (!usuario) return <SelectorUsuario rolEsperado="operador" />
  if (usuario.rol !== 'operador') return <Navigate to="/tecnico" replace />
  return <>{children}</>
}

function RequireTecnico({ children }: { children: ReactNode }) {
  const { usuario } = useAuth()
  if (!usuario) return <SelectorUsuario rolEsperado="tecnico" />
  if (usuario.rol !== 'tecnico') return <Navigate to="/operador" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/operador" replace />} />

      <Route
        path="/operador"
        element={
          <RequireOperador>
            <OperadorLayout />
          </RequireOperador>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="mapa" element={<Proximamente titulo="Mapa" />} />
        <Route path="calendario" element={<Proximamente titulo="Calendario" />} />
        <Route path="agenda" element={<Proximamente titulo="Agenda" />} />
        <Route path="ascensores" element={<Proximamente titulo="Ascensores" />} />
        <Route path="emergencias" element={<Proximamente titulo="Emergencias" />} />
        <Route path="tecnicos" element={<Proximamente titulo="Técnicos" />} />
        <Route path="mensajes" element={<Proximamente titulo="Mensajes" />} />
      </Route>

      <Route
        path="/tecnico"
        element={
          <RequireTecnico>
            <TecnicoLayout />
          </RequireTecnico>
        }
      >
        <Route index element={<Navigate to="agenda" replace />} />
        <Route path="agenda" element={<Agenda />} />
        <Route path="ordenes/:id" element={<OrdenDetalle />} />
        <Route path="trabajos" element={<Proximamente titulo="Trabajos" />} />
        <Route path="mapa" element={<Proximamente titulo="Mapa" />} />
        <Route path="emergencias" element={<Proximamente titulo="Emergencias" />} />
        <Route path="mensajes" element={<Proximamente titulo="Mensajes" />} />
      </Route>
    </Routes>
  )
}
