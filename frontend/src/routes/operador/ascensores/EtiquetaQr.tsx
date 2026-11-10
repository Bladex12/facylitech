import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Download, Printer } from 'lucide-react'
import type { Ascensor, Edificio } from '../../../api/types'
import { categoriaDe } from '../../../domain/equipos'
import { CATEGORIA_CFG } from '../comun/etiquetas'
import { CLASE_BOTON_SECUNDARIO, CLASE_TARJETA } from '../comun/ui'

/** Colores de marca leídos de los tokens CSS (index.css), no hex sueltos. */
function token(nombre: string, respaldo: string): string {
  if (typeof document === 'undefined') return respaldo
  return getComputedStyle(document.documentElement).getPropertyValue(nombre).trim() || respaldo
}

/**
 * Etiqueta imprimible (PNG) de 600×800: banda de marca, QR real con el
 * `codigo_qr` (lo que lee el escáner del técnico: GET /ascensores/qr/{codigo}),
 * y los datos para identificar el equipo a simple vista.
 */
async function generarEtiqueta(equipo: Ascensor, edificio: Edificio | undefined): Promise<string> {
  const navy = token('--color-navy', '#0d1b2a')
  const accent = token('--color-accent', '#0284c7')
  const muted = token('--color-text-muted', '#6b7280')
  const canvas = document.createElement('canvas')
  canvas.width = 600
  canvas.height = 800
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.fillStyle = navy
  ctx.fillRect(0, 0, canvas.width, 90)
  ctx.fillStyle = accent
  ctx.fillRect(40, 27, 36, 36)
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 30px Barlow, system-ui, sans-serif'
  ctx.textBaseline = 'middle'
  ctx.fillText('Facylitech', 92, 46)
  ctx.font = '16px Barlow, system-ui, sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText('Escanear para abrir ficha', 560, 46)
  ctx.textAlign = 'left'

  const qr = document.createElement('canvas')
  await QRCode.toCanvas(qr, equipo.codigo_qr, {
    width: 440,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: navy, light: '#ffffff' },
  })
  ctx.drawImage(qr, 80, 120, 440, 440)

  ctx.textAlign = 'center'
  ctx.fillStyle = navy
  ctx.font = 'bold 40px "DM Mono", ui-monospace, monospace'
  ctx.fillText(equipo.codigo_qr, 300, 610)
  ctx.fillStyle = accent
  ctx.font = 'bold 26px "DM Mono", ui-monospace, monospace'
  ctx.fillText(`${equipo.codigo} · ${CATEGORIA_CFG[categoriaDe(equipo)].label}`, 300, 662)
  ctx.fillStyle = muted
  ctx.font = '22px Barlow, system-ui, sans-serif'
  const linea = [edificio?.nombre, equipo.torre].filter(Boolean).join(' · ')
  ctx.fillText(linea.length > 46 ? `${linea.slice(0, 45)}…` : linea, 300, 708)
  if (edificio) ctx.fillText(`${edificio.direccion}, ${edificio.comuna}`.slice(0, 50), 300, 742)

  ctx.strokeStyle = token('--color-border', '#e0e0de')
  ctx.setLineDash([10, 8])
  ctx.lineWidth = 2
  ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12)
  return canvas.toDataURL('image/png')
}

function imprimir(src: string, titulo: string) {
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  document.body.appendChild(iframe)
  const doc = iframe.contentDocument!
  doc.open()
  doc.write(
    `<!doctype html><html><head><title>${titulo.replace(/[<>&"]/g, '')}</title><style>@page{margin:12mm}body{margin:0;display:flex;justify-content:center}img{width:70mm}</style></head><body><img src="${src}"></body></html>`,
  )
  doc.close()
  const img = doc.querySelector('img')!
  const lanzar = () => {
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
    setTimeout(() => iframe.remove(), 1000)
  }
  if (img.complete) lanzar()
  else img.onload = lanzar
}

export function EtiquetaQr({ equipo, edificio }: { equipo: Ascensor; edificio?: Edificio }) {
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let vigente = true
    QRCode.toString(equipo.codigo_qr, {
      type: 'svg',
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: token('--color-navy', '#0d1b2a'), light: '#ffffff' },
    })
      .then((s) => vigente && setSvg(s))
      .catch(() => vigente && setError(true))
    return () => {
      vigente = false
    }
  }, [equipo.codigo_qr])

  async function descargar() {
    const src = await generarEtiqueta(equipo, edificio)
    const a = document.createElement('a')
    a.href = src
    a.download = `etiqueta-${equipo.codigo_qr}.png`
    a.click()
  }

  async function imprimirEtiqueta() {
    imprimir(await generarEtiqueta(equipo, edificio), `Etiqueta ${equipo.codigo_qr}`)
  }

  return (
    <div className={`${CLASE_TARJETA} flex flex-col items-center gap-5 p-8`}>
      <div className="h-52 w-52 rounded border border-[var(--color-border)] p-2" data-testid="qr">
        {svg ? (
          <img
            src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`}
            alt={`Código QR ${equipo.codigo_qr}`}
            className="h-full w-full"
            style={{ imageRendering: 'pixelated' }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-[var(--color-text-muted)]">
            {error ? 'No se pudo generar el QR' : 'Generando…'}
          </div>
        )}
      </div>
      <div className="text-center">
        <div className="mb-1 font-mono-brand text-2xl font-bold text-[var(--color-text)]">{equipo.codigo_qr}</div>
        <div className="text-sm text-[var(--color-text-muted)]">
          ID único del equipo — el técnico lo escanea para abrir la ficha y sus OTs
        </div>
      </div>
      <div className="rounded border border-dashed border-[var(--color-border)] px-6 py-3 text-center font-mono-brand text-xs text-[var(--color-text-muted)]">
        {equipo.codigo} · {edificio?.nombre ?? '—'}
        {equipo.torre ? ` · ${equipo.torre}` : ''} · {[equipo.marca, equipo.modelo].filter(Boolean).join(' ')}
      </div>
      <div className="flex gap-2">
        <button onClick={imprimirEtiqueta} disabled={!svg} className={CLASE_BOTON_SECUNDARIO}>
          <Printer size={14} /> Imprimir etiqueta
        </button>
        <button onClick={descargar} disabled={!svg} className={CLASE_BOTON_SECUNDARIO}>
          <Download size={14} /> Descargar PNG
        </button>
      </div>
    </div>
  )
}
