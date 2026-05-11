import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { addDays, format, isSameDay, parseISO, startOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Search, ChevronLeft, ChevronRight, Calendar, Clock, CheckCircle2, User,
  Stethoscope, Brain, ArrowRight, ArrowLeft,
} from 'lucide-react'
import { patientsApi, doctorsApi, appointmentsApi, specialtiesApi } from '../../services/api'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input, Textarea, Label } from '../../components/ui/Input'
import { Avatar } from '../../components/ui/Avatar'
import { Badge } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Spinner'
import { cn } from '../../lib/cn'
import { fadeInUp } from '../../lib/motion'
import { formatCLP } from '../../lib/format'

const STEPS = ['Paciente', 'Profesional', 'Hora', 'Confirmar']

export default function ReceptionBook() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)

  // Step 1: Patient
  const [patientQuery, setPatientQuery] = useState('')
  const [patients, setPatients] = useState([])
  const [patientLoading, setPatientLoading] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState(null)

  // Step 2: Doctor
  const [doctors, setDoctors] = useState([])
  const [specialties, setSpecialties] = useState([])
  const [specialtyId, setSpecialtyId] = useState('')
  const [selectedDoctor, setSelectedDoctor] = useState(null)

  // Step 3: Slot
  const [weekStart, setWeekStart] = useState(() => startOfWeek(addDays(new Date(), 1), { weekStartsOn: 1 }))
  const [selectedDate, setSelectedDate] = useState(addDays(new Date(), 1))
  const [slots, setSlots] = useState([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState(null)

  // Step 4
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Patient search
  useEffect(() => {
    setPatientLoading(true)
    const t = setTimeout(() => {
      patientsApi.search(patientQuery)
        .then((r) => setPatients(r.data))
        .finally(() => setPatientLoading(false))
    }, 250)
    return () => clearTimeout(t)
  }, [patientQuery])

  // Specialties
  useEffect(() => {
    specialtiesApi.list().then((r) => setSpecialties(r.data))
  }, [])

  // Doctors
  useEffect(() => {
    if (step !== 1) return
    doctorsApi
      .list(specialtyId ? { specialty_id: specialtyId } : {})
      .then((r) => setDoctors(r.data))
  }, [step, specialtyId])

  // Slots
  useEffect(() => {
    if (step !== 2 || !selectedDoctor) return
    setSlotsLoading(true)
    setSelectedSlot(null)
    doctorsApi.getAvailableSlots(selectedDoctor.id, format(selectedDate, 'yyyy-MM-dd'))
      .then((r) => setSlots(r.data.slots))
      .finally(() => setSlotsLoading(false))
  }, [step, selectedDoctor, selectedDate])

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  )

  const handleSubmit = async () => {
    if (!selectedPatient || !selectedDoctor || !selectedSlot) return
    setSubmitting(true)
    try {
      const { data } = await appointmentsApi.create({
        patient_id: selectedPatient.id,
        doctor_id: selectedDoctor.id,
        appointment_date: format(selectedDate, 'yyyy-MM-dd'),
        start_time: selectedSlot.start_time + ':00',
        reason,
      })
      if (data.checkout_url) {
        toast.success('Cita creada. Comparte el link de pago con el paciente.')
        navigator.clipboard?.writeText(data.checkout_url).catch(() => {})
      } else {
        toast.success('Cita agendada')
      }
      navigate('/reception/appointments')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al agendar la cita')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <motion.div {...fadeInUp} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reservar para un paciente</h1>
        <p className="text-sm text-ink-500 mt-1">Flujo en 4 pasos: paciente → profesional → hora → confirmar.</p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-3 overflow-x-auto pb-1">
        {STEPS.map((label, i) => (
          <React.Fragment key={i}>
            <button
              type="button"
              onClick={() => i < step && setStep(i)}
              disabled={i > step}
              className={cn(
                'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap transition-all',
                i === step  ? 'bg-ink-900 text-white border-ink-900' :
                i  < step  ? 'bg-brand-50 text-brand-700 border-brand-100 cursor-pointer hover:bg-brand-100' :
                              'bg-white text-ink-400 border-ink-200',
              )}
            >
              <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px]">{i+1}</span>
              {label}
            </button>
            {i < STEPS.length - 1 && <span className="text-ink-300">›</span>}
          </React.Fragment>
        ))}
      </div>

      {/* Step content */}
      {step === 0 && (
        <Card className="p-6">
          <div className="mb-5">
            <h2 className="text-base font-semibold tracking-tight">Selecciona al paciente</h2>
            <p className="text-xs text-ink-500 mt-0.5">Busca por nombre, email o RUT.</p>
          </div>
          <Input
            placeholder="Buscar paciente..."
            leftIcon={Search}
            value={patientQuery}
            onChange={(e) => setPatientQuery(e.target.value)}
            className="h-12"
          />
          <div className="mt-4 max-h-[420px] overflow-y-auto -mx-2">
            {patientLoading ? (
              <div className="py-8 flex justify-center"><Spinner /></div>
            ) : patients.length === 0 ? (
              <p className="text-sm text-ink-500 text-center py-8">Sin resultados</p>
            ) : (
              <ul className="divide-y divide-ink-100">
                {patients.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => { setSelectedPatient(p); setStep(1) }}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-ink-50 transition-colors text-left"
                    >
                      <Avatar name={`${p.first_name} ${p.last_name}`} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-ink-900 truncate">{p.first_name} {p.last_name}</div>
                        <div className="text-xs text-ink-500 truncate">{p.email} {p.rut && `· ${p.rut}`}</div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-ink-400" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      )}

      {step === 1 && selectedPatient && (
        <div className="space-y-4">
          <Selected
            label="Paciente"
            primary={`${selectedPatient.first_name} ${selectedPatient.last_name}`}
            secondary={selectedPatient.email}
            onChange={() => setStep(0)}
          />

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h2 className="text-base font-semibold tracking-tight">Selecciona profesional</h2>
              <select
                value={specialtyId}
                onChange={(e) => setSpecialtyId(e.target.value)}
                className="h-10 px-3 rounded-lg border border-ink-200 text-sm font-medium"
              >
                <option value="">Todas las especialidades</option>
                {specialties.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {doctors.length === 0 ? (
              <p className="text-sm text-ink-500 text-center py-8">Sin médicos en esta especialidad</p>
            ) : (
              <ul className="grid sm:grid-cols-2 gap-2">
                {doctors.map((d) => {
                  const Icon = d.specialty.name.toLowerCase().includes('psic') ? Brain : Stethoscope
                  return (
                    <li key={d.id}>
                      <button
                        type="button"
                        onClick={() => { setSelectedDoctor(d); setStep(2) }}
                        className="w-full flex items-center gap-3 p-3 rounded-xl border border-ink-200 hover:border-brand-300 hover:bg-brand-50/30 transition-all text-left"
                      >
                        <Avatar name={`${d.user.first_name} ${d.user.last_name}`} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm text-ink-900 truncate">Dr(a). {d.user.first_name} {d.user.last_name}</div>
                          <div className="flex items-center gap-1.5 text-xs text-brand-600 mt-0.5">
                            <Icon className="w-3 h-3" /> {d.specialty.name}
                          </div>
                        </div>
                        <span className="text-xs font-bold tabular-nums">
                          {d.consultation_price > 0 ? formatCLP(d.consultation_price) : 'Free'}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </div>
      )}

      {step === 2 && selectedDoctor && (
        <div className="space-y-4">
          <Selected
            label="Profesional"
            primary={`Dr(a). ${selectedDoctor.user.first_name} ${selectedDoctor.user.last_name}`}
            secondary={selectedDoctor.specialty.name}
            onChange={() => setStep(1)}
          />

          <Card className="p-5 sm:p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-semibold tracking-tight">Elige fecha y hora</h2>
                <p className="text-xs text-ink-500 mt-0.5">
                  {format(weekStart, "MMMM yyyy", { locale: es }).replace(/^\w/, (c) => c.toUpperCase())}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => setWeekStart(addDays(weekStart, -7))} disabled={isSameDay(weekStart, startOfWeek(new Date(), { weekStartsOn: 1 }))}>
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
                <p className="text-sm text-ink-500 text-center py-8">El profesional no atiende este día.</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-6 gap-2">
                  {slots.map((slot) => {
                    const isSelected = selectedSlot?.start_time === slot.start_time
                    return (
                      <button
                        key={slot.start_time}
                        type="button"
                        disabled={!slot.available}
                        onClick={() => { setSelectedSlot(slot); setStep(3) }}
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
      )}

      {step === 3 && selectedPatient && selectedDoctor && selectedSlot && (
        <div className="space-y-4">
          <Card className="p-6">
            <div className="text-[10px] uppercase tracking-wider text-ink-400 font-semibold mb-3">Resumen</div>
            <div className="space-y-3 pb-5 border-b border-ink-100 text-sm">
              <Row label="Paciente"     value={`${selectedPatient.first_name} ${selectedPatient.last_name}`} icon={User} />
              <Row label="Profesional"  value={`Dr(a). ${selectedDoctor.user.first_name} ${selectedDoctor.user.last_name}`} icon={Stethoscope} />
              <Row label="Especialidad" value={selectedDoctor.specialty.name} />
              <Row label="Fecha"        value={format(selectedDate, "d MMM yyyy", { locale: es })} icon={Calendar} />
              <Row label="Hora"         value={selectedSlot.start_time} icon={Clock} highlight />
              <Row label="Duración"     value={`${selectedDoctor.consultation_duration} min`} />
            </div>

            <div className="flex items-center justify-between py-4">
              <span className="text-sm font-semibold text-ink-900">Total</span>
              <span className="text-xl font-bold tabular-nums tracking-tight">
                {selectedDoctor.consultation_price > 0 ? formatCLP(selectedDoctor.consultation_price) : 'Sin costo'}
              </span>
            </div>

            <div className="mb-5">
              <Label>Motivo (opcional)</Label>
              <Textarea rows={2} placeholder="Anotación para el médico..." value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>

            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setStep(2)}>
                <ArrowLeft className="w-4 h-4" /> Volver
              </Button>
              <Button className="flex-1" onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Agendando...' : <>Confirmar reserva <CheckCircle2 className="w-4 h-4" /></>}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </motion.div>
  )
}

function Selected({ label, primary, secondary, onChange }) {
  return (
    <Card className="p-4 flex items-center gap-3">
      <div className="text-[10px] uppercase tracking-wider text-ink-400 font-semibold w-24 shrink-0">{label}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-ink-900 truncate">{primary}</div>
        {secondary && <div className="text-xs text-ink-500 truncate">{secondary}</div>}
      </div>
      <Button variant="ghost" size="sm" onClick={onChange}>Cambiar</Button>
    </Card>
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
