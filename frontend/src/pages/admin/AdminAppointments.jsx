import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarDays, Search } from 'lucide-react'
import { adminApi } from '../../services/api'
import { Card } from '../../components/ui/Card'
import { Avatar } from '../../components/ui/Avatar'
import { StatusBadge } from '../../components/ui/Badge'
import { Input } from '../../components/ui/Input'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'
import ExportButton from '../../components/ui/ExportButton'
import { cn } from '../../lib/cn'
import { fadeInUp } from '../../lib/motion'

const tabs = [
  { id: '',          label: 'Todas' },
  { id: 'scheduled', label: 'Agendadas' },
  { id: 'confirmed', label: 'Confirmadas' },
  { id: 'completed', label: 'Completadas' },
  { id: 'cancelled', label: 'Canceladas' },
]

export default function AdminAppointments() {
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    setLoading(true)
    adminApi.listAppointments(filter ? { status: filter } : {})
      .then((r) => setAppointments(r.data))
      .finally(() => setLoading(false))
  }, [filter])

  const filtered = appointments.filter((a) =>
    !query.trim() ||
    `${a.patient} ${a.doctor}`.toLowerCase().includes(query.toLowerCase()),
  )

  return (
    <motion.div {...fadeInUp} className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Citas del sistema</h1>
          <p className="text-sm text-ink-500 mt-1">Mostrando las últimas 200 citas registradas.</p>
        </div>
        <ExportButton endpoint="/exports/appointments" filename="citas.xlsx" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input placeholder="Buscar por paciente o psicólogo/a..." leftIcon={Search} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setFilter(t.id)}
              className={cn(
                'px-3.5 h-11 rounded-xl text-xs font-semibold border whitespace-nowrap transition-all',
                filter === t.id
                  ? 'bg-ink-900 text-white border-ink-900'
                  : 'bg-white text-ink-600 border-ink-200 hover:border-ink-300',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="py-16 flex justify-center"><Spinner size="lg" /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={CalendarDays} title="No hay citas" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/60">
                  {['#', 'Paciente', 'Psicólogo/a', 'Fecha', 'Hora', 'Estado'].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-[10px] uppercase tracking-wider text-ink-500 font-bold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id} className="border-b border-ink-100 last:border-b-0 hover:bg-ink-50/40 transition-colors">
                    <td className="px-5 py-3.5 text-xs text-ink-400 font-mono">#{a.id}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={a.patient} size="xs" />
                        <span className="font-medium text-ink-900">{a.patient}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={a.doctor} size="xs" />
                        <span className="font-medium text-ink-900">{a.doctor}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-ink-600 tabular-nums">
                      {format(parseISO(a.date), "d MMM yyyy", { locale: es })}
                    </td>
                    <td className="px-5 py-3.5 text-ink-600 tabular-nums">{a.start_time.slice(0, 5)}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={a.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </motion.div>
  )
}
