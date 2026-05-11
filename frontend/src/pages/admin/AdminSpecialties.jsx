import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Plus, Tag, Trash2 } from 'lucide-react'
import { specialtiesApi } from '../../services/api'
import { Card, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input, Textarea, Label } from '../../components/ui/Input'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'
import { fadeInUp } from '../../lib/motion'

export default function AdminSpecialties() {
  const [specialties, setSpecialties] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ name: '', description: '' })

  const load = () => {
    setLoading(true)
    specialtiesApi.list().then((r) => setSpecialties(r.data)).finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await specialtiesApi.create(form)
      toast.success('Especialidad creada')
      setForm({ name: '', description: '' })
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeactivate = async (id) => {
    if (!window.confirm('¿Desactivar esta especialidad?')) return
    try {
      await specialtiesApi.remove(id)
      toast.success('Especialidad desactivada')
      load()
    } catch {
      toast.error('Error')
    }
  }

  return (
    <motion.div {...fadeInUp} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Especialidades</h1>
        <p className="text-sm text-ink-500 mt-1">Categorías que los pacientes usan para buscar profesionales.</p>
      </div>

      <div className="grid lg:grid-cols-[1fr_1.4fr] gap-6">
        <Card className="p-6">
          <CardHeader className="p-0 pb-5">
            <CardTitle>Nueva especialidad</CardTitle>
            <CardDescription>Aparecerá en los filtros del buscador.</CardDescription>
          </CardHeader>

          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <Label>Nombre</Label>
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ej. Nutrición" />
            </div>
            <div>
              <Label>Descripción</Label>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Breve descripción visible para los pacientes." />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              <Plus className="w-4 h-4" /> {submitting ? 'Creando...' : 'Crear especialidad'}
            </Button>
          </form>
        </Card>

        <Card className="p-6">
          <CardHeader className="p-0 pb-5">
            <CardTitle>Activas</CardTitle>
            <CardDescription>{specialties.length} {specialties.length === 1 ? 'especialidad' : 'especialidades'}.</CardDescription>
          </CardHeader>

          {loading ? (
            <div className="py-10 flex justify-center"><Spinner /></div>
          ) : specialties.length === 0 ? (
            <EmptyState icon={Tag} title="Sin especialidades" />
          ) : (
            <ul className="divide-y divide-ink-100">
              {specialties.map((s) => (
                <li key={s.id} className="py-3.5 first:pt-0 last:pb-0 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center shrink-0">
                    <Tag className="w-4 h-4 text-brand-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-ink-900 text-sm">{s.name}</div>
                    {s.description && <div className="text-xs text-ink-500 mt-0.5 line-clamp-2">{s.description}</div>}
                  </div>
                  <button
                    onClick={() => handleDeactivate(s.id)}
                    title="Desactivar"
                    className="p-2 rounded-lg text-ink-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </motion.div>
  )
}
