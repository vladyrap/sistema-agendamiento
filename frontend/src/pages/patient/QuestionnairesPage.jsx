import React, { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Sparkles, Clock, Check, ArrowRight, ArrowLeft, AlertTriangle, ClipboardList,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { questionnairesApi } from '../../services/api'
import { Card } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { fadeInUp } from '../../lib/motion'
import { cn } from '../../lib/cn'
import QuestionnaireForm from '../../components/questionnaires/QuestionnaireForm'
import SeverityBar from '../../components/questionnaires/SeverityBar'

export default function QuestionnairesPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')

  async function load() {
    setLoading(true)
    try {
      const r = await questionnairesApi.mine(filter === 'all' ? undefined : filter)
      setItems(r.data)
    } catch {
      toast.error('No se pudieron cargar tus cuestionarios')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [filter])

  // Si hay :id en la URL, mostramos el formulario para responder/ver
  if (id) {
    return (
      <div className="space-y-5">
        <Link
          to="/patient/questionnaires"
          className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900 font-medium"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a mis cuestionarios
        </Link>
        <Card className="p-6">
          <QuestionnaireForm
            assignmentId={parseInt(id, 10)}
            onSubmitted={() => load()}
            onCancel={() => navigate('/patient/questionnaires')}
          />
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-7">
      <motion.div {...fadeInUp}>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tightest inline-flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-brand-600" /> Cuestionarios psicológicos
        </h1>
        <p className="text-ink-500 text-sm mt-1">
          Tests clínicos asignados por tu profesional para evaluar tu evolución. Solo se comparten con quien te atiende.
        </p>
      </motion.div>

      <div className="inline-flex rounded-xl bg-ink-100 p-1">
        {[
          { id: 'pending',   label: 'Pendientes' },
          { id: 'completed', label: 'Completados' },
          { id: 'all',       label: 'Todos' },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3.5 py-1.5 text-sm font-semibold rounded-lg transition-colors ${
              filter === f.id ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-600 hover:text-ink-900'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 flex justify-center"><Spinner size="lg" /></div>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            icon={ClipboardList}
            title={filter === 'pending' ? 'No tienes cuestionarios pendientes' : 'Sin cuestionarios todavía'}
            description={filter === 'pending'
              ? '¡Genial! Estás al día con todo.'
              : 'Cuando tu profesional te asigne un test, aparecerá aquí.'}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((a) => {
            const isCompleted = a.status === 'completed'
            return (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Link
                  to={`/patient/questionnaires/${a.id}`}
                  className={cn(
                    'block rounded-2xl border p-5 transition-all group',
                    isCompleted
                      ? 'bg-wellness-50/40 border-wellness-100 hover:border-wellness-200'
                      : 'bg-white border-ink-200 hover:border-brand-300 hover:shadow-soft',
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
                        {a.crisis_flagged && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                            <AlertTriangle className="w-3 h-3" /> Alerta
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-ink-600 mt-1">{a.questionnaire_name}</div>
                      <div className="text-[11px] text-ink-500 mt-1 flex items-center gap-2 flex-wrap">
                        {a.doctor_name && <span>De {a.doctor_name}</span>}
                        {a.due_date && !isCompleted && (
                          <span>Vence {format(parseISO(a.due_date), 'd MMM', { locale: es })}</span>
                        )}
                        {isCompleted && a.completed_at && (
                          <span>Hecho {format(parseISO(a.completed_at), 'd MMM', { locale: es })}</span>
                        )}
                      </div>
                      {isCompleted && a.score !== null && (
                        <div className="mt-3 max-w-md">
                          <SeverityBar
                            score={a.score}
                            maxScore={a.max_score}
                            severityLabel={a.severity_label}
                            severityTone={a.severity_tone}
                            size="sm"
                          />
                        </div>
                      )}
                    </div>
                    <ArrowRight className="w-5 h-5 text-ink-400 group-hover:text-brand-600 transition-colors" />
                  </div>
                </Link>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
