import React, { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Upload, Image as ImageIcon, FileText, Stethoscope, Paperclip, Trash2, Eye, Download,
} from 'lucide-react'
import { attachmentsApi } from '../../services/api'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/Spinner'
import { cn } from '../../lib/cn'

const CATEGORIES = [
  { id: 'imaging',      label: 'Imagenología',  icon: ImageIcon,    tone: 'bg-brand-50 text-brand-700' },
  { id: 'lab',          label: 'Laboratorio',   icon: FileText,     tone: 'bg-wellness-50 text-wellness-700' },
  { id: 'prescription', label: 'Receta',        icon: Stethoscope,  tone: 'bg-amber-50 text-amber-700' },
  { id: 'other',        label: 'Otro',          icon: Paperclip,    tone: 'bg-ink-100 text-ink-700' },
]

const MAX_BYTES = 20 * 1024 * 1024

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function categoryConfig(id) {
  return CATEGORIES.find((c) => c.id === id) || CATEGORIES[3]
}

/**
 * Sección reutilizable de adjuntos.
 *
 * Props:
 *  - mode: 'self' (paciente sube los suyos) | 'staff' (médico/admin sube por paciente)
 *  - patientId: requerido si mode='staff'
 *  - readonly: si true, oculta upload
 */
export function AttachmentsSection({ mode = 'self', patientId, readonly = false }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [category, setCategory] = useState('imaging')
  const [preview, setPreview] = useState(null) // { url, contentType, name }
  const fileRef = useRef(null)

  const load = () => {
    setLoading(true)
    const promise = mode === 'self' ? attachmentsApi.listMine() : attachmentsApi.listFor(patientId)
    promise.then((r) => setItems(r.data)).catch(() => setItems([])).finally(() => setLoading(false))
  }

  useEffect(load, [mode, patientId])

  const handleSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_BYTES) {
      toast.error('Máximo 20 MB por archivo')
      return
    }
    handleUpload(file)
    e.target.value = ''
  }

  const handleUpload = async (file) => {
    setUploading(true)
    try {
      const opts = { category }
      const promise = mode === 'self'
        ? attachmentsApi.uploadMine(file, opts)
        : attachmentsApi.uploadFor(patientId, file, opts)
      await promise
      toast.success('Archivo subido')
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al subir')
    } finally {
      setUploading(false)
    }
  }

  const handleView = async (att) => {
    try {
      const r = await attachmentsApi.downloadBlob(att.id)
      const blob = new Blob([r.data], { type: att.content_type })
      const url = URL.createObjectURL(blob)
      if (att.content_type.startsWith('image/')) {
        setPreview({ url, contentType: att.content_type, name: att.file_name })
      } else {
        window.open(url, '_blank')
        // El navegador toma control, no revoco enseguida
      }
    } catch {
      toast.error('No se pudo abrir el archivo')
    }
  }

  const handleDownload = async (att) => {
    try {
      const r = await attachmentsApi.downloadBlob(att.id)
      const blob = new Blob([r.data], { type: att.content_type })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = att.file_name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Error al descargar')
    }
  }

  const handleDelete = async (att) => {
    if (!window.confirm(`¿Eliminar "${att.file_name}"?`)) return
    try {
      await attachmentsApi.remove(att.id)
      setItems((prev) => prev.filter((x) => x.id !== att.id))
      toast.success('Eliminado')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al eliminar')
    }
  }

  return (
    <div className="space-y-4">
      {!readonly && (
        <div className="rounded-2xl border-2 border-dashed border-ink-200 bg-ink-50/40 p-5">
          <div className="flex flex-wrap gap-2 mb-3">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                  category === c.id
                    ? 'bg-ink-900 text-white border-ink-900'
                    : 'bg-white text-ink-600 border-ink-200 hover:border-ink-300',
                )}
              >
                <c.icon className="w-3.5 h-3.5" /> {c.label}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-xs text-ink-500">
              Sube radiografías, exámenes o recetas. JPG, PNG, PDF, DICOM. Máx 20 MB.
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,application/dicom,.dcm"
              className="hidden"
              onChange={handleSelect}
            />
            <Button size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <Upload className="w-3.5 h-3.5" /> {uploading ? 'Subiendo...' : 'Subir archivo'}
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-8 flex justify-center"><Spinner /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-8 text-sm text-ink-500 border border-dashed border-ink-200 rounded-2xl">
          No hay archivos adjuntos.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((att) => {
            const cat = categoryConfig(att.category)
            const isImage = att.content_type.startsWith('image/')
            return (
              <li key={att.id} className="flex items-center gap-3 p-3 rounded-xl border border-ink-100 hover:bg-ink-50/40 transition-colors">
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', cat.tone)}>
                  <cat.icon className="w-5 h-5" strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-ink-900 truncate">{att.file_name}</div>
                  <div className="text-xs text-ink-500 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span>{cat.label}</span>
                    <span className="text-ink-300">·</span>
                    <span className="tabular-nums">{formatSize(att.size_bytes)}</span>
                    <span className="text-ink-300">·</span>
                    <span className="tabular-nums">{format(parseISO(att.uploaded_at), "d MMM yyyy", { locale: es })}</span>
                  </div>
                  {att.note && <div className="text-xs text-ink-500 mt-0.5 italic truncate">"{att.note}"</div>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => handleView(att)} title={isImage ? 'Ver' : 'Abrir'}>
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDownload(att)} title="Descargar">
                    <Download className="w-4 h-4" />
                  </Button>
                  {!readonly && (
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(att)} title="Eliminar">
                      <Trash2 className="w-4 h-4 text-ink-400" />
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {/* Preview de imagen */}
      {preview && (
        <div
          className="fixed inset-0 z-50 bg-ink-900/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => { URL.revokeObjectURL(preview.url); setPreview(null) }}
        >
          <div className="absolute top-4 right-4 text-xs text-white/80">{preview.name}</div>
          <img src={preview.url} alt={preview.name} className="max-w-full max-h-full rounded-xl shadow-soft-lg" />
        </div>
      )}
    </div>
  )
}
