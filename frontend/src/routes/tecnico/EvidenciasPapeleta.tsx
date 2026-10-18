import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Camera, ChevronLeft, ChevronRight, Loader2, RotateCw, Trash2, X } from 'lucide-react'
import { urlArchivo } from '../../api/client'
import { endpoints } from '../../api/endpoints'
import type { Evidencia, Papeleta } from '../../api/types'
import { comprimirImagen, formatoBytes } from '../../domain/imagen'
import { mensajeError } from '../../lib/red'

interface Subida {
  idLocal: string
  original: File
  preview: string
  comprimida: Blob | null
  estado: 'comprimiendo' | 'subiendo' | 'error'
  error?: string
}

/**
 * Fotos de evidencia: cámara trasera, compresión en el cliente (≤1600 px, JPEG 0.8)
 * y subida una a una (mejor con mala señal, RNF-02), con estado y reintento por foto.
 */
export function EvidenciasPapeleta({ papeleta, soloLectura }: { papeleta: Papeleta; soloLectura: boolean }) {
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [subidas, setSubidas] = useState<Subida[]>([])
  const [visor, setVisor] = useState<number | null>(null)
  const [errorBorrar, setErrorBorrar] = useState<string | null>(null)
  const procesando = useRef(false)
  const evidencias = papeleta.evidencias ?? []

  const actualizar = (id: string, cambios: Partial<Subida>) =>
    setSubidas((prev) => prev.map((s) => (s.idLocal === id ? { ...s, ...cambios } : s)))

  // Cola secuencial: comprime y sube de a una.
  useEffect(() => {
    if (procesando.current) return
    const siguiente = subidas.find((s) => s.estado === 'comprimiendo' || (s.estado === 'subiendo' && !s.error))
    if (!siguiente) return
    procesando.current = true
    ;(async () => {
      try {
        let blob = siguiente.comprimida
        if (!blob) {
          blob = await comprimirImagen(siguiente.original)
          actualizar(siguiente.idLocal, { comprimida: blob, estado: 'subiendo' })
        }
        const nombre = siguiente.original.name.replace(/\.\w+$/, '') + '.jpg'
        const archivo = blob instanceof File ? blob : new File([blob], nombre, { type: blob.type || 'image/jpeg' })
        const evidencia = await endpoints.papeletas.subirEvidencia(papeleta.id, archivo, 'foto')
        queryClient.setQueryData<Papeleta>(['papeleta', papeleta.id], (prev) =>
          prev ? { ...prev, evidencias: [...(prev.evidencias ?? []), evidencia] } : prev,
        )
        URL.revokeObjectURL(siguiente.preview)
        setSubidas((prev) => prev.filter((s) => s.idLocal !== siguiente.idLocal))
      } catch (e) {
        actualizar(siguiente.idLocal, { estado: 'error', error: mensajeError(e) })
      } finally {
        procesando.current = false
        // re-dispara el efecto para la siguiente foto
        setSubidas((prev) => [...prev])
      }
    })()
  }, [subidas, papeleta.id, queryClient])

  const borrar = useMutation({
    mutationFn: (ev: Evidencia) => endpoints.papeletas.eliminarEvidencia(papeleta.id, ev.id),
    onSuccess: (p) => {
      queryClient.setQueryData(['papeleta', papeleta.id], p)
      setVisor(null)
      setErrorBorrar(null)
    },
    onError: (e) => setErrorBorrar(mensajeError(e)),
  })

  function alElegir(e: ChangeEvent<HTMLInputElement>) {
    const archivos = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith('image/'))
    e.target.value = ''
    setSubidas((prev) => [
      ...prev,
      ...archivos.map((f) => ({
        idLocal: crypto.randomUUID(),
        original: f,
        preview: URL.createObjectURL(f),
        comprimida: null,
        estado: 'comprimiendo' as const,
      })),
    ])
  }

  const actual = visor != null ? evidencias[visor] : null

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-semibold tracking-widest text-[var(--color-text-muted)] uppercase">
          Fotos de evidencia
        </p>
        <span className="font-mono-brand text-xs text-[var(--color-text-muted)]">{evidencias.length}</span>
      </div>

      {(evidencias.length > 0 || subidas.length > 0) && (
        <div className="mb-3 grid grid-cols-4 gap-2">
          {evidencias.map((ev, i) => (
            <button
              key={ev.id}
              onClick={() => setVisor(i)}
              className="aspect-square overflow-hidden rounded border border-[var(--color-border)] bg-[var(--color-bg)]"
            >
              <img src={urlArchivo(ev.url)} alt={`Evidencia ${i + 1}`} loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
          {subidas.map((s) => (
            <div key={s.idLocal} className="relative aspect-square overflow-hidden rounded border border-[var(--color-border)]">
              <img src={s.preview} alt="" className="h-full w-full object-cover opacity-60" />
              <div
                className={`absolute inset-0 flex flex-col items-center justify-center gap-1 p-1 text-center text-[9px] font-semibold text-white ${
                  s.estado === 'error' ? 'bg-red-700/75' : 'bg-[var(--color-navy)]/55'
                }`}
              >
                {s.estado === 'error' ? (
                  <>
                    <AlertCircle size={14} />
                    <span className="leading-tight">No se subió</span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => actualizar(s.idLocal, { estado: s.comprimida ? 'subiendo' : 'comprimiendo', error: undefined })}
                        aria-label="Reintentar"
                        className="rounded bg-white/25 p-1"
                      >
                        <RotateCw size={11} />
                      </button>
                      <button
                        onClick={() => {
                          URL.revokeObjectURL(s.preview)
                          setSubidas((prev) => prev.filter((x) => x.idLocal !== s.idLocal))
                        }}
                        aria-label="Descartar"
                        className="rounded bg-white/25 p-1"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    {s.estado === 'comprimiendo' ? 'Optimizando' : 'Subiendo'}
                    {s.comprimida && (
                      <span className="font-mono-brand font-normal opacity-90">{formatoBytes(s.comprimida.size)}</span>
                    )}
                  </>
                )}
              </div>
              {s.estado === 'subiendo' && (
                <div className="absolute inset-x-0 bottom-0 h-1 overflow-hidden bg-white/30">
                  <div className="h-full w-1/3 animate-[deslizar_1.1s_ease-in-out_infinite] bg-[var(--color-accent)]" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!soloLectura ? (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            onChange={alElegir}
            className="hidden"
          />
          <button
            onClick={() => inputRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[var(--color-border)] py-3 text-sm font-semibold text-[var(--color-text)] active:bg-[var(--color-bg)]"
          >
            <Camera size={16} className="text-[var(--color-accent)]" /> Adjuntar fotos
          </button>
          <p className="mt-1 text-center text-[10px] text-[var(--color-text-muted)]">
            Se optimizan antes de subir para ahorrar datos.
          </p>
        </>
      ) : (
        evidencias.length === 0 && <p className="text-xs text-[var(--color-text-muted)]">Sin fotos adjuntas.</p>
      )}

      {actual && visor != null && (
        <div className="fixed inset-0 z-50 mx-auto flex max-w-md flex-col bg-black">
          <div className="flex items-center justify-between px-3 py-3 text-white">
            <button onClick={() => setVisor(null)} aria-label="Cerrar" className="rounded p-1.5 active:bg-white/10">
              <X size={20} />
            </button>
            <span className="font-mono-brand text-xs text-slate-300">
              {visor + 1} / {evidencias.length} ·{' '}
              {new Date(actual.created_at).toLocaleString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}
            </span>
            {!soloLectura ? (
              <button
                onClick={() => window.confirm('¿Eliminar esta foto?') && borrar.mutate(actual)}
                disabled={borrar.isPending}
                aria-label="Eliminar foto"
                className="rounded p-1.5 text-red-400 active:bg-white/10 disabled:opacity-40"
              >
                <Trash2 size={18} />
              </button>
            ) : (
              <span className="w-8" />
            )}
          </div>
          <div className="relative flex flex-1 items-center justify-center overflow-hidden">
            <img src={urlArchivo(actual.url)} alt="" className="max-h-full max-w-full object-contain" />
            {visor > 0 && (
              <button
                onClick={() => setVisor(visor - 1)}
                aria-label="Anterior"
                className="absolute left-2 rounded-full bg-black/50 p-2 text-white"
              >
                <ChevronLeft size={20} />
              </button>
            )}
            {visor < evidencias.length - 1 && (
              <button
                onClick={() => setVisor(visor + 1)}
                aria-label="Siguiente"
                className="absolute right-2 rounded-full bg-black/50 p-2 text-white"
              >
                <ChevronRight size={20} />
              </button>
            )}
          </div>
          {errorBorrar && <p className="bg-red-700 px-4 py-2 text-center text-xs text-white">{errorBorrar}</p>}
        </div>
      )}
    </div>
  )
}
