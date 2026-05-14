import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Building2, Users, TrendingUp, Calendar, Sparkles, ToggleLeft, ToggleRight,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { companiesApi } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { Card } from '../../components/ui/Card'
import { Avatar } from '../../components/ui/Avatar'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { fadeInUp } from '../../lib/motion'
import ExportButton from '../../components/ui/ExportButton'

export default function CompanyDashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState(null)
  const [usage, setUsage] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [anonymized, setAnonymized] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const [s, u, m] = await Promise.all([
        companiesApi.myStats(),
        companiesApi.myUsage(60, anonymized),
        companiesApi.myMembers(),
      ])
      setStats(s.data)
      setUsage(u.data)
      setMembers(m.data)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No se pudo cargar')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [anonymized])

  if (loading || !stats) {
    return <div className="py-16 flex justify-center"><Spinner size="lg" /></div>
  }

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Buen día'
    if (h < 19) return 'Buenas tardes'
    return 'Buenas noches'
  })()

  const trend = stats.sessions_used_last_month > 0
    ? Math.round(((stats.sessions_used_this_month - stats.sessions_used_last_month) / stats.sessions_used_last_month) * 100)
    : null

  return (
    <div className="space-y-8">
      {/* Hero */}
      <motion.div {...fadeInUp}>
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-800 to-ink-900 p-8 sm:p-10 text-white">
          <div className="absolute -top-24 -right-12 w-72 h-72 rounded-full bg-brand-400/30 blur-3xl" />
          <div className="absolute -bottom-20 -left-10 w-72 h-72 rounded-full bg-wellness-400/20 blur-3xl" />
          <div className="absolute inset-0 bg-grid-dark opacity-40" />

          <div className="relative">
            <div className="inline-flex items-center gap-1.5 text-xs text-white/70 mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tightest leading-tight">
              {greeting}, {user?.first_name}.
            </h1>
            <p className="text-white/70 mt-2">
              {stats.name} · {stats.members_active} empleado{stats.members_active !== 1 && 's'} activo{stats.members_active !== 1 && 's'}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Stats grandes */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Pool disponible" value={stats.sessions_pool} icon={TrendingUp} hue="brand" subtitle="sesiones" />
        <StatCard label="Usadas totales" value={stats.sessions_used} icon={Sparkles} hue="wellness" subtitle="histórico" />
        <StatCard label="Este mes" value={stats.sessions_used_this_month} icon={Calendar} hue="amber" subtitle={trend !== null ? `${trend >= 0 ? '+' : ''}${trend}% vs mes anterior` : 'primer mes'} />
        <StatCard label="Empleados activos" value={stats.members_active} icon={Users} hue="rose" subtitle={`de ${stats.members_total} totales`} />
      </div>

      {/* Usage list */}
      <Card>
        <div className="px-5 py-4 border-b border-ink-100 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-base font-semibold inline-flex items-center gap-2">
              <Calendar className="w-4 h-4 text-brand-600" /> Sesiones usadas
            </h2>
            <p className="text-xs text-ink-500 mt-0.5">
              Últimos 60 días · {usage.length} sesiones
              {anonymized && <span className="ml-1 italic">(anonimizado)</span>}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setAnonymized((a) => !a)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-600 hover:text-ink-900"
            >
              {anonymized ? <ToggleLeft className="w-5 h-5" /> : <ToggleRight className="w-5 h-5 text-brand-600" />}
              {anonymized ? 'Anonimizado' : 'Ver nombres'}
            </button>
            <ExportButton endpoint={`/exports/company/${stats.company_id}/usage`} filename={`uso_${stats.name}.xlsx`} label="Excel" />
          </div>
        </div>

        {usage.length === 0 ? (
          <EmptyState icon={Calendar} title="Sin sesiones todavía" description="Las sesiones cubiertas por la empresa aparecerán acá." />
        ) : (
          <ul className="divide-y divide-ink-100 max-h-96 overflow-y-auto">
            {usage.map((u) => (
              <li key={u.appointment_id} className="px-5 py-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center font-bold text-xs">
                  {format(parseISO(u.date), 'd MMM', { locale: es })}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-ink-800 truncate">
                    {u.employee_name || <em className="text-ink-400">Empleado #{u.appointment_id}</em>}
                  </div>
                  <div className="text-[11px] text-ink-500">{u.specialty || 'Consulta'} · {u.status}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Members */}
      <Card>
        <div className="px-5 py-4 border-b border-ink-100">
          <h2 className="text-base font-semibold inline-flex items-center gap-2">
            <Users className="w-4 h-4 text-brand-600" /> Empleados con beneficio activo
          </h2>
          <p className="text-xs text-ink-500 mt-0.5">{members.filter((m) => m.is_active).length} activos · {members.length} totales</p>
        </div>
        {members.length === 0 ? (
          <EmptyState icon={Users} title="Sin empleados" description="Contacta al admin de Calmar para sumar empleados." />
        ) : (
          <ul className="divide-y divide-ink-100">
            {members.map((m) => (
              <li key={m.id} className="px-5 py-3 flex items-center gap-3">
                <Avatar name={m.patient_name} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-ink-900 truncate">{m.patient_name}</div>
                  <div className="text-[11px] text-ink-500 truncate">{m.patient_email}</div>
                </div>
                <div className="text-xs text-ink-500">
                  {m.sessions_used} {m.sessions_used === 1 ? 'sesión' : 'sesiones'}
                </div>
                {!m.is_active && (
                  <span className="text-[10px] uppercase font-bold bg-ink-100 text-ink-600 px-2 py-0.5 rounded-full">Inactivo</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}


function StatCard({ label, value, icon: Icon, hue, subtitle }) {
  const colors = {
    brand:    'bg-brand-50 text-brand-600',
    wellness: 'bg-wellness-50 text-wellness-600',
    amber:    'bg-amber-50 text-amber-600',
    rose:     'bg-rose-50 text-rose-600',
  }
  return (
    <Card className="p-5">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors[hue]}`}>
        <Icon className="w-5 h-5" strokeWidth={2} />
      </div>
      <div className="mt-3">
        <div className="text-3xl font-bold tracking-tight tabular-nums">{value}</div>
        <div className="text-xs text-ink-500 mt-0.5">{label}</div>
        {subtitle && <div className="text-[10px] text-ink-400 mt-0.5">{subtitle}</div>}
      </div>
    </Card>
  )
}
