import React, { useEffect, useState } from 'react'
import { ClipboardList } from 'lucide-react'
import toast from 'react-hot-toast'
import { homeworkApi } from '../../services/api'
import { Card } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import HomeworkItem from './HomeworkItem'
import AssignHomeworkForm from './AssignHomeworkForm'
import ExportButton from '../../components/ui/ExportButton'

/**
 * Sección de tareas en la ficha del paciente (vista del doctor).
 * Permite asignar nuevas, ver lista actual con su estado.
 */
export default function PatientHomeworkSection({ patientId, canAssign = true }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // 'all' | 'pending' | 'completed'

  async function load() {
    setLoading(true)
    try {
      const r = await homeworkApi.byPatient(patientId, filter === 'all' ? undefined : filter)
      setItems(r.data)
    } catch {
      toast.error('No se pudieron cargar las tareas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [patientId, filter])

  const pending = items.filter((i) => i.status === 'pending').length
  const completed = items.filter((i) => i.status === 'completed').length

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-semibold inline-flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-brand-600" />
          Tareas entre sesiones
          <span className="text-xs text-ink-500 font-normal">
            · {pending} pendientes · {completed} completadas
          </span>
        </h3>

        <div className="flex items-center gap-2">
          <ExportButton endpoint={`/exports/homework/patient/${patientId}`} filename="tareas.xlsx" label="Excel" size="sm" />
          {canAssign && (
            <AssignHomeworkForm patientId={patientId} onCreated={load} />
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="inline-flex rounded-lg bg-ink-100 p-0.5">
        {[
          { id: 'all',       label: 'Todas' },
          { id: 'pending',   label: 'Pendientes' },
          { id: 'completed', label: 'Completadas' },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
              filter === f.id ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-600 hover:text-ink-900'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-8 flex justify-center"><Spinner /></div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Sin tareas todavía"
          description={canAssign ? "Asigna la primera tarea con el botón de arriba." : ""}
        />
      ) : (
        <div className="space-y-2.5">
          {items.map((hw) => (
            <HomeworkItem key={hw.id} hw={hw} role="doctor" compact onChanged={load} />
          ))}
        </div>
      )}
    </Card>
  )
}
