import React, { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Plus, Stethoscope, Search, Filter } from 'lucide-react'
import { adminApi, doctorsApi, specialtiesApi, clinicsApi } from '../../services/api'
import { Card, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input, Label, Textarea } from '../../components/ui/Input'
import { Avatar } from '../../components/ui/Avatar'
import { Badge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'
import { fadeInUp } from '../../lib/motion'
import { formatCLP } from '../../lib/format'

const empty = {
  email: '', password: '', first_name: '', last_name: '',
  phone: '', rut: '',
  specialty_id: '', clinic_id: '',
  license_number: '', consultation_duration: 30,
  consultation_price: 0,
  bio: '',
}

export default function AdminDoctors() {
  const [doctors, setDoctors] = useState([])
  const [specialties, setSpecialties] = useState([])
  const [clinics, setClinics] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState(empty)
  // Filtros de la lista
  const [q, setQ] = useState('')
  const [specialtyFilter, setSpecialtyFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')  // all | active | inactive

  const loadDoctors = () => doctorsApi.list().then((r) => setDoctors(r.data))

  const filteredDoctors = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return doctors.filter((d) => {
      if (specialtyFilter && d.specialty?.id !== parseInt(specialtyFilter)) return false
      if (statusFilter === 'active'   && d.is_active === false) return false
      if (statusFilter === 'inactive' && d.is_active !== false) return false
      if (ql) {
        const haystack = `${d.user.first_name} ${d.user.last_name} ${d.user.email} ${d.specialty?.name || ''} ${d.license_number || ''}`.toLowerCase()
        if (!haystack.includes(ql)) return false
      }
      return true
    })
  }, [doctors, q, specialtyFilter, statusFilter])

  useEffect(() => {
    Promise.all([
      loadDoctors(),
      specialtiesApi.list().then((r) => setSpecialties(r.data)),
      clinicsApi.list().then((r) => setClinics(r.data)),
    ]).finally(() => setLoading(false))
  }, [])

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const payload = {
        ...form,
        specialty_id: parseInt(form.specialty_id),
        clinic_id: form.clinic_id ? parseInt(form.clinic_id) : null,
        consultation_duration: parseInt(form.consultation_duration) || 30,
        consultation_price: parseInt(form.consultation_price) || 0,
        rut: form.rut || null,
        phone: form.phone || null,
        bio: form.bio || null,
      }
      await adminApi.createDoctor(payload)
      toast.success('Psicólogo/a creado/a')
      setForm(empty)
      loadDoctors()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al crear psicólogo/a')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <motion.div {...fadeInUp} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Psicólogos/as</h1>
        <p className="text-sm text-ink-500 mt-1">Crea cuentas de profesionales y gestiona el plantel.</p>
      </div>

      <div className="grid lg:grid-cols-[1fr_1.4fr] gap-6">
        {/* Form */}
        <Card className="p-6">
          <CardHeader className="p-0 pb-5">
            <CardTitle>Nuevo/a psicólogo/a</CardTitle>
            <CardDescription>Crea usuario y perfil profesional en una sola operación.</CardDescription>
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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Especialidad</Label>
                <select required value={form.specialty_id} onChange={set('specialty_id')} className="w-full h-11 rounded-xl border border-ink-200 bg-white px-3 text-sm hover:border-ink-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 focus:outline-none">
                  <option value="">— seleccionar —</option>
                  {specialties.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <Label>Clínica</Label>
                <select value={form.clinic_id} onChange={set('clinic_id')} className="w-full h-11 rounded-xl border border-ink-200 bg-white px-3 text-sm hover:border-ink-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 focus:outline-none">
                  <option value="">— sin asignar —</option>
                  {clinics.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><Label>N° licencia</Label><Input required value={form.license_number} onChange={set('license_number')} /></div>
              <div><Label>Duración (min)</Label><Input type="number" min={5} max={240} step={5} value={form.consultation_duration} onChange={set('consultation_duration')} /></div>
            </div>

            <div>
              <Label>Valor consulta (CLP) <span className="text-ink-400 font-normal">— 0 = gratuita</span></Label>
              <Input type="number" min={0} step={500} value={form.consultation_price} onChange={set('consultation_price')} placeholder="25000" />
            </div>

            <div><Label>Bio (opcional)</Label><Textarea rows={2} value={form.bio} onChange={set('bio')} /></div>

            <Button type="submit" className="w-full" disabled={submitting}>
              <Plus className="w-4 h-4" /> {submitting ? 'Creando...' : 'Crear psicólogo/a'}
            </Button>
          </form>
        </Card>

        {/* List */}
        <Card className="p-6">
          <CardHeader className="p-0 pb-5">
            <CardTitle>Plantel actual</CardTitle>
            <CardDescription>
              {filteredDoctors.length === doctors.length
                ? `${doctors.length} ${doctors.length === 1 ? 'profesional registrado' : 'profesionales registrados'}.`
                : `Mostrando ${filteredDoctors.length} de ${doctors.length}.`}
            </CardDescription>
          </CardHeader>

          {/* Filtros */}
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="w-3.5 h-3.5 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por nombre, email, licencia…"
                className="w-full h-9 rounded-xl border border-ink-200 pl-8 pr-3 text-xs bg-white focus:outline-none focus:border-brand-400"
              />
            </div>
            <div className="inline-flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-ink-400" />
              <select
                value={specialtyFilter}
                onChange={(e) => setSpecialtyFilter(e.target.value)}
                className="h-9 rounded-xl border border-ink-200 bg-white px-2 text-xs"
              >
                <option value="">Todas las especialidades</option>
                {specialties.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 rounded-xl border border-ink-200 bg-white px-2 text-xs"
            >
              <option value="all">Todos los estados</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </select>
          </div>

          {loading ? (
            <div className="py-10 flex justify-center"><Spinner /></div>
          ) : filteredDoctors.length === 0 ? (
            <EmptyState
              icon={Stethoscope}
              title={doctors.length === 0 ? "Sin psicólogos/as" : "Sin resultados"}
              description={doctors.length === 0 ? "Crea el primero usando el formulario." : "Probá ajustar la búsqueda o los filtros."}
            />
          ) : (
            <ul className="divide-y divide-ink-100">
              {filteredDoctors.map((d) => (
                <li key={d.id} className="py-3 first:pt-0 last:pb-0 flex items-center gap-3">
                  <Avatar name={`${d.user.first_name} ${d.user.last_name}`} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-ink-900 text-sm truncate">Ps. {d.user.first_name} {d.user.last_name}</div>
                    <div className="text-xs text-ink-500 truncate">{d.user.email}</div>
                  </div>
                  <Badge tone="brand">{d.specialty.name}</Badge>
                  <div className="text-right shrink-0 hidden sm:block">
                    <div className="text-xs font-semibold text-ink-900 tabular-nums">
                      {d.consultation_price > 0 ? formatCLP(d.consultation_price) : '—'}
                    </div>
                    <div className="text-[10px] text-ink-400 tabular-nums">{d.consultation_duration} min</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </motion.div>
  )
}
