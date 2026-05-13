import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { format, parseISO, differenceInDays } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Users, Search, Heart, ClipboardList, Calendar, Shield, AlertTriangle,
  ChevronRight, Mail, Phone, Filter, ArrowUpDown,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { myPatientsApi } from '../../services/api'
import { Card } from '../../components/ui/Card'
import { Avatar } from '../../components/ui/Avatar'
import { Input } from '../../components/ui/Input'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { fadeInUp } from '../../lib/motion'
import { cn } from '../../lib/cn'

const EMOJI = { 1:'😢', 2:'😞', 3:'😕', 4:'😐', 5:'🙂', 6:'🙂', 7:'😊', 8:'😄', 9:'🤩', 10:'🌟' }

function moodToneClass(s) {
  if (s == null) return 'bg-ink-100 text-ink-600 border-ink-200'
  if (s <= 3) return 'bg-rose-100 text-rose-700 border-rose-200'
  if (s <= 5) return 'bg-amber-100 text-amber-800 border-amber-200'
  if (s <= 7) return 'bg-wellness-100 text-wellness-700 border-wellness-200'
  return 'bg-brand-100 text-brand-700 border-brand-200'
}

const SORTS = {
  name:      { label: 'Nombre',          fn: (a, b) => a.name.localeCompare(b.name) },
  recent:    { label: 'Atendido reciente', fn: (a, b) => (b.last_appointment_date || '').localeCompare(a.last_appointment_date || '') },
  upcoming:  { label: 'Próxima cita',    fn: (a, b) => (a.next_appointment_date || '￿').localeCompare(b.next_appointment_date || '￿') },
  mood:      { label: 'Ánimo (bajo primero)', fn: (a, b) => (a.mood_latest_score ?? 99) - (b.mood_latest_score ?? 99) },
}

const FILTERS = {
  all:     { label: 'Todos',      fn: () => true },
  minor:   { label: 'Menores',    fn: (p) => p.is_minor },
  crisis:  { label: 'Ánimo bajo', fn: (p) => p.mood_latest_score != null && p.mood_latest_score <= 3 },
  pending: { label: 'Con tareas pendientes', fn: (p) => p.pending_homework > 0 },
  no_guardian: { label: 'Sin tutor legal', fn: (p) => p.is_minor && !p.has_legal_guardian },
}

