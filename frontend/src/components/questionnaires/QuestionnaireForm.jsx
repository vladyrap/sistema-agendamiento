import React, { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Check, AlertTriangle, Clock, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { questionnairesApi } from '../../services/api'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { cn } from '../../lib/cn'
import SeverityBar from './SeverityBar'

/**
 * Componente para que el paciente responda un cuestionario asignado.
 *
 * Props:
 *  - assignmentId: ID de la asignación
 *  - onSubmitted: callback con la respuesta (incluye score y severidad)
 *  - onCancel: callback para volver atrás
 */
export default function QuestionnaireForm({ assignmentId, onSubmitted, onCancel }) {
  const [assignment, setAssignment] = useState(null)
  const [definition, setDefinition] = useState(null) // catálogo completo con preguntas
  const [loading, setLoading] = useState(true)
  const [answers, setAnswers] = useState({})  // {"0": 2, ...}
  const [comment, setComment] = useState('')
  const [step, setStep] = useState(0)  // pregunta actual (one-at-a-time UX)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    setLoading(true)
    questionnairesApi.getAssignment(assignmentId)
      .then(async (r) => {
        setAssignment(r.data)
        const def = await questionnairesApi.get(r.data.code)
        setDefinition(def.data)
        // Si ya tiene respuestas (re-ver), pre-cargar
        if (r.data.answers) setAnswers(r.data.answers)
        if (r.data.patient_comment) setComment(r.data.patient_comment)
      })
      .catch(() => toast.error('No se pudo cargar el cuestionario'))
      .finally(() => setLoading(false))
  }, [assignmentId])

  const total = definition?.num_questions || 0
  const allAnswered = useMemo(
    () => total > 0 && Object.keys(answers).length === total,
    [answers, total],
  )

  function selectAnswer(idx, value) {
    setAnswers((a) => ({ ...a, [String(idx)]: value }))
    // Auto-avance a la siguiente pregunta (con un delay para que el usuario vea su elección)
    if (idx < total - 1) {
      setTimeout(() => setStep((s) => Math.min(s + 1, total - 1)), 300)
    }
  }

  async function submit() {
    if (!allAnswered) {
      toast.error(`Faltan ${total - Object.keys(answers).length} respuestas`)
      return
    }
    setSubmitting(true)
    try {
      const r = await questionnairesApi.submit(assignmentId, answers, comment)
      setResult(r.data)
      // Si crisis, mostrar mensaje específico
      if (r.data.crisis_flagged) {
        toast.error('Tu respuesta sugiere que estás pasando un momento muy difícil. Por favor, contacta a tu profesional o llama al *4141.', { duration: 8000 })
      } else {
        toast.success('Respuestas guardadas')
      }
      onSubmitted?.(r.data)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al enviar')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="py-16 flex justify-center"><Spinner size="lg" /></div>
  }

  if (!assignment || !definition) {
    return <div className="py-16 text-center text-ink-500">No se pudo cargar el cuestionario.</div>
  }

  // Si ya está completado y NO está re-respondiendo, mostrar resultados
  if (assignment.status === 'completed' && !result) {
    return <CompletedView assignment={assignment} definition={definition} onClose={onCancel} />
  }

  // Si recién se envió, mostrar resultado
  if (result) {
    return <CompletedView assignment={result} definition={definition} onClose={onCancel} isNew />
  }

  const currentQ = definition.questions[step]
  const currentAnswer = answers[String(step)]
  const progress = ((step + 1) / total) * 100

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
          <h2 className="text-xl font-bold tracking-tight inline-flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-brand-600" /> {definition.short_name}
          </h2>
          <div className="text-xs text-ink-500 inline-flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> ~{definition.duration_minutes} min
          </div>
        </div>
        <p className="text-sm text-ink-600 leading-relaxed">{definition.instructions}</p>
      </div>

      {/* Progreso */}
      <div>
        <div className="flex items-center justify-between text-xs text-ink-500 mb-1.5">
          <span>Pregunta {step + 1} de {total}</span>
          <span className="tabular-nums">{Object.keys(answers).length}/{total} respondidas</span>
        </div>
        <div className="h-1.5 bg-ink-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-brand-500 to-brand-700 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Pregunta actual */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.25 }}
          className="space-y-4"
        >
          <div className="rounded-2xl bg-gradient-to-br from-brand-50 to-white border border-brand-100 p-6">
            <div className="text-[11px] uppercase tracking-wider font-bold text-brand-600 mb-2">
              Pregunta {step + 1}
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-ink-900 leading-snug">
              {currentQ}
            </h3>
          </div>

          {/* Opciones */}
          <div className="grid gap-2">
            {definition.scale_options.map((opt) => {
              const selected = currentAnswer === opt.value
              return (
                <motion.button
                  key={opt.value}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => selectAnswer(step, opt.value)}
                  className={cn(
                    'flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl border-2 text-left transition-all',
                    selected
                      ? 'border-brand-500 bg-brand-50 shadow-brand-sm'
                      : 'border-ink-200 bg-white hover:border-brand-300 hover:bg-brand-50/50',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0',
                      selected ? 'bg-brand-600 border-brand-600' : 'border-ink-300',
                    )}>
                      {selected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                    </div>
                    <span className={cn(
                      'text-sm font-medium',
                      selected ? 'text-brand-800' : 'text-ink-700',
                    )}>
                      {opt.label}
                    </span>
                  </div>
                  <span className={cn(
                    'text-xs font-bold tabular-nums px-2 py-0.5 rounded-full',
                    selected ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-600',
                  )}>
                    {opt.value}
                  </span>
                </motion.button>
              )
            })}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Nota opcional al final */}
      {step === total - 1 && (
        <div>
          <label className="block text-xs uppercase tracking-wider font-semibold text-ink-600 mb-1.5">
            Comentario (opcional)
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="¿Quieres agregar algo para tu profesional?"
            className="w-full rounded-xl border border-ink-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-400 resize-none"
          />
        </div>
      )}

      {/* Navegación */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          <ChevronLeft className="w-4 h-4" /> Anterior
        </Button>

        {step < total - 1 ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setStep((s) => Math.min(total - 1, s + 1))}
            disabled={currentAnswer === undefined}
          >
            Siguiente <ChevronRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button
            size="md"
            onClick={submit}
            disabled={!allAnswered || submitting}
          >
            <Check className="w-4 h-4" />
            {submitting ? 'Enviando…' : 'Enviar respuestas'}
          </Button>
        )}
      </div>
    </div>
  )
}


