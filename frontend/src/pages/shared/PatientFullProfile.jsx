import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { format, parseISO, differenceInYears } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  ArrowLeft, Mail, Phone, IdCard, MapPin, Cake, ShieldCheck, Stethoscope, Brain,
  Calendar, Clock, HeartPulse, Paperclip, FileEdit, CalendarPlus, AlertTriangle,
  Save, ChevronRight, CheckCircle2, FileText,
} from 'lucide-react'
import { patientsApi, doctorsApi } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { Card } from '../../components/ui/Card'
import { Avatar } from '../../components/ui/Avatar'
import { Badge, StatusBadge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { Input, Label } from '../../components/ui/Input'
import { AttachmentsSection } from '../../components/medical/AttachmentsSection'
import { SessionLogForm } from '../../components/medical/SessionLogForm'
import PatientMoodCard from '../../components/mood/PatientMoodCard'
import PatientHomeworkSection from '../../components/homework/PatientHomeworkSection'
import { cn } from '../../lib/cn'
import { fadeInUp } from '../../lib/motion'

const TABS = [
  { id: 'general',  label: 'General',     icon: HeartPulse },
  { id: 'doctor',   label: 'Profesional', icon: Stethoscope },
  { id: 'history',  label: 'Historial',   icon: FileText },
  { id: 'files',    label: 'Adjuntos',    icon: Paperclip },
]

const STATUS_CFG = {
  active:        { label: 'Activo',         tone: 'success' },
  in_treatment:  { label: 'En tratamiento', tone: 'brand'   },
  inactive:      { label: 'Inactivo',       tone: 'ink'     },
  discharged:    { label: 'Alta médica',    tone: 'warning' },
}

export default function PatientFullProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('general')
  const [sessionAppt, setSessionAppt] = useState(null)

  const isAdmin = user?.role === 'admin'

  const load = () => {
    setLoading(true)
    patientsApi.getFull(id)
      .then((r) => setData(r.data))
      .catch((err) => toast.error(err.response?.data?.detail || 'No se pudo cargar la ficha'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [id])

  if (loading) return <div className="py-16 flex justify-center"><Spinner size="lg" /></div>
  if (!data) return null

  const p = data.patient
  const fullName = `${p.first_name} ${p.last_name}`
  const age = p.birth_date ? differenceInYears(new Date(), parseISO(p.birth_date)) : null
  const status = STATUS_CFG[p.patient_status] || STATUS_CFG.active
  const backPath = user?.role === 'admin' ? '/admin/users'
                 : user?.role === 'doctor' ? '/doctor/schedule'
                 : user?.role === 'receptionist' ? '/reception/patients'
                 : '/patient'

  return (
    <motion.div {...fadeInUp} className="space-y-6">
      <Link to={backPath} className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900 font-medium">
        <ArrowLeft className="w-4 h-4" /> Volver
      </Link>

      {/* Header */}
      <Card className="p-0 overflow-hidden">
        <div className="h-28 bg-gradient-to-br from-brand-500 via-brand-700 to-ink-900 relative">
          <div className="absolute inset-0 bg-grid-dark opacity-30" />
        </div>
        <div className="px-6 sm:px-8 pb-6 -mt-12 relative">
          <div className="flex items-end gap-4 flex-wrap">
            <Avatar name={fullName} size="2xl" className="ring-4 ring-white shadow-soft-lg" />
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center gap-2 flex-wrap mt-2">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{fullName}</h1>
                <Badge tone={status.tone} dot>{status.label}</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-ink-600">
                {age !== null && <span className="inline-flex items-center gap-1.5"><Cake className="w-3.5 h-3.5 text-ink-400" /> {age} años</span>}
                {p.rut && <span className="inline-flex items-center gap-1.5"><IdCard className="w-3.5 h-3.5 text-ink-400" /> {p.rut}</span>}
                <span className="inline-flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-ink-400" /> {p.email}</span>
                {p.phone && <span className="inline-flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-ink-400" /> {p.phone}</span>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to={`/patient/search`}>
                <Button variant="secondary" size="sm"><CalendarPlus className="w-3.5 h-3.5" /> Nueva cita</Button>
              </Link>
            </div>
          </div>
        </div>
      </Card>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat label="Próxima cita" value={data.next_appointment ? `${format(parseISO(data.next_appointment.appointment_date), 'd MMM', { locale: es })} · ${data.next_appointment.start_time.slice(0,5)}` : '—'} />
        <Stat label="Última atención" value={data.last_attended ? format(parseISO(data.last_attended.appointment_date), "d MMM yyyy", { locale: es }) : '—'} />
        <Stat label="Atenciones" value={data.totals.appointments_completed} subtitle={`de ${data.totals.appointments_total} agendadas`} />
        <Stat label="Ingreso al sistema" value={p.created_at ? format(parseISO(p.created_at), 'MMM yyyy', { locale: es }) : '—'} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 border-b border-ink-100">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold transition-colors border-b-2 -mb-px whitespace-nowrap',
              tab === t.id
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-ink-500 hover:text-ink-900',
            )}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'general'  && <TabGeneral data={data} isAdmin={isAdmin} onReload={load} />}
      {tab === 'doctor'   && <TabDoctor data={data} isAdmin={isAdmin} onReload={load} />}
      {tab === 'history'  && <TabHistory data={data} onOpenSession={setSessionAppt} />}
      {tab === 'files'    && (
        <Card className="p-6">
          <AttachmentsSection mode="staff" patientId={p.id} />
        </Card>
      )}

      <SessionLogForm
        open={!!sessionAppt}
        onClose={() => setSessionAppt(null)}
        appointment={sessionAppt}
        onSaved={load}
      />
    </motion.div>
  )
}

