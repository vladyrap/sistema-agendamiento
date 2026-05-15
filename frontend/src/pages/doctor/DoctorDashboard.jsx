import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  CalendarDays, Clock, CheckCircle2, Users, Sparkles, Stethoscope, Brain,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Receipt, ArrowRight } from 'lucide-react'
import { appointmentsApi, boletasApi } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { Card } from '../../components/ui/Card'
import { Avatar } from '../../components/ui/Avatar'
import { StatusBadge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'
import { fadeInUp, stagger, staggerItem } from '../../lib/motion'
import DoctorMoodFeed from '../../components/mood/DoctorMoodFeed'
import DoctorHomeworkFeed from '../../components/homework/DoctorHomeworkFeed'
import PatientBriefing from '../../components/clinical/PatientBriefing'

export default function DoctorDashboard() {
  const { user } = useAuth()
  const [today, setToday] = useState([])
  const [pending, setPending] = useState(0)
  const [loading, setLoading] = useState(true)
  const [boletasPending, setBoletasPending] = useState({ count: 0, amount: 0 })

  useEffect(() => {
    appointmentsApi.list()
      .then((r) => {
        const todayStr = format(new Date(), 'yyyy-MM-dd')
        const todays = r.data.filter((a) => a.appointment_date === todayStr)
        setToday(todays)
        setPending(r.data.filter((a) => a.status === 'scheduled').length)
      })
      .finally(() => setLoading(false))
    boletasApi.pendingSummary()
      .then((r) => setBoletasPending({ count: r.data.pending_count || 0, amount: r.data.pending_amount_clp || 0 }))
      .catch(() => {})
  }, [])

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Buen día'
    if (h < 19) return 'Buenas tardes'
    return 'Buenas noches'
  })()

  const next = today.find((a) => ['scheduled', 'confirmed'].includes(a.status))
  const completedToday = today.filter((a) => a.status === 'completed').length

  return (
    <div className="space-y-8">
      <motion.div {...fadeInUp}>
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-800 to-ink-900 p-8 sm:p-10 text-white">
          <div className="absolute -top-24 -right-12 w-72 h-72 rounded-full bg-brand-400/30 blur-3xl" />
          <div className="absolute -bottom-20 -left-10 w-72 h-72 rounded-full bg-wellness-400/20 blur-3xl" />
          <div className="absolute inset-0 bg-grid-dark opacity-40" />

          <div className="relative grid md:grid-cols-2 gap-6 items-end">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs text-white/70 mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tightest leading-tight">
                {greeting}, Ps. {user?.first_name}.
              </h1>
              <p className="text-white/70 mt-2">
                {today.length === 0
                  ? 'Hoy no tienes citas programadas. Disfruta de un día más tranquilo.'
                  : `Tienes ${today.length} ${today.length === 1 ? 'cita' : 'citas'} para hoy.`}
              </p>
            </div>

            {next && (
              <div className="rounded-2xl bg-white/10 backdrop-blur border border-white/15 p-5">
                <div className="text-[11px] uppercase tracking-wider text-white/60 font-semibold mb-3">
                  Siguiente paciente
                </div>
                <div className="flex items-center gap-3">
                  <Avatar name={`${next.patient.first_name} ${next.patient.last_name}`} size="md" />
                  <div>
                    <div className="text-sm font-semibold">{next.patient.first_name} {next.patient.last_name}</div>
                    <div className="text-xs text-white/70">{next.reason || 'Sin motivo especificado'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 mt-4 text-sm">
                  <Clock className="w-4 h-4" /> {next.start_time.slice(0, 5)}
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      <motion.div variants={stagger()} initial="initial" animate="animate" className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: 'Citas hoy',         value: today.length,     icon: CalendarDays, hue: 'brand' },
          { label: 'Por confirmar',     value: pending,          icon: Clock,        hue: 'amber' },
          { label: 'Completadas hoy',   value: completedToday,   icon: CheckCircle2, hue: 'wellness' },
        ].map((s) => (
          <motion.div key={s.label} variants={staggerItem}>
            <Card className="p-5">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                s.hue === 'brand'    ? 'bg-brand-50 text-brand-600' :
                s.hue === 'wellness' ? 'bg-wellness-50 text-wellness-600' :
                                       'bg-amber-50 text-amber-600'
              }`}>
                <s.icon className="w-5 h-5" strokeWidth={2} />
              </div>
              <div className="mt-4">
                <div className="text-2xl font-bold tracking-tight tabular-nums">{s.value}</div>
                <div className="text-xs text-ink-500 mt-1">{s.label}</div>
              </div>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {next && (
        <motion.div {...fadeInUp}>
          <PatientBriefing appointmentId={next.id} defaultOpen={false} compact />
        </motion.div>
      )}

      {boletasPending.count > 0 && (
        <motion.div {...fadeInUp}>
          <Link
            to="/doctor/boletas"
            className="group block rounded-2xl border border-amber-200 bg-amber-50/60 p-5 hover:bg-amber-50 hover:border-amber-300 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-100 text-amber-700 shrink-0">
                <Receipt className="w-5 h-5" strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-ink-900">
                  Tienes {boletasPending.count} {boletasPending.count === 1 ? 'boleta pendiente' : 'boletas pendientes'} de emitir en el SII
                </div>
                <div className="text-xs text-ink-600 mt-0.5">
                  Total: ${(boletasPending.amount || 0).toLocaleString('es-CL')} CLP
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-amber-700 group-hover:translate-x-0.5 transition-transform shrink-0" />
            </div>
          </Link>
        </motion.div>
      )}

      {/* Feed de "amanecidas" — diarios emocionales recientes de tus pacientes */}
      <motion.div {...fadeInUp}>
        <DoctorMoodFeed />
      </motion.div>

      {/* Tareas asignadas a tus pacientes */}
      <motion.div {...fadeInUp}>
        <DoctorHomeworkFeed />
      </motion.div>

      <div>
        <h2 className="text-lg font-semibold tracking-tight mb-4">
          Citas de hoy — {format(new Date(), "EEEE d MMMM", { locale: es })}
        </h2>
        <Card>
          {loading ? (
            <div className="py-10 flex justify-center"><Spinner /></div>
          ) : today.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="Sin citas para hoy"
              description="Aprovecha el día. Las próximas citas aparecerán aquí en cuanto se agenden."
            />
          ) : (
            <ul className="divide-y divide-ink-100">
              {today.map((a) => (
                <li key={a.id} className="p-5 flex items-center gap-4 hover:bg-ink-50/60 transition-colors first:rounded-t-2xl last:rounded-b-2xl">
                  <Avatar name={`${a.patient.first_name} ${a.patient.last_name}`} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-ink-900 truncate">{a.patient.first_name} {a.patient.last_name}</span>
                      <StatusBadge status={a.status} />
                    </div>
                    {a.reason && <div className="text-sm text-ink-500 mt-0.5 truncate">"{a.reason}"</div>}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold text-ink-900 tabular-nums">{a.start_time.slice(0, 5)}</div>
                    <div className="text-xs text-ink-500">– {a.end_time.slice(0, 5)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
