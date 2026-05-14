import React, { useEffect, useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Calendar, Clock, Search, Stethoscope, Brain, X, CalendarClock,
  Star, CreditCard, AlertCircle, Video, Download, BellRing,
} from 'lucide-react'
import { appointmentsApi, reviewsApi, waitlistApi } from '../../services/api'
import { Avatar } from '../../components/ui/Avatar'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge, StatusBadge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'
import { ReviewForm } from '../../components/patient/ReviewForm'
import ExportButton from '../../components/ui/ExportButton'
import { cn } from '../../lib/cn'
import { fadeInUp, stagger, staggerItem } from '../../lib/motion'

const tabs = [
  { id: '',          label: 'Todas' },
  { id: 'scheduled', label: 'Agendadas' },
  { id: 'confirmed', label: 'Confirmadas' },
  { id: 'completed', label: 'Completadas' },
  { id: 'cancelled', label: 'Canceladas' },
]

export default function MyAppointments() {
  const navigate = useNavigate()
  const [appointments, setAppointments] = useState([])
  const [reviewedIds, setReviewedIds] = useState(new Set())
  const [waitlistEntries, setWaitlistEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [params, setParams] = useSearchParams()
  const [reviewing, setReviewing] = useState(null) // appointment object

  useEffect(() => {
    waitlistApi.mine().then((r) => setWaitlistEntries(r.data)).catch(() => {})
  }, [])

  const handleLeaveWaitlist = async (id) => {
    if (!window.confirm('¿Salir de la lista de espera?')) return
    try {
      await waitlistApi.leave(id)
      setWaitlistEntries((prev) => prev.filter((e) => e.id !== id))
      toast.success('Saliste de la lista de espera')
    } catch {
      toast.error('Error')
    }
  }

  // Mensaje al volver desde MercadoPago
  useEffect(() => {
    const status = params.get('payment')
    if (!status) return
    if (status === 'success') toast.success('Pago confirmado. Tu cita está agendada.')
    if (status === 'failure') toast.error('El pago no pudo procesarse. Intenta nuevamente.')
    if (status === 'pending') toast('Pago pendiente. Te avisaremos cuando se acredite.')
    params.delete('payment')
    params.delete('appointment')
    setParams(params, { replace: true })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const load = () => {
    setLoading(true)
    appointmentsApi.list(filter ? { status: filter } : {})
      .then(async (r) => {
        setAppointments(r.data)
        // Buscar reviews existentes para citas completadas
        const completed = r.data.filter((a) => a.status === 'completed')
        const checks = await Promise.all(
          completed.map((a) =>
            reviewsApi.forAppointment(a.id).then((rr) => (rr.data ? a.id : null)).catch(() => null),
          ),
        )
        setReviewedIds(new Set(checks.filter(Boolean)))
      })
      .finally(() => setLoading(false))
  }

  useEffect(load, [filter])

  const handleCancel = async (id) => {
    if (!window.confirm('¿Estás seguro de cancelar esta cita?')) return
    try {
      await appointmentsApi.cancel(id, { cancellation_reason: 'Cancelado por el paciente' })
      toast.success('Cita cancelada')
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al cancelar')
    }
  }

  return (
    <motion.div {...fadeInUp} className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mis citas</h1>
          <p className="text-sm text-ink-500 mt-1">Próximas, pasadas y todo tu historial.</p>
        </div>
        <ExportButton endpoint="/exports/appointments" filename="mis_citas.xlsx" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setFilter(t.id)}
            className={cn(
              'px-3.5 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap transition-all',
              filter === t.id
                ? 'bg-ink-900 text-white border-ink-900'
                : 'bg-white text-ink-600 border-ink-200 hover:border-ink-300',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 flex justify-center"><Spinner size="lg" /></div>
      ) : appointments.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No hay citas en esta categoría"
          description="Cuando reserves una cita aparecerá aquí."
          action={<Link to="/patient/search"><Button><Search className="w-4 h-4" /> Buscar profesional</Button></Link>}
        />
      ) : (
        <motion.div variants={stagger(0.04)} initial="initial" animate="animate" className="space-y-3">
          {appointments.map((a) => {
            const Icon = a.doctor.specialty.name.toLowerCase().includes('psic') ? Brain : Stethoscope
            const fullName = `${a.doctor.user.first_name} ${a.doctor.user.last_name}`
            const canReschedule = ['scheduled', 'confirmed'].includes(a.status)
            const canCancel = ['scheduled', 'confirmed'].includes(a.status)
            const canReview = a.status === 'completed' && !reviewedIds.has(a.id)
            return (
              <motion.div key={a.id} variants={staggerItem}>
                <Card hover className="p-5">
                  <div className="flex items-start gap-4 flex-wrap sm:flex-nowrap">
                    <Avatar name={fullName} size="md" />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-ink-900">Dr(a). {fullName}</span>
                        <StatusBadge status={a.status} />
                        {a.payment_status === 'pending' && (
                          <Badge tone="warning"><AlertCircle className="w-3 h-3" /> Pago pendiente</Badge>
                        )}
                        {a.payment_status === 'approved' && (
                          <Badge tone="success"><CreditCard className="w-3 h-3" /> Pagada</Badge>
                        )}
                        {a.payment_status === 'rejected' && (
                          <Badge tone="danger"><AlertCircle className="w-3 h-3" /> Pago rechazado</Badge>
                        )}
                        {a.status === 'completed' && reviewedIds.has(a.id) && (
                          <Badge tone="ink"><Star className="w-3 h-3" /> Reseñada</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-brand-600 mt-1">
                        <Icon className="w-3.5 h-3.5" /> {a.doctor.specialty.name}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-sm text-ink-600">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-ink-400" />
                          {format(parseISO(a.appointment_date), "EEEE d MMM", { locale: es })}
                        </div>
                        <div className="flex items-center gap-1.5 tabular-nums">
                          <Clock className="w-3.5 h-3.5 text-ink-400" />
                          {a.start_time.slice(0, 5)} – {a.end_time.slice(0, 5)}
                        </div>
                      </div>
                      {a.reason && (
                        <p className="text-sm text-ink-500 mt-2 line-clamp-2 italic">"{a.reason}"</p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1.5 sm:flex-col sm:items-end shrink-0">
                      {a.modality === 'online' && ['scheduled', 'confirmed'].includes(a.status) && (
                        <Link to={`/teleconsulta/${a.id}`}>
                          <Button size="sm">
                            <Video className="w-3.5 h-3.5" /> Entrar a consulta
                          </Button>
                        </Link>
                      )}
                      {canReview && (
                        <Button size="sm" onClick={() => setReviewing(a)}>
                          <Star className="w-3.5 h-3.5" /> Calificar
                        </Button>
                      )}
                      {canReschedule && (
                        <Button variant="secondary" size="sm" onClick={() => navigate(`/patient/reschedule/${a.id}`)}>
                          <CalendarClock className="w-3.5 h-3.5" /> Reagendar
                        </Button>
                      )}
                      {['scheduled', 'confirmed'].includes(a.status) && (
                        <a href={`/api/appointments/${a.id}/calendar.ics`} download>
                          <Button variant="secondary" size="sm">
                            <Download className="w-3.5 h-3.5" /> Calendario
                          </Button>
                        </a>
                      )}
                      {canCancel && (
                        <Button variant="ghost" size="sm" onClick={() => handleCancel(a.id)}>
                          <X className="w-3.5 h-3.5" /> Cancelar
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </motion.div>
      )}

      {waitlistEntries.length > 0 && (
        <div className="space-y-3 pt-6 border-t border-ink-100">
          <div className="flex items-center gap-2">
            <BellRing className="w-4 h-4 text-brand-600" />
            <h2 className="text-base font-semibold tracking-tight">Listas de espera</h2>
          </div>
          {waitlistEntries.map((w) => {
            const fullName = w.doctor ? `${w.doctor.user.first_name} ${w.doctor.user.last_name}` : ''
            return (
              <Card key={w.id} className="p-4 flex items-center gap-3">
                <Avatar name={fullName} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-ink-900">Dr(a). {fullName}</div>
                  <div className="text-xs text-ink-500 tabular-nums">
                    {format(parseISO(w.desired_from), "d MMM", { locale: es })} – {format(parseISO(w.desired_to), "d MMM yyyy", { locale: es })}
                  </div>
                </div>
                <Badge tone={w.status === 'notified' ? 'success' : w.status === 'cancelled' ? 'danger' : 'brand'}>
                  {w.status === 'pending' && 'En espera'}
                  {w.status === 'notified' && '¡Cupo libre!'}
                  {w.status === 'satisfied' && 'Reservada'}
                  {w.status === 'cancelled' && 'Cancelada'}
                </Badge>
                {w.status !== 'cancelled' && (
                  <Button variant="ghost" size="icon" onClick={() => handleLeaveWaitlist(w.id)} title="Salir">
                    <X className="w-4 h-4 text-ink-500" />
                  </Button>
                )}
              </Card>
            )
          })}
        </div>
      )}

      <ReviewForm
        open={!!reviewing}
        onClose={() => setReviewing(null)}
        appointment={reviewing}
        onSubmitted={() => {
          if (reviewing) setReviewedIds((prev) => new Set([...prev, reviewing.id]))
        }}
      />
    </motion.div>
  )
}
