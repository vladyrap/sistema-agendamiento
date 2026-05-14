import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Calendar, Clock, Search, ArrowUpRight, Heart, Sparkles, Stethoscope, Brain,
} from 'lucide-react'
import { appointmentsApi } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Avatar } from '../../components/ui/Avatar'
import { Badge, StatusBadge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'
import { fadeInUp, stagger, staggerItem } from '../../lib/motion'
import MoodCheckin from '../../components/mood/MoodCheckin'
import PatientHomeworkWidget from '../../components/homework/PatientHomeworkWidget'
import PatientQuestionnairesWidget from '../../components/questionnaires/PatientQuestionnairesWidget'
import CompanyBenefitCard from '../../components/companies/CompanyBenefitCard'
import CreditCard from '../../components/gift/CreditCard'

export default function PatientDashboard() {
  const { user } = useAuth()
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    appointmentsApi.list({ status: 'scheduled' })
      .then((r) => setAppointments(r.data.slice(0, 5)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const next = appointments[0]
  const total = appointments.length

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Buen día'
    if (h < 19) return 'Buenas tardes'
    return 'Buenas noches'
  })()

  return (
    <div className="space-y-8">
      {/* Hero */}
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
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tightest leading-tight text-balance">
                {greeting}, {user?.first_name}.
              </h1>
              <p className="text-white/70 mt-2 text-pretty">
                Aquí tienes un vistazo de tus citas y todo lo que tienes por delante.
              </p>
              <div className="flex flex-wrap gap-2 mt-6">
                <Link to="/patient/search">
                  <Button variant="dark" className="bg-white text-ink-900 hover:bg-ink-50">
                    <Search className="w-4 h-4" /> Buscar profesional
                  </Button>
                </Link>
                <Link to="/patient/appointments">
                  <Button variant="ghost" className="text-white hover:bg-white/10">
                    Ver mis citas <ArrowUpRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </div>

            {next && (
              <div className="rounded-2xl bg-white/10 backdrop-blur border border-white/15 p-5">
                <div className="text-[11px] uppercase tracking-wider text-white/60 font-semibold mb-3">
                  Próxima cita
                </div>
                <div className="flex items-center gap-3">
                  <Avatar name={`${next.doctor.user.first_name} ${next.doctor.user.last_name}`} size="md" />
                  <div>
                    <div className="text-sm font-semibold">
                      Ps. {next.doctor.user.first_name} {next.doctor.user.last_name}
                    </div>
                    <div className="text-xs text-white/70">{next.doctor.specialty.name}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-4 text-sm">
                  <div className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> {format(parseISO(next.appointment_date), 'dd MMM', { locale: es })}</div>
                  <div className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {next.start_time.slice(0,5)}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Beneficio corporativo (si tiene) */}
      <motion.div {...fadeInUp}>
        <CompanyBenefitCard />
      </motion.div>

      {/* Crédito de gift cards */}
      <motion.div {...fadeInUp}>
        <CreditCard />
      </motion.div>

      {/* Diario emocional — check-in del día */}
      <motion.div {...fadeInUp}>
        <MoodCheckin />
      </motion.div>

      {/* Cuestionarios psicológicos pendientes */}
      <motion.div {...fadeInUp}>
        <PatientQuestionnairesWidget />
      </motion.div>

      {/* Tareas entre sesiones */}
      <motion.div {...fadeInUp}>
        <PatientHomeworkWidget />
      </motion.div>

      {/* Stats */}
      <motion.div variants={stagger()} initial="initial" animate="animate" className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: 'Próximas citas', value: total, icon: Calendar, hue: 'brand' },
          { label: 'Profesionales atendidos', value: '—', icon: Stethoscope, hue: 'wellness' },
          { label: 'Consultas online', value: '—', icon: Heart, hue: 'amber' },
        ].map((s) => (
          <motion.div key={s.label} variants={staggerItem}>
            <Card className="p-5">
              <div className="flex items-start justify-between">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  s.hue === 'brand' ? 'bg-brand-50 text-brand-600' :
                  s.hue === 'wellness' ? 'bg-wellness-50 text-wellness-600' :
                  'bg-amber-50 text-amber-600'
                }`}>
                  <s.icon className="w-5 h-5" strokeWidth={2} />
                </div>
              </div>
              <div className="mt-4">
                <div className="text-2xl font-bold tracking-tight tabular-nums">{s.value}</div>
                <div className="text-xs text-ink-500 mt-1">{s.label}</div>
              </div>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Próximas citas */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold tracking-tight">Próximas citas</h2>
          <Link to="/patient/appointments" className="text-sm text-brand-600 font-medium hover:text-brand-700">
            Ver todas →
          </Link>
        </div>

        <Card>
          {loading ? (
            <div className="py-10 flex justify-center"><Spinner /></div>
          ) : appointments.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="Aún no tienes citas agendadas"
              description="Busca un profesional y reserva tu primera cita en menos de un minuto."
              action={<Link to="/patient/search"><Button><Search className="w-4 h-4" /> Buscar profesional</Button></Link>}
            />
          ) : (
            <ul className="divide-y divide-ink-100">
              {appointments.map((a) => {
                const Icon = a.doctor.specialty.name.toLowerCase().includes('psic') ? Brain : Stethoscope
                return (
                  <li key={a.id} className="p-5 flex items-center gap-4 hover:bg-ink-50/60 transition-colors first:rounded-t-2xl last:rounded-b-2xl">
                    <Avatar name={`${a.doctor.user.first_name} ${a.doctor.user.last_name}`} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="font-semibold text-ink-900 text-sm truncate">
                          Ps. {a.doctor.user.first_name} {a.doctor.user.last_name}
                        </div>
                        <StatusBadge status={a.status} />
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 text-xs text-brand-600 font-medium">
                        <Icon className="w-3.5 h-3.5" /> {a.doctor.specialty.name}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-semibold text-ink-900 tabular-nums">
                        {format(parseISO(a.appointment_date), "d MMM", { locale: es })}
                      </div>
                      <div className="text-xs text-ink-500 tabular-nums">{a.start_time.slice(0,5)}</div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
