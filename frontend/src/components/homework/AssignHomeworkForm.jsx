import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X, Save, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { homeworkApi } from '../../services/api'
import { Button } from '../../components/ui/Button'
import { Input, Label } from '../../components/ui/Input'
import { cn } from '../../lib/cn'

const QUICK_TEMPLATES = [
  { title: '10 minutos de mindfulness',     description: 'Sienta unos minutos en silencio, foco en la respiración. Si te distraes, vuelve suavemente al aire entrando y saliendo.' },
  { title: 'Diario emocional diario',       description: 'Anota 3 cosas que sentiste hoy, sin juzgarlas. Solo registrar.' },
  { title: 'Respiración 4-7-8',             description: 'Inhala 4s, sostén 7s, exhala 8s. Repite 4 ciclos. Hacelo 2 veces al día.' },
  { title: 'Caminata sin pantalla',         description: 'Una caminata de 20 minutos sin celular. Mirá lo que te rodea.' },
  { title: '3 gratitudes',                  description: 'Antes de dormir, anota 3 cosas por las que estés agradecido hoy.' },
]

/**
 * Formulario para que el doctor asigne una tarea al paciente.
 * Inline (no modal), con templates rápidos y campo libre.
 */
export default function AssignHomeworkForm({ patientId, onCreated }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)

  function reset() {
    setTitle('')
    setDescription('')
    setDueDate('')
  }

  function applyTemplate(t) {
    setTitle(t.title)
    setDescription(t.description)
  }

  async function submit() {
    if (!title.trim()) {
      toast.error('Ponele un título')
      return
    }
    setSaving(true)
    try {
      const payload = {
        patient_id: patientId,
        title: title.trim(),
        description: description.trim(),
        due_date: dueDate || null,
      }
      await homeworkApi.create(payload)
      toast.success('Tarea asignada')
      reset()
      setOpen(false)
      onCreated?.()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <AnimatePresence mode="wait">
        {!open ? (
          <motion.div key="closed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
              <Plus className="w-4 h-4" /> Asignar tarea
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-2xl border border-brand-200 bg-brand-50/40 p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold inline-flex items-center gap-2 text-brand-800">
                <Sparkles className="w-4 h-4" /> Nueva tarea
              </h4>
              <button
                onClick={() => { setOpen(false); reset() }}
                className="text-ink-500 hover:text-ink-900 p-1"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Templates rápidos */}
            <div>
              <div className="text-[11px] uppercase tracking-wider font-semibold text-brand-700 mb-1.5">
                Plantillas rápidas
              </div>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_TEMPLATES.map((t) => (
                  <button
                    key={t.title}
                    onClick={() => applyTemplate(t)}
                    className={cn(
                      'text-xs px-2.5 py-1.5 rounded-lg border',
                      title === t.title
                        ? 'bg-brand-600 text-white border-brand-600'
                        : 'bg-white text-ink-700 border-ink-200 hover:border-brand-300 hover:bg-brand-50',
                    )}
                  >
                    {t.title}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label>Título *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Ejercicio de respiración 4-7-8"
                maxLength={200}
                autoFocus
              />
            </div>

            <div>
              <Label>Descripción / instrucciones</Label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalles, frecuencia, cuándo hacerlo…"
                rows={3}
                className="w-full rounded-xl border border-ink-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-400 resize-none"
              />
            </div>

            <div>
              <Label>Fecha límite (opcional)</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => { setOpen(false); reset() }}>
                Cancelar
              </Button>
              <Button size="sm" onClick={submit} disabled={saving || !title.trim()}>
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Asignando…' : 'Asignar'}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
