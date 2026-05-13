import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { ClipboardList, Check, Clock, AlertTriangle, ChevronRight } from 'lucide-react'
import { homeworkApi } from '../../services/api'
import { Card } from '../../components/ui/Card'
import { Avatar } from '../../components/ui/Avatar'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { cn } from '../../lib/cn'

/**
 * Feed para el doctor: tareas recientes que asignó a sus pacientes,
 * con estado y resumen. Muestra completadas + pendientes mezcladas pero ordenadas.
 */
export default function DoctorHomeworkFeed({ className = '' }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    homeworkApi.doctorRecent(30)
      .then((r) => setItems(r.data))
      .catch(() => setError('No se pudo cargar'))
      .finally(() => setLoading(false))
  }, [])

  const grouped = useMemo(() => ({
    pending: items.filter((i) => i.status === 'pending'),
    completed: items.filter((i) => i.status === 'completed'),
  }), [items])

  return (
    <Card className={cn('overflow-hidden', className)}>
      <div className="px-6 py-5 border-b border-ink-100 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight inline-flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-brand-600" />
            Tareas asignadas a tus pacientes
          </h2>
          <p className="text-xs text-ink-500 mt-0.5">
            Últimos 30 días · {grouped.pending.length} pendientes · {grouped.completed.length} completadas
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center"><Spinner /></div>
      ) : error ? (
        <p className="p-6 text-sm text-ink-500">{error}</p>
      ) : items.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No has asignado tareas todavía"
          description="Desde la ficha de un paciente podés asignarle ejercicios o lecturas para hacer entre sesiones."
        />
      ) : (
        <ul className="divide-y divide-ink-100 max-h-[480px] overflow-y-auto">
          {items.slice(0, 10).map((item, idx) => {
            const isCompleted = item.status === 'completed'
            return (
              <motion.li
                key={item.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: idx * 0.03 }}
                className="px-6 py-4 hover:bg-ink-50/60 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <Avatar name={item.patient_name || '?'} size="sm" className="shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-ink-900 truncate">{item.patient_name}</span>
                      <span className={cn(
                        'inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border',
                        isCompleted
                          ? 'bg-wellness-100 text-wellness-700 border-wellness-200'
                          : 'bg-amber-100 text-amber-800 border-amber-200',
                      )}>
                        {isCompleted ? <><Check className="w-3 h-3" /> Completada</> : <><Clock className="w-3 h-3" /> Pendiente</>}
                      </span>
                    </div>
                    <div className={cn('text-sm mt-1 truncate', isCompleted ? 'text-ink-500 line-through' : 'text-ink-800')}>
                      {item.title}
                    </div>
                    <div className="text-[11px] text-ink-500 mt-1">
                      {item.created_at && format(parseISO(item.created_at), "d MMM", { locale: es })}
                      {item.due_date && ` · Vence ${format(parseISO(item.due_date), "d MMM", { locale: es })}`}
                      {isCompleted && item.completed_at && ` · Hecha ${format(parseISO(item.completed_at), "d MMM", { locale: es })}`}
                    </div>
                    {item.patient_feedback && (
                      <p className="text-xs text-ink-600 italic mt-1.5 line-clamp-2">"{item.patient_feedback}"</p>
                    )}
                  </div>
                  <Link
                    to={`/doctor/patients/${item.patient_id}`}
                    className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800 self-center"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </motion.li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
