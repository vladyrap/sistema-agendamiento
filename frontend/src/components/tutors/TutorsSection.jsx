import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Shield, Plus, Mail, Phone, IdCard, Pencil, Trash2, AlertTriangle, Send,
  Bell, Eye, CheckCircle2, UserPlus, Link2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { tutorsApi } from '../../services/api'
import { Card } from '../../components/ui/Card'
import { Avatar } from '../../components/ui/Avatar'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import TutorForm from './TutorForm'
import { cn } from '../../lib/cn'

/**
 * Sección de Tutores en la ficha del paciente. Visible para paciente, doctor, recepción y admin.
 *
 * Props:
 *  - patientId
 *  - patientBirthDate (opcional, ISO date) — para detectar si es menor de edad y validar
 *  - canManage (bool) — habilita botones de agregar/editar/borrar
 *  - canAlert (bool) — habilita botón "Alertar tutor" (solo profesional/admin)
 */
export default function TutorsSection({
  patientId, patientBirthDate, canManage = true, canAlert = false, className = '',
}) {
  const [tutors, setTutors] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null) // tutor en edición

  async function load() {
    setLoading(true)
    try {
      const r = await tutorsApi.listForPatient(patientId)
      setTutors(r.data)
    } catch {
      toast.error('No se pudieron cargar los tutores')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [patientId])

  async function removeTutor(t) {
    if (!confirm(`¿Quitar a ${t.name} como tutor?`)) return
    try {
      await tutorsApi.remove(t.id)
      toast.success('Tutor eliminado')
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error')
    }
  }

  async function alertTutor(t) {
    const message = prompt(
      `Enviar alerta a ${t.name} (${t.email || t.phone || 'sin contacto'}). ` +
      `Mensaje (opcional, puedes dejar en blanco):`,
      '',
    )
    if (message === null) return  // cancelado
    try {
      await tutorsApi.alert(t.id, message)
      toast.success('Alerta enviada al tutor')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No se pudo enviar')
    }
  }

  // Calcular edad si tenemos fecha de nacimiento
  let age = null
  if (patientBirthDate) {
    const today = new Date()
    const bd = new Date(patientBirthDate)
    age = today.getFullYear() - bd.getFullYear()
    if (today.getMonth() < bd.getMonth() || (today.getMonth() === bd.getMonth() && today.getDate() < bd.getDate())) {
      age -= 1
    }
  }
  const isMinor = age !== null && age < 18
  const hasLegalGuardian = tutors.some((t) => t.is_legal_guardian)
  const missingLegalGuardian = isMinor && !hasLegalGuardian && !loading

  return (
    <Card className={cn('p-6 space-y-4', className)}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold inline-flex items-center gap-2">
            <Shield className="w-4 h-4 text-brand-600" /> Tutores y contactos de crisis
            {isMinor && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                Menor de edad
              </span>
            )}
          </h3>
          <p className="text-xs text-ink-500 mt-0.5">
            Reciben alertas automáticas si hay crisis emocional (score ≤ 2 en el diario).
          </p>
        </div>
        {canManage && !adding && !editing && (
          <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
            <Plus className="w-4 h-4" /> Agregar tutor
          </Button>
        )}
      </div>

      {/* Warning si menor de edad y no tiene tutor legal */}
      {missingLegalGuardian && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-xs text-amber-800">
            <strong>Falta tutor legal.</strong> El paciente es menor de edad ({age} años).
            Es obligatorio designar al menos un tutor legal antes de reservar consultas.
          </div>
        </div>
      )}

      {/* Form de alta/edición */}
      {(adding || editing) && (
        <TutorForm
          patientId={patientId}
          tutor={editing}
          onSaved={() => { setAdding(false); setEditing(null); load() }}
          onCancel={() => { setAdding(false); setEditing(null) }}
        />
      )}

      {/* Lista */}
      {loading ? (
        <div className="py-8 flex justify-center"><Spinner /></div>
      ) : tutors.length === 0 ? (
        !adding && (
          <EmptyState
            icon={Shield}
            title="Sin tutores designados"
            description={canManage ? "Agregá un tutor para que el sistema lo alerte en caso de crisis." : ""}
          />
        )
      ) : (
        <div className="space-y-2.5">
          {tutors.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'rounded-2xl border p-4 flex items-start gap-3',
                t.is_legal_guardian ? 'bg-rose-50/40 border-rose-100' : 'bg-white border-ink-200',
              )}
            >
              <Avatar name={t.name} size="md" className="shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-ink-900 truncate">{t.name}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-ink-100 text-ink-700 border border-ink-200">
                    {t.relationship_label}
                  </span>
                  {t.is_legal_guardian && (
                    <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                      Tutor legal
                    </span>
                  )}
                  {t.has_account && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-wellness-100 text-wellness-700 border border-wellness-200">
                      <Link2 className="w-2.5 h-2.5" /> Cuenta vinculada
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 mt-1.5 text-xs text-ink-600 flex-wrap">
                  {t.email && (
                    <span className="inline-flex items-center gap-1">
                      <Mail className="w-3 h-3" /> {t.email}
                    </span>
                  )}
                  {t.phone && (
                    <span className="inline-flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {t.phone}
                    </span>
                  )}
                  {t.rut && (
                    <span className="inline-flex items-center gap-1">
                      <IdCard className="w-3 h-3" /> {t.rut}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 mt-2 text-[11px] text-ink-500 flex-wrap">
                  {t.notify_on_crisis && (
                    <span className="inline-flex items-center gap-1 text-rose-600">
                      <AlertTriangle className="w-3 h-3" /> Alerta crisis
                    </span>
                  )}
                  {t.notify_on_appointments && (
                    <span className="inline-flex items-center gap-1 text-brand-600">
                      <Bell className="w-3 h-3" /> Recibe citas
                    </span>
                  )}
                  {t.can_view_full_profile && t.has_account && (
                    <span className="inline-flex items-center gap-1 text-wellness-600">
                      <Eye className="w-3 h-3" /> Ve perfil completo
                    </span>
                  )}
                </div>

                {t.notes && (
                  <p className="text-xs text-ink-600 italic mt-2 leading-relaxed">"{t.notes}"</p>
                )}
              </div>

              <div className="flex flex-col items-end gap-1">
                {canAlert && (
                  <button
                    onClick={() => alertTutor(t)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 px-2 py-1 rounded-lg"
                    title="Enviar alerta manual"
                  >
                    <Send className="w-3.5 h-3.5" /> Alertar
                  </button>
                )}
                {canManage && (
                  <>
                    <button
                      onClick={() => setEditing(t)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-ink-600 hover:bg-ink-100 px-2 py-1 rounded-lg"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Editar
                    </button>
                    <button
                      onClick={() => removeTutor(t)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:bg-rose-50 px-2 py-1 rounded-lg"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Quitar
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </Card>
  )
}
