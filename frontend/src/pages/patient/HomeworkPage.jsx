import React, { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { ClipboardList, Check, Circle, TrendingUp, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { homeworkApi } from '../../services/api'
import { Card } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import HomeworkItem from '../../components/homework/HomeworkItem'
import { fadeInUp } from '../../lib/motion'

export default function HomeworkPage() {
  const [items, setItems] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending') // 'pending' | 'completed' | 'all'

  async function load() {
    setLoading(true)
    try {
      const [r1, r2] = await Promise.all([
        homeworkApi.mine(filter === 'all' ? undefined : filter),
        homeworkApi.myStats(),
      ])
      setItems(r1.data)
      setStats(r2.data)
    } catch {
      toast.error('No se pudieron cargar tus tareas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [filter])

  return (
    <div className="space-y-7">
      <motion.div {...fadeInUp}>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tightest">Tareas entre sesiones</h1>
        <p className="text-ink-500 text-sm mt-1">
          Ejercicios y tareas asignadas por tu profesional. Marcalas a medida que las hagas — tu profesional verá tu avance.
        </p>
      </motion.div>

      {/* Stats */}
      {stats && stats.total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Pendientes" value={stats.pending} icon={Circle} hue="brand" />
          <StatCard label="Completadas" value={stats.completed} icon={Check} hue="wellness" />
          <StatCard label="Vencidas" value={stats.overdue} icon={AlertCircle} hue="rose" />
          <StatCard
            label="Completadas"
            value={stats.completion_rate !== null ? `${Math.round((stats.completion_rate || 0) * 100)}%` : '—'}
            icon={TrendingUp}
            hue="amber"
          />
        </div>
      )}

      {/* Filtros */}
      <div className="inline-flex rounded-xl bg-ink-100 p-1">
        {[
          { id: 'pending',   label: 'Pendientes' },
          { id: 'completed', label: 'Completadas' },
          { id: 'all',       label: 'Todas' },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3.5 py-1.5 text-sm font-semibold rounded-lg transition-colors ${
              filter === f.id ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-600 hover:text-ink-900'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="py-12 flex justify-center"><Spinner /></div>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            icon={ClipboardList}
            title={
              filter === 'pending'
                ? 'No tienes tareas pendientes'
                : filter === 'completed'
                  ? 'Aún no has completado ninguna tarea'
                  : 'No tienes tareas asignadas'
            }
            description={
              filter === 'pending'
                ? '¡Genial! Estás al día.'
                : 'Cuando tu profesional te asigne tareas, las verás aquí.'
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((hw) => (
            <HomeworkItem key={hw.id} hw={hw} role="patient" onChanged={load} />
          ))}
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, icon: Icon, hue }) {
  const colors = {
    brand:    'bg-brand-50 text-brand-600',
    wellness: 'bg-wellness-50 text-wellness-600',
    rose:     'bg-rose-50 text-rose-600',
    amber:    'bg-amber-50 text-amber-600',
  }
  return (
    <Card className="p-5">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors[hue]}`}>
        <Icon className="w-5 h-5" strokeWidth={2} />
      </div>
      <div className="mt-3">
        <div className="text-2xl font-bold tracking-tight tabular-nums">{value}</div>
        <div className="text-xs text-ink-500 mt-0.5">{label}</div>
      </div>
    </Card>
  )
}