function CompletedView({ assignment, definition, onClose, isNew = false }) {
  const tone = assignment.severity_tone || 'wellness'
  const isCrisis = assignment.crisis_flagged

  return (
    <div className="space-y-5">
      {isNew && (
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-2xl bg-gradient-to-br from-wellness-50 to-brand-50 border border-wellness-100 p-4 text-center"
        >
          <div className="inline-flex items-center gap-2 text-wellness-700 font-semibold">
            <Check className="w-4 h-4" /> Gracias por completar el cuestionario.
          </div>
        </motion.div>
      )}

      {isCrisis && (
        <div className="rounded-2xl bg-rose-50 border-2 border-rose-200 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
            <div>
              <h4 className="font-bold text-rose-800">Tu respuesta nos preocupa</h4>
              <p className="text-sm text-rose-700 mt-1 leading-relaxed">
                Tu profesional fue notificado/a y se pondrá en contacto. Si necesitas ayuda inmediata:
              </p>
              <ul className="mt-2 space-y-1 text-sm text-rose-700">
                <li>🆘 <strong>Salud Responde</strong>: 600 360 7777 (24h)</li>
                <li>🆘 <strong>*4141</strong> desde tu celular (gratis, 24h)</li>
                <li>🆘 <strong>SAMU</strong>: 131 (emergencias)</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-white border border-ink-200 p-6">
        <div className="text-[11px] uppercase tracking-wider font-bold text-ink-500 mb-1">
          Resultado · {definition.short_name}
        </div>
        <SeverityBar
          score={assignment.score}
          maxScore={assignment.max_score}
          severityLabel={assignment.severity_label}
          severityTone={tone}
        />
        {assignment.action_hint && (
          <p className="text-sm text-ink-700 mt-4 leading-relaxed">
            {assignment.action_hint}
          </p>
        )}
      </div>

      {assignment.patient_comment && (
        <div className="rounded-2xl bg-ink-50 border border-ink-100 p-4">
          <div className="text-[11px] uppercase tracking-wider font-semibold text-ink-500 mb-1">
            Tu comentario
          </div>
          <p className="text-sm text-ink-700 italic leading-relaxed">"{assignment.patient_comment}"</p>
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button onClick={onClose}>Volver</Button>
      </div>
    </div>
  )
}
