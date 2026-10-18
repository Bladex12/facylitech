import type { RolUsuario, Usuario } from '../api/types'

/**
 * Lógica pura de la sesión (sin React): parseo, vigencia, validación de
 * contraseñas y reglas de redirección por rol. Contrato: docs/contrato-auth.md.
 */

export const CLAVE_SESION = 'facylitech.sesion'
/** Clave del selector de desarrollo anterior; se borra al arrancar. */
export const CLAVE_SESION_ANTIGUA = 'facylitech.usuario'
export const MIN_PASSWORD = 8

export interface Sesion {
  token: string
  usuario: Usuario
  /** ISO 8601 con zona. */
  expira_at: string
}

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Interpreta el JSON guardado; devuelve null si está corrupto o incompleto. */
export function parsearSesion(raw: string | null): Sesion | null {
  if (!raw) return null
  let datos: unknown
  try {
    datos = JSON.parse(raw)
  } catch {
    return null
  }
  if (!esObjeto(datos)) return null
  const { token, usuario, expira_at } = datos
  if (typeof token !== 'string' || token === '') return null
  if (typeof expira_at !== 'string' || Number.isNaN(Date.parse(expira_at))) return null
  if (!esObjeto(usuario)) return null
  if (typeof usuario.id !== 'string' || (usuario.rol !== 'operador' && usuario.rol !== 'tecnico'))
    return null
  return { token, usuario: usuario as unknown as Usuario, expira_at }
}

/** La sesión sirve mientras `expira_at` no haya pasado. */
export function sesionVigente(sesion: Sesion, ahora: Date = new Date()): boolean {
  return Date.parse(sesion.expira_at) > ahora.getTime()
}

// ── Almacenamiento (puede fallar: modo privado, cuota, storage bloqueado) ──

export function leerSesionGuardada(): Sesion | null {
  try {
    return parsearSesion(localStorage.getItem(CLAVE_SESION))
  } catch {
    return null
  }
}

export function guardarSesion(sesion: Sesion): void {
  try {
    localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion))
  } catch {
    // sin almacenamiento: la sesión vive solo en memoria
  }
}

export function borrarSesionGuardada(): void {
  try {
    localStorage.removeItem(CLAVE_SESION)
    localStorage.removeItem(CLAVE_SESION_ANTIGUA)
  } catch {
    // nada que borrar
  }
}

// ── Contraseñas ──

/** Mensaje de error de la contraseña nueva o null si es válida. */
export function validarPasswordNueva(nueva: string, confirmacion: string): string | null {
  if (nueva.length < MIN_PASSWORD)
    return `La contraseña nueva debe tener al menos ${MIN_PASSWORD} caracteres.`
  if (nueva !== confirmacion) return 'La confirmación no coincide con la contraseña nueva.'
  return null
}

function azarSeguro(n: number): number {
  const buf = new Uint32Array(1)
  // Rechazo de sesgo: descarta los valores que no se reparten parejo entre n.
  const limite = Math.floor(0x100000000 / n) * n
  do {
    crypto.getRandomValues(buf)
  } while (buf[0] >= limite)
  return buf[0] % n
}

/** Contraseña legible (sin caracteres ambiguos) para que el operador la entregue al técnico. */
export function generarPassword(largo = 10, azar: (n: number) => number = azarSeguro): string {
  const alfabeto = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let salida = ''
  for (let i = 0; i < largo; i++) salida += alfabeto[azar(alfabeto.length)]
  return salida
}

// ── Redirecciones por rol ──

export function rutaInicial(rol: RolUsuario): string {
  return rol === 'operador' ? '/operador' : '/tecnico'
}

/** ¿Puede este rol abrir esa ruta? (`/operador/...` solo operador, `/tecnico/...` solo técnico). */
export function rutaPermitida(ruta: string, rol: RolUsuario): boolean {
  const base = rutaInicial(rol)
  return ruta === base || ruta.startsWith(`${base}/`)
}

/**
 * A dónde ir tras entrar: la ruta que se intentaba abrir si es del rol
 * correcto; si no (o si no hay), la sección del rol.
 */
export function destinoTrasLogin(
  from: { pathname?: string; search?: string; hash?: string } | null | undefined,
  rol: RolUsuario,
): string {
  const pathname = from?.pathname
  if (typeof pathname === 'string' && rutaPermitida(pathname, rol)) {
    return `${pathname}${from?.search ?? ''}${from?.hash ?? ''}`
  }
  return rutaInicial(rol)
}

// ── Mensajes ──

/** "2 min 05 s" / "45 s" para el contador de bloqueo temporal. */
export function formatoEspera(segundos: number): string {
  const s = Math.max(0, Math.ceil(segundos))
  if (s < 60) return `${s} s`
  const m = Math.floor(s / 60)
  const resto = s % 60
  return resto === 0 ? `${m} min` : `${m} min ${String(resto).padStart(2, '0')} s`
}
