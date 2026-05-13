import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { format, parseISO, formatDistanceToNow, differenceInDays } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Heart, AlertTriangle, Sun, ChevronRight, CalendarDays, MessageCircle,
} from 'lucide-react'
import { moodApi } from '../../services/api'
import { Card } from '../../components/ui/Card'
import { Avatar } from '../../components/ui/Avatar'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { cn } from '../../lib/cn'

const EMOJI = {
  1: '😢', 2: '😞', 3: '😕', 4: '😐', 5: '🙂',
  6: '🙂', 7: '😊', 8: '😄', 9: '🤩', 10: '🌟',
}

const SCALE_LABELS = {
  1: 'muy mal', 2: 'mal', 3: 'bajo', 4: 'apagado', 5: 'neutro',
  6: 'bien', 7: 'muy bien', 8: 'genial', 9: 'pleno', 10: 'excelente',
}

function scoreClasses(s) {
  if (s <= 3) return {
    ring: 'ring-rose-200',
    bg:   'bg-rose-50',
    pill: 'bg-rose-100 text-rose-700 border-rose-200',
    flag: true,
  }
  if (s <= 5) return {
    ring: 'ring-amber-200',
    bg:   'bg-amber-50',
    pill: 'bg-amber-100 text-amber-800 border-amber-200',
    flag: false,
  }
  if (s <= 7) return {
    ring: 'ring-wellness-200',
    bg:   'bg-wellness-50',
    pill: 'bg-wellness-100 text-wellness-700 border-wellness-200',
    flag: false,
  }
  return {
    ring: 'ring-brand-200',
    bg:   'bg-brand-50',
    pill: 'bg-brand-100 text-brand-700 border-brand-200',
    flag: false,
  }
}

function freshness(date) {
  const d = parseISO(date)
  const diff = differenceInDays(new Date(), d)
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Ayer'
  return `Hace ${diff} días`
}

/**
 * Card del dashboard del doctor: muestra la última entrada del diario de cada
 * uno de sus pacientes, ordenada con los scores más bajos primero (los que
 * necesitan atención).
 */
export default function DoctorMoodFeed({ className = '' }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    moodApi.doctorFeed(7)
      .then((r) => setItems(r.data))
      .catch(() => setError('No se pudo cargar el feed'))
      .finally(() => setLoading(false))
  }, [])

  const lowCount = items.filter((i) => i.score <= 3).length

  return (
    <Card className={cn('overflow-hidden', className)}>
      <div className="px-6 py-5 border-b border-ink-100 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight inline-flex items-center gap-2">
            <Sun className="w-5 h-5 text-amber-500" />
            ¿Cómo amanecieron tus pacientes?
          </h2>
          <p className="text-xs text-ink-500 mt-0.5">
            Últimos 7 días · {items.length} {items.length === 1 ? 'paciente' : 'pacientes'} con registro
            {lowCount > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-rose-600 font-semibold">
                <AlertTriangle className="w-3 h-3" /> {lowCount} con score bajo
              </span>
            )}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center"><Spinner /></div>
      ) : error ? (
        <p className="p-6 text-sm text-ink-500">{error}</p>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="Aún no hay registros recientes"
          description="Cuando tus pacientes empiecen a usar su diario emocional, los verás aquí."
        />
      ) : (
        <ul className="divide-y divide-ink-100">
          {items.map((item, idx) => {
            const cls = scoreClasses(item.score)
            const linkRole = '/doctor' // doctor accede vía la ruta de doctor
            return (
              <motion.li
                key={item.entry_id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: idx * 0.03 }}
                className={cn('px-6 py-4 flex items-start gap-4 hover:bg-ink-50/60 transition-colors', cls.bg)}
              >
                <div className="relative shrink-0">
                  <Avatar name={item.patient_name} size="md" className={cn('ring-4 ring-white shadow-soft', cls.ring)} />
                  <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white shadow-soft border border-ink-100 flex items-center justify-center text-base">
                    {EMOJI[item.score]}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="text-sm font-semibold text-ink-900 truncate">
                      {item.patient_name}
                    </div>
                    <span className={cn(
                      'text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border',
                      cls.pill,
                    )}>
                      {item.score}/10 · {SCALE_LABELS[item.score]}
                    </span>
                    {cls.flag && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 uppercase tracking-wide">
                        <AlertTriangle className="w-3 h-3" /> Atención
                      </span>
                    )}
                  </div>

                  <div className="mt-1 text-xs text-ink-500 flex items-center gap-3 flex-wrap">
                    <span>{freshness(item.date)}</span>
                    <span>·</span>
                    <span>{format(parseISO(item.date), "EEEE d 'de' MMM", { locale: es })}</span>
                    {item.next_appointment_date && (
                      <>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1 text-brand-600 font-medium">
                          <CalendarDays className="w-3 h-3" />
                          Próx. cita {format(parseISO(item.next_appointment_date), "d MMM", { locale: es })}
                        </span>
                      </>
                    )}
                  </div>

                  {item.note && (
                    <p className="text-sm text-ink-700 mt-2 leading-relaxed line-clamp-2">
                      <MessageCircle className="inline w-3.5 h-3.5 text-ink-400 mr-1 align-text-bottom" />
                      "{item.note}"
                    </p>
                  )}
                </div>

                <Link
                  to={`${linkRole}/patients/${item.patient_id}`}
                  className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800 self-center"
                >
                  Ver ficha <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </motion.li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
