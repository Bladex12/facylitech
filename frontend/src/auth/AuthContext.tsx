import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { endpoints } from '../api/endpoints'
import { fijarToken, onNoAutorizado } from '../api/client'
import { limpiarCachesServiceWorker } from './limpiarCaches'
import { AuthContext, type MotivoCierre, type AuthContextValue } from './useAuth'
import {
  borrarSesionGuardada,
  guardarSesion,
  leerSesionGuardada,
  sesionVigente,
  type Sesion,
} from './sesion'

/**
 * Sesión real (JWT, docs/contrato-auth.md). Guarda `{token, usuario, expira_at}`
 * en localStorage; `api/client.ts` envía el token y avisa de los 401 a
 * través de `onNoAutorizado`, sin depender de React Router: al quedar
 * `usuario` en null, los guards de `App.tsx` redirigen a `/login`.
 */

/** Máximo que se muestra la pantalla de carga mientras `GET /auth/me` responde. */
const ESPERA_VALIDACION_MS = 4000

function sesionInicial(): { sesion: Sesion | null; motivo: MotivoCierre } {
  try {
    localStorage.removeItem('facylitech.usuario') // selector de desarrollo anterior
  } catch {
    // storage bloqueado
  }
  const guardada = leerSesionGuardada()
  if (guardada && sesionVigente(guardada)) {
    fijarToken(guardada.token)
    return { sesion: guardada, motivo: null }
  }
  if (guardada) {
    borrarSesionGuardada()
    return { sesion: null, motivo: 'expirada' }
  }
  return { sesion: null, motivo: null }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [inicial] = useState(sesionInicial)
  const [sesion, setSesion] = useState<Sesion | null>(inicial.sesion)
  const [motivoCierre, setMotivoCierre] = useState<MotivoCierre>(inicial.motivo)
  const [cargando, setCargando] = useState(inicial.sesion !== null)

  /** Descarta todo rastro del usuario: memoria, storage, caché de consultas y del service worker. */
  const cerrarSesion = useCallback(
    (motivo: Exclude<MotivoCierre, null>) => {
      fijarToken(null)
      borrarSesionGuardada()
      setSesion(null)
      setMotivoCierre(motivo)
      setCargando(false)
      queryClient.clear()
      void limpiarCachesServiceWorker()
    },
    [queryClient],
  )

  // Un 401 en cualquier endpoint (salvo login/cambiar-password) = sesión caída.
  useEffect(() => onNoAutorizado(() => cerrarSesion('expirada')), [cerrarSesion])

  // Al montar: valida la sesión guardada. Sin red se conserva; solo un 401 la descarta
  // (lo maneja onNoAutorizado) o `expira_at` vencido (ya resuelto en sesionInicial).
  useEffect(() => {
    if (!inicial.sesion) return
    let activo = true
    // Con señal mala (RNF-02) no se deja al técnico mirando una pantalla de carga:
    // pasados unos segundos se entra con la sesión guardada y la validación sigue en segundo plano.
    const espera = window.setTimeout(() => setCargando(false), ESPERA_VALIDACION_MS)
    endpoints.auth
      .me()
      .then((usuario) => {
        if (!activo) return
        setSesion((actual) => {
          if (!actual) return actual
          const nueva = { ...actual, usuario }
          guardarSesion(nueva)
          return nueva
        })
      })
      .catch(() => {
        // sin red u otro error: se conserva la sesión guardada
      })
      .finally(() => {
        window.clearTimeout(espera)
        if (activo) setCargando(false)
      })
    return () => {
      activo = false
      window.clearTimeout(espera)
    }
  }, [inicial.sesion])

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await endpoints.auth.login(email.trim(), password)
      // Antes de mostrar nada del usuario nuevo, fuera lo del anterior.
      await limpiarCachesServiceWorker()
      queryClient.clear()
      const nueva: Sesion = { token: res.access_token, usuario: res.usuario, expira_at: res.expira_at }
      fijarToken(nueva.token)
      guardarSesion(nueva)
      setSesion(nueva)
      setMotivoCierre(null)
      setCargando(false)
      return nueva.usuario
    },
    [queryClient],
  )

  const logout = useCallback(() => cerrarSesion('voluntario'), [cerrarSesion])

  const value = useMemo<AuthContextValue>(
    () => ({ usuario: sesion?.usuario ?? null, cargando, motivoCierre, login, logout }),
    [sesion, cargando, motivoCierre, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
