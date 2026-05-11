import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Link } from 'react-router-dom'
import {
  CalendarDays, CheckCircle2, X, FileText, Clock, Video, FileSearch, List, Grid,
  CalendarX, AlertTriangle,
} from 'lucide-react'
import { appointmentsApi } from '../../services/api'
import { Modal } from '../../components/ui/Modal'
import { Input, Label, Textarea } from '../../components/ui/Input'
import { PatientHistoryModal } from '../../components/doctor/PatientHistoryModal'
import { SessionLogForm } from '../../components/medical/SessionLogForm'
import { DoctorScheduleWeek } from './DoctorScheduleWeek'
import { Card } from '../../components/ui/Card'
import { Avatar } from '../../components/ui/Avatar'
import { Button } from '../../components/ui/Button'
import { StatusBadge } from '../../components/ui/Badge'
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

export default function DoctorSchedule() {
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [historyPatient, setHistoryPatient] = useState(null)
  const [sessionAppt, setSessionAppt] = useState(null)
  const [view, setView] = useState('list') // 'list' | 'week'
  const [cancelDayOpen, setCancelDayOpen] = useState(false)
  const [cancelDayForm, setCancelDayForm] = useState({ date: '', reason: '' })
  const [cancelDaySubmitting, setCancelDaySubmitting] = useState(false)

  const handleCancelDay = async (e) => {
    e.preventDefault()
    if (!cancelDayForm.date) return
    if (!window.confirm(`¿Cancelar TODAS las citas del ${cancelDayForm.date}? Esto notifica a todos los pacientes.`)) return
    setCancelDaySubmitting(true)
    try {
      const { data } = await appointmentsApi.cancelDay({
        date: cancelDayForm.date,
        reason: cancelDayForm.reason || null,
      })
      toast.success(`${data.cancelled} cita(s) cancelada(s)`)
      setCancelDayOpen(false)
      setCancelDayForm({ date: '', reason: '' })
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error')
    } finally {
      setCancelDaySubmitting(false)
    }
  }

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

  // Abre el formulario estructurado de nota clínica.
  // El propio modal marca la cita como "completed" al finalizar.
  const handleOpenSessionLog = (appt) => setSessionAppt(appt)

  const handleCancel = async (id) => {
    if (!window.confirm('¿Cancelar esta cita?')) return
    try {
      await appointmentsApi.cancel(id, { cancellation_reason: 'Cancelado por el médico' })
      toast.success('Cita cancelada')
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error')
    }
  }

  return (
    <motion.div {...fadeInUp} className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mi agenda</h1>
          <p className="text-sm text-ink-500 mt-1">Administra tus citas y atiende a tus pacientes.</p>
        </div>
        <div className="flex gap-2">
          <div className="inline-flex bg-white border border-ink-200 rounded-xl p-0.5">
            {[
              { id: 'list', label: 'Lista',  icon: List },
              { id: 'week', label: 'Semana', icon: Grid },
            ].map((v) => (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                  view === v.id ? 'bg-ink-900 text-white' : 'text-ink-600 hover:text-ink-900',
                )}
              >
                <v.icon className="w-3.5 h-3.5" /> {v.label}
              </button>
            ))}
          </div>
          <Button variant="danger" size="sm" onClick={() => setCancelDayOpen(true)}>
            <CalendarX className="w-3.5 h-3.5" /> Cancelar día
          </Button>
        </div>
      </div>

      {view === 'week' ? (
        <DoctorScheduleWeek
          appointments={appointments}
          loading={loading}
          onAppointmentClick={(a) => setHistoryPatient(a.patient)}
        />
      ) : (
      <>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
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
        <EmptyState icon={CalendarDays} title="No hay citas en esta categoría" />
      ) : (
        <motion.div variants={stagger(0.04)} initial="initial" animate="animate" className="space-y-3">
          {appointments.map((a) => (
            <motion.div key={a.id} variants={staggerItem}>
              <Card hover className="p-5">
                <div className="flex items-start gap-4">
                  <Avatar name={`${a.patient.first_name} ${a.patient.last_name}`} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-ink-900">{a.patient.first_name} {a.patient.last_name}</span>
                      <StatusBadge status={a.status} />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-ink-600">
                      <div className="flex items-center gap-1.5">
                        <CalendarDays className="w-3.5 h-3.5 text-ink-400" />
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
                    {a.notes && (
                      <div className="flex items-start gap-1.5 text-xs text-ink-500 mt-2 p-2 bg-ink-50 rounded-lg">
                        <FileText className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span>{a.notes}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                    <Link to={`/doctor/patients/${a.patient.id}`}>
                      <Button variant="secondary" size="sm">
                        <FileSearch className="w-3.5 h-3.5" /> Ficha
                      </Button>
                    </Link>
                    {a.modality === 'online' && ['scheduled', 'confirmed'].includes(a.status) && (
                      <Link to={`/teleconsulta/${a.id}`}>
                        <Button size="sm">
                          <Video className="w-3.5 h-3.5" /> Entrar
                        </Button>
                      </Link>
                    )}
                    {a.status === 'scheduled' && (
                      <Button variant="success" size="sm" onClick={() => handleConfirm(a.id)}>
                        Confirmar
                      </Button>
                    )}
                    {['scheduled', 'confirmed'].includes(a.status) && (
                      <>
                        <Button variant="primary" size="sm" onClick={() => handleOpenSessionLog(a)}>
                          <CheckCircle2 className="w-3.5 h-3.5" /> Atender
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => handleCancel(a.id)}>
                          <X className="w-3.5 h-3.5" /> Cancelar
                        </Button>
                      </>
                    )}
                    {a.status === 'completed' && (
                      <Button variant="secondary" size="sm" onClick={() => handleOpenSessionLog(a)}>
                        <FileText className="w-3.5 h-3.5" /> Ver nota
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}
      </>
      )}

      <PatientHistoryModal
        open={!!historyPatient}
        onClose={() => setHistoryPatient(null)}
        patient={historyPatient}
      />

      <SessionLogForm
        open={!!sessionAppt}
        onClose={() => setSessionAppt(null)}
        appointment={sessionAppt}
        onSaved={load}
      />

      <Modal
        open={cancelDayOpen}
        onClose={() => setCancelDayOpen(false)}
        title="Cancelar día completo"
        description="Cancela todas tus citas para una fecha específica. Cada paciente recibirá una notificación."
      >
        <form onSubmit={handleCancelDay} className="space-y-4">
          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-100 text-amber-800 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Esta acción es <strong>irreversible</strong>. Las citas quedan en estado "cancelada".</span>
          </div>
          <div>
            <Label>Fecha</Label>
            <Input type="date" required value={cancelDayForm.date} onChange={(e) => setCancelDayForm({ ...cancelDayForm, date: e.target.value })} />
          </div>
          <div>
            <Label>Motivo (opcional)</Label>
            <Textarea rows={2} placeholder="Imprevisto, enfermedad, etc." value={cancelDayForm.reason} onChange={(e) => setCancelDayForm({ ...cancelDayForm, reason: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setCancelDayOpen(false)}>
              Volver
            </Button>
            <Button type="submit" variant="danger" className="flex-1" disabled={cancelDaySubmitting}>
              {cancelDaySubmitting ? 'Cancelando...' : 'Cancelar día'}
            </Button>
          </div>
        </form>
      </Modal>
    </motion.div>
  )
}
