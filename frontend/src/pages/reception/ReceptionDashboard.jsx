import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  CalendarDays, CalendarPlus, Users, Sparkles, Clock, Stethoscope, Brain,
  ArrowUpRight,
} from 'lucide-react'
import { appointmentsApi } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Avatar } from '../../components/ui/Avatar'
import { StatusBadge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'
import { fadeInUp, stagger, staggerItem } from '../../lib/motion'

export default function ReceptionDashboard() {
  const { user } = useAuth()
  const [today, setToday] = useState([])
  const [pending, setPending] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    appointmentsApi.list()
      .then((r) => {
        const todayStr = format(new Date(), 'yyyy-MM-dd')
        setToday(r.data.filter((a) => a.appointment_date === todayStr))
        setPending(r.data.filter((a) => a.status === 'scheduled').length)
      })
      .finally(() => setLoading(false))
  }, [])

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Buen día'
    if (h < 19) return 'Buenas tardes'
    return 'Buenas noches'
  })()

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
            <p className="text-white/70 mt-2">Mostrador y agenda del día.</p>
            <div className="flex flex-wrap gap-2 mt-6">
              <Link to="/reception/book">
                <Button variant="dark" className="bg-white text-ink-900 hover:bg-ink-50">
                  <CalendarPlus className="w-4 h-4" /> Reservar para paciente
                </Button>
              </Link>
              <Link to="/reception/patients">
                <Button variant="ghost" className="text-white hover:bg-white/10">
                  <Users className="w-4 h-4" /> Pacientes <ArrowUpRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div variants={stagger()} initial="initial" animate="animate" className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: 'Citas hoy',         value: today.length,    icon: CalendarDays, hue: 'brand' },
          { label: 'Por confirmar',     value: pending,         icon: Clock,        hue: 'amber' },
          { label: 'Confirmadas hoy',   value: today.filter((a) => a.status === 'confirmed').length, icon: CalendarDays, hue: 'wellness' },
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

      <div>
        <h2 className="text-lg font-semibold tracking-tight mb-4">
          Citas de hoy
        </h2>
        <Card>
          {loading ? (
            <div className="py-10 flex justify-center"><Spinner /></div>
          ) : today.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="Sin citas para hoy"
              description="Cuando lleguen reservas, aparecerán acá ordenadas por hora."
            />
          ) : (
            <ul className="divide-y divide-ink-100">
              {today.map((a) => {
                const Icon = a.doctor.specialty.name.toLowerCase().includes('psic') ? Brain : Stethoscope
                return (
                  <li key={a.id} className="p-5 flex items-center gap-4 hover:bg-ink-50/60 transition-colors first:rounded-t-2xl last:rounded-b-2xl">
                    <Avatar name={`${a.patient.first_name} ${a.patient.last_name}`} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-ink-900 truncate">{a.patient.first_name} {a.patient.last_name}</span>
                        <StatusBadge status={a.status} />
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-brand-600 mt-1">
                        <Icon className="w-3.5 h-3.5" /> Dr(a). {a.doctor.user.first_name} {a.doctor.user.last_name} · {a.doctor.specialty.name}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-semibold text-ink-900 tabular-nums">{a.start_time.slice(0, 5)}</div>
                      <div className="text-xs text-ink-500">– {a.end_time.slice(0, 5)}</div>
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
