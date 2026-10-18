import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import type { RolUsuario } from '../api/types'
import { useAuth } from './AuthContext'
import { PantallaCarga } from './PantallaCarga'
import { rutaInicial } from './sesion'

/**
 * Guard de rutas: sin sesión manda a `/login` recordando la ruta pedida
 * (`state.from`); con sesión de otro rol manda a la sección de su rol.
 * Mientras se valida la sesión guardada muestra una pantalla de carga.
 */
export function RequireRol({ rol, children }: { rol: RolUsuario; children: ReactNode }) {
  const { usuario, cargando, motivoCierre } = useAuth()
  const location = useLocation()
  if (cargando) return <PantallaCarga />
  if (!usuario) {
    // Tras un cierre voluntario no se recuerda la ruta: el próximo usuario parte de cero.
    const state = motivoCierre === 'voluntario' ? null : { from: location }
    return <Navigate to="/login" replace state={state} />
  }
  if (usuario.rol !== rol) return <Navigate to={rutaInicial(usuario.rol)} replace />
  return <>{children}</>
}

/** Ruta `/`: cada quien a su sección, o al login. */
export function RedirigirInicio() {
  const { usuario, cargando } = useAuth()
  if (cargando) return <PantallaCarga />
  return <Navigate to={usuario ? rutaInicial(usuario.rol) : '/login'} replace />
}
