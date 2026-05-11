import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Save, User, Mail, Phone, Stethoscope, DollarSign, Clock } from 'lucide-react'
import { authApi, doctorsApi } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { Card, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input, Label, Textarea } from '../../components/ui/Input'
import { Avatar } from '../../components/ui/Avatar'
import { Badge } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Spinner'
import { fadeInUp } from '../../lib/motion'

export default function DoctorOwnProfile() {
  const { user, refreshUser } = useAuth()
  const [doctor, setDoctor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [savingPersonal, setSavingPersonal] = useState(false)
  const [savingProfessional, setSavingProfessional] = useState(false)

  const [personal, setPersonal] = useState({
    first_name: user?.first_name || '',
    last_name:  user?.last_name  || '',
    phone:      user?.phone      || '',
  })
  const [professional, setProfessional] = useState({
    bio: '',
    consultation_duration: 30,
    consultation_price: 0,
  })

  useEffect(() => {
    doctorsApi.me()
      .then((r) => {
        setDoctor(r.data)
        setProfessional({
          bio: r.data.bio || '',
          consultation_duration: r.data.consultation_duration,
          consultation_price: r.data.consultation_price || 0,
        })
      })
      .catch(() => {
        // Si no tiene perfil de médico, no mostramos error.
      })
      .finally(() => setLoading(false))
  }, [])

  const handleSavePersonal = async (e) => {
    e.preventDefault()
    setSavingPersonal(true)
    try {
      const { data } = await authApi.updateMe({
        first_name: personal.first_name,
        last_name: personal.last_name,
        phone: personal.phone || null,
      })
      localStorage.setItem('user', JSON.stringify(data))
      refreshUser?.(data)
      toast.success('Datos personales actualizados')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al guardar')
    } finally {
      setSavingPersonal(false)
    }
  }

  const handleSaveProfessional = async (e) => {
    e.preventDefault()
    if (!doctor) return
    setSavingProfessional(true)
    try {
      const { data } = await doctorsApi.update(doctor.id, {
        bio: professional.bio || null,
        consultation_duration: parseInt(professional.consultation_duration) || 30,
        consultation_price: parseInt(professional.consultation_price) || 0,
      })
      setDoctor(data)
      toast.success('Perfil profesional actualizado')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al guardar')
    } finally {
      setSavingProfessional(false)
    }
  }

  if (loading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>

  return (
    <motion.div {...fadeInUp} className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mi perfil</h1>
        <p className="text-sm text-ink-500 mt-1">Datos personales y configuración profesional.</p>
      </div>

      {/* Identity */}
      {doctor && (
        <Card className="p-6 sm:p-7">
          <div className="flex items-center gap-4">
            <Avatar name={`${user?.first_name || ''} ${user?.last_name || ''}`} size="xl" />
            <div className="flex-1">
              <div className="text-lg font-semibold text-ink-900">Dr(a). {user?.first_name} {user?.last_name}</div>
              <div className="text-sm text-brand-600 font-medium flex items-center gap-1.5">
                <Stethoscope className="w-3.5 h-3.5" /> {doctor.specialty.name}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Badge tone="outline">Lic. {doctor.license_number}</Badge>
                {doctor.is_active && <Badge tone="success" dot>Activo</Badge>}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Personal */}
      <Card className="p-6 sm:p-7">
        <CardHeader className="p-0 pb-5">
          <CardTitle>Datos personales</CardTitle>
          <CardDescription>Información de contacto.</CardDescription>
        </CardHeader>

        <form onSubmit={handleSavePersonal} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Nombre</Label>
              <Input required leftIcon={User} value={personal.first_name} onChange={(e) => setPersonal({ ...personal, first_name: e.target.value })} />
            </div>
            <div>
              <Label>Apellido</Label>
              <Input required value={personal.last_name} onChange={(e) => setPersonal({ ...personal, last_name: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Email</Label>
            <Input leftIcon={Mail} value={user?.email || ''} disabled />
          </div>
          <div>
            <Label>Teléfono</Label>
            <Input leftIcon={Phone} placeholder="+56 9..." value={personal.phone} onChange={(e) => setPersonal({ ...personal, phone: e.target.value })} />
          </div>
          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={savingPersonal}>
              <Save className="w-4 h-4" /> {savingPersonal ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </form>
      </Card>

      {/* Profesional */}
      {doctor && (
        <Card className="p-6 sm:p-7">
          <CardHeader className="p-0 pb-5">
            <CardTitle>Perfil profesional</CardTitle>
            <CardDescription>Lo que ven los pacientes al buscarte.</CardDescription>
          </CardHeader>

          <form onSubmit={handleSaveProfessional} className="space-y-4">
            <div>
              <Label>Bio</Label>
              <Textarea
                rows={4}
                placeholder="Cuéntale a tus pacientes sobre tu experiencia, formación y enfoque clínico..."
                value={professional.bio}
                onChange={(e) => setProfessional({ ...professional, bio: e.target.value })}
                maxLength={500}
              />
              <div className="text-[11px] text-ink-400 mt-1 text-right tabular-nums">{professional.bio.length}/500</div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Duración consulta (min)</Label>
                <Input
                  type="number" min={5} max={240} step={5}
                  leftIcon={Clock}
                  value={professional.consultation_duration}
                  onChange={(e) => setProfessional({ ...professional, consultation_duration: e.target.value })}
                />
              </div>
              <div>
                <Label>Valor consulta (CLP)</Label>
                <Input
                  type="number" min={0} step={500}
                  leftIcon={DollarSign}
                  value={professional.consultation_price}
                  onChange={(e) => setProfessional({ ...professional, consultation_price: e.target.value })}
                />
                <div className="text-[11px] text-ink-400 mt-1">0 = consulta gratuita</div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={savingProfessional}>
                <Save className="w-4 h-4" /> {savingProfessional ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </form>
        </Card>
      )}
    </motion.div>
  )
}
