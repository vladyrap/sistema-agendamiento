import React, { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  FileText, Plus, Pencil, Trash2, CalendarClock, User, Sparkles, Filter,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { externalTestsApi } from '../../services/api'
import { Card } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import ExternalTestForm from './ExternalTestForm'
import { cn } from '../../lib/cn'

const CATEGORY_TONE = {
  'Cognición':              'bg-brand-100 text-brand-700 border-brand-200',
  'Personalidad':           'bg-violet-100 text-violet-700 border-violet-200',
  'Proyectivos':            'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200',
  'Depresión/Ansiedad':     'bg-rose-100 text-rose-700 border-rose-200',
  'Trastornos alimentarios':'bg-amber-100 text-amber-700 border-amber-200',
  'TOC':                    'bg-cyan-100 text-cyan-700 border-cyan-200',
  'Trauma':                 'bg-rose-100 text-rose-700 border-rose-200',
  'Autismo':                'bg-sky-100 text-sky-700 border-sky-200',
  'Infanto-juvenil':        'bg-wellness-100 text-wellness-700 border-wellness-200',
  'Adicciones':             'bg-amber-100 text-amber-800 border-amber-200',
  'Otros':                  'bg-ink-100 text-ink-700 border-ink-200',
}

/**
 * Sección en la ficha del paciente que muestra tests aplicados externamente.
 *
 * Props:
 *  - patientId
 *  - canManage (bool) — doctor/admin pueden crear/editar/borrar
 */
export default function ExternalTestsSection({ patientId, canManage = true, className = '' }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  async function load() {
    setLoading(true)
    try {
      const r = await externalTestsApi.forPatient(patientId)
      setItems(r.data)
    } catch {
      toast.error('No se pudieron cargar los tests externos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [patientId])

  const availableCategories = useMemo(() => {
    const set = new Set()
    items.forEach((t) => { if (t.category) set.add(t.category) })
    return Array.from(set).sort()
  }, [items])

  const filtered = useMemo(() => {
    return items.filter((t) => {
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false
      if (fromDate && t.applied_at && t.applied_at < fromDate) return false
      if (toDate && t.applied_at && t.applied_at > toDate) return false
      return true
    })
  }, [items, categoryFilter, fromDate, toDate])

  async function remove(t) {
    if (!window.confirm(`¿Borrar el registro del test "${t.test_name}"?`)) return
    try {
      await externalTestsApi.remove(t.id)
      toast.success('Eliminado')
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al borrar')
    }
  }

  return (
    <Card className={cn('p-6 space-y-4', className)}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold inline-flex items-center gap-2">
            <FileText className="w-4 h-4 text-brand-600" /> Tests aplicados externamente
            <span className="text-xs text-ink-500 font-normal">· {items.length} registros</span>
          </h3>
          <p className="text-xs text-ink-500 mt-0.5">
            Resultados de tests con copyright o aplicados presencialmente (WAIS, Rorschach, MMPI, BDI, MoCA…).
          </p>
        </div>
        {canManage && !adding && !editing && (
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold bg-white text-ink-700 border border-ink-200 hover:bg-brand-50 hover:border-brand-300"
          >
            <Plus className="w-4 h-4" /> Registrar resultado
          </button>
        )}
      </div>

      {(adding || editing) && (
        <ExternalTestForm
          patientId={patientId}
          test={editing}
          onSaved={() => { setAdding(false); setEditing(null); load() }}
          onCancel={() => { setAdding(false); setEditing(null) }}
        />
      )}

      {items.length > 1 && !adding && !editing && (
        <div className="flex items-center gap-2 flex-wrap text-xs border-t border-ink-100 pt-3">
          <div className="inline-flex items-center gap-1.5">
            <Filter className="w-3 h-3 text-ink-400" />
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="h-8 rounded-lg border border-ink-200 bg-white px-2 text-xs">
              <option value="all">Todas las categorías</option>
              {availableCategories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <label className="inline-flex items-center gap-1 text-ink-600">
            Desde
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-8 rounded-lg border border-ink-200 bg-white px-2 text-xs" />
          </label>
          <label className="inline-flex items-center gap-1 text-ink-600">
            Hasta
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-8 rounded-lg border border-ink-200 bg-white px-2 text-xs" />
          </label>
          {(categoryFilter !== 'all' || fromDate || toDate) && (
            <button type="button" onClick={() => { setCategoryFilter('all'); setFromDate(''); setToDate('') }} className="text-ink-500 hover:text-ink-900 underline">
              Limpiar
            </button>
          )}
          <span className="text-[10px] text-ink-400 ml-auto">
            {filtered.length === items.length ? `${items.length}` : `${filtered.length} de ${items.length}`}
          </span>
        </div>
      )}

      {loading ? (
        <div className="py-8 flex justify-center"><Spinner /></div>
      ) : items.length === 0 ? (
        !adding && (
          <EmptyState
            icon={FileText}
            title="Sin tests registrados"
            description={canManage ? "Registrá el resultado de un test aplicado offline (WAIS, Rorschach, MMPI, etc.)." : ""}
          />
        )
      ) : (
        <div className="space-y-2.5">
          {filtered.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-ink-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-ink-900">{t.test_name}</span>
                    {t.category && (
                      <span className={cn(
                        'inline-flex items-center text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border',
                        CATEGORY_TONE[t.category] || CATEGORY_TONE['Otros'],
                      )}>
                        {t.category}
                      </span>
                    )}
                    {t.severity_label && (
                      <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-ink-100 text-ink-700 border border-ink-200">
                        {t.severity_label}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mt-1.5 text-[11px] text-ink-500 flex-wrap">
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="w-3 h-3" />
                      Aplicado el {format(parseISO(t.applied_at), "d 'de' MMM yyyy", { locale: es })}
                    </span>
                    {t.doctor_name && (
                      <span className="inline-flex items-center gap-1">
                        <User className="w-3 h-3" /> {t.doctor_name}
                      </span>
                    )}
                    {t.follow_up_date && (
                      <span className="inline-flex items-center gap-1 text-brand-600 font-medium">
                        <Sparkles className="w-3 h-3" />
                        Re-evaluar el {format(parseISO(t.follow_up_date), "d MMM yyyy", { locale: es })}
                      </span>
                    )}
                  </div>

                  {t.score && (
                    <div className="mt-2 text-sm text-ink-800">
                      <span className="font-semibold">Score:</span> <span className="tabular-nums">{t.score}</span>
                    </div>
                  )}

                  {t.interpretation && (
                    <div className="mt-2 rounded-xl bg-ink-50/70 border border-ink-100 p-3 text-sm text-ink-700 leading-relaxed whitespace-pre-wrap">
                      {t.interpretation}
                    </div>
                  )}
                </div>

                {canManage && (
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <button
                      onClick={() => setEditing(t)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-ink-600 hover:bg-ink-100 px-2 py-1 rounded-lg"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Editar
                    </button>
                    <button
                      onClick={() => remove(t)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:bg-rose-50 px-2 py-1 rounded-lg"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Borrar
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </Card>
  )
}
