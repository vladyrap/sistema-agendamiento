import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronRight, ClipboardList, TrendingUp } from 'lucide-react'
import { homeworkApi } from '../../services/api'
import { Card } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'
import HomeworkItem from './HomeworkItem'

/**
 * Widget compacto para el dashboard del paciente — muestra las tareas pendientes.
 */
export default function PatientHomeworkWidget({ limit = 3 }) {
  const [pending, setPending] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const [r1, r2] = await Promise.all([
        homeworkApi.mine('pending'),
        homeworkApi.myStats(),
      ])
      setPending(r1.data)
      setStats(r2.data)
    } catch {
      /* silent */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (!loading && pending.length === 0 && (!stats || stats.total === 0)) {
    // Si nunca tuvo tareas, no mostramos el widget — para no llenar el dashboard.
    return null
  }

  const visible = pending.slice(0, limit)
  const hidden = Math.max(0, pending.length - visible.length)

  return (
    <Card className="overflow-hidden">
      <div className="px-6 py-4 border-b border-ink-100 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-semibold inline-flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-brand-600" />
            Tus tareas
          </h3>
          {stats && (
            <p className="text-xs text-ink-500 mt-0.5">
              {stats.pending} pendientes · {stats.completed} completadas
              {stats.completion_rate !== null && stats.total > 0 && (
                <span className="inline-flex items-center gap-1 ml-2 text-wellness-700 font-semibold">
                  <TrendingUp className="w-3 h-3" />
                  {Math.round((stats.completion_rate || 0) * 100)}%
                </span>
              )}
            </p>
          )}
        </div>
        <Link
          to="/patient/homework"
          className="text-sm font-medium text-brand-600 hover:text-brand-700 inline-flex items-center gap-1"
        >
          Ver todas <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {loading ? (
        <div className="py-10 flex justify-center"><Spinner /></div>
      ) : pending.length === 0 ? (
        <div className="py-10 text-center">
          <ClipboardList className="w-8 h-8 text-ink-300 mx-auto" />
          <p className="text-sm text-ink-500 mt-2">¡No tienes tareas pendientes! 🎉</p>
        </div>
      ) : (
        <div className="p-4 space-y-3">
          {visible.map((hw) => (
            <HomeworkItem key={hw.id} hw={hw} role="patient" compact onChanged={load} />
          ))}
          {hidden > 0 && (
            <Link
              to="/patient/homework"
              className="block text-center text-sm text-brand-600 font-medium hover:text-brand-700 py-2"
            >
              Ver {hidden} {hidden === 1 ? 'tarea más' : 'tareas más'} →
            </Link>
          )}
        </div>
      )}
    </Card>
  )
}
