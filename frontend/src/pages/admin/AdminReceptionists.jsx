import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Plus, ConciergeBell } from 'lucide-react'
import { adminApi } from '../../services/api'
import { Card, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input, Label } from '../../components/ui/Input'
import { Avatar } from '../../components/ui/Avatar'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'
import { fadeInUp } from '../../lib/motion'

const empty = {
  email: '', password: '', first_name: '', last_name: '', phone: '', rut: '',
}

export default function AdminReceptionists() {
  const [receptionists, setReceptionists] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState(empty)

  const load = () => {
    setLoading(true)
    adminApi.listUsers({ role: 'receptionist' })
      .then((r) => setReceptionists(r.data))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await adminApi.createReceptionist({
        ...form,
        rut: form.rut || null,
        phone: form.phone || null,
      })
      toast.success('Recepcionista creada')
      setForm(empty)
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al crear recepcionista')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <motion.div {...fadeInUp} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Recepcionistas</h1>
        <p className="text-sm text-ink-500 mt-1">Crea cuentas de mostrador con acceso limitado a citas y pacientes.</p>
      </div>

      <div className="grid lg:grid-cols-[1fr_1.4fr] gap-6">
        <Card className="p-6">
          <CardHeader className="p-0 pb-5">
            <CardTitle>Nueva recepcionista</CardTitle>
            <CardDescription>Podrá agendar citas a nombre de pacientes y registrar pacientes nuevos en mostrador.</CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nombre</Label><Input required value={form.first_name} onChange={set('first_name')} /></div>
              <div><Label>Apellido</Label><Input required value={form.last_name} onChange={set('last_name')} /></div>
            </div>
            <div><Label>Email</Label><Input type="email" required value={form.email} onChange={set('email')} /></div>
            <div><Label>Contraseña inicial</Label><Input type="password" required minLength={6} value={form.password} onChange={set('password')} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>RUT</Label><Input placeholder="12345678-9" value={form.rut} onChange={set('rut')} /></div>
              <div><Label>Teléfono</Label><Input placeholder="+56 9..." value={form.phone} onChange={set('phone')} /></div>
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              <Plus className="w-4 h-4" /> {submitting ? 'Creando...' : 'Crear recepcionista'}
            </Button>
          </form>
        </Card>

        <Card className="p-6">
          <CardHeader className="p-0 pb-5">
            <CardTitle>Equipo de mostrador</CardTitle>
            <CardDescription>{receptionists.length} {receptionists.length === 1 ? 'persona registrada' : 'personas registradas'}.</CardDescription>
          </CardHeader>

          {loading ? (
            <div className="py-10 flex justify-center"><Spinner /></div>
          ) : receptionists.length === 0 ? (
            <EmptyState icon={ConciergeBell} title="Sin recepcionistas" description="Crea la primera con el formulario." />
          ) : (
            <ul className="divide-y divide-ink-100">
              {receptionists.map((u) => (
                <li key={u.id} className="py-3 first:pt-0 last:pb-0 flex items-center gap-3">
                  <Avatar name={`${u.first_name} ${u.last_name}`} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-ink-900 text-sm truncate">{u.first_name} {u.last_name}</div>
                    <div className="text-xs text-ink-500 truncate">{u.email}</div>
                  </div>
                  <span className={`text-xs font-semibold ${u.is_active ? 'text-wellness-700' : 'text-red-700'}`}>
                    {u.is_active ? '● Activa' : '○ Inactiva'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </motion.div>
  )
}
