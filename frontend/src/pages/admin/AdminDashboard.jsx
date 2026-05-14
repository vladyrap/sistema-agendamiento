import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Users, Stethoscope, CalendarDays, UserCircle, TrendingUp } from 'lucide-react'
import { adminApi } from '../../services/api'
import { Card, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'
import { fadeInUp, stagger, staggerItem } from '../../lib/motion'

const statusLabels = {
  scheduled: 'Agendadas',
  confirmed: 'Confirmadas',
  cancelled: 'Canceladas',
  completed: 'Completadas',
  no_show:   'No asistieron',
}

const statusColors = {
  scheduled: 'bg-brand-500',
  confirmed: 'bg-wellness-500',
  cancelled: 'bg-red-500',
  completed: 'bg-ink-400',
  no_show:   'bg-amber-500',
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminApi.getStats().then((r) => setStats(r.data)).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="py-16 flex justify-center"><Spinner size="lg" /></div>
  if (!stats) return null

  const total = Object.values(stats.appointments_by_status || {}).reduce((a, b) => a + b, 0)

  return (
    <motion.div {...fadeInUp} className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Panel de control</h1>
        <p className="text-sm text-ink-500 mt-1">Resumen general del sistema.</p>
      </div>

      {/* KPIs */}
      <motion.div variants={stagger()} initial="initial" animate="animate" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Usuarios',  value: stats.total_users,        icon: Users,        hue: 'brand'    },
          { label: 'Pacientes', value: stats.total_patients,     icon: UserCircle,   hue: 'wellness' },
          { label: 'Psicólogos/as', value: stats.total_doctors,  icon: Stethoscope,  hue: 'amber'    },
          { label: 'Citas',     value: stats.total_appointments, icon: CalendarDays, hue: 'rose'     },
        ].map((s) => (
          <motion.div key={s.label} variants={staggerItem}>
            <Card className="p-5 relative overflow-hidden">
              <div className={`absolute -bottom-6 -right-6 w-24 h-24 rounded-full opacity-30 blur-2xl ${
                s.hue === 'brand'    ? 'bg-brand-300' :
                s.hue === 'wellness' ? 'bg-wellness-300' :
                s.hue === 'amber'    ? 'bg-amber-300' :
                                       'bg-rose-300'
              }`} />
              <div className={`relative w-10 h-10 rounded-xl flex items-center justify-center ${
                s.hue === 'brand'    ? 'bg-brand-50 text-brand-600' :
                s.hue === 'wellness' ? 'bg-wellness-50 text-wellness-600' :
                s.hue === 'amber'    ? 'bg-amber-50 text-amber-600' :
                                       'bg-rose-50 text-rose-600'
              }`}>
                <s.icon className="w-5 h-5" strokeWidth={2} />
              </div>
              <div className="relative mt-4">
                <div className="text-3xl font-bold tracking-tight tabular-nums">{s.value}</div>
                <div className="text-xs text-ink-500 mt-1 font-medium">{s.label}</div>
              </div>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Citas por estado */}
      <Card className="p-6 sm:p-7">
        <CardHeader className="p-0 pb-5">
          <CardTitle>Citas por estado</CardTitle>
          <CardDescription>Distribución actual del total de citas registradas.</CardDescription>
        </CardHeader>

        {total === 0 ? (
          <div className="py-8 text-center text-sm text-ink-500">Aún no hay datos suficientes.</div>
        ) : (
          <>
            {/* Barra apilada */}
            <div className="h-3 rounded-full overflow-hidden bg-ink-100 flex">
              {Object.entries(stats.appointments_by_status).map(([k, v]) => (
                <div
                  key={k}
                  title={`${statusLabels[k] || k}: ${v}`}
                  className={statusColors[k] || 'bg-ink-500'}
                  style={{ width: `${(v / total) * 100}%` }}
                />
              ))}
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-5">
              {Object.entries(stats.appointments_by_status).map(([k, v]) => {
                const pct = ((v / total) * 100).toFixed(1)
                return (
                  <div key={k} className="flex items-center justify-between p-3 rounded-xl border border-ink-100 bg-ink-50/50">
                    <div className="flex items-center gap-2.5">
                      <span className={`w-2 h-2 rounded-full ${statusColors[k] || 'bg-ink-500'}`} />
                      <span className="text-sm font-medium text-ink-700">{statusLabels[k] || k}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold tabular-nums">{v}</div>
                      <div className="text-[10px] text-ink-400 tabular-nums">{pct}%</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </Card>

      {/* Hint */}
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-brand-50 border border-brand-100">
        <TrendingUp className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />
        <div className="text-sm text-ink-700">
          Para gráficos en tiempo real, abre Grafana vía SSH tunnel — los dashboards de Prometheus muestran latencia,
          volumen de reservas y notificaciones procesadas.
        </div>
      </div>
    </motion.div>
  )
}
