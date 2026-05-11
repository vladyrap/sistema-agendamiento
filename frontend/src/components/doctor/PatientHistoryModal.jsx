import React, { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Save, HeartPulse, FileEdit, ShieldAlert, Paperclip } from 'lucide-react'
import { medicalRecordApi, patientNotesApi } from '../../services/api'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Textarea, Label } from '../ui/Input'
import { Spinner } from '../ui/Spinner'
import { AttachmentsSection } from '../medical/AttachmentsSection'

export function PatientHistoryModal({ open, onClose, patient }) {
  const [medical, setMedical] = useState(null)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !patient) return
    setLoading(true)
    Promise.all([
      medicalRecordApi.forPatient(patient.id).then((r) => setMedical(r.data)).catch(() => setMedical(null)),
      patientNotesApi.get(patient.id).then((r) => setNote(r.data.content || '')).catch(() => setNote('')),
    ]).finally(() => setLoading(false))
  }, [open, patient])

  const handleSaveNote = async () => {
    if (!patient) return
    setSaving(true)
    try {
      await patientNotesApi.save(patient.id, { content: note })
      toast.success('Notas guardadas')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  if (!patient) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${patient.first_name} ${patient.last_name}`}
      description={`${patient.email}${patient.rut ? ' · ' + patient.rut : ''}${patient.phone ? ' · ' + patient.phone : ''}`}
      size="lg"
    >
      {loading ? (
        <div className="py-10 flex justify-center"><Spinner /></div>
      ) : (
        <div className="space-y-6">
          {/* Ficha clínica */}
          <section>
            <h3 className="text-sm font-semibold text-ink-900 mb-3 inline-flex items-center gap-1.5">
              <HeartPulse className="w-4 h-4 text-brand-600" /> Ficha clínica del paciente
            </h3>
            {!medical || !hasContent(medical) ? (
              <div className="text-sm text-ink-500 italic px-4 py-3 rounded-xl bg-ink-50 border border-ink-100">
                El paciente aún no completó su ficha clínica.
              </div>
            ) : (
              <div className="rounded-xl border border-ink-100 p-4 space-y-2.5 text-sm bg-ink-50/40">
                <Field label="Grupo sanguíneo" value={medical.blood_type} />
                <Field label="Alergias" value={medical.allergies} highlight />
                <Field label="Condiciones crónicas" value={medical.chronic_conditions} />
                <Field label="Medicamentos" value={medical.medications} />
                <Field label="Notas del paciente" value={medical.notes} />
                {(medical.emergency_contact_name || medical.emergency_contact_phone) && (
                  <div className="pt-2 border-t border-ink-100">
                    <div className="text-[10px] uppercase tracking-wider text-ink-400 font-semibold inline-flex items-center gap-1.5 mb-1">
                      <ShieldAlert className="w-3 h-3 text-amber-600" /> Contacto de emergencia
                    </div>
                    <div className="text-ink-700">{medical.emergency_contact_name} {medical.emergency_contact_phone && `· ${medical.emergency_contact_phone}`}</div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Adjuntos */}
          <section>
            <h3 className="text-sm font-semibold text-ink-900 mb-3 inline-flex items-center gap-1.5">
              <Paperclip className="w-4 h-4 text-brand-600" /> Imágenes y exámenes
            </h3>
            <AttachmentsSection mode="staff" patientId={patient.id} />
          </section>

          {/* Notas privadas del médico */}
          <section>
            <h3 className="text-sm font-semibold text-ink-900 mb-3 inline-flex items-center gap-1.5">
              <FileEdit className="w-4 h-4 text-brand-600" /> Tus notas privadas
            </h3>
            <Label className="sr-only">Notas privadas</Label>
            <Textarea
              rows={6}
              placeholder="Anota observaciones clínicas, evolución, contexto del paciente. Solo tú las verás."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={5000}
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-ink-400 tabular-nums">{note.length}/5000</span>
              <Button size="sm" onClick={handleSaveNote} disabled={saving}>
                <Save className="w-3.5 h-3.5" /> {saving ? 'Guardando...' : 'Guardar notas'}
              </Button>
            </div>
          </section>
        </div>
      )}
    </Modal>
  )
}

function hasContent(rec) {
  return ['blood_type', 'allergies', 'chronic_conditions', 'medications', 'notes',
          'emergency_contact_name', 'emergency_contact_phone']
    .some((k) => (rec[k] || '').trim())
}

function Field({ label, value, highlight }) {
  if (!value || !value.trim()) return null
  return (
    <div>
      <div className={`text-[10px] uppercase tracking-wider font-semibold ${highlight ? 'text-red-600' : 'text-ink-400'}`}>{label}</div>
      <div className="text-ink-800 whitespace-pre-wrap">{value}</div>
    </div>
  )
}
