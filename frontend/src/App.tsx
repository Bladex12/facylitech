import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Login } from './auth/Login'
import { RedirigirInicio, RequireRol } from './auth/RequireRol'
import { OperadorLayout } from './routes/operador/Layout'
import { Dashboard } from './routes/operador/Dashboard'
import { Emergencias } from './routes/operador/Emergencias'
import { Mapa } from './routes/operador/Mapa'
import { Tecnicos } from './routes/operador/Tecnicos'
import { Ascensores } from './routes/operador/ascensores/Ascensores'
import { Calendario } from './routes/operador/calendario/Calendario'
import { AgendaOperador } from './routes/operador/agenda/AgendaOperador'
import { TecnicoLayout } from './routes/tecnico/Layout'
import { Agenda } from './routes/tecnico/Agenda'
import { OrdenDetalle } from './routes/tecnico/OrdenDetalle'
import { Trabajos } from './routes/tecnico/Trabajos'
import { Mapa as MapaTecnico } from './routes/tecnico/Mapa'
import { Emergencias as EmergenciasTecnico } from './routes/tecnico/Emergencias'
import { Escanear } from './routes/tecnico/Escanear'
import { Mensajeria } from './components/mensajes/Mensajeria'

function RequireOperador({ children }: { children: ReactNode }) {
  return <RequireRol rol="operador">{children}</RequireRol>
}

function RequireTecnico({ children }: { children: ReactNode }) {
  return <RequireRol rol="tecnico">{children}</RequireRol>
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RedirigirInicio />} />
      <Route path="/login" element={<Login />} />

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
        <Route path="mapa" element={<Mapa />} />
        <Route path="calendario" element={<Calendario />} />
        <Route path="agenda" element={<AgendaOperador />} />
        <Route path="ascensores/*" element={<Ascensores />} />
        <Route path="emergencias" element={<Emergencias />} />
        <Route path="tecnicos" element={<Tecnicos />} />
        <Route path="mensajes" element={<Mensajeria modo="escritorio" />} />
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
        <Route path="trabajos" element={<Trabajos />} />
        <Route path="mapa" element={<MapaTecnico />} />
        <Route path="emergencias" element={<EmergenciasTecnico />} />
        <Route path="escanear" element={<Escanear />} />
        <Route
          path="mensajes"
          element={<Mensajeria modo="movil" rutaOrden={(id) => `/tecnico/ordenes/${id}`} />}
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
