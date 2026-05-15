import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Save, User, Mail, Phone, IdCard, HeartPulse, ShieldAlert, Paperclip } from 'lucide-react'
import { authApi, medicalRecordApi } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { Card, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input, Label, Textarea } from '../../components/ui/Input'
import { Avatar } from '../../components/ui/Avatar'
import { Spinner } from '../../components/ui/Spinner'
import { AttachmentsSection } from '../../components/medical/AttachmentsSection'
import TwoFactorSection from '../../components/TwoFactorSection'
import { fadeInUp } from '../../lib/motion'

const emptyMR = {
  blood_type: '',
  allergies: '',
  chronic_conditions: '',
  medications: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  notes: '',
}

export default function PatientProfile() {
  const { user, refreshUser } = useAuth()
  const [form, setForm] = useState({
    first_name:        user?.first_name || '',
    last_name:         user?.last_name  || '',
    phone:             user?.phone      || '',
    birth_date:        user?.birth_date || '',
    address:           user?.address    || '',
    health_insurance:  user?.health_insurance || '',
  })
  const [saving, setSaving] = useState(false)

  const [medical, setMedical] = useState(emptyMR)
  const [medLoading, setMedLoading] = useState(true)
  const [medSaving, setMedSaving] = useState(false)

  useEffect(() => {
    medicalRecordApi.mine()
      .then((r) => setMedical({ ...emptyMR, ...Object.fromEntries(Object.entries(r.data).filter(([_, v]) => v != null)) }))
      .catch(() => {})
      .finally(() => setMedLoading(false))
  }, [])

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value })
  const setMed = (field) => (e) => setMedical({ ...medical, [field]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { data } = await authApi.updateMe({
        first_name:       form.first_name,
        last_name:        form.last_name,
        phone:            form.phone || null,
        birth_date:       form.birth_date || null,
        address:          form.address || null,
        health_insurance: form.health_insurance || null,
      })
      localStorage.setItem('user', JSON.stringify(data))
      refreshUser?.(data)
      toast.success('Perfil actualizado')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveMedical = async (e) => {
    e.preventDefault()
    setMedSaving(true)
    try {
      const payload = Object.fromEntries(
        Object.entries(medical).map(([k, v]) => [k, v?.trim() ? v.trim() : null]),
      )
      await medicalRecordApi.updateMine(payload)
      toast.success('Ficha clínica actualizada')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al guardar')
    } finally {
      setMedSaving(false)
    }
  }

  return (
    <motion.div {...fadeInUp} className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mi perfil</h1>
        <p className="text-sm text-ink-500 mt-1">Tus datos personales y ficha clínica.</p>
      </div>

      {/* Identity */}
      <Card className="p-6 sm:p-7">
        <div className="flex items-center gap-4">
          <Avatar name={`${user?.first_name || ''} ${user?.last_name || ''}`} size="xl" />
          <div>
            <div className="text-lg font-semibold text-ink-900">{user?.first_name} {user?.last_name}</div>
            <div className="text-sm text-ink-500">{user?.email}</div>
            <div className="text-xs text-ink-400 mt-1">Cuenta de paciente</div>
          </div>
        </div>
      </Card>

      <Card className="p-6 sm:p-7">
        <CardHeader className="p-0 pb-5">
          <CardTitle>Datos personales</CardTitle>
          <CardDescription>Mantén tu información actualizada para no perder citas.</CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Nombre</Label>
              <Input required leftIcon={User} value={form.first_name} onChange={set('first_name')} />
            </div>
            <div>
              <Label>Apellido</Label>
              <Input required value={form.last_name} onChange={set('last_name')} />
            </div>
          </div>

          <div>
            <Label>Email</Label>
            <Input leftIcon={Mail} value={user?.email || ''} disabled />
            <div className="text-[11px] text-ink-400 mt-1">El email no puede cambiarse desde aquí.</div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Teléfono</Label>
              <Input leftIcon={Phone} placeholder="+56 9..." value={form.phone} onChange={set('phone')} />
            </div>
            <div>
              <Label>RUT</Label>
              <Input leftIcon={IdCard} value={user?.rut || ''} disabled />
              <div className="text-[11px] text-ink-400 mt-1">Solo se modifica desde el panel admin.</div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Fecha de nacimiento</Label>
              <Input type="date" value={form.birth_date || ''} onChange={set('birth_date')} />
            </div>
            <div>
              <Label>Previsión / Seguro</Label>
              <Input placeholder="Fonasa B, Isapre Banmédica..." value={form.health_insurance} onChange={set('health_insurance')} />
            </div>
          </div>

          <div>
            <Label>Dirección</Label>
            <Input placeholder="Calle, número, comuna..." value={form.address} onChange={set('address')} />
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={saving}>
              <Save className="w-4 h-4" /> {saving ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </div>
        </form>
      </Card>

      {/* Ficha clínica */}
      <Card className="p-6 sm:p-7">
        <CardHeader className="p-0 pb-5">
          <CardTitle className="flex items-center gap-2"><HeartPulse className="w-4 h-4 text-brand-600" /> Ficha clínica</CardTitle>
          <CardDescription>Información que el psicólogo/a verá antes de tu consulta. Completar es opcional pero muy útil.</CardDescription>
        </CardHeader>

        {medLoading ? (
          <div className="py-8 flex justify-center"><Spinner /></div>
        ) : (
          <form onSubmit={handleSaveMedical} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Grupo sanguíneo</Label>
                <Input placeholder="O+ / A- / etc." value={medical.blood_type} onChange={setMed('blood_type')} />
              </div>
            </div>

            <div>
              <Label>Alergias</Label>
              <Textarea rows={2} placeholder="Penicilina, mariscos, polen..." value={medical.allergies} onChange={setMed('allergies')} />
            </div>

            <div>
              <Label>Condiciones crónicas</Label>
              <Textarea rows={2} placeholder="Hipertensión, diabetes tipo 2..." value={medical.chronic_conditions} onChange={setMed('chronic_conditions')} />
            </div>

            <div>
              <Label>Medicamentos en uso</Label>
              <Textarea rows={2} placeholder="Losartán 50mg c/24h, Metformina 850mg..." value={medical.medications} onChange={setMed('medications')} />
            </div>

            <div className="rounded-xl border border-ink-100 p-4 bg-ink-50/40 space-y-3">
              <div className="text-xs font-semibold text-ink-700 inline-flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600" /> Contacto de emergencia
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label>Nombre</Label>
                  <Input value={medical.emergency_contact_name} onChange={setMed('emergency_contact_name')} />
                </div>
                <div>
                  <Label>Teléfono</Label>
                  <Input placeholder="+56 9..." value={medical.emergency_contact_phone} onChange={setMed('emergency_contact_phone')} />
                </div>
              </div>
            </div>

            <div>
              <Label>Notas adicionales</Label>
              <Textarea rows={2} value={medical.notes} onChange={setMed('notes')} />
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={medSaving}>
                <Save className="w-4 h-4" /> {medSaving ? 'Guardando...' : 'Guardar ficha'}
              </Button>
            </div>
          </form>
        )}
      </Card>

      {/* Adjuntos */}
      <Card className="p-6 sm:p-7">
        <CardHeader className="p-0 pb-5">
          <CardTitle className="flex items-center gap-2"><Paperclip className="w-4 h-4 text-brand-600" /> Imágenes y exámenes</CardTitle>
          <CardDescription>Sube radiografías, ecografías, exámenes de laboratorio o recetas. Tu psicólogo/a las verá antes de la consulta.</CardDescription>
        </CardHeader>
        <AttachmentsSection mode="self" />
      </Card>

      {/* Seguridad */}
      <TwoFactorSection />
    </motion.div>
  )
}
