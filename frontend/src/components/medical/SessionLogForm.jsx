import React, { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Save, CheckCircle2, Stethoscope, Brain, AlertTriangle } from 'lucide-react'
import { sessionLogsApi } from '../../services/api'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input, Label, Textarea } from '../ui/Input'
import { Spinner } from '../ui/Spinner'
import { cn } from '../../lib/cn'

const empty = {
  diagnosis: '', evolution: '', observations: '', indications: '',
  treatment: '', medications: '', next_steps: '',
  emotional_state: '', topics_discussed: '', therapeutic_goals: '',
  progress_notes: '', homework: '', risk_level: '',
  is_draft: true,
}

const RISK_LEVELS = [
  { id: '',       label: 'Sin alerta', tone: 'bg-ink-100 text-ink-600' },
  { id: 'low',    label: 'Bajo',       tone: 'bg-wellness-100 text-wellness-700' },
  { id: 'medium', label: 'Medio',      tone: 'bg-amber-100 text-amber-700' },
  { id: 'high',   label: 'Alto',       tone: 'bg-red-100 text-red-700' },
]

/**
 * Modal de nota clínica post-sesión.
 *
 * Props:
 *  - open, onClose
 *  - appointment: objeto cita (al menos { id, doctor.specialty })
 *  - onSaved: callback con (savedLog) tras guardar
 */
export function SessionLogForm({ open, onClose, appointment, onSaved }) {
  const [data, setData] = useState(empty)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const isPsych = (appointment?.doctor?.specialty?.name || '').toLowerCase().includes('psic')

  useEffect(() => {
    if (!open || !appointment) return
    setLoading(true)
    sessionLogsApi.get(appointment.id)
      .then((r) => {
        if (r.data) setData({ ...empty, ...r.data })
        else setData(empty)
      })
      .catch(() => setData(empty))
      .finally(() => setLoading(false))
  }, [open, appointment])

  if (!appointment) return null

  const set = (field) => (e) => setData({ ...data, [field]: e.target.value })

  const handleSave = async (finalize) => {
    setSubmitting(true)
    try {
      const payload = { ...data, is_draft: !finalize }
      const { data: saved } = await sessionLogsApi.save(appointment.id, payload)
      toast.success(finalize ? 'Atención finalizada' : 'Borrador guardado')
      onSaved?.(saved)
      if (finalize) onClose?.()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al guardar')
    } finally {
      setSubmitting(false)
    }
  }

  const patientName = appointment.patient
    ? `${appointment.patient.first_name} ${appointment.patient.last_name}`
    : ''

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nota clínica de sesión"
      description={patientName ? `Registro para ${patientName}` : 'Registra los detalles clínicos de la consulta.'}
      size="xl"
    >
      {loading ? (
        <div className="py-10 flex justify-center"><Spinner /></div>
      ) : (
        <div className="space-y-5">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-brand-700 bg-brand-50 px-3 py-1.5 rounded-full">
            {isPsych ? <Brain className="w-3.5 h-3.5" /> : <Stethoscope className="w-3.5 h-3.5" />}
            {isPsych ? 'Plantilla psicología' : 'Plantilla médica'}
            {!data.is_draft && <span className="ml-1 px-1.5 py-0.5 rounded bg-wellness-100 text-wellness-700 text-[10px]">FINALIZADA</span>}
          </div>

          {/* Comunes */}
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Diagnóstico / hipótesis" value={data.diagnosis} onChange={set('diagnosis')} placeholder="Cefalea tensional, episodio depresivo leve..." />
            <Field label="Evolución" value={data.evolution} onChange={set('evolution')} placeholder="Mejora respecto a la sesión anterior..." />
          </div>
          <Field label="Observaciones" value={data.observations} onChange={set('observations')} rows={2} />
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Indicaciones" value={data.indications} onChange={set('indications')} rows={2} />
            <Field label="Tratamiento recomendado" value={data.treatment} onChange={set('treatment')} rows={2} />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Medicamentos indicados" value={data.medications} onChange={set('medications')} rows={2} placeholder="Paracetamol 500mg c/8h x 3 días..." />
            <Field label="Próximos pasos" value={data.next_steps} onChange={set('next_steps')} rows={2} />
          </div>

          {/* Psicología */}
          {isPsych && (
            <div className="border-t border-ink-100 pt-5 space-y-4">
              <div className="text-[11px] uppercase tracking-wider font-bold text-brand-600">Sección psicología</div>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Estado emocional observado" value={data.emotional_state} onChange={set('emotional_state')} />
                <Field label="Temas tratados" value={data.topics_discussed} onChange={set('topics_discussed')} />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Objetivos terapéuticos" value={data.therapeutic_goals} onChange={set('therapeutic_goals')} rows={2} />
                <Field label="Avances del proceso" value={data.progress_notes} onChange={set('progress_notes')} rows={2} />
              </div>
              <Field label="Tareas / ejercicios para el paciente" value={data.homework} onChange={set('homework')} rows={2} />

              <div>
                <Label className="inline-flex items-center gap-1.5">
                  <AlertTriangle className="w-3 h-3 text-amber-600" /> Nivel de alerta clínica
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {RISK_LEVELS.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setData({ ...data, risk_level: r.id })}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                        data.risk_level === r.id
                          ? `${r.tone} border-current ring-2 ring-ink-900/10`
                          : 'bg-white text-ink-600 border-ink-200 hover:border-ink-300',
                      )}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-3 border-t border-ink-100">
            <Button variant="secondary" className="flex-1 min-w-[140px]" onClick={() => handleSave(false)} disabled={submitting}>
              <Save className="w-4 h-4" /> {submitting ? 'Guardando...' : 'Guardar borrador'}
            </Button>
            <Button className="flex-1 min-w-[140px]" onClick={() => handleSave(true)} disabled={submitting}>
              <CheckCircle2 className="w-4 h-4" /> Finalizar atención
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

function Field({ label, value, onChange, placeholder, rows = 1 }) {
  return (
    <div>
      <Label>{label}</Label>
      {rows > 1 ? (
        <Textarea rows={rows} value={value || ''} onChange={onChange} placeholder={placeholder} />
      ) : (
        <Input value={value || ''} onChange={onChange} placeholder={placeholder} />
      )}
    </div>
  )
}
