import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  ChevronLeft, ChevronRight, ArrowLeft, Calendar, Clock, Video, MapPin,
  CheckCircle2, Stethoscope, Brain, Sparkles, Building2,
} from 'lucide-react'
import { addDays, format, isSameDay, parseISO, startOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'
import { doctorsApi, appointmentsApi, companiesApi } from '../../services/api'
import { Avatar } from '../../components/ui/Avatar'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Textarea, Label } from '../../components/ui/Input'
import { Spinner } from '../../components/ui/Spinner'
import { cn } from '../../lib/cn'
import { fadeInUp } from '../../lib/motion'
import { formatCLP } from '../../lib/format'

const todayPlus = (n) => addDays(new Date(), n)

export default function BookAppointment() {
  const { doctorId } = useParams()
  const navigate = useNavigate()
  const [doctor, setDoctor] = useState(null)
  const [benefit, setBenefit] = useState(null) // beneficio empresa si aplica

  // Week navigation
  const [weekStart, setWeekStart] = useState(() => startOfWeek(todayPlus(0), { weekStartsOn: 1 }))
  const [selectedDate, setSelectedDate] = useState(todayPlus(1))

  // Slots
  const [slots, setSlots] = useState([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState(null)

  // Booking
  const [reason, setReason] = useState('')
  const [modality, setModality] = useState('in_person')
  const [repeatWeeks, setRepeatWeeks] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    doctorsApi.get(doctorId).then((r) => setDoctor(r.data))
    companiesApi.myBenefit().then((r) => setBenefit(r.data)).catch(() => {})
  }, [doctorId])

  // ¿La cita se cubrirá con beneficio empresa?
  const isCoveredByCompany = (() => {
    if (!benefit?.has_benefit) return false
    if ((benefit.sessions_pool_total ?? 0) <= 0) return false
    if (benefit.monthly_cap !== null && benefit.sessions_used_this_month >= benefit.monthly_cap) return false
    return true
  })()

  useEffect(() => {
    setSlotsLoading(true)
    setSelectedSlot(null)
    const dateStr = format(selectedDate, 'yyyy-MM-dd')
    doctorsApi.getAvailableSlots(doctorId, dateStr)
      .then((r) => setSlots(r.data.slots))
      .finally(() => setSlotsLoading(false))
  }, [doctorId, selectedDate])

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  )

  const handleBook = async () => {
    if (!selectedSlot) return
    setSubmitting(true)
    try {
      const { data } = await appointmentsApi.create({
        doctor_id: parseInt(doctorId),
        appointment_date: format(selectedDate, 'yyyy-MM-dd'),
        start_time: selectedSlot.start_time + ':00',
        reason,
        modality,
        repeat_weeks: repeatWeeks,
      })
      // Si la cita requiere pago, redirigimos a MercadoPago.
      if (data.checkout_url) {
        toast.success('Cita reservada. Redirigiendo al pago...')
        window.location.href = data.checkout_url
        return
      }
      toast.success('¡Cita agendada exitosamente!')
      navigate('/patient/appointments')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al agendar la cita')
    } finally {
      setSubmitting(false)
    }
  }

  if (!doctor) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>

  const fullName = `${doctor.user.first_name} ${doctor.user.last_name}`
  const SpecialtyIcon = doctor.specialty.name.toLowerCase().includes('psic') ? Brain : Stethoscope

  return (
    <motion.div {...fadeInUp} className="space-y-6">
      <Link to={`/patient/doctors/${doctorId}`} className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900 font-medium">
        <ArrowLeft className="w-4 h-4" /> Volver al perfil
      </Link>

      <div className="grid lg:grid-cols-[1fr_380px] gap-6">
        {/* Left: calendar + slots */}
        <div className="space-y-5">
          {/* Doctor mini-card */}
          <Card className="p-5 flex items-center gap-4">
            <Avatar name={fullName} src={doctor?.user?.photo_url} size="lg" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-ink-900">Ps. {fullName}</div>
              <div className="flex items-center gap-1.5 text-sm text-brand-600 mt-0.5">
                <SpecialtyIcon className="w-3.5 h-3.5" /> {doctor.specialty.name}
              </div>
            </div>
            <Badge tone="success" dot>Disponible</Badge>
          </Card>

          {/* Calendar */}
          <Card className="p-5 sm:p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-semibold tracking-tight">Elige una fecha</h2>
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
                      'group relative flex flex-col items-center justify-center py-3 rounded-2xl border transition-all',
                      isPast && 'opacity-30 cursor-not-allowed',
                      !isPast && !isSelected && 'border-ink-100 hover:border-brand-200 hover:bg-brand-50/50',
                      isSelected && 'border-brand-600 bg-brand-600 text-white shadow-brand-sm',
                    )}
                  >
                    <span className={cn(
                      'text-[10px] uppercase font-semibold tracking-wider',
                      isSelected ? 'text-white/80' : 'text-ink-400',
                    )}>
                      {format(day, 'EEE', { locale: es })}
                    </span>
                    <span className={cn(
                      'text-lg font-bold mt-0.5 tabular-nums',
                      isSelected ? 'text-white' : 'text-ink-900',
                    )}>
                      {format(day, 'd')}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Slots */}
            <div className="mt-7">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-ink-900">
                  Horarios para {format(selectedDate, "EEEE d 'de' MMM", { locale: es })}
                </h3>
                {!slotsLoading && (
                  <span className="text-xs text-ink-500">
                    {slots.filter((s) => s.available).length} disponibles
                  </span>
                )}
              </div>

              {slotsLoading ? (
                <div className="py-10 flex justify-center"><Spinner /></div>
              ) : slots.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm text-ink-500">El profesional no atiende este día.</p>
                </div>
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

          {/* Modality + reason */}
          <Card className="p-5 sm:p-6 space-y-5">
            <div>
              <Label>Modalidad</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'in_person', label: 'Presencial', icon: MapPin, desc: 'Consulta en clínica' },
                  { id: 'online',    label: 'Online',     icon: Video,  desc: 'Por videollamada' },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setModality(m.id)}
                    className={cn(
                      'flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all',
                      modality === m.id
                        ? 'border-brand-500 bg-brand-50/50 ring-4 ring-brand-500/10'
                        : 'border-ink-200 hover:border-ink-300',
                    )}
                  >
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                      modality === m.id ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-600',
                    )}>
                      <m.icon className="w-4 h-4" strokeWidth={2} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-ink-900">{m.label}</div>
                      <div className="text-xs text-ink-500 mt-0.5">{m.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label>Motivo de consulta <span className="text-ink-400 font-normal">(opcional)</span></Label>
              <Textarea
                rows={3}
                placeholder="Cuéntale brevemente al profesional qué te trae a la consulta..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            <div>
              <Label>¿Repetir semanalmente? <span className="text-ink-400 font-normal">(útil para terapia)</span></Label>
              <div className="flex flex-wrap gap-1.5">
                {[0, 3, 7, 11].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRepeatWeeks(n)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                      repeatWeeks === n
                        ? 'bg-ink-900 text-white border-ink-900'
                        : 'bg-white text-ink-600 border-ink-200 hover:border-ink-300',
                    )}
                  >
                    {n === 0 ? 'Solo esta cita' : `${n + 1} citas`}
                  </button>
                ))}
              </div>
              {repeatWeeks > 0 && (
                <p className="text-[11px] text-ink-500 mt-2">
                  Se intentará crear {repeatWeeks + 1} citas (esta + {repeatWeeks} semanas más).
                  Si alguna semana no hay disponibilidad, se omite.
                </p>
              )}
            </div>
          </Card>
        </div>

        {/* Right: sticky summary */}
        <div>
          <div className="lg:sticky lg:top-24 space-y-4">
            <Card className="p-6">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 uppercase tracking-wider mb-3">
                <Sparkles className="w-3.5 h-3.5" /> Resumen
              </div>

              <div className="space-y-3 pb-5 border-b border-ink-100">
                <Row label="Profesional" value={`Ps. ${fullName}`} />
                <Row label="Especialidad" value={doctor.specialty.name} />
                <Row label="Duración" value={`${doctor.consultation_duration} minutos`} />
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
                <Row
                  label="Modalidad"
                  value={modality === 'online' ? 'Online' : 'Presencial'}
                  icon={modality === 'online' ? Video : MapPin}
                />
              </div>

              {/* Banner de beneficio empresa */}
              {isCoveredByCompany && (
                <div className="my-4 rounded-2xl bg-gradient-to-br from-wellness-50 to-brand-50 border border-wellness-200 p-3.5">
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-wellness-600 text-white flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-wellness-800">
                        {benefit.company_name} cubre esta cita
                      </div>
                      <div className="text-[11px] text-wellness-700 mt-0.5 leading-relaxed">
                        Se descuenta automáticamente del pool de tu empresa. Sin pago.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between py-4">
                <span className="text-sm font-semibold text-ink-900">Total a pagar</span>
                <span className="text-xl font-bold tabular-nums tracking-tight">
                  {isCoveredByCompany
                    ? <span className="text-wellness-700">$0</span>
                    : doctor.consultation_price > 0
                      ? formatCLP(doctor.consultation_price)
                      : 'Sin costo'}
                </span>
              </div>

              {isCoveredByCompany && doctor.consultation_price > 0 && (
                <div className="text-[11px] text-ink-500 -mt-2 mb-2 text-right">
                  <span className="line-through">{formatCLP(doctor.consultation_price)}</span>
                  <span className="ml-1.5 text-wellness-700 font-semibold">cubierto por empresa</span>
                </div>
              )}

              <Button
                size="lg"
                className="w-full"
                onClick={handleBook}
                disabled={!selectedSlot || submitting}
              >
                {submitting
                  ? 'Agendando...'
                  : isCoveredByCompany
                    ? <>Reservar con beneficio empresa <CheckCircle2 className="w-4 h-4" /></>
                    : doctor.consultation_price > 0
                      ? <>Pagar y reservar <CheckCircle2 className="w-4 h-4" /></>
                      : <>Confirmar reserva <CheckCircle2 className="w-4 h-4" /></>}
              </Button>

              <p className="text-[11px] text-center text-ink-400 mt-3">
                {isCoveredByCompany
                  ? `Pool empresa restante: ${benefit.sessions_pool_total} sesiones · Cancelación gratuita hasta 24h antes`
                  : doctor.consultation_price > 0
                    ? 'Pago seguro vía MercadoPago · Cancelación gratuita hasta 24h antes'
                    : 'Cancelación gratuita hasta 24h antes'}
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
    <div className="flex items-center justify-between text-sm">
      <span className="text-ink-500">{label}</span>
      <span className={cn(
        'font-semibold flex items-center gap-1.5',
        highlight ? 'text-brand-700' : 'text-ink-900',
      )}>
        {Icon && <Icon className="w-3.5 h-3.5 text-ink-400" />}
        {value}
      </span>
    </div>
  )
}
