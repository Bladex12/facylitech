/**
 * Decodificación de QR desde un <video>:
 * - `BarcodeDetector` nativo (Chrome Android, Safari iOS 17+): rápido y sin peso extra.
 * - Si no existe, `jsqr` (~45 KB min, sin dependencias) cargado bajo demanda con
 *   `import()` para no engordar el bundle inicial (RNF-02). Ver docs/decisiones.md.
 */
export type Decodificador = (video: HTMLVideoElement) => Promise<string | null>

interface BarcodeDetectorLike {
  detect(fuente: CanvasImageSource): Promise<{ rawValue: string }[]>
}
interface BarcodeDetectorCtor {
  new (opciones: { formats: string[] }): BarcodeDetectorLike
  getSupportedFormats?: () => Promise<string[]>
}

const ANCHO_ANALISIS = 640

export async function crearDecodificador(): Promise<Decodificador> {
  const Ctor = (globalThis as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector
  if (Ctor) {
    try {
      const formatos = (await Ctor.getSupportedFormats?.()) ?? ['qr_code']
      if (formatos.includes('qr_code')) {
        const detector = new Ctor({ formats: ['qr_code'] })
        return async (video) => {
          const res = await detector.detect(video)
          return res[0]?.rawValue ?? null
        }
      }
    } catch {
      // cae al fallback
    }
  }

  const { default: jsQR } = await import('jsqr')
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  return async (video) => {
    if (!ctx || !video.videoWidth) return null
    const escala = Math.min(1, ANCHO_ANALISIS / video.videoWidth)
    canvas.width = Math.round(video.videoWidth * escala)
    canvas.height = Math.round(video.videoHeight * escala)
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
    return jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })?.data ?? null
  }
}

export type EstadoCamara = 'iniciando' | 'activa' | 'denegada' | 'no_disponible' | 'sin_camara' | 'error'

export async function abrirCamaraTrasera(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
  })
}

/** Traduce el error de getUserMedia. Los navegadores no son consistentes con el
 * nombre del error al bloquear la cámara, así que se confirma con la Permissions API. */
export async function estadoDesdeError(e: unknown): Promise<EstadoCamara> {
  const nombre = (e as { name?: string })?.name
  if (nombre === 'NotAllowedError' || nombre === 'SecurityError') return 'denegada'
  try {
    const permiso = await navigator.permissions?.query({ name: 'camera' as PermissionName })
    if (permiso?.state === 'denied') return 'denegada'
  } catch {
    // Safari antiguo no soporta 'camera' en la Permissions API
  }
  if (nombre === 'NotFoundError' || nombre === 'OverconstrainedError') return 'sin_camara'
  return 'error'
}
