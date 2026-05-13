import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Save, X, Shield, Bell, Eye, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { tutorsApi } from '../../services/api'
import { Input, Label } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { cn } from '../../lib/cn'

const RELATIONSHIP_OPTIONS = [
  'Madre', 'Padre', 'Tutor legal', 'Pareja', 'Cónyuge', 'Hermano/a',
  'Hijo/a', 'Abuelo/a', 'Amigo/a cercano', 'Otro',
]

function ToggleRow({ checked, onChange, icon: Icon, title, description, color = 'brand' }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        'w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-colors',
        checked
          ? color === 'rose'
            ? 'bg-rose-50 border-rose-200'
            : 'bg-brand-50 border-brand-200'
          : 'bg-white border-ink-200 hover:border-ink-300',
      )}
    >
      <div className={cn(
        'mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0',
        checked
          ? color === 'rose'
            ? 'bg-rose-500 border-rose-500 text-white'
            : 'bg-brand-600 border-brand-600 text-white'
          : 'bg-white border-ink-300',
      )}>
        {checked && (
          <svg viewBox="0 0 16 16" fill="none" className="w-3 h-3">
            <path d="M3 8.5l3.5 3L13 5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-ink-900">
          <Icon className="w-3.5 h-3.5" /> {title}
        </div>
        <p className="text-xs text-ink-500 mt-0.5 leading-relaxed">{description}</p>
      </div>
    </button>
  )
}

/**
 * Formulario para agregar/editar un tutor. Inline (no modal).
 */
export default function TutorForm({ patientId, tutor = null, onSaved, onCancel }) {
  const isEdit = Boolean(tutor?.id)
  const [data, setData] = useState({
    name: tutor?.name || '',
    relationship_label: tutor?.relationship_label || 'Madre',
    email: tutor?.email || '',
    phone: tutor?.phone || '',
    rut: tutor?.rut || '',
    is_legal_guardian: tutor?.is_legal_guardian || false,
    notify_on_crisis: tutor?.notify_on_crisis ?? true,
    notify_on_appointments: tutor?.notify_on_appointments || false,
    can_view_full_profile: tutor?.can_view_full_profile ?? true,
    notes: tutor?.notes || '',
  })
  const [saving, setSaving] = useState(false)

  function update(k, v) { setData((d) => ({ ...d, [k]: v })) }

  async function submit() {
    if (!data.name.trim()) {
      toast.error('Ponele el nombre del tutor')
      return
    }
    if (!data.email && !data.phone) {
      toast.error('Necesitamos al menos un email o teléfono para contactarlo')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...data,
        name: data.name.trim(),
        email: data.email.trim().toLowerCase() || null,
        phone: data.phone.trim() || null,
        rut: data.rut.trim() || null,
        notes: data.notes.trim(),
      }
      if (isEdit) {
        await tutorsApi.update(tutor.id, payload)
        toast.success('Tutor actualizado')
      } else {
        await tutorsApi.add(patientId, payload)
        toast.success('Tutor agregado')
      }
      onSaved?.()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-brand-200 bg-brand-50/30 p-5 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold inline-flex items-center gap-2 text-brand-800">
          <Shield className="w-4 h-4" /> {isEdit ? 'Editar tutor' : 'Nuevo tutor'}
        </h4>
        <button onClick={onCancel} className="text-ink-500 hover:text-ink-900 p-1" aria-label="Cerrar">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <Label>Nombre completo *</Label>
          <Input
            value={data.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="Ej: Ana Pérez"
            maxLength={200}
            autoFocus
          />
        </div>
        <div>
          <Label>Relación *</Label>
          <select
            value={data.relationship_label}
            onChange={(e) => update('relationship_label', e.target.value)}
            className="w-full h-11 rounded-xl border border-ink-200 bg-white px-3 text-sm"
          >
            {RELATIONSHIP_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
        <div>
          <Label>RUT (opcional)</Label>
          <Input
            value={data.rut}
            onChange={(e) => update('rut', e.target.value)}
            placeholder="11.111.111-1"
            maxLength={20}
          />
        </div>
        <div>
          <Label>Email *</Label>
          <Input
            type="email"
            value={data.email}
            onChange={(e) => update('email', e.target.value)}
            placeholder="tutor@ejemplo.com"
          />
          <p className="text-[11px] text-ink-500 mt-1">
            Si tiene cuenta en Calmar (tipo "tutor"), se vincula automáticamente.
          </p>
        </div>
        <div>
          <Label>Teléfono *</Label>
          <Input
            type="tel"
            value={data.phone}
            onChange={(e) => update('phone', e.target.value)}
            placeholder="+56 9 1234 5678"
            maxLength={50}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-[11px] uppercase tracking-wider font-semibold text-brand-700">
          Permisos y notificaciones
        </div>
        <ToggleRow
          checked={data.is_legal_guardian}
          onChange={(v) => update('is_legal_guardian', v)}
          icon={Shield}
          title="Tutor legal"
          description="Requerido si el paciente es menor de edad. Permite operar legalmente en su nombre."
          color="rose"
        />
        <ToggleRow
          checked={data.notify_on_crisis}
          onChange={(v) => update('notify_on_crisis', v)}
          icon={AlertTriangle}
          title="Alertar en crisis"
          description="Recibe email/SMS automáticamente si el paciente registra un estado emocional muy bajo (1-2/10)."
          color="rose"
        />
        <ToggleRow
          checked={data.notify_on_appointments}
          onChange={(v) => update('notify_on_appointments', v)}
          icon={Bell}
          title="Notificar de citas"
          description="Recibe copia de recordatorios y confirmaciones de cita (recomendado para menores de edad)."
        />
        <ToggleRow
          checked={data.can_view_full_profile}
          onChange={(v) => update('can_view_full_profile', v)}
          icon={Eye}
          title="Acceso completo al perfil"
          description="Si tiene cuenta vinculada, puede ver toda la ficha del paciente (citas, diario, tareas)."
        />
      </div>

      <div>
        <Label>Notas (opcional)</Label>
        <textarea
          value={data.notes}
          onChange={(e) => update('notes', e.target.value)}
          rows={2}
          maxLength={1000}
          placeholder="Información adicional (horarios para contactarlo, contexto familiar, etc.)"
          className="w-full rounded-xl border border-ink-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-400 resize-none"
        />
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancelar</Button>
        <Button size="sm" onClick={submit} disabled={saving || !data.name.trim()}>
          <Save className="w-3.5 h-3.5" />
          {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Agregar tutor'}
        </Button>
      </div>
    </motion.div>
  )
}
