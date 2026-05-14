import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronRight, Sparkles, Clock, ArrowRight } from 'lucide-react'
import { questionnairesApi } from '../../services/api'
import { Card } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'

/**
 * Widget compacto para el dashboard del paciente: muestra cuestionarios pendientes.
 */
export default function PatientQuestionnairesWidget() {
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    questionnairesApi.mine('pending')
      .then((r) => setPending(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (!loading && pending.length === 0) return null  // no mostramos si no hay pendientes

  return (
    <Card className="overflow-hidden border-brand-200 bg-brand-50/30">
      <div className="px-6 py-4 border-b border-brand-100 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-semibold inline-flex items-center gap-2 text-brand-800">
            <Sparkles className="w-4 h-4" /> Cuestionarios para responder
          </h3>
          <p className="text-xs text-brand-600 mt-0.5">
            {pending.length} pendiente{pending.length !== 1 && 's'} · Tu profesional verá los resultados.
          </p>
        </div>
        <Link
          to="/patient/questionnaires"
          className="text-sm font-medium text-brand-700 hover:text-brand-800 inline-flex items-center gap-1"
        >
          Ver todos <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {loading ? (
        <div className="py-10 flex justify-center"><Spinner /></div>
      ) : (
        <div className="p-4 space-y-3">
          {pending.slice(0, 3).map((a) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Link
                to={`/patient/questionnaires/${a.id}`}
                className="flex items-center gap-3 rounded-xl bg-white border border-ink-200 p-4 hover:border-brand-300 hover:shadow-soft transition-all group"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-ink-900">{a.short_name}</div>
                  <div className="text-xs text-ink-500 truncate">{a.questionnaire_name}</div>
                  <div className="text-[11px] text-ink-500 mt-1 flex items-center gap-2 flex-wrap">
                    {a.doctor_name && <span>De {a.doctor_name}</span>}
                    {a.due_date && (
                      <span className="inline-flex items-center gap-0.5">
                        <Clock className="w-3 h-3" /> Vence {format(parseISO(a.due_date), 'd MMM', { locale: es })}
                      </span>
                    )}
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-ink-400 group-hover:text-brand-600" />
              </Link>
            </motion.div>
          ))}
          {pending.length > 3 && (
            <Link
              to="/patient/questionnaires"
              className="block text-center text-sm text-brand-700 font-medium hover:text-brand-800 py-2"
            >
              Ver {pending.length - 3} más →
            </Link>
          )}
        </div>
      )}
    </Card>
  )
}
