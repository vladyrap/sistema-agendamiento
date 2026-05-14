import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Calendar, Clock, Search, Stethoscope, Brain, X, CalendarClock, CheckCircle2,
} from 'lucide-react'
import { appointmentsApi } from '../../services/api'
import { Avatar } from '../../components/ui/Avatar'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { StatusBadge } from '../../components/ui/Badge'
import { Input } from '../../components/ui/Input'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'
import { cn } from '../../lib/cn'
import { fadeInUp, stagger, staggerItem } from '../../lib/motion'

const tabs = [
  { id: '',          label: 'Todas' },
  { id: 'scheduled', label: 'Por confirmar' },
  { id: 'confirmed', label: 'Confirmadas' },
  { id: 'completed', label: 'Completadas' },
  { id: 'cancelled', label: 'Canceladas' },
]

export default function ReceptionAppointments() {
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [query, setQuery] = useState('')

  const load = () => {
    setLoading(true)
    appointmentsApi.list(filter ? { status: filter } : {})
      .then((r) => setAppointments(r.data))
      .finally(() => setLoading(false))
  }

  useEffect(load, [filter])

  const handleConfirm = async (id) => {
    try {
      await appointmentsApi.confirm(id)
      toast.success('Cita confirmada')
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error')
    }
  }

  const handleCancel = async (id) => {
    if (!window.confirm('¿Cancelar esta cita?')) return
    try {
      await appointmentsApi.cancel(id, { cancellation_reason: 'Cancelado desde recepción' })
      toast.success('Cita cancelada')
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error')
    }
  }

  const filtered = appointments.filter((a) =>
    !query.trim() ||
    `${a.patient.first_name} ${a.patient.last_name} ${a.doctor.user.first_name} ${a.doctor.user.last_name}`
      .toLowerCase().includes(query.toLowerCase()),
  )

  return (
    <motion.div {...fadeInUp} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Citas</h1>
        <p className="text-sm text-ink-500 mt-1">Gestión completa de la agenda de la clínica.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input placeholder="Buscar por paciente o psicólogo/a..." leftIcon={Search} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setFilter(t.id)}
              className={cn(
                'px-3.5 h-11 rounded-xl text-xs font-semibold border whitespace-nowrap transition-all',
                filter === t.id ? 'bg-ink-900 text-white border-ink-900'
                                : 'bg-white text-ink-600 border-ink-200 hover:border-ink-300',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-16 flex justify-center"><Spinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Calendar} title="No hay citas" />
      ) : (
        <motion.div variants={stagger(0.04)} initial="initial" animate="animate" className="space-y-3">
          {filtered.map((a) => {
            const Icon = a.doctor.specialty.name.toLowerCase().includes('psic') ? Brain : Stethoscope
            const canConfirm = a.status === 'scheduled'
            const canCancel = ['scheduled', 'confirmed'].includes(a.status)
            return (
              <motion.div key={a.id} variants={staggerItem}>
                <Card hover className="p-5">
                  <div className="flex items-start gap-4 flex-wrap sm:flex-nowrap">
                    <Avatar name={`${a.patient.first_name} ${a.patient.last_name}`} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-ink-900">{a.patient.first_name} {a.patient.last_name}</span>
                        <StatusBadge status={a.status} />
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-brand-600 mt-1">
                        <Icon className="w-3.5 h-3.5" /> Ps. {a.doctor.user.first_name} {a.doctor.user.last_name} · {a.doctor.specialty.name}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-ink-600">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-ink-400" />
                          {format(parseISO(a.appointment_date), "EEEE d MMM", { locale: es })}
                        </div>
                        <div className="flex items-center gap-1.5 tabular-nums">
                          <Clock className="w-3.5 h-3.5 text-ink-400" />
                          {a.start_time.slice(0, 5)} – {a.end_time.slice(0, 5)}
                        </div>
                      </div>
                      {a.reason && <p className="text-sm text-ink-500 mt-2 line-clamp-2 italic">"{a.reason}"</p>}
                    </div>

                    {(canConfirm || canCancel) && (
                      <div className="flex flex-wrap gap-1.5 sm:flex-col sm:items-end shrink-0">
                        {canConfirm && (
                          <Button variant="success" size="sm" onClick={() => handleConfirm(a.id)}>
                            <CheckCircle2 className="w-3.5 h-3.5" /> Confirmar
                          </Button>
                        )}
                        {canCancel && (
                          <Button variant="danger" size="sm" onClick={() => handleCancel(a.id)}>
                            <X className="w-3.5 h-3.5" /> Cancelar
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </motion.div>
      )}
    </motion.div>
  )
}
