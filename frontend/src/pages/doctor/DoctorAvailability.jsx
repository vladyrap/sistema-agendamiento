import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Plus, Clock, Plane, Trash2 } from 'lucide-react'
import { doctorsApi, doctorBlocksApi } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { Card, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input, Label } from '../../components/ui/Input'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'
import { fadeInUp } from '../../lib/motion'

const DAYS = [
  { id: 0, label: 'Lunes',     short: 'Lun' },
  { id: 1, label: 'Martes',    short: 'Mar' },
  { id: 2, label: 'Miércoles', short: 'Mié' },
  { id: 3, label: 'Jueves',    short: 'Jue' },
  { id: 4, label: 'Viernes',   short: 'Vie' },
  { id: 5, label: 'Sábado',    short: 'Sáb' },
  { id: 6, label: 'Domingo',   short: 'Dom' },
]

export default function DoctorAvailability() {
  const { user } = useAuth()
  const [doctorId, setDoctorId] = useState(null)
  const [availabilities, setAvailabilities] = useState([])
  const [blocks, setBlocks] = useState([])
  const [form, setForm] = useState({ day_of_week: 0, start_time: '09:00', end_time: '18:00' })
  const [blockForm, setBlockForm] = useState({ start_date: '', end_date: '', reason: '' })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submittingBlock, setSubmittingBlock] = useState(false)

  useEffect(() => {
    doctorsApi.me()
      .then((r) => {
        setDoctorId(r.data.id)
        return Promise.all([
          doctorsApi.getAvailability(r.data.id).then((a) => setAvailabilities(a.data)),
          doctorBlocksApi.list().then((b) => setBlocks(b.data)).catch(() => setBlocks([])),
        ])
      })
      .catch((err) => {
        if (err.response?.status !== 404) toast.error('Error cargando perfil de médico')
      })
      .finally(() => setLoading(false))
  }, [])

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!doctorId) return toast.error('Perfil de médico no encontrado')
    setSubmitting(true)
    try {
      const { data } = await doctorsApi.setAvailability(doctorId, {
        ...form,
        start_time: form.start_time + ':00',
        end_time: form.end_time + ':00',
      })
      setAvailabilities((prev) => [...prev, data])
      toast.success('Disponibilidad agregada')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAddBlock = async (e) => {
    e.preventDefault()
    if (!blockForm.start_date || !blockForm.end_date) {
      toast.error('Indica las fechas')
      return
    }
    setSubmittingBlock(true)
    try {
      const { data } = await doctorBlocksApi.create({
        start_date: blockForm.start_date,
        end_date: blockForm.end_date,
        reason: blockForm.reason || null,
      })
      setBlocks((prev) => [...prev, data].sort((a, b) => a.start_date.localeCompare(b.start_date)))
      setBlockForm({ start_date: '', end_date: '', reason: '' })
      toast.success('Ausencia registrada')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error')
    } finally {
      setSubmittingBlock(false)
    }
  }

  const handleRemoveBlock = async (id) => {
    if (!window.confirm('¿Eliminar esta ausencia? Las fechas vuelven a estar disponibles.')) return
    try {
      await doctorBlocksApi.remove(id)
      setBlocks((prev) => prev.filter((b) => b.id !== id))
      toast.success('Ausencia eliminada')
    } catch {
      toast.error('Error al eliminar')
    }
  }

  return (
    <motion.div {...fadeInUp} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Disponibilidad</h1>
        <p className="text-sm text-ink-500 mt-1">Días, horarios y ausencias.</p>
      </div>

      <div className="grid lg:grid-cols-[1fr_1.4fr] gap-6">
        <Card className="p-6">
          <CardHeader className="p-0 pb-5">
            <CardTitle>Agregar bloque horario</CardTitle>
            <CardDescription>Selecciona el día y rango de atención.</CardDescription>
          </CardHeader>

          <form onSubmit={handleAdd} className="space-y-5">
            <div>
              <Label>Día de la semana</Label>
              <div className="grid grid-cols-7 gap-1">
                {DAYS.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setForm({ ...form, day_of_week: d.id })}
                    className={`h-11 rounded-lg text-xs font-semibold border transition-all ${
                      form.day_of_week === d.id
                        ? 'bg-brand-600 text-white border-brand-600 shadow-brand-sm'
                        : 'bg-white text-ink-600 border-ink-200 hover:border-ink-300'
                    }`}
                  >
                    {d.short}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Desde</Label>
                <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
              </div>
              <div>
                <Label>Hasta</Label>
                <Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              <Plus className="w-4 h-4" /> {submitting ? 'Agregando...' : 'Agregar bloque'}
            </Button>
          </form>
        </Card>

        <Card className="p-6">
          <CardHeader className="p-0 pb-5">
            <CardTitle>Bloques actuales</CardTitle>
            <CardDescription>Tu horario semanal de atención.</CardDescription>
          </CardHeader>

          {loading ? (
            <div className="py-10 flex justify-center"><Spinner /></div>
          ) : availabilities.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="Sin horarios configurados"
              description="Agrega tu primer bloque para empezar a recibir reservas."
            />
          ) : (
            <ul className="divide-y divide-ink-100">
              {DAYS.map((d) => {
                const slots = availabilities.filter((a) => a.day_of_week === d.id)
                if (slots.length === 0) return null
                return (
                  <li key={d.id} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between">
                    <span className="text-sm font-semibold text-ink-900">{d.label}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {slots.map((s) => (
                        <span key={s.id} className="px-2.5 py-1 rounded-lg bg-brand-50 text-brand-700 text-xs font-semibold tabular-nums border border-brand-100">
                          {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}
                        </span>
                      ))}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* Ausencias */}
      <div className="grid lg:grid-cols-[1fr_1.4fr] gap-6">
        <Card className="p-6">
          <CardHeader className="p-0 pb-5">
            <CardTitle className="inline-flex items-center gap-2"><Plane className="w-4 h-4 text-brand-600" /> Programar ausencia</CardTitle>
            <CardDescription>Vacaciones, congresos, días libres. Durante esas fechas no recibes reservas.</CardDescription>
          </CardHeader>
          <form onSubmit={handleAddBlock} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Desde</Label>
                <Input type="date" required value={blockForm.start_date} onChange={(e) => setBlockForm({ ...blockForm, start_date: e.target.value })} />
              </div>
              <div>
                <Label>Hasta</Label>
                <Input type="date" required value={blockForm.end_date} onChange={(e) => setBlockForm({ ...blockForm, end_date: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Motivo (opcional)</Label>
              <Input placeholder="Vacaciones, congreso..." value={blockForm.reason} onChange={(e) => setBlockForm({ ...blockForm, reason: e.target.value })} />
            </div>
            <Button type="submit" className="w-full" disabled={submittingBlock}>
              <Plus className="w-4 h-4" /> {submittingBlock ? 'Registrando...' : 'Registrar ausencia'}
            </Button>
          </form>
        </Card>

        <Card className="p-6">
          <CardHeader className="p-0 pb-5">
            <CardTitle>Ausencias programadas</CardTitle>
            <CardDescription>{blocks.length} {blocks.length === 1 ? 'período' : 'períodos'} bloqueados.</CardDescription>
          </CardHeader>
          {loading ? (
            <div className="py-10 flex justify-center"><Spinner /></div>
          ) : blocks.length === 0 ? (
            <EmptyState icon={Plane} title="Sin ausencias programadas" description="Cuando agregues una, aparecerá aquí." />
          ) : (
            <ul className="divide-y divide-ink-100">
              {blocks.map((b) => (
                <li key={b.id} className="py-3.5 first:pt-0 last:pb-0 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-ink-900 text-sm tabular-nums">
                      {format(parseISO(b.start_date), "d MMM", { locale: es })} – {format(parseISO(b.end_date), "d MMM yyyy", { locale: es })}
                    </div>
                    {b.reason && <div className="text-xs text-ink-500 truncate">{b.reason}</div>}
                  </div>
                  <button
                    onClick={() => handleRemoveBlock(b.id)}
                    title="Eliminar"
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