export default function DoctorPatientsList() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('name')
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    myPatientsApi.forDoctor()
      .then((r) => setItems(r.data))
      .catch(() => toast.error('No se pudieron cargar los pacientes'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    let out = items.filter(FILTERS[filter].fn)
    if (ql) {
      out = out.filter((p) =>
        p.name.toLowerCase().includes(ql) ||
        p.email.toLowerCase().includes(ql) ||
        (p.rut || '').toLowerCase().includes(ql)
      )
    }
    out = [...out].sort(SORTS[sort].fn)
    return out
  }, [items, q, filter, sort])

  return (
    <div className="space-y-7">
      <motion.div {...fadeInUp} className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tightest inline-flex items-center gap-2">
            <Users className="w-6 h-6 text-brand-600" />
            Mis pacientes
          </h1>
          <p className="text-ink-500 text-sm mt-1">
            {items.length === 0 ? 'Aún no tienes pacientes atendidos.' : `${items.length} ${items.length === 1 ? 'paciente' : 'pacientes'} en tu cartera.`}
          </p>
        </div>
      </motion.div>

      {/* Búsqueda + filtros + sort */}
      <Card className="p-4 flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[220px]">
          <Input
            leftIcon={Search}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, email o RUT…"
          />
        </div>
        <div className="inline-flex items-center gap-1.5">
          <Filter className="w-4 h-4 text-ink-500" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-10 rounded-xl border border-ink-200 bg-white px-3 text-sm"
          >
            {Object.entries(FILTERS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div className="inline-flex items-center gap-1.5">
          <ArrowUpDown className="w-4 h-4 text-ink-500" />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="h-10 rounded-xl border border-ink-200 bg-white px-3 text-sm"
          >
            {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      </Card>

      {loading ? (
        <div className="py-16 flex justify-center"><Spinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title={items.length === 0 ? 'Sin pacientes todavía' : 'Sin resultados'}
            description={items.length === 0
              ? 'Cuando reserves la primera consulta con un paciente, aparecerá aquí.'
              : 'Probá ajustar la búsqueda o los filtros.'}
          />
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p, idx) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: idx * 0.03 }}
            >
              <Link to={`/doctor/patients/${p.id}`} className="block group h-full">
                <Card className="p-5 h-full group-hover:border-brand-200 transition-colors flex flex-col">
                  {/* Header */}
                  <div className="flex items-start gap-3">
                    <Avatar name={p.name} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-ink-900 truncate">{p.name}</div>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {p.age !== null && (
                          <span className="text-[11px] text-ink-500">{p.age} años</span>
                        )}
                        {p.is_minor && (
                          <span className={cn(
                            'text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full border',
                            p.has_legal_guardian
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-rose-100 text-rose-700 border-rose-200',
                          )}>
                            Menor{!p.has_legal_guardian && ' · sin tutor'}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-ink-400 group-hover:text-brand-600 transition-colors mt-1" />
                  </div>

                  {/* Contacto */}
                  <div className="mt-3 space-y-0.5">
                    <div className="text-[11px] text-ink-500 flex items-center gap-1 truncate">
                      <Mail className="w-3 h-3" /> {p.email}
                    </div>
                    {p.phone && (
                      <div className="text-[11px] text-ink-500 flex items-center gap-1 truncate">
                        <Phone className="w-3 h-3" /> {p.phone}
                      </div>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    {/* Ánimo */}
                    <div className={cn('rounded-xl p-2.5 text-center border', moodToneClass(p.mood_latest_score))}>
                      <div className="text-[10px] uppercase tracking-wide font-semibold opacity-70 mb-0.5 flex items-center justify-center gap-1">
                        <Heart className="w-2.5 h-2.5" /> Ánimo
                      </div>
                      {p.mood_latest_score != null ? (
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-base leading-none">{EMOJI[p.mood_latest_score]}</span>
                          <span className="text-xs font-bold tabular-nums">{p.mood_latest_score}/10</span>
                        </div>
                      ) : (
                        <div className="text-xs opacity-50">—</div>
                      )}
                    </div>

                    {/* Próxima cita */}
                    <div className="rounded-xl bg-ink-50 border border-ink-100 p-2.5 text-center">
                      <div className="text-[10px] uppercase tracking-wide font-semibold text-ink-500 mb-0.5 flex items-center justify-center gap-1">
                        <Calendar className="w-2.5 h-2.5" /> Próxima
                      </div>
                      {p.next_appointment_date ? (
                        <div className="text-xs font-bold text-ink-700">
                          {format(parseISO(p.next_appointment_date), 'd MMM', { locale: es })}
                          {p.next_appointment_time && <span className="text-[10px] text-ink-500 ml-1">{p.next_appointment_time}</span>}
                        </div>
                      ) : (
                        <div className="text-xs text-ink-400">—</div>
                      )}
                    </div>

                    {/* Tareas */}
                    <div className="rounded-xl bg-ink-50 border border-ink-100 p-2.5 text-center">
                      <div className="text-[10px] uppercase tracking-wide font-semibold text-ink-500 mb-0.5 flex items-center justify-center gap-1">
                        <ClipboardList className="w-2.5 h-2.5" /> Tareas
                      </div>
                      <div className={cn('text-xs font-bold tabular-nums', p.pending_homework > 0 ? 'text-amber-700' : 'text-ink-500')}>
                        {p.pending_homework} pend.
                      </div>
                    </div>

                    {/* Tutores */}
                    <div className="rounded-xl bg-ink-50 border border-ink-100 p-2.5 text-center">
                      <div className="text-[10px] uppercase tracking-wide font-semibold text-ink-500 mb-0.5 flex items-center justify-center gap-1">
                        <Shield className="w-2.5 h-2.5" /> Tutores
                      </div>
                      <div className="text-xs font-bold tabular-nums text-ink-700">{p.tutors_count}</div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="mt-3 pt-3 border-t border-ink-100 flex items-center justify-between text-[11px] text-ink-500">
                    <span>{p.appointments_total} {p.appointments_total === 1 ? 'consulta' : 'consultas'}</span>
                    {p.last_appointment_date && (
                      <span>
                        Última: {format(parseISO(p.last_appointment_date), 'd MMM yyyy', { locale: es })}
                      </span>
                    )}
                  </div>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