function Stat({ label, value, subtitle }) {
  return (
    <Card className="p-4">
      <div className="text-[10px] uppercase tracking-wider text-ink-400 font-bold">{label}</div>
      <div className="text-lg font-bold text-ink-900 tracking-tight mt-1 tabular-nums truncate">{value}</div>
      {subtitle && <div className="text-xs text-ink-500 mt-0.5">{subtitle}</div>}
    </Card>
  )
}

function TabGeneral({ data, isAdmin, onReload }) {
  const p = data.patient
  const r = data.medical_record
  const [editing, setEditing] = useState(false)
  const [statusForm, setStatusForm] = useState({
    patient_status: p.patient_status || 'active',
    assigned_doctor_id: p.assigned_doctor_id || '',
  })
  const [allDoctors, setAllDoctors] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isAdmin) doctorsApi.list().then((rr) => setAllDoctors(rr.data)).catch(() => {})
  }, [isAdmin])

  const handleSave = async () => {
    setSaving(true)
    try {
      await patientsApi.updateClinical(p.id, {
        patient_status: statusForm.patient_status,
        assigned_doctor_id: statusForm.assigned_doctor_id ? parseInt(statusForm.assigned_doctor_id) : null,
      })
      toast.success('Datos clínicos actualizados')
      setEditing(false)
      onReload()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error')
    } finally {
      setSaving(false)
    }
  }

  const { user: currentUser } = useAuth()
  const canAssign = currentUser?.role === 'doctor' || currentUser?.role === 'admin'

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <PatientMoodCard patientId={p.id} className="lg:col-span-2" />

      <PatientHomeworkSection patientId={p.id} canAssign={canAssign} />

      <Card className="p-6">
        <h3 className="text-sm font-semibold mb-4 inline-flex items-center gap-2">
          <IdCard className="w-4 h-4 text-brand-600" /> Datos personales
        </h3>
        <dl className="space-y-2.5 text-sm">
          <Row label="Email" value={p.email} />
          <Row label="Teléfono" value={p.phone || '—'} />
          <Row label="RUT" value={p.rut || '—'} />
          <Row label="Fecha de nacimiento" value={p.birth_date ? format(parseISO(p.birth_date), "d 'de' MMMM yyyy", { locale: es }) : '—'} />
          <Row label="Dirección" value={p.address || '—'} />
          <Row label="Previsión" value={p.health_insurance || '—'} />
        </dl>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold inline-flex items-center gap-2">
            <HeartPulse className="w-4 h-4 text-brand-600" /> Ficha clínica
          </h3>
        </div>
        <dl className="space-y-2.5 text-sm">
          <Row label="Grupo sanguíneo" value={r.blood_type || '—'} />
          <Row label="Alergias" value={r.allergies || '—'} highlight={!!r.allergies} />
          <Row label="Condiciones crónicas" value={r.chronic_conditions || '—'} />
          <Row label="Medicamentos" value={r.medications || '—'} />
          <Row label="Contacto emergencia" value={r.emergency_contact_name ? `${r.emergency_contact_name} · ${r.emergency_contact_phone || '—'}` : '—'} />
        </dl>
      </Card>

      {isAdmin && (
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Estado clínico y asignación</h3>
            {!editing && <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>Editar</Button>}
          </div>
          {!editing ? (
            <dl className="space-y-2.5 text-sm">
              <Row label="Estado del paciente" value={STATUS_CFG[p.patient_status]?.label || 'Activo'} />
              <Row label="Profesional asignado" value={data.assigned_doctor ? `Dr(a). ${data.assigned_doctor.first_name} ${data.assigned_doctor.last_name} · ${data.assigned_doctor.specialty}` : 'Sin asignar'} />
            </dl>
          ) : (
            <div className="space-y-3">
              <div>
                <Label>Estado</Label>
                <select className="w-full h-11 rounded-xl border border-ink-200 bg-white px-3 text-sm" value={statusForm.patient_status} onChange={(e) => setStatusForm({ ...statusForm, patient_status: e.target.value })}>
                  {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <Label>Profesional asignado</Label>
                <select className="w-full h-11 rounded-xl border border-ink-200 bg-white px-3 text-sm" value={statusForm.assigned_doctor_id} onChange={(e) => setStatusForm({ ...statusForm, assigned_doctor_id: e.target.value })}>
                  <option value="">— Sin asignar —</option>
                  {allDoctors.map((d) => <option key={d.id} value={d.id}>Dr(a). {d.user.first_name} {d.user.last_name} · {d.specialty.name}</option>)}
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="secondary" className="flex-1" onClick={() => setEditing(false)}>Cancelar</Button>
                <Button className="flex-1" onClick={handleSave} disabled={saving}>
                  <Save className="w-4 h-4" /> {saving ? 'Guardando...' : 'Guardar'}
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}

function TabDoctor({ data }) {
  const d = data.assigned_doctor
  if (!d) {
    return (
      <Card className="p-8 text-center">
        <Stethoscope className="w-8 h-8 text-ink-300 mx-auto" />
        <p className="text-sm text-ink-500 mt-2">Sin profesional asignado.</p>
        <p className="text-xs text-ink-400 mt-1">Un admin puede asignar uno desde la pestaña General.</p>
      </Card>
    )
  }
  const attended = data.appointments.filter((a) => a.doctor?.id === d.id)
  return (
    <Card className="p-6">
      <div className="flex items-start gap-4">
        <Avatar name={`${d.first_name} ${d.last_name}`} size="xl" />
        <div className="flex-1">
          <h3 className="text-lg font-semibold">Dr(a). {d.first_name} {d.last_name}</h3>
          <div className="text-sm text-brand-600 font-medium">{d.specialty}</div>
          {d.clinic && <div className="text-sm text-ink-500 mt-0.5 inline-flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {d.clinic}</div>}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-sm text-ink-600">
            <span className="inline-flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-ink-400" /> {d.email}</span>
            {d.phone && <span className="inline-flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-ink-400" /> {d.phone}</span>}
          </div>
        </div>
      </div>
      <div className="mt-5 pt-5 border-t border-ink-100">
        <div className="text-[10px] uppercase tracking-wider text-ink-400 font-bold mb-2">
          Atenciones realizadas con este profesional
        </div>
        <div className="text-2xl font-bold tracking-tight">{attended.filter((a) => a.status === 'completed').length}</div>
        <div className="text-xs text-ink-500">de {attended.length} citas totales</div>
      </div>
    </Card>
  )
}

function TabHistory({ data, onOpenSession }) {
  if (data.appointments.length === 0) {
    return (
      <Card className="p-8 text-center">
        <FileText className="w-8 h-8 text-ink-300 mx-auto" />
        <p className="text-sm text-ink-500 mt-2">Aún no hay sesiones registradas.</p>
      </Card>
    )
  }
  return (
    <div className="relative pl-6 sm:pl-8">
      {/* Vertical line */}
      <div className="absolute left-2 sm:left-3 top-2 bottom-2 w-px bg-ink-200" />
      <div className="space-y-4">
        {data.appointments.map((a) => <TimelineItem key={a.id} appointment={a} onOpenSession={onOpenSession} />)}
      </div>
    </div>
  )
}

function TimelineItem({ appointment: a, onOpenSession }) {
  const isPsych = (a.doctor?.specialty || '').toLowerCase().includes('psic')
  const log = a.session_log
  const isCompleted = a.status === 'completed'

  return (
    <div className="relative">
      <span className={cn(
        'absolute -left-6 sm:-left-8 top-3 w-4 h-4 rounded-full ring-4 ring-ink-50',
        isCompleted ? 'bg-wellness-500' :
        a.status === 'cancelled' ? 'bg-red-400' :
        a.status === 'confirmed' ? 'bg-brand-500' : 'bg-ink-300',
      )} />

      <Card className="p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold tabular-nums">
                {format(parseISO(a.appointment_date), "EEEE d 'de' MMMM yyyy", { locale: es })} · {a.start_time.slice(0,5)}
              </span>
              <StatusBadge status={a.status} />
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-sm text-brand-600">
              {isPsych ? <Brain className="w-3.5 h-3.5" /> : <Stethoscope className="w-3.5 h-3.5" />}
              {a.doctor ? `Dr(a). ${a.doctor.first_name} ${a.doctor.last_name} · ${a.doctor.specialty}` : '—'}
            </div>
            {a.reason && <p className="text-sm text-ink-500 mt-2 italic">"{a.reason}"</p>}
          </div>

          {(isCompleted || a.status === 'confirmed' || a.status === 'scheduled') && (
            <Button variant="secondary" size="sm" onClick={() => onOpenSession(a)}>
              <FileEdit className="w-3.5 h-3.5" /> {log ? (log.is_draft ? 'Editar borrador' : 'Ver nota') : 'Agregar nota'}
            </Button>
          )}
        </div>

        {log && (
          <div className="mt-4 pt-4 border-t border-ink-100 grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {log.is_draft && (
              <div className="sm:col-span-2 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-1 rounded-md w-fit">
                <AlertTriangle className="w-3 h-3" /> Borrador — no finalizado
              </div>
            )}
            <LogField label="Diagnóstico" value={log.diagnosis} />
            <LogField label="Evolución" value={log.evolution} />
            <LogField label="Observaciones" value={log.observations} />
            <LogField label="Indicaciones" value={log.indications} />
            <LogField label="Tratamiento" value={log.treatment} />
            <LogField label="Medicamentos" value={log.medications} />
            <LogField label="Próximos pasos" value={log.next_steps} />
            {isPsych && (
              <>
                <LogField label="Estado emocional" value={log.emotional_state} />
                <LogField label="Temas tratados" value={log.topics_discussed} />
                <LogField label="Objetivos terapéuticos" value={log.therapeutic_goals} />
                <LogField label="Avances" value={log.progress_notes} />
                <LogField label="Tareas" value={log.homework} />
                {log.risk_level && (
                  <div className="sm:col-span-2">
                    <span className="text-[10px] uppercase tracking-wider text-ink-400 font-bold">Nivel de alerta</span>
                    <Badge
                      tone={log.risk_level === 'high' ? 'danger' : log.risk_level === 'medium' ? 'warning' : 'success'}
                      className="ml-2"
                    >
                      {log.risk_level === 'high' ? 'Alto' : log.risk_level === 'medium' ? 'Medio' : 'Bajo'}
                    </Badge>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}

function LogField({ label, value }) {
  if (!value || !value.trim()) return null
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-ink-400 font-bold">{label}</div>
      <div className="text-ink-800 whitespace-pre-wrap text-sm">{value}</div>
    </div>
  )
}

function Row({ label, value, highlight }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-ink-500 shrink-0">{label}</dt>
      <dd className={cn('text-right break-words', highlight ? 'text-red-700 font-semibold' : 'text-ink-900')}>{value}</dd>
    </div>
  )
}
