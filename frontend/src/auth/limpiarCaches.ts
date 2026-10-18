/**
 * Cachés del service worker (vite.config.ts) que contienen datos del usuario:
 * respuestas GET de la API y fotos de evidencia. Se vacían al cerrar sesión y
 * al iniciar una nueva para que otro usuario en el mismo celular no vea datos
 * del anterior.
 */
export const CACHES_DE_USUARIO = ['api-get', 'evidencias'] as const

export async function limpiarCachesServiceWorker(): Promise<void> {
  if (typeof caches === 'undefined') return
  await Promise.all(
    CACHES_DE_USUARIO.map(async (nombre) => {
      try {
        await caches.delete(nombre)
      } catch {
        // caché no disponible (contexto inseguro, modo privado): nada que limpiar
      }
    }),
  )
}
