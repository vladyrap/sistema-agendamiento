import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { format, parseISO, isPast, differenceInCalendarDays } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Check, Circle, Clock, CalendarClock, MessageSquare, Trash2, Pencil, X, Save, Undo2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { homeworkApi } from '../../services/api'
import { Button } from '../../components/ui/Button'
import { cn } from '../../lib/cn'

/**
 * Item reutilizable de tarea entre sesiones.
 *
 * Props:
 * - hw: la tarea (HomeworkResponse del API)
 * - role: 'patient' | 'doctor' | 'admin' — define qué acciones se muestran
 * - onChanged: callback luego de completar / descompletar / borrar
 * - compact: versión más densa (para listas largas)
 */
export default function HomeworkItem({ hw, role = 'patient', onChanged, compact = false }) {
  const [feedback, setFeedback] = useState(hw.patient_feedback || '')
  const [showFeedback, setShowFeedback] = useState(false)
  const [saving, setSaving] = useState(false)

  const isCompleted = hw.status === 'completed'
  const dueDate = hw.due_date ? parseISO(hw.due_date) : null
  const isOverdue = !isCompleted && dueDate && isPast(dueDate) && differenceInCalendarDays(dueDate, new Date()) < 0
  const daysToDue = dueDate ? differenceInCalendarDays(dueDate, new Date()) : null

  async function markComplete() {
    setSaving(true)
    try {
      await homeworkApi.complete(hw.id, feedback)
      toast.success('¡Bien hecho!')
      setShowFeedback(false)
      onChanged?.()
    } catch {
      toast.error('No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  async function markUncomplete() {
    if (!confirm('¿Volver a marcarla como pendiente?')) return
    setSaving(true)
    try {
      await homeworkApi.uncomplete(hw.id)
      toast.success('Volvió a pendiente')
      onChanged?.()
    } catch {
      toast.error('No se pudo')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!confirm('¿Borrar esta tarea? El paciente la perderá.')) return
    try {
      await homeworkApi.remove(hw.id)
      toast.success('Borrada')
      onChanged?.()
    } catch {
      toast.error('No se pudo borrar')
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border transition-colors',
        isCompleted
          ? 'bg-wellness-50/50 border-wellness-100'
          : isOverdue
            ? 'bg-rose-50/40 border-rose-100'
            : 'bg-white border-ink-200',
        compact ? 'p-4' : 'p-5',
      )}
    >
      <div className="flex items-start gap-3">
        {role === 'patient' ? (
          <button
            onClick={() => isCompleted ? markUncomplete() : setShowFeedback(true)}
            disabled={saving}
            className={cn(
              'shrink-0 mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all',
              isCompleted
                ? 'bg-wellness-500 border-wellness-500 text-white hover:bg-wellness-600'
                : 'border-ink-300 hover:border-brand-500 hover:bg-brand-50',
            )}
            title={isCompleted ? 'Volver a pendiente' : 'Marcar como completada'}
            aria-label={isCompleted ? 'Volver a pendiente' : 'Marcar como completada'}
          >
            {isCompleted ? <Check className="w-3.5 h-3.5" /> : null}
          </button>
        ) : (
          <div className={cn(
            'shrink-0 mt-0.5 w-6 h-6 rounded-full flex items-center justify-center',
            isCompleted ? 'bg-wellness-100 text-wellness-700' : 'bg-ink-100 text-ink-500',
          )}>
            {isCompleted ? <Check className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <h4 className={cn(
              'font-semibold text-sm tracking-tight',
              isCompleted ? 'text-ink-500 line-through' : 'text-ink-900',
            )}>
              {hw.title}
            </h4>
            <div className="flex items-center gap-1.5 shrink-0">
              {dueDate && !isCompleted && (
                <span className={cn(
                  'inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border',
                  isOverdue
                    ? 'bg-rose-100 text-rose-700 border-rose-200'
                    : daysToDue !== null && daysToDue <= 2
                      ? 'bg-amber-100 text-amber-800 border-amber-200'
                      : 'bg-ink-100 text-ink-600 border-ink-200',
                )}>
                  <CalendarClock className="w-3 h-3" />
                  {isOverdue
                    ? `Vencida hace ${Math.abs(daysToDue)}d`
                    : daysToDue === 0
                      ? 'Hoy'
                      : daysToDue === 1
                        ? 'Mañana'
                        : `En ${daysToDue}d`}
                </span>
              )}
              {isCompleted && hw.completed_at && (
                <span className="text-[10px] text-wellness-700 font-semibold uppercase tracking-wide bg-wellness-100 border border-wellness-200 rounded-full px-2 py-0.5">
                  Hecha {format(parseISO(hw.completed_at), 'd MMM', { locale: es })}
                </span>
              )}
            </div>
          </div>

          {hw.description && (
            <p className={cn(
              'mt-1.5 leading-relaxed whitespace-pre-wrap',
              compact ? 'text-xs text-ink-600' : 'text-sm text-ink-600',
              isCompleted && 'text-ink-400',
            )}>
              {hw.description}
            </p>
          )}

          {/* Metadata: doctor / paciente */}
          {(role === 'patient' && hw.doctor_name) && (
            <div className="text-[11px] text-ink-500 mt-2">
              Asignada por {hw.doctor_name}
              {hw.doctor_specialty && ` · ${hw.doctor_specialty}`}
              {' · '}
              {hw.created_at && format(parseISO(hw.created_at), "d MMM", { locale: es })}
            </div>
          )}
          {(role !== 'patient' && hw.patient_name) && (
            <div className="text-[11px] text-ink-500 mt-2">
              {hw.patient_name}
              {' · '}
              Creada {hw.created_at && format(parseISO(hw.created_at), "d MMM", { locale: es })}
            </div>
          )}

          {/* Feedback del paciente al completar */}
          {hw.patient_feedback && (
            <div className="mt-3 p-3 rounded-xl bg-ink-50 border border-ink-100 text-sm text-ink-700">
              <MessageSquare className="inline w-3.5 h-3.5 text-ink-400 mr-1 align-text-bottom" />
              "{hw.patient_feedback}"
            </div>
          )}

          {/* Form de feedback al completar (paciente) */}
          {showFeedback && (
            <div className="mt-3 space-y-2">
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="¿Cómo te fue? (opcional)"
                rows={2}
                maxLength={2000}
                className="w-full rounded-xl border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-400 resize-none"
                autoFocus
              />
              <div className="flex items-center justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowFeedback(false)}>
                  <X className="w-3.5 h-3.5" /> Cancelar
                </Button>
                <Button size="sm" onClick={markComplete} disabled={saving}>
                  <Check className="w-3.5 h-3.5" />
                  {saving ? 'Guardando…' : 'Marcar completa'}
                </Button>
              </div>
            </div>
          )}

          {/* Acciones doctor */}
          {role !== 'patient' && !isCompleted && (
            <div className="mt-3 flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={remove} className="text-rose-600 hover:bg-rose-50">
                <Trash2 className="w-3.5 h-3.5" /> Borrar
              </Button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
