import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { addDays, format, isSameDay, parseISO, startOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  ChevronLeft, ChevronRight, ArrowLeft, Calendar, Clock, CheckCircle2,
  Stethoscope, Brain, AlertTriangle,
} from 'lucide-react'
import { appointmentsApi, doctorsApi } from '../../services/api'
import { Avatar } from '../../components/ui/Avatar'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { cn } from '../../lib/cn'
import { fadeInUp } from '../../lib/motion'

export default function Reschedule() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [appointment, setAppointment] = useState(null)
  const [weekStart, setWeekStart] = useState(() => startOfWeek(addDays(new Date(), 1), { weekStartsOn: 1 }))
  const [selectedDate, setSelectedDate] = useState(addDays(new Date(), 1))
  const [slots, setSlots] = useState([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    appointmentsApi.get(id).then((r) => setAppointment(r.data))
  }, [id])

  useEffect(() => {
    if (!appointment) return
    setSlotsLoading(true)
    setSelectedSlot(null)
    doctorsApi.getAvailableSlots(appointment.doctor_id, format(selectedDate, 'yyyy-MM-dd'))
      .then((r) => setSlots(r.data.slots))
      .finally(() => setSlotsLoading(false))
  }, [appointment, selectedDate])

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  )

  const handleSubmit = async () => {
    if (!selectedSlot) return
    setSubmitting(true)
    try {
      await appointmentsApi.reschedule(id, {
        appointment_date: format(selectedDate, 'yyyy-MM-dd'),
        start_time: selectedSlot.start_time + ':00',
      })
      toast.success('Cita reagendada exitosamente')
      navigate('/patient/appointments')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al reagendar')
    } finally {
      setSubmitting(false)
    }
  }

  if (!appointment) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>

  const fullName = `${appointment.doctor.user.first_name} ${appointment.doctor.user.last_name}`
  const SpecialtyIcon = appointment.doctor.specialty.name.toLowerCase().includes('psic') ? Brain : Stethoscope

  return (
    <motion.div {...fadeInUp} className="space-y-6">
      <Link to="/patient/appointments" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900 font-medium">
        <ArrowLeft className="w-4 h-4" /> Volver a mis citas
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reagendar cita</h1>
        <p className="text-sm text-ink-500 mt-1">Elige una nueva fecha y hora.</p>
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-5">
          {/* Doctor + cita actual */}
          <Card className="p-5">
            <div className="flex items-center gap-4">
              <Avatar name={fullName} size="lg" />
              <div className="flex-1">
                <div className="font-semibold text-ink-900">Dr(a). {fullName}</div>
                <div className="flex items-center gap-1.5 text-sm text-brand-600 mt-0.5">
                  <SpecialtyIcon className="w-3.5 h-3.5" /> {appointment.doctor.specialty.name}
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2 mt-4 p-3 rounded-xl bg-amber-50 border border-amber-100">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800">
                <div className="font-semibold">Cita actual</div>
                <div>{format(parseISO(appointment.appointment_date), "EEEE d 'de' MMM", { locale: es })} · {appointment.start_time.slice(0, 5)}</div>
              </div>
            </div>
          </Card>

          {/* Calendar */}
          <Card className="p-5 sm:p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-semibold tracking-tight">Nueva fecha</h2>
                <p className="text-xs text-ink-500 mt-0.5">
                  {format(weekStart, "MMMM yyyy", { locale: es }).replace(/^\w/, (c) => c.toUpperCase())}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setWeekStart(addDays(weekStart, -7))}
                  disabled={isSameDay(weekStart, startOfWeek(new Date(), { weekStartsOn: 1 }))}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setWeekStart(addDays(weekStart, 7))}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-2">
              {days.map((day) => {
                const isPast = day < new Date().setHours(0, 0, 0, 0)
                const isSelected = isSameDay(day, selectedDate)
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    disabled={isPast}
                    onClick={() => setSelectedDate(day)}
                    className={cn(
                      'flex flex-col items-center justify-center py-3 rounded-2xl border transition-all',
                      isPast && 'opacity-30 cursor-not-allowed',
                      !isPast && !isSelected && 'border-ink-100 hover:border-brand-200 hover:bg-brand-50/50',
                      isSelected && 'border-brand-600 bg-brand-600 text-white shadow-brand-sm',
                    )}
                  >
                    <span className={cn('text-[10px] uppercase font-semibold tracking-wider',
                      isSelected ? 'text-white/80' : 'text-ink-400')}>
                      {format(day, 'EEE', { locale: es })}
                    </span>
                    <span className={cn('text-lg font-bold mt-0.5 tabular-nums',
                      isSelected ? 'text-white' : 'text-ink-900')}>
                      {format(day, 'd')}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="mt-7">
              <h3 className="text-sm font-semibold text-ink-900 mb-3">
                Horarios — {format(selectedDate, "EEEE d 'de' MMM", { locale: es })}
              </h3>
              {slotsLoading ? (
                <div className="py-10 flex justify-center"><Spinner /></div>
              ) : slots.length === 0 ? (
                <div className="py-8 text-center"><p className="text-sm text-ink-500">El profesional no atiende este día.</p></div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-6 gap-2">
                  {slots.map((slot) => {
                    const isSelected = selectedSlot?.start_time === slot.start_time
                    return (
                      <button
                        key={slot.start_time}
                        type="button"
                        disabled={!slot.available}
                        onClick={() => setSelectedSlot(slot)}
                        className={cn(
                          'h-11 rounded-xl border text-sm font-semibold tabular-nums transition-all',
                          !slot.available && 'bg-ink-50 text-ink-300 border-ink-100 cursor-not-allowed line-through',
                          slot.available && !isSelected && 'bg-white border-ink-200 text-ink-700 hover:border-brand-500 hover:text-brand-700 hover:bg-brand-50',
                          isSelected && 'bg-brand-600 border-brand-600 text-white shadow-brand-sm',
                        )}
                      >
                        {slot.start_time}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Summary sticky */}
        <div>
          <div className="lg:sticky lg:top-24">
            <Card className="p-6">
              <div className="text-[10px] uppercase tracking-wider text-ink-400 font-semibold mb-3">Nueva cita</div>

              <div className="space-y-3 pb-5 border-b border-ink-100 text-sm">
                <Row label="Profesional" value={`Dr(a). ${fullName}`} />
                <Row
                  label="Fecha"
                  value={format(selectedDate, "d MMM yyyy", { locale: es })}
                  icon={Calendar}
                />
                <Row
                  label="Hora"
                  value={selectedSlot ? selectedSlot.start_time : '—'}
                  icon={Clock}
                  highlight={!!selectedSlot}
                />
              </div>

              <Button
                size="lg"
                className="w-full mt-5"
                onClick={handleSubmit}
                disabled={!selectedSlot || submitting}
              >
                {submitting ? 'Reagendando...' : <>Confirmar cambio <CheckCircle2 className="w-4 h-4" /></>}
              </Button>

              <p className="text-[11px] text-center text-ink-400 mt-3">
                La nueva cita queda en estado "agendada" hasta confirmación.
              </p>
            </Card>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function Row({ label, value, icon: Icon, highlight }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-500">{label}</span>
      <span className={cn('font-semibold flex items-center gap-1.5',
        highlight ? 'text-brand-700' : 'text-ink-900')}>
        {Icon && <Icon className="w-3.5 h-3.5 text-ink-400" />}
        {value}
      </span>
    </div>
  )
}
