import React, { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from './Button'
import { cn } from '../../lib/cn'

/**
 * Botón reutilizable que dispara la descarga de un archivo Excel desde un endpoint.
 *
 * Props:
 *   - endpoint: ruta relativa al backend (sin /api), ej: "/exports/appointments"
 *   - filename: nombre fallback si el server no manda Content-Disposition
 *   - label: texto del botón (default: "Descargar Excel")
 *   - variant, size, className: passthrough al Button
 *   - params: { ... } query params opcionales
 */
export default function ExportButton({
  endpoint,
  filename = 'export.xlsx',
  label = 'Descargar Excel',
  variant = 'secondary',
  size = 'sm',
  className = '',
  params = null,
  icon: Icon = Download,
}) {
  const [loading, setLoading] = useState(false)

  async function handleDownload() {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const qs = params ? `?${new URLSearchParams(params).toString()}` : ''
      const res = await fetch(`/api${endpoint}${qs}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `HTTP ${res.status}`)
      }
      // Intentar leer filename del header
      const cd = res.headers.get('content-disposition') || ''
      const match = /filename="?([^"]+)"?/.exec(cd)
      const name = match ? match[1] : filename
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = name
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast.success('Descarga lista')
    } catch (err) {
      toast.error('No se pudo descargar: ' + (err?.message || 'error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleDownload}
      disabled={loading}
      className={cn('inline-flex items-center gap-1.5', className)}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
      {loading ? 'Descargando…' : label}
    </Button>
  )
}
