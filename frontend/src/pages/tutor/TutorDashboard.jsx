import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Heart, Users, AlertTriangle, ChevronRight, ClipboardList, Calendar, Shield, Sparkles,
} from 'lucide-react'
import { tutorsApi } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { Card } from '../../components/ui/Card'
import { Avatar } from '../../components/ui/Avatar'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { fadeInUp } from '../../lib/motion'
import { cn } from '../../lib/cn'

const EMOJI = {
  1: '😢', 2: '😞', 3: '😕', 4: '😐', 5: '🙂',
  6: '🙂', 7: '😊', 8: '😄', 9: '🤩', 10: '🌟',
}

function moodTone(s) {
  if (s == null) return 'bg-ink-100 text-ink-600'
  if (s <= 3) return 'bg-rose-100 text-rose-700'
  if (s <= 5) return 'bg-amber-100 text-amber-700'
  if (s <= 7) return 'bg-wellness-100 text-wellness-700'
  return 'bg-brand-100 text-brand-700'
}

export default function TutorDashboard() {
  const { user } = useAuth()
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    tutorsApi.myPatients()
      .then((r) => setPatients(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Buen día'
    if (h < 19) return 'Buenas tardes'
    return 'Buenas noches'
  })()

  const crisisCount = patients.filter((p) => p.mood_score_latest !== null && p.mood_score_latest <= 3).length

  return (
    <div className="space-y-8">
      <motion.div {...fadeInUp}>
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-800 to-ink-900 p-8 sm:p-10 text-white">
          <div className="absolute -top-24 -right-12 w-72 h-72 rounded-full bg-brand-400/30 blur-3xl" />
          <div className="absolute -bottom-20 -left-10 w-72 h-72 rounded-full bg-wellness-400/20 blur-3xl" />
          <div className="absolute inset-0 bg-grid-dark opacity-40" />

          <div className="relative">
            <div className="inline-flex items-center gap-1.5 text-xs text-white/70 mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tightest leading-tight">
              {greeting}, {user?.first_name}.
            </h1>
            <p className="text-white/70 mt-2 max-w-xl text-pretty">
              {patients.length === 0
                ? 'Todavía no estás vinculado a ningún paciente.'
                : `Estás cuidando de ${patients.length} ${patients.length === 1 ? 'persona' : 'personas'}.`}
              {crisisCount > 0 && (
                <span className="block mt-1 text-rose-200 font-medium">
                  ⚠ {crisisCount} {crisisCount === 1 ? 'requiere' : 'requieren'} tu atención.
                </span>
              )}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Lista de pacientes */}
      {loading ? (
        <div className="py-16 flex justify-center"><Spinner size="lg" /></div>
      ) : patients.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title="Sin pacientes vinculados todavía"
            description="Cuando un paciente (o tu hijo/a) te designe como tutor en miespejo.cl con tu email, vas a aparecer acá."
          />
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {patients.map((p, idx) => {
            const inCrisis = p.mood_score_latest !== null && p.mood_score_latest <= 3
            return (
              <motion.div
                key={p.patient_id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: idx * 0.05 }}
              >
                <Link to={`/tutor/patients/${p.patient_id}`} className="block group">
                  <Card className={cn(
                    'p-5 h-full transition-all',
                    inCrisis ? 'border-rose-200 hover:border-rose-300' : 'group-hover:border-brand-200',
                  )}>
                    <div className="flex items-start gap-3">
                      <Avatar name={p.patient_name} size="lg" className={cn(
                        'ring-4',
                        inCrisis ? 'ring-rose-100' : 'ring-brand-50',
                      )} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-ink-900 truncate">{p.patient_name}</div>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-ink-100 text-ink-700 border border-ink-200">
                            {p.relationship_label}
                          </span>
                          {p.is_legal_guardian && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                              <Shield className="w-2.5 h-2.5" /> Legal
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-ink-400 group-hover:text-brand-600 transition-colors" />
                    </div>

                    {/* Estado actual */}
                    <div className="grid grid-cols-3 gap-2 mt-4">
                      {/* Mood */}
                      <div className={cn('rounded-xl border p-2.5 text-center', inCrisis ? 'border-rose-200 bg-rose-50' : 'border-ink-100 bg-ink-50/50')}>
                        <div className="text-xs text-ink-500 mb-1 flex items-center justify-center gap-1">
                          <Heart className="w-3 h-3" /> Ánimo
                        </div>
                        {p.mood_score_latest != null ? (
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-lg leading-none">{EMOJI[p.mood_score_latest]}</span>
                            <span className={cn('text-xs font-bold tabular-nums', inCrisis ? 'text-rose-700' : 'text-ink-700')}>
                              {p.mood_score_latest}/10
                            </span>
                          </div>
                        ) : (
                          <div className="text-xs text-ink-400">—</div>
                        )}
                      </div>

                      {/* Tareas */}
                      <div className="rounded-xl border border-ink-100 bg-ink-50/50 p-2.5 text-center">
                        <div className="text-xs text-ink-500 mb-1 flex items-center justify-center gap-1">
                          <ClipboardList className="w-3 h-3" /> Tareas
                        </div>
                        <div className="text-sm font-bold tabular-nums text-ink-700">
                          {p.pending_homework}
                        </div>
                      </div>

                      {/* Próxima cita */}
                      <div className="rounded-xl border border-ink-100 bg-ink-50/50 p-2.5 text-center">
                        <div className="text-xs text-ink-500 mb-1 flex items-center justify-center gap-1">
                          <Calendar className="w-3 h-3" /> Próx.
                        </div>
                        {p.next_appointment_date ? (
                          <div className="text-xs font-bold text-ink-700">
                            {format(parseISO(p.next_appointment_date), 'd MMM', { locale: es })}
                          </div>
                        ) : (
                          <div className="text-xs text-ink-400">—</div>
                        )}
                      </div>
                    </div>

                    {inCrisis && (
                      <div className="mt-3 rounded-xl bg-rose-50 border border-rose-200 p-2.5 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        <p className="text-xs text-rose-800 leading-tight">
                          Registró un estado emocional bajo. Considera contactarlo.
                        </p>
                      </div>
                    )}
                  </Card>
                </Link>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
