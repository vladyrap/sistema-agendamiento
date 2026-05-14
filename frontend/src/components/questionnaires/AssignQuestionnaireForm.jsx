import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X, Sparkles, Send, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import { questionnairesApi } from '../../services/api'
import { Button } from '../../components/ui/Button'
import { Input, Label } from '../../components/ui/Input'
import { cn } from '../../lib/cn'

/**
 * Formulario para que el doctor asigne un cuestionario al paciente.
 */
export default function AssignQuestionnaireForm({ patientId, onCreated }) {
  const [open, setOpen] = useState(false)
  const [catalog, setCatalog] = useState([])
  const [code, setCode] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    questionnairesApi.list()
      .then((r) => setCatalog(r.data))
      .catch(() => {})
  }, [])

  function reset() {
    setCode('')
    setDueDate('')
    setNote('')
  }

  async function submit() {
    if (!code) {
      toast.error('Elige un cuestionario')
      return
    }
    setSaving(true)
    try {
      await questionnairesApi.assign({
        patient_id: patientId,
        code,
        due_date: dueDate || null,
        doctor_note: note,
      })
      toast.success('Cuestionario asignado')
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
              <Plus className="w-4 h-4" /> Asignar cuestionario
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-2xl border border-brand-200 bg-brand-50/30 p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold inline-flex items-center gap-2 text-brand-800">
                <Sparkles className="w-4 h-4" /> Asignar cuestionario
              </h4>
              <button
                onClick={() => { setOpen(false); reset() }}
                className="text-ink-500 hover:text-ink-900 p-1"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <Label>Selecciona el cuestionario *</Label>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-1">
                {catalog.map((q) => {
                  const selected = code === q.code
                  return (
                    <button
                      key={q.code}
                      type="button"
                      onClick={() => setCode(q.code)}
                      className={cn(
                        'text-left rounded-xl border-2 p-3 transition-colors',
                        selected
                          ? 'border-brand-500 bg-brand-50 shadow-brand-sm'
                          : 'border-ink-200 bg-white hover:border-brand-300',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className={cn('text-sm font-bold', selected ? 'text-brand-800' : 'text-ink-900')}>
                          {q.short_name}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] text-ink-500">
                          <Clock className="w-3 h-3" /> ~{q.duration_minutes}m
                        </span>
                      </div>
                      <p className="text-[11px] text-ink-600 leading-snug">{q.description}</p>
                      <div className="text-[10px] text-ink-400 mt-1.5">
                        {q.num_questions} preguntas · score 0-{q.max_score}
                      </div>
                    </button>
                  )
                })}
              </div>
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

            <div>
              <Label>Nota para el paciente (opcional)</Label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                maxLength={1000}
                placeholder="Por ejemplo: 'Por favor responde antes del lunes para conversarlo en la próxima sesión.'"
                className="w-full rounded-xl border border-ink-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-400 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => { setOpen(false); reset() }}>
                Cancelar
              </Button>
              <Button size="sm" onClick={submit} disabled={saving || !code}>
                <Send className="w-3.5 h-3.5" />
                {saving ? 'Asignando…' : 'Asignar'}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
