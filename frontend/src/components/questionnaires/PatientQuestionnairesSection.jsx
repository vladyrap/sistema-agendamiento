import React, { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Sparkles, Clock, Check, AlertTriangle, Trash2, ClipboardList, TrendingUp,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { questionnairesApi } from '../../services/api'
import { Card } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { cn } from '../../lib/cn'
import AssignQuestionnaireForm from './AssignQuestionnaireForm'
import SeverityBar from './SeverityBar'
import HistoryChart from './HistoryChart'
import ExportButton from '../../components/ui/ExportButton'

/**
 * Sección en la ficha del paciente con sus cuestionarios + histórico por test.
 *
 * Props:
 *  - patientId
 *  - canAssign (bool) — doctor/admin puede asignar nuevos
 */
export default function PatientQuestionnairesSection({ patientId, canAssign = true, className = '' }) {
  const [items, setItems] = useState([])
  const [catalog, setCatalog] = useState([])
  const [history, setHistory] = useState({}) // por code → array de puntos
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const [r1, r2] = await Promise.all([
        questionnairesApi.forPatient(patientId),
        questionnairesApi.list(),
      ])
      setItems(r1.data)
      setCatalog(r2.data)
      // Cargar historiales para cada cuestionario que tenga al menos un completed
      const uniqueCompletedCodes = [...new Set(
        r1.data.filter((a) => a.status === 'completed').map((a) => a.code)
      )]
      const histories = await Promise.all(
        uniqueCompletedCodes.map(async (code) => {
          try {
            const h = await questionnairesApi.history(patientId, code)
            return [code, h.data]
          } catch {
            return [code, []]
          }
        })
      )
      setHistory(Object.fromEntries(histories))
    } catch {
      toast.error('No se pudieron cargar los cuestionarios')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [patientId])

  async function removeAssignment(a) {
    if (!confirm(`¿Borrar el cuestionario ${a.short_name} asignado el ${format(parseISO(a.created_at), 'd MMM', { locale: es })}?`)) return
    try {
      await questionnairesApi.remove(a.id)
      toast.success('Borrado')
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No se pudo borrar')
    }
  }

  const catalogByCode = useMemo(
    () => Object.fromEntries(catalog.map((q) => [q.code, q])),
    [catalog],
  )

  const pendingCount = items.filter((a) => a.status === 'pending').length
  const completedCount = items.filter((a) => a.status === 'completed').length

  return (
    <Card className={cn('p-6 space-y-5', className)}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold inline-flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-600" /> Cuestionarios psicológicos
            <span className="text-xs text-ink-500 font-normal">
              · {pendingCount} pendientes · {completedCount} completados
            </span>
          </h3>
          <p className="text-xs text-ink-500 mt-0.5">
            Tests validados (PHQ-9, GAD-7, WHO-5) para evaluar y seguir la evolución clínica.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton endpoint={`/exports/questionnaires/patient/${patientId}`} filename="cuestionarios.xlsx" label="Excel" size="sm" />
          {canAssign && (
            <AssignQuestionnaireForm patientId={patientId} onCreated={load} />
          )}
        </div>
      </div>

      {loading ? (
        <div className="py-8 flex justify-center"><Spinner /></div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Sin cuestionarios asignados"
          description={canAssign ? 'Asigna el primer cuestionario con el botón de arriba.' : ''}
        />
      ) : (
        <>
          {/* Historiales por código de cuestionario */}
          {Object.entries(history).map(([code, points]) => {
            if (!points.length) return null
            const meta = catalogByCode[code]
            return (
              <div key={code} className="rounded-2xl border border-ink-100 bg-ink-50/40 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-brand-600" />
                    <span className="text-sm font-semibold text-ink-900">
                      Evolución {meta?.short_name || code.toUpperCase()}
                    </span>
                  </div>
                  <span className="text-[11px] text-ink-500">
                    {points.length} {points.length === 1 ? 'medición' : 'mediciones'}
                  </span>
                </div>
                <HistoryChart points={points} maxScore={meta?.max_score || 27} height={140} />
              </div>
            )
          })}

          {/* Lista de asignaciones */}
          <div className="space-y-2.5">
            {items.map((a) => (
              <AssignmentRow
                key={a.id}
                a={a}
                meta={catalogByCode[a.code]}
                onRemove={canAssign ? () => removeAssignment(a) : null}
              />
            ))}
          </div>
        </>
      )}
    </Card>
  )
}


function AssignmentRow({ a, meta, onRemove }) {
  const isCompleted = a.status === 'completed'
  const isCrisis = a.crisis_flagged

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border p-4',
        isCrisis ? 'bg-rose-50/40 border-rose-200' :
        isCompleted ? 'bg-wellness-50/40 border-wellness-100' :
        'bg-white border-ink-200',
      )}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-ink-900">{a.short_name}</span>
            <span className={cn(
              'inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border',
              isCompleted
                ? 'bg-wellness-100 text-wellness-700 border-wellness-200'
                : 'bg-amber-100 text-amber-800 border-amber-200',
            )}>
              {isCompleted ? <><Check className="w-3 h-3" /> Completado</> : <><Clock className="w-3 h-3" /> Pendiente</>}
            </span>
            {isCrisis && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                <AlertTriangle className="w-3 h-3" /> Crisis detectada
              </span>
            )}
          </div>

          <div className="text-[11px] text-ink-500 mt-1">
            {a.questionnaire_name}
            {a.created_at && ` · Asignado ${format(parseISO(a.created_at), "d MMM", { locale: es })}`}
            {a.due_date && ` · Vence ${format(parseISO(a.due_date), "d MMM", { locale: es })}`}
            {isCompleted && a.completed_at && ` · Completado ${format(parseISO(a.completed_at), "d MMM", { locale: es })}`}
          </div>

          {a.doctor_note && (
            <div className="text-xs text-ink-600 mt-1.5 italic">
              Nota del profesional: "{a.doctor_note}"
            </div>
          )}

          {isCompleted && a.score !== null && (
            <div className="mt-3 max-w-md">
              <SeverityBar
                score={a.score}
                maxScore={a.max_score}
                severityLabel={a.severity_label}
                severityTone={a.severity_tone}
                size="sm"
              />
              {a.action_hint && (
                <p className="text-xs text-ink-600 mt-2 leading-relaxed">{a.action_hint}</p>
              )}
              {a.patient_comment && (
                <p className="text-xs text-ink-700 mt-2 italic leading-relaxed">
                  Comentario del paciente: "{a.patient_comment}"
                </p>
              )}
            </div>
          )}
        </div>

        {onRemove && !isCompleted && (
          <button
            onClick={onRemove}
            className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:bg-rose-50 px-2 py-1 rounded-lg"
          >
            <Trash2 className="w-3.5 h-3.5" /> Borrar
          </button>
        )}
      </div>
    </motion.div>
  )
}
